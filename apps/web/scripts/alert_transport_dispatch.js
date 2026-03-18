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

function parseInteger(value, fallback) {
    const parsed = Number.parseInt(String(value || ""), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
    }

    return fallback;
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonSafe(filePath, fallback = null) {
    try {
        return readJson(filePath);
    } catch {
        return fallback;
    }
}

function listMatchingReports(directory, prefixes, extension = ".json") {
    if (!fs.existsSync(directory)) {
        return [];
    }

    const prefixList = Array.isArray(prefixes) ? prefixes : [prefixes];
    return fs
        .readdirSync(directory)
        .filter((name) =>
            prefixList.some(
                (prefix) => name.startsWith(prefix) && name.endsWith(extension)
            )
        )
        .map((name) => path.join(directory, name))
        .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
}

function readLatestReport(reportsDir, prefixes) {
    const matches = listMatchingReports(reportsDir, prefixes, ".json");
    if (matches.length === 0) {
        return null;
    }

    return matches[matches.length - 1];
}

function resolveReportsDir(workspaceRoot) {
    const override = process.env.ALERT_TRANSPORT_REPORTS_DIR?.trim();
    if (override) {
        return path.resolve(override);
    }

    return path.join(workspaceRoot, "docs", "reports");
}

function normalizeStatus(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "unknown";
}

function classifySeverity(sentinel, trend, opsSummary) {
    const sentinelStatus = normalizeStatus(sentinel?.status);
    const trendStatus = normalizeStatus(trend?.status);
    const opsStatus = normalizeStatus(opsSummary?.overallStatus);

    if (sentinelStatus === "fail" || sentinelStatus === "pass_with_emergency_bypass") {
        return {
            severity: "critical",
            source: "conversion_sentinel",
            reason:
                typeof sentinel?.summary?.triggerCode === "string"
                    ? sentinel.summary.triggerCode
                    : sentinelStatus,
        };
    }

    if (
        trendStatus === "alert" ||
        trendStatus === "warning" ||
        opsStatus === "warning" ||
        opsStatus === "fail"
    ) {
        return {
            severity: "warning",
            source: trendStatus === "alert" || trendStatus === "warning"
                ? "conversion_trend"
                : "ops_summary",
            reason: trendStatus === "alert" || trendStatus === "warning" ? trendStatus : opsStatus,
        };
    }

    return {
        severity: "none",
        source: "none",
        reason: "healthy",
    };
}

function buildFingerprint({ severity, sentinel, trend, opsSummary }) {
    const sentinelTrigger =
        typeof sentinel?.summary?.triggerCode === "string"
            ? sentinel.summary.triggerCode
            : "none";
    const trendAnomalyCount =
        typeof trend?.anomalyCount === "number" ? trend.anomalyCount : 0;
    const opsOverall = typeof opsSummary?.overallStatus === "string" ? opsSummary.overallStatus : "unknown";

    if (severity === "critical") {
        return `critical:${sentinelTrigger}:${opsOverall}`;
    }

    if (severity === "warning") {
        return `warning:${trendAnomalyCount}:${opsOverall}`;
    }

    return `none:${opsOverall}`;
}

function loadConfig(configPath) {
    const raw = fs.existsSync(configPath) ? readJsonSafe(configPath, {}) : {};

    return {
        cooldownMinutes: parseInteger(
            process.env.ALERT_TRANSPORT_COOLDOWN_MINUTES,
            parseInteger(raw?.cooldownMinutes, 120)
        ),
        maxRetries: parseInteger(
            process.env.ALERT_TRANSPORT_MAX_RETRIES,
            parseInteger(raw?.maxRetries, 3)
        ),
        retryDelayMs: parseInteger(
            process.env.ALERT_TRANSPORT_RETRY_DELAY_MS,
            parseInteger(raw?.retryDelayMs, 1000)
        ),
        warningBatchWindowMinutes: parseInteger(
            process.env.ALERT_TRANSPORT_WARNING_BATCH_WINDOW_MINUTES,
            parseInteger(raw?.warningBatchWindowMinutes, 30)
        ),
        warningBatchSize: parseInteger(
            process.env.ALERT_TRANSPORT_WARNING_BATCH_SIZE,
            parseInteger(raw?.warningBatchSize, 3)
        ),
    };
}

function loadState(statePath) {
    const raw = readJsonSafe(statePath, null);
    if (!raw || typeof raw !== "object") {
        return {
            lastDeliveredByFingerprint: {},
            pendingWarnings: [],
        };
    }

    return {
        lastDeliveredByFingerprint:
            raw.lastDeliveredByFingerprint &&
            typeof raw.lastDeliveredByFingerprint === "object"
                ? raw.lastDeliveredByFingerprint
                : {},
        pendingWarnings: Array.isArray(raw.pendingWarnings) ? raw.pendingWarnings : [],
    };
}

function persistState(statePath, payload) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function isCoolingDown(lastDeliveredAt, cooldownMinutes, nowMs) {
    if (typeof lastDeliveredAt !== "string") {
        return {
            active: false,
            minutesSinceLastDelivery: null,
        };
    }

    const parsed = new Date(lastDeliveredAt);
    if (Number.isNaN(parsed.getTime())) {
        return {
            active: false,
            minutesSinceLastDelivery: null,
        };
    }

    const minutesSinceLastDelivery = Number(
        ((nowMs - parsed.getTime()) / (60 * 1000)).toFixed(2)
    );

    return {
        active: minutesSinceLastDelivery < cooldownMinutes,
        minutesSinceLastDelivery,
    };
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dispatchWithRetries(dispatchFn, maxRetries, retryDelayMs) {
    const attempts = [];
    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
        try {
            const response = await dispatchFn();
            attempts.push({
                attempt,
                ok: response.ok,
                status: response.status,
            });
            if (response.ok) {
                return {
                    delivered: true,
                    attempts,
                };
            }
        } catch (error) {
            attempts.push({
                attempt,
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            });
        }

        if (attempt < maxRetries) {
            await delay(retryDelayMs * attempt);
        }
    }

    return {
        delivered: false,
        attempts,
    };
}

function resolveSinks() {
    const sinks = [];
    const webhookUrl = process.env.ALERT_TRANSPORT_WEBHOOK_URL?.trim();
    if (webhookUrl) {
        sinks.push({ type: "webhook", webhookUrl });
    }

    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    const emailTo = process.env.ALERT_TRANSPORT_EMAIL_TO?.trim();
    if (resendApiKey && emailTo) {
        sinks.push({
            type: "email",
            resendApiKey,
            to: emailTo,
            from:
                process.env.ALERT_TRANSPORT_EMAIL_FROM?.trim() ||
                "alerts@autoapply.works",
        });
    }

    return sinks;
}

async function deliverToSinks({ sinks, payload, config }) {
    if (sinks.length === 0) {
        return {
            status: "local_only",
            sinkResults: [],
            allDelivered: true,
        };
    }

    const sinkResults = [];
    for (const sink of sinks) {
        if (sink.type === "webhook") {
            const webhookResult = await dispatchWithRetries(
                () =>
                    fetch(sink.webhookUrl, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(payload),
                    }),
                config.maxRetries,
                config.retryDelayMs
            );

            sinkResults.push({
                sink: "webhook",
                delivered: webhookResult.delivered,
                attempts: webhookResult.attempts,
            });
            continue;
        }

        if (sink.type === "email") {
            const subject = `[AutoApply][${payload.severity.toUpperCase()}] ${payload.reason}`;
            const textBody = [
                `Severity: ${payload.severity}`,
                `Reason: ${payload.reason}`,
                `Source: ${payload.source}`,
                `Fingerprint: ${payload.fingerprint}`,
                `GeneratedAt: ${payload.generatedAt}`,
            ].join("\n");

            const emailResult = await dispatchWithRetries(
                () =>
                    fetch("https://api.resend.com/emails", {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${sink.resendApiKey}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            from: sink.from,
                            to: [sink.to],
                            subject,
                            text: textBody,
                        }),
                    }),
                config.maxRetries,
                config.retryDelayMs
            );

            sinkResults.push({
                sink: "email",
                delivered: emailResult.delivered,
                attempts: emailResult.attempts,
            });
        }
    }

    const allDelivered = sinkResults.every((sinkResult) => sinkResult.delivered);
    return {
        status: allDelivered ? "delivered" : "delivery_failed",
        sinkResults,
        allDelivered,
    };
}

