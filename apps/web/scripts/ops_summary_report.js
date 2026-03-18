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

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listMatchingReports(directory, prefix, extension = ".json") {
    if (!fs.existsSync(directory)) {
        return [];
    }

    return fs
        .readdirSync(directory)
        .filter((name) => name.startsWith(prefix) && name.endsWith(extension))
        .map((name) => path.join(directory, name))
        .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
}

function toStatus(value, fallback = "unavailable") {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function classifyStatus(status) {
    const normalized = status.toLowerCase();
    if (normalized === "fail") {
        return "fail";
    }

    if (normalized.includes("alert") || normalized.includes("warning")) {
        return "warning";
    }

    if (normalized === "pass" || normalized === "pass_with_emergency_bypass") {
        return normalized;
    }

    return "unavailable";
}

function canonicalParityStatus(rawText) {
    if (rawText.includes("PASS canonical_og_parity_all_indexable")) {
        return "pass";
    }

    if (rawText.includes("FAIL")) {
        return "fail";
    }

    return "unavailable";
}

function readLatestFile(reportsDir, prefix, extension) {
    const candidates = listMatchingReports(reportsDir, prefix, extension);
    if (candidates.length === 0) {
        return null;
    }

    return candidates[candidates.length - 1];
}

function readLatestFromPrefixes(reportsDir, prefixes, extension = ".json") {
    const allCandidates = prefixes
        .flatMap((prefix) => listMatchingReports(reportsDir, prefix, extension))
        .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);

    if (allCandidates.length === 0) {
        return null;
    }

    return allCandidates[allCandidates.length - 1];
}

function createComponentSummary(name, status, detail, sourceReport) {
    return {
        name,
        status,
        detail,
        sourceReport,
    };
}

function appendAnomaly(list, anomaly) {
    if (!anomaly) {
        return;
    }

    list.push(anomaly);
}

function collectTopAnomalies(funnel, correlation) {
    const anomalies = [];
    const daily = Array.isArray(funnel?.anomalies?.daily) ? funnel.anomalies.daily : [];
    const weekly = Array.isArray(funnel?.anomalies?.weekly) ? funnel.anomalies.weekly : [];
    const routeDropoff = Array.isArray(funnel?.anomalies?.routeDropoff)
        ? funnel.anomalies.routeDropoff
        : [];
    const campaignDropoff = Array.isArray(funnel?.anomalies?.campaignDropoff)
        ? funnel.anomalies.campaignDropoff
        : [];

    for (const item of daily.slice(0, 2)) {
        appendAnomaly(anomalies, {
            source: "conversion_daily",
            label: item?.id || "daily_anomaly",
            detail: item?.message || "Daily conversion anomaly detected.",
            severity: item?.severity || "warning",
        });
    }

    for (const item of weekly.slice(0, 2)) {
        appendAnomaly(anomalies, {
            source: "conversion_weekly",
            label: item?.id || "weekly_anomaly",
            detail: item?.message || "Weekly conversion anomaly detected.",
            severity: item?.severity || "warning",
        });
    }

    for (const item of routeDropoff.slice(0, 2)) {
        appendAnomaly(anomalies, {
            source: "conversion_route_dropoff",
            label: item?.segment || "route_dropoff",
            detail: `Route ${item?.segment || "unknown"} completion ${
                item?.completionRateFromFormStart ?? "n/a"
            }`,
            severity: "warning",
        });
    }

    for (const item of campaignDropoff.slice(0, 2)) {
        appendAnomaly(anomalies, {
            source: "conversion_campaign_dropoff",
            label: item?.segment || "campaign_dropoff",
            detail: `Campaign ${item?.segment || "unknown"} completion ${
                item?.completionRateFromFormStart ?? "n/a"
            }`,
            severity: "warning",
        });
    }

    const correlationFlags = Array.isArray(correlation?.cooccurrenceFlags)
        ? correlation.cooccurrenceFlags
        : [];
    for (const item of correlationFlags.slice(0, 3)) {
        appendAnomaly(anomalies, {
            source: "perf_conversion_correlation",
            label: item?.route || "route",
            detail: `Perf + conversion co-occurrence on ${item?.route || "unknown"} (${item?.conversion?.dropPercentFromBaseline ?? "n/a"}% drop).`,
            severity: "warning",
        });
    }

    return anomalies.slice(0, 8);
}

