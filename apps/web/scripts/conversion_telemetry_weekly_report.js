#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function formatTimestamp(date = new Date()) {
    const yyyy = String(date.getUTCFullYear());
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const hh = String(date.getUTCHours()).padStart(2, "0");
    const mi = String(date.getUTCMinutes()).padStart(2, "0");
    const ss = String(date.getUTCSeconds()).padStart(2, "0");
    return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function readSegmentAlerts(segments = []) {
    return segments
        .filter((segment) => {
            const formStarts = segment?.summary?.formStarts || 0;
            const completionRate = segment?.summary?.completionRateFromFormStart || 0;
            return formStarts >= 5 && completionRate < 0.2;
        })
        .slice(0, 10)
        .map((segment) => ({
            segment: segment.segment,
            formStarts: segment.summary.formStarts,
            completionRateFromFormStart: segment.summary.completionRateFromFormStart,
        }));
}

const REQUIRED_FUNNEL_EVENTS = [
    "page_view",
    "cta_click",
    "form_start",
    "captcha_pass",
    "captcha_fail",
    "submit_success",
    "submit_fail",
];
const UNKNOWN_SEGMENT = "unknown";
const OTHER_SEGMENT = "__other__";
const DIRECT_CHANNEL = "direct";
const ORGANIC_CHANNEL = "organic";
const PAID_CHANNEL = "paid";
const PAID_CHANNEL_HINTS = [
    "paid",
    "cpc",
    "ppc",
    "ads",
    "adwords",
    "paid_social",
    "meta",
    "facebook",
    "instagram",
    "google_ads",
    "bing_ads",
    "tiktok_ads",
];
const DIRECT_CHANNEL_EXACT_MATCH = new Set([
    "",
    UNKNOWN_SEGMENT,
    OTHER_SEGMENT,
    "direct",
    "(direct)",
    "none",
    "na",
]);

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listMatchingReports(directory, prefix) {
    if (!fs.existsSync(directory)) {
        return [];
    }

    return fs
        .readdirSync(directory)
        .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
        .map((name) => path.join(directory, name))
        .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
}

function parseBoolean(value, fallback) {
    if (typeof value !== "string") {
        return fallback;
    }

    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
        return true;
    }

    if (["0", "false", "no", "off"].includes(normalized)) {
        return false;
    }

    return fallback;
}

function parseInteger(value, fallback) {
    const parsed = Number.parseInt(String(value || ""), 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
    }

    return fallback;
}

function resolveTelemetryTimestamp(sourceMode, payload) {
    if (sourceMode === "live") {
        return payload?.telemetry?.generatedAt || null;
    }

    return payload?.generatedAt || null;
}

function evaluateFreshness(sourceTimestamp, freshnessWindowMinutes, now) {
    if (!sourceTimestamp || typeof sourceTimestamp !== "string") {
        return {
            isFresh: false,
            ageMinutes: null,
            freshnessWindowMinutes,
            failureCode: "source_timestamp_missing",
        };
    }

    const parsed = new Date(sourceTimestamp);
    if (Number.isNaN(parsed.getTime())) {
        return {
            isFresh: false,
            ageMinutes: null,
            freshnessWindowMinutes,
            failureCode: "source_timestamp_invalid",
        };
    }

    const ageMinutes = Number(
        ((now.getTime() - parsed.getTime()) / (60 * 1000)).toFixed(2)
    );

    if (ageMinutes > freshnessWindowMinutes) {
        return {
            isFresh: false,
            ageMinutes,
            freshnessWindowMinutes,
            failureCode: "source_stale",
        };
    }

    return {
        isFresh: true,
        ageMinutes,
        freshnessWindowMinutes,
        failureCode: null,
    };
}

function resolveSeededReport(reportsDir, explicitPath) {
    if (explicitPath) {
        return path.resolve(explicitPath);
    }

    const candidates = listMatchingReports(reportsDir, "wave5-conversion-trend-");
    if (candidates.length === 0) {
        return null;
    }

    return candidates[candidates.length - 1];
}