function prunePendingWarnings(pendingWarnings, nowMs, warningBatchWindowMinutes) {
    const maxAgeMinutes = warningBatchWindowMinutes * 4;
    return pendingWarnings.filter((item) => {
        if (typeof item?.createdAt !== "string") {
            return false;
        }

        const createdAt = new Date(item.createdAt);
        if (Number.isNaN(createdAt.getTime())) {
            return false;
        }

        const ageMinutes = (nowMs - createdAt.getTime()) / (60 * 1000);
        return ageMinutes <= maxAgeMinutes;
    });
}

async function main() {
    const workspaceRoot = path.resolve(__dirname, "../../..");
    const reportsDir = resolveReportsDir(workspaceRoot);
    const configPath =
        process.env.ALERT_TRANSPORT_CONFIG_PATH?.trim() ||
        path.join(__dirname, "..", "config", "alert-transport.json");
    const config = loadConfig(path.resolve(configPath));

    const now = new Date();
    const nowIso = now.toISOString();
    const nowMs = now.getTime();

    const statePath =
        process.env.ALERT_TRANSPORT_STATE_PATH?.trim() ||
        path.join(reportsDir, "wave7-alert-transport-state.json");
    const outputPath =
        process.env.REPORT_PATH ||
        path.join(reportsDir, `wave7-alert-transport-${formatTimestamp(now)}.json`);

    const sentinelPath = readLatestReport(reportsDir, [
        "wave7-conversion-sentinel-",
        "wave6-conversion-sentinel-",
        "wave5-conversion-sentinel-",
    ]);
    const trendPath = readLatestReport(reportsDir, [
        "wave7-conversion-trend-live-",
        "wave6-conversion-trend-live-",
        "wave5-conversion-trend-",
    ]);
    const opsPath = readLatestReport(reportsDir, [
        "wave7-ops-summary-v2-",
        "wave6-ops-summary-",
        "wave5-ops-summary-",
    ]);

    const sentinel = sentinelPath ? readJsonSafe(sentinelPath, {}) : {};
    const trend = trendPath ? readJsonSafe(trendPath, {}) : {};
    const opsSummary = opsPath ? readJsonSafe(opsPath, {}) : {};

    const severityPayload = classifySeverity(sentinel, trend, opsSummary);
    const fingerprint = buildFingerprint({
        severity: severityPayload.severity,
        sentinel,
        trend,
        opsSummary,
    });

    const state = loadState(path.resolve(statePath));
    state.pendingWarnings = prunePendingWarnings(
        state.pendingWarnings,
        nowMs,
        config.warningBatchWindowMinutes
    );

    const cooldown = isCoolingDown(
        state.lastDeliveredByFingerprint[fingerprint],
        config.cooldownMinutes,
        nowMs
    );

    const routing =
        severityPayload.severity === "critical"
            ? "immediate"
            : severityPayload.severity === "warning"
              ? "batched"
              : "none";

    let dispatchMode = "none";
    let dispatchPayload = null;
    let queueInfo = {
        queuedWarnings: state.pendingWarnings.length,
        warningQueueAction: "none",
    };

    if (severityPayload.severity === "warning") {
        const queuedExists = state.pendingWarnings.some(
            (item) => item?.fingerprint === fingerprint
        );
        if (!queuedExists) {
            state.pendingWarnings.push({
                createdAt: nowIso,
                fingerprint,
                severity: "warning",
                source: severityPayload.source,
                reason: severityPayload.reason,
            });
        }

        const oldest = state.pendingWarnings[0];
        const oldestAgeMinutes = oldest?.createdAt
            ? Number(
                  ((nowMs - new Date(oldest.createdAt).getTime()) / (60 * 1000)).toFixed(2)
              )
            : 0;
        const shouldDispatchWarningBatch =
            state.pendingWarnings.length >= config.warningBatchSize ||
            oldestAgeMinutes >= config.warningBatchWindowMinutes;

        if (shouldDispatchWarningBatch) {
            dispatchMode = "warning_batch";
            dispatchPayload = {
                generatedAt: nowIso,
                severity: "warning",
                source: "warning_batch",
                reason: `batch_${state.pendingWarnings.length}_items`,
                fingerprint: `warning_batch:${state.pendingWarnings.length}:${oldest?.createdAt || nowIso}`,
                items: state.pendingWarnings,
            };
        }

        queueInfo = {
            queuedWarnings: state.pendingWarnings.length,
            warningQueueAction: shouldDispatchWarningBatch ? "dispatch" : "queued",
        };
    }

    if (severityPayload.severity === "critical") {
        if (!cooldown.active) {
            dispatchMode = "critical_immediate";
            dispatchPayload = {
                generatedAt: nowIso,
                severity: "critical",
                source: severityPayload.source,
                reason: severityPayload.reason,
                fingerprint,
                sentinelStatus: sentinel?.status || "unknown",
                triggerCode: sentinel?.summary?.triggerCode || null,
            };
        } else {
            dispatchMode = "suppressed_cooldown";
        }
    }

    const sinks = resolveSinks();
    let delivery = {
        status: "no_dispatch",
        sinkResults: [],
        allDelivered: true,
    };

    if (dispatchPayload) {
        delivery = await deliverToSinks({ sinks, payload: dispatchPayload, config });

        if (delivery.allDelivered) {
            const deliveredFingerprint =
                dispatchPayload.fingerprint || fingerprint;
            state.lastDeliveredByFingerprint[deliveredFingerprint] = nowIso;
            if (dispatchMode === "warning_batch") {
                state.pendingWarnings = [];
            }
        }
    }

    persistState(path.resolve(statePath), state);

    const hasExternalFailure =
        dispatchPayload !== null && sinks.length > 0 && !delivery.allDelivered;

    const output = {
        generatedAt: nowIso,
        reportsDir: path.resolve(reportsDir),
        statePath: path.resolve(statePath),
        status: hasExternalFailure ? "fail" : "pass",
        routing,
        dispatchMode,
        severity: severityPayload.severity,
        source: severityPayload.source,
        reason: severityPayload.reason,
        fingerprint,
        cooldown: {
            active: cooldown.active,
            minutesSinceLastDelivery: cooldown.minutesSinceLastDelivery,
            cooldownMinutes: config.cooldownMinutes,
        },
        queueInfo,
        delivery,
        sinksConfigured: sinks.map((sink) => sink.type),
        sourceReports: {
            sentinel: sentinelPath ? path.resolve(sentinelPath) : null,
            trend: trendPath ? path.resolve(trendPath) : null,
            opsSummary: opsPath ? path.resolve(opsPath) : null,
        },
        localArtifactIsSourceOfTruth: true,
    };

    fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
    fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(output, null, 2)}\n`, "utf8");

    console.log(`Wave 7 alert transport report: ${path.resolve(outputPath)}`);
    console.log(JSON.stringify(output, null, 2));

    if (hasExternalFailure) {
        process.exit(1);
    }
}

main().catch((error) => {
    console.error("Alert transport dispatch failed:", error);
    process.exit(1);
});