function main() {
    const workspaceRoot = path.resolve(__dirname, "../../..");
    const reportsDir = path.resolve(
        process.env.OPS_REPORTS_DIR || path.join(workspaceRoot, "docs", "reports")
    );
    const outputPath =
        process.env.REPORT_PATH ||
        path.join(reportsDir, `wave6-ops-summary-${formatTimestamp()}.json`);

    const perfGatePath = readLatestFromPrefixes(
        reportsDir,
        ["wave5-performance-budget-", "wave4-performance-budget-"],
        ".json"
    );
    const lighthousePath = readLatestFromPrefixes(
        reportsDir,
        ["wave5-lighthouse-reliability-", "wave4-lighthouse-reliability-"],
        ".json"
    );
    const funnelPath = readLatestFromPrefixes(
        reportsDir,
        ["wave6-conversion-trend-live-", "wave5-conversion-trend-"],
        ".json"
    );
    const sentinelPath = readLatestFromPrefixes(
        reportsDir,
        ["wave6-conversion-sentinel-", "wave5-conversion-sentinel-"],
        ".json"
    );
    const correlationPath = readLatestFromPrefixes(
        reportsDir,
        ["wave6-perf-conversion-correlation-"],
        ".json"
    );
    const parityPath = readLatestFile(
        reportsDir,
        "wave3-canonical-og-parity-prod-",
        ".txt"
    );
    const squirrelPath = readLatestFile(
        reportsDir,
        "wave3-live-squirrel-audit-prod-",
        ".json"
    );

    const perfGate = perfGatePath ? readJson(perfGatePath) : null;
    const lighthouse = lighthousePath ? readJson(lighthousePath) : null;
    const funnel = funnelPath ? readJson(funnelPath) : null;
    const sentinel = sentinelPath ? readJson(sentinelPath) : null;
    const correlation = correlationPath ? readJson(correlationPath) : null;
    const squirrel = squirrelPath ? readJson(squirrelPath) : null;
    const parityRaw = parityPath ? fs.readFileSync(parityPath, "utf8") : "";

    const perfStatus = classifyStatus(toStatus(perfGate?.status));
    const lighthouseStatus = classifyStatus(toStatus(lighthouse?.summary?.status));
    const funnelStatus = classifyStatus(toStatus(funnel?.status));
    const rawTelemetryQualityStatus = toStatus(funnel?.dataQuality?.status, "");
    const telemetryQualityStatus = rawTelemetryQualityStatus
        ? classifyStatus(rawTelemetryQualityStatus)
        : funnelStatus === "pass"
          ? "pass"
          : "warning";
    const telemetryQualityScore =
        typeof funnel?.dataQuality?.qualityScore === "number"
            ? Number(funnel.dataQuality.qualityScore.toFixed(2))
            : null;
    const telemetryQualityMinimum =
        typeof funnel?.dataQuality?.minQualityScore === "number"
            ? Number(funnel.dataQuality.minQualityScore.toFixed(2))
            : null;
    const telemetryFreshnessStatus =
        typeof funnel?.sourceFreshness?.isFresh === "boolean"
            ? funnel.sourceFreshness.isFresh
                ? "pass"
                : "warning"
            : funnelStatus === "pass"
              ? "pass"
              : "warning";
    const sentinelStatus = sentinelPath
        ? classifyStatus(toStatus(sentinel?.status))
        : "pass";
    const correlationStatus = correlationPath
        ? classifyStatus(toStatus(correlation?.status))
        : "pass";
    const parityCanonicalStatus = classifyStatus(canonicalParityStatus(parityRaw));
    const paritySquirrelStatus = classifyStatus(toStatus(squirrel?.status));

    const parityOverallStatus =
        parityCanonicalStatus === "pass" && paritySquirrelStatus === "pass"
            ? "pass"
            : parityCanonicalStatus === "fail" || paritySquirrelStatus === "fail"
              ? "fail"
              : "warning";

    const components = {
        perfGate: createComponentSummary(
            "perfGate",
            perfStatus,
            perfStatus === "pass"
                ? "Performance budget gate is passing."
                : "Performance budget gate requires attention.",
            perfGatePath
        ),
        lighthouseReliability: createComponentSummary(
            "lighthouseReliability",
            lighthouseStatus,
            lighthouseStatus === "pass"
                ? "Lighthouse reliability checks are stable."
                : "Lighthouse reliability checks require attention.",
            lighthousePath
        ),
        funnelHealth: createComponentSummary(
            "funnelHealth",
            funnelStatus,
            funnelStatus === "pass"
                ? "Conversion trend is stable with no active anomalies."
                : "Conversion trend includes anomalies or alerts.",
            funnelPath
        ),
        telemetryQuality: createComponentSummary(
            "telemetryQuality",
            telemetryQualityStatus,
            telemetryQualityScore !== null && telemetryQualityMinimum !== null
                ? `Telemetry quality score ${telemetryQualityScore}/${telemetryQualityMinimum}.`
                : "Telemetry quality score unavailable.",
            funnelPath
        ),
        parityChecks: createComponentSummary(
            "parityChecks",
            parityOverallStatus,
            parityOverallStatus === "pass"
                ? "Canonical parity and live squirrel checks are passing."
                : "Parity checks require attention.",
            parityPath || squirrelPath
        ),
        conversionSentinel: createComponentSummary(
            "conversionSentinel",
            sentinelStatus,
            sentinelStatus === "pass"
                ? "Conversion sentinel is healthy."
                : "Conversion sentinel detected a regression.",
            sentinelPath
        ),
        telemetryFreshness: createComponentSummary(
            "telemetryFreshness",
            telemetryFreshnessStatus,
            telemetryFreshnessStatus === "pass"
                ? "Telemetry freshness checks are healthy."
                : "Telemetry source freshness requires attention.",
            funnelPath
        ),
        perfConversionCorrelation: createComponentSummary(
            "perfConversionCorrelation",
            correlationStatus,
            correlationStatus === "pass"
                ? "No co-occurring perf + conversion regressions detected."
                : "Co-occurring perf + conversion regressions detected.",
            correlationPath
        ),
    };

    const componentStatuses = Object.values(components).map((component) =>
        classifyStatus(component.status)
    );

    let overallStatus = "pass";
    if (componentStatuses.some((status) => status === "fail")) {
        overallStatus = "fail";
    } else if (componentStatuses.some((status) => status !== "pass")) {
        overallStatus = "warning";
    }

    const topAnomalies = collectTopAnomalies(funnel, correlation);

    const missionControlSummary = [
        `Overall status: ${overallStatus.toUpperCase()}`,
        `Perf gate: ${components.perfGate.status}`,
        `Lighthouse reliability: ${components.lighthouseReliability.status}`,
        `Funnel health: ${components.funnelHealth.status}`,
        `Telemetry quality: ${components.telemetryQuality.status}${
            telemetryQualityScore !== null
                ? ` (${telemetryQualityScore})`
                : ""
        }`,
        `Telemetry freshness: ${components.telemetryFreshness.status}`,
        `Conversion sentinel: ${components.conversionSentinel.status}`,
        `Perf/conversion correlation: ${components.perfConversionCorrelation.status}`,
        `Parity checks: ${components.parityChecks.status}`,
        `Top anomalies: ${topAnomalies.length}`,
    ];

    const output = {
        generatedAt: new Date().toISOString(),
        reportsDir,
        overallStatus,
        missionControl: {
            seoParityStatus: components.parityChecks.status,
            perfGateStatus: components.perfGate.status,
            conversionSentinelStatus: components.conversionSentinel.status,
            telemetryFreshness: {
                status: components.telemetryFreshness.status,
                sourceMode:
                    typeof funnel?.sourceMode === "string" ? funnel.sourceMode : null,
                ageMinutes:
                    typeof funnel?.sourceFreshness?.ageMinutes === "number"
                        ? funnel.sourceFreshness.ageMinutes
                        : null,
            },
            topAnomalies,
        },
        components,
        topAnomalies,
        missionControlSummary,
        sourceReports: {
            perfGate: perfGatePath,
            lighthouseReliability: lighthousePath,
            funnelHealth: funnelPath,
            conversionSentinel: sentinelPath,
            perfConversionCorrelation: correlationPath,
            canonicalParity: parityPath,
            liveSquirrel: squirrelPath,
        },
    };

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    console.log(`Wave 6 ops summary report: ${outputPath}`);
    console.log(JSON.stringify(output, null, 2));
}

main();