function validateRequiredEvents(events) {
    const safeEvents = events && typeof events === "object" ? events : {};
    const present = REQUIRED_FUNNEL_EVENTS.filter((eventName) =>
        Number.isFinite(Number(safeEvents[eventName]))
    );
    const missing = REQUIRED_FUNNEL_EVENTS.filter(
        (eventName) => !present.includes(eventName)
    );

    return {
        required: REQUIRED_FUNNEL_EVENTS,
        present,
        missing,
        pass: missing.length === 0,
    };
}

function summarizeSegments(segments = []) {
    const total = Array.isArray(segments) ? segments.length : 0;
    const known = (Array.isArray(segments) ? segments : []).filter((item) => {
        const segment = item?.segment;
        if (typeof segment !== "string") {
            return false;
        }

        return segment !== UNKNOWN_SEGMENT && segment !== OTHER_SEGMENT;
    }).length;

    return {
        total,
        known,
        pass: known > 0,
    };
}

function evaluateDataQuality({ funnelDaily, freshness, minQualityScore }) {
    const requiredEvents = validateRequiredEvents(funnelDaily?.events);
    const routeSegments = summarizeSegments(funnelDaily?.segmentation?.byRoute || []);
    const campaignSegments = summarizeSegments(
        funnelDaily?.segmentation?.byCampaign || []
    );

    const requiredCoverage =
        requiredEvents.required.length === 0
            ? 0
            : requiredEvents.present.length / requiredEvents.required.length;

    const qualityScore = Number(
        (
            requiredCoverage * 40 +
            (routeSegments.pass ? 15 : 0) +
            (campaignSegments.pass ? 15 : 0) +
            (freshness.isFresh ? 30 : 0)
        ).toFixed(2)
    );

    const status =
        !requiredEvents.pass || !freshness.isFresh
            ? "fail"
            : qualityScore >= minQualityScore
              ? "pass"
              : "warning";

    return {
        status,
        qualityScore,
        minQualityScore,
        checks: {
            requiredEvents,
            segmentation: {
                route: routeSegments,
                campaign: campaignSegments,
            },
            freshness: {
                pass: freshness.isFresh,
                ageMinutes: freshness.ageMinutes,
                freshnessWindowMinutes: freshness.freshnessWindowMinutes,
            },
        },
    };
}

function classifyCampaignChannel(segmentValue) {
    const normalized =
        typeof segmentValue === "string" ? segmentValue.trim().toLowerCase() : "";

    if (DIRECT_CHANNEL_EXACT_MATCH.has(normalized)) {
        return DIRECT_CHANNEL;
    }

    if (PAID_CHANNEL_HINTS.some((hint) => normalized.includes(hint))) {
        return PAID_CHANNEL;
    }

    return ORGANIC_CHANNEL;
}

function aggregateChannelBreakdown(campaignSegments = []) {
    const buckets = new Map();

    for (const segment of Array.isArray(campaignSegments) ? campaignSegments : []) {
        const channel = classifyCampaignChannel(segment?.segment);
        const summary = segment?.summary || {};

        const bucket = buckets.get(channel) || {
            channel,
            formStarts: 0,
            submitSuccess: 0,
            captchaPass: 0,
            captchaFail: 0,
            segments: [],
        };

        bucket.formStarts += Number(summary.formStarts || 0);
        bucket.submitSuccess += Number(summary.submitSuccess || 0);
        bucket.captchaPass += Number(summary.captchaPass || 0);
        bucket.captchaFail += Number(summary.captchaFail || 0);
        bucket.segments.push(typeof segment?.segment === "string" ? segment.segment : "unknown");

        buckets.set(channel, bucket);
    }

    return [ORGANIC_CHANNEL, PAID_CHANNEL, DIRECT_CHANNEL]
        .map((channel) => buckets.get(channel))
        .filter(Boolean)
        .map((bucket) => {
            const captchaAttempts = bucket.captchaPass + bucket.captchaFail;
            return {
                channel: bucket.channel,
                formStarts: bucket.formStarts,
                submitSuccess: bucket.submitSuccess,
                completionRateFromFormStart:
                    bucket.formStarts > 0
                        ? Number((bucket.submitSuccess / bucket.formStarts).toFixed(4))
                        : 0,
                captchaFailRate:
                    captchaAttempts > 0
                        ? Number((bucket.captchaFail / captchaAttempts).toFixed(4))
                        : 0,
                segmentCount: bucket.segments.length,
                segments: bucket.segments.slice(0, 10),
            };
        });
}

async function main() {
    const workspaceRoot = path.resolve(__dirname, "../../..");
    const reportsDir = path.join(workspaceRoot, "docs", "reports");
    const baseUrl = (process.argv[2] || process.env.CONVERSION_TELEMETRY_BASE_URL || "https://autoapply.works").replace(/\/$/, "");
    const diagnosticsToken = process.env.CONTACT_DIAGNOSTICS_TOKEN?.trim();
    const configPath = path.join(
        __dirname,
        "..",
        "config",
        "conversion-telemetry-source.json"
    );
    const config = fs.existsSync(configPath)
        ? readJson(configPath)
        : {};
    const allowSeededFallback = parseBoolean(
        process.env.CONVERSION_TELEMETRY_ALLOW_SEEDED_FALLBACK,
        Boolean(config.allowSeededFallback)
    );
    const freshnessWindowMinutes = parseInteger(
        process.env.CONVERSION_TELEMETRY_FRESHNESS_MINUTES,
        parseInteger(config.freshnessWindowMinutes, 180)
    );
    const fallbackWindowSize = parseInteger(
        process.env.CONVERSION_TELEMETRY_FALLBACK_WINDOW_SIZE,
        parseInteger(config.fallbackWindowSize, 3)
    );
    const maxFallbackReportsInWindow = parseInteger(
        process.env.CONVERSION_TELEMETRY_MAX_FALLBACK_REPORTS_IN_WINDOW,
        parseInteger(config.maxFallbackReportsInWindow, 0)
    );
    const minQualityScore = parseInteger(
        process.env.CONVERSION_TELEMETRY_MIN_QUALITY_SCORE,
        parseInteger(config.minQualityScore, 80)
    );
    const seededReportPath = resolveSeededReport(
        reportsDir,
        process.env.CONVERSION_TELEMETRY_SEEDED_REPORT
    );
    const reportPath =
        process.env.REPORT_PATH ||
        path.join(reportsDir, `wave6-conversion-trend-live-${formatTimestamp()}.json`);

    const sourceFailures = [];
    const now = new Date();
    let sourceMode = "live";
    let sourcePath = `${baseUrl}/api/contact/diagnostics`;
    let payload = {};

    if (diagnosticsToken) {
        const response = await fetch(`${baseUrl}/api/contact/diagnostics`, {
            method: "GET",
            headers: {
                "x-contact-diagnostics-token": diagnosticsToken,
            },
        });

        try {
            payload = await response.json();
        } catch {
            payload = {};
        }

        if (!response.ok) {
            sourceFailures.push(`live_fetch_failed_${response.status}`);
            payload = {};
        }
    } else {
        sourceFailures.push("live_token_missing");
    }

    if (!payload?.telemetry) {
        if (!allowSeededFallback) {
            console.error(
                "Live diagnostics unavailable and seeded fallback disabled.",
                sourceFailures
            );
            process.exit(1);
        }

        if (!seededReportPath || !fs.existsSync(seededReportPath)) {
            console.error("Seeded fallback requested but no seeded report was found.");
            process.exit(1);
        }

        sourceMode = "seeded";
        sourcePath = seededReportPath;
        payload = readJson(seededReportPath);
    }

    const telemetry = sourceMode === "live" ? payload?.telemetry || null : payload?.funnel ? payload : null;
    if (!telemetry) {
        console.error("Unable to resolve telemetry funnel payload.");
        process.exit(1);
    }

    const funnelDaily = telemetry?.funnel?.daily || null;
    const funnelWeekly = telemetry?.funnel?.weekly || null;
    const dailyAnomalies = funnelDaily?.summary?.anomalies || [];
    const weeklyAnomalies = funnelWeekly?.anomalies || [];
    const routeAlerts = readSegmentAlerts(funnelDaily?.segmentation?.byRoute || []);
    const campaignAlerts = readSegmentAlerts(funnelDaily?.segmentation?.byCampaign || []);
    const channelBreakdown = aggregateChannelBreakdown(
        funnelDaily?.segmentation?.byCampaign || []
    );
    const organicChannel = channelBreakdown.find(
        (entry) => entry.channel === ORGANIC_CHANNEL
    ) || {
        channel: ORGANIC_CHANNEL,
        formStarts: 0,
        submitSuccess: 0,
        completionRateFromFormStart: 0,
        captchaFailRate: 0,
        segmentCount: 0,
        segments: [],
    };

    const anomalyCount =
        dailyAnomalies.length +
        weeklyAnomalies.length +
        routeAlerts.length +
        campaignAlerts.length;

    const sourceTimestamp = resolveTelemetryTimestamp(sourceMode, payload);
    const freshness = evaluateFreshness(sourceTimestamp, freshnessWindowMinutes, now);

    const fallbackHistory = listMatchingReports(
        reportsDir,
        "wave6-conversion-trend-live-"
    )
        .slice(-fallbackWindowSize)
        .map((filePath) => {
            try {
                const report = readJson(filePath);
                return {
                    filePath,
                    sourceMode: report?.sourceMode || "unknown",
                };
            } catch {
                return {
                    filePath,
                    sourceMode: "unknown",
                };
            }
        });

    const fallbackReportsInWindow =
        fallbackHistory.filter((entry) => entry.sourceMode !== "live").length +
        (sourceMode !== "live" ? 1 : 0);
    const fallbackWindowExceeded =
        fallbackReportsInWindow > maxFallbackReportsInWindow;

    const failureCodes = [];
    if (!freshness.isFresh && freshness.failureCode) {
        failureCodes.push(freshness.failureCode);
    }
    if (fallbackWindowExceeded) {
        failureCodes.push("fallback_window_exceeded");
    }

    const dataQuality = evaluateDataQuality({
        funnelDaily,
        freshness,
        minQualityScore,
    });

    if (!dataQuality.checks.requiredEvents.pass) {
        failureCodes.push("required_funnel_events_missing");
    }
    if (!dataQuality.checks.segmentation.route.pass) {
        failureCodes.push("route_dimension_missing");
    }
    if (!dataQuality.checks.segmentation.campaign.pass) {
        failureCodes.push("campaign_dimension_missing");
    }
    if (dataQuality.qualityScore < minQualityScore) {
        failureCodes.push("quality_score_below_threshold");
    }

    const output = {
        generatedAt: now.toISOString(),
        baseUrl,
        source: sourcePath,
        sourceMode,
        sourceFailures,
        sourceFreshness: freshness,
        sourcePolicy: {
            allowSeededFallback,
            fallbackWindowSize,
            maxFallbackReportsInWindow,
            fallbackReportsInWindow,
            fallbackWindowExceeded,
        },
        status:
            failureCodes.length > 0
                ? "fail"
                : anomalyCount > 0
                  ? "alert"
                  : "pass",
        anomalyCount,
        failureCodes: Array.from(new Set(failureCodes)),
        dataQuality,
        keyMetrics: {
            dailyCompletionRateFromFormStart:
                funnelDaily?.summary?.completionRateFromFormStart ?? null,
            dailyCaptchaFailRate: funnelDaily?.summary?.captchaFailRate ?? null,
            weeklyCompletionRateLatest:
                funnelWeekly?.trend?.completionRateFromFormStart?.latest ?? null,
            weeklyCompletionRateBaseline:
                funnelWeekly?.trend?.completionRateFromFormStart?.baseline ?? null,
            weeklyCaptchaFailRateLatest:
                funnelWeekly?.trend?.captchaFailRate?.latest ?? null,
            weeklyCaptchaFailRateBaseline:
                funnelWeekly?.trend?.captchaFailRate?.baseline ?? null,
        },
        anomalies: {
            daily: dailyAnomalies,
            weekly: weeklyAnomalies,
            routeDropoff: routeAlerts,
            campaignDropoff: campaignAlerts,
        },
        channels: {
            classificationVersion: "wave7_v1",
            breakdown: channelBreakdown,
            organic: {
                ...organicChannel,
                hasMinimumSample: organicChannel.formStarts >= 5,
            },
        },
        funnel: {
            daily: funnelDaily,
            weekly: funnelWeekly,
        },
    };

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    console.log(`Wave 6 conversion trend report: ${reportPath}`);
    console.log(JSON.stringify(output, null, 2));

    if (failureCodes.length > 0) {
        process.exit(1);
    }
}

main().catch((error) => {
    console.error("Conversion trend report generation failed:", error);
    process.exit(1);
});
