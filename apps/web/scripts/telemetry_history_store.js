#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_CONFIG = {
    retentionDays: 90,
    maxEntriesPerStream: 1500,
    rollingWindowsDays: [7, 14, 30],
    minSamplesPerWindow: 2,
};

function formatTimestamp(date = new Date()) {
    const yyyy = String(date.getUTCFullYear());
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const hh = String(date.getUTCHours()).padStart(2, "0");
    const mi = String(date.getUTCMinutes()).padStart(2, "0");
    const ss = String(date.getUTCSeconds()).padStart(2, "0");
    return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function toNumberOrNull(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    return null;
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

function readLatestReport(reportsDir, prefixes, extension = ".json") {
    const matches = listMatchingReports(reportsDir, prefixes, extension);
    if (matches.length === 0) {
        return null;
    }

    return matches[matches.length - 1];
}

function parseIsoTimestamp(raw) {
    if (typeof raw !== "string" || !raw.trim()) {
        return null;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return parsed.toISOString();
}

function asIsoDate(value, fallbackIso) {
    const parsed = parseIsoTimestamp(value);
    return parsed || fallbackIso;
}

function normalizeHistoryStore(rawStore, config, fallbackIso) {
    const streams = rawStore && typeof rawStore === "object" ? rawStore.streams || {} : {};

    return {
        schemaVersion: 1,
        updatedAt: asIsoDate(rawStore?.updatedAt, fallbackIso),
        retentionDays: config.retentionDays,
        maxEntriesPerStream: config.maxEntriesPerStream,
        rollingWindowsDays: config.rollingWindowsDays,
        streams: {
            conversion: Array.isArray(streams.conversion) ? streams.conversion : [],
            sentinel: Array.isArray(streams.sentinel) ? streams.sentinel : [],
            perf: Array.isArray(streams.perf) ? streams.perf : [],
        },
    };
}

function parseInteger(value, fallback) {
    const parsed = Number.parseInt(String(value || ""), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
    }

    return fallback;
}

function uniquePositiveIntegers(values, fallback) {
    if (!Array.isArray(values)) {
        return fallback;
    }

    const parsed = values
        .map((value) => parseInteger(value, NaN))
        .filter((value) => Number.isFinite(value) && value > 0);

    if (parsed.length === 0) {
        return fallback;
    }

    return Array.from(new Set(parsed)).sort((a, b) => a - b);
}

function loadConfig(configPath) {
    const raw = fs.existsSync(configPath) ? readJsonSafe(configPath, {}) : {};
    const retentionDays = parseInteger(
        process.env.TELEMETRY_HISTORY_RETENTION_DAYS,
        parseInteger(raw?.retentionDays, DEFAULT_CONFIG.retentionDays)
    );
    const maxEntriesPerStream = parseInteger(
        process.env.TELEMETRY_HISTORY_MAX_ENTRIES,
        parseInteger(raw?.maxEntriesPerStream, DEFAULT_CONFIG.maxEntriesPerStream)
    );
    const minSamplesPerWindow = parseInteger(
        process.env.TELEMETRY_HISTORY_MIN_SAMPLES,
        parseInteger(raw?.minSamplesPerWindow, DEFAULT_CONFIG.minSamplesPerWindow)
    );

    const rollingWindowsDays = uniquePositiveIntegers(
        raw?.rollingWindowsDays,
        DEFAULT_CONFIG.rollingWindowsDays
    );

    return {
        retentionDays,
        maxEntriesPerStream,
        rollingWindowsDays,
        minSamplesPerWindow,
    };
}

function buildConversionEntry(reportPath, payload, nowIso) {
    const dailySummary = payload?.funnel?.daily?.summary || {};

    return {
        generatedAt: asIsoDate(payload?.generatedAt, nowIso),
        sourceReport: path.resolve(reportPath),
        sourceMode:
            typeof payload?.sourceMode === "string" ? payload.sourceMode : "unknown",
        status: typeof payload?.status === "string" ? payload.status : "unknown",
        anomalyCount: toNumberOrNull(payload?.anomalyCount),
        formStarts: toNumberOrNull(dailySummary?.formStarts),
        completionRateFromFormStart:
            toNumberOrNull(payload?.keyMetrics?.dailyCompletionRateFromFormStart) ??
            toNumberOrNull(dailySummary?.completionRateFromFormStart),
        captchaFailRate:
            toNumberOrNull(payload?.keyMetrics?.dailyCaptchaFailRate) ??
            toNumberOrNull(dailySummary?.captchaFailRate),
        qualityScore: toNumberOrNull(payload?.dataQuality?.qualityScore),
    };
}

function buildSentinelEntry(reportPath, payload, nowIso) {
    return {
        generatedAt: asIsoDate(payload?.generatedAt, nowIso),
        sourceReport: path.resolve(reportPath),
        status: typeof payload?.status === "string" ? payload.status : "unknown",
        triggerCode:
            typeof payload?.summary?.triggerCode === "string"
                ? payload.summary.triggerCode
                : null,
        confidenceTier:
            typeof payload?.summary?.highestRegressionConfidence === "string"
                ? payload.summary.highestRegressionConfidence
                : "none",
        alertDispatchStatus:
            typeof payload?.summary?.alertDispatch?.status === "string"
                ? payload.summary.alertDispatch.status
                : "unknown",
        triggered: Boolean(payload?.summary?.triggered),
    };
}

function buildPerfEntry(reportPath, payload, nowIso) {
    const routeTrends = Array.isArray(payload?.routeTrends) ? payload.routeTrends : [];
    const highIntentRoute =
        typeof payload?.deterministicRoutes?.highIntentRoute === "string"
            ? payload.deterministicRoutes.highIntentRoute
            : null;

    const selectedRoute =
        routeTrends.find((item) => item?.route === highIntentRoute) || routeTrends[0] || null;
    const percentiles = selectedRoute?.percentiles || {};

    return {
        generatedAt: asIsoDate(payload?.generatedAt, nowIso),
        sourceReport: path.resolve(reportPath),
        status:
            typeof payload?.overallStatus === "string"
                ? payload.overallStatus
                : typeof payload?.status === "string"
                  ? payload.status
                  : "unknown",
        route: typeof selectedRoute?.route === "string" ? selectedRoute.route : null,
        lcpP75: toNumberOrNull(percentiles?.lcpMs?.p75),
        clsP75: toNumberOrNull(percentiles?.cls?.p75),
        jsBytesP75: toNumberOrNull(percentiles?.jsBytes?.p75),
        imageBytesP75: toNumberOrNull(percentiles?.imageBytes?.p75),
    };
}

function makeEntryKey(entry) {
    return `${entry.generatedAt || "unknown"}|${entry.sourceReport || "unknown"}`;
}

function addUniqueEntry(stream, entry) {
    if (!entry || typeof entry !== "object") {
        return false;
    }

    const newKey = makeEntryKey(entry);
    const exists = stream.some((candidate) => makeEntryKey(candidate) === newKey);
    if (exists) {
        return false;
    }

    stream.push(entry);
    return true;
}

function sanitizeStream(stream) {
    return (Array.isArray(stream) ? stream : [])
        .filter((entry) => entry && typeof entry === "object")
        .map((entry) => ({
            ...entry,
            generatedAt: parseIsoTimestamp(entry.generatedAt) || null,
        }))
        .filter((entry) => entry.generatedAt !== null)
        .sort(
            (a, b) =>
                new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime()
        );
}

function applyRetentionAndCompaction(stream, config, nowMs) {
    const retentionBoundaryMs = nowMs - config.retentionDays * DAY_MS;

    const retained = sanitizeStream(stream).filter((entry) => {
        const timestampMs = new Date(entry.generatedAt).getTime();
        return timestampMs >= retentionBoundaryMs;
    });

    if (retained.length <= config.maxEntriesPerStream) {
        return retained;
    }

    return retained.slice(retained.length - config.maxEntriesPerStream);
}

function computeAverage(entries, key) {
    const values = entries
        .map((entry) => toNumberOrNull(entry?.[key]))
        .filter((value) => value !== null);

    if (values.length === 0) {
        return {
            sampleCount: 0,
            value: null,
        };
    }

    const total = values.reduce((sum, value) => sum + value, 0);
    return {
        sampleCount: values.length,
        value: Number((total / values.length).toFixed(6)),
    };
}

function computeRollingWindow(entries, metricKey, days, nowMs, minSamplesPerWindow) {
    const currentStart = nowMs - days * DAY_MS;
    const previousStart = nowMs - 2 * days * DAY_MS;

    const currentEntries = entries.filter((entry) => {
        const timestampMs = new Date(entry.generatedAt).getTime();
        return timestampMs >= currentStart && timestampMs <= nowMs;
    });
    const previousEntries = entries.filter((entry) => {
        const timestampMs = new Date(entry.generatedAt).getTime();
        return timestampMs >= previousStart && timestampMs < currentStart;
    });

    const currentAverage = computeAverage(currentEntries, metricKey);
    const previousAverage = computeAverage(previousEntries, metricKey);
    const enoughSamples =
        currentAverage.sampleCount >= minSamplesPerWindow &&
        previousAverage.sampleCount >= minSamplesPerWindow;

    if (!enoughSamples) {
        return {
            status: "insufficient_data",
            current: currentAverage,
            previous: previousAverage,
            delta: null,
            deltaPercent: null,
        };
    }

    const delta = Number((currentAverage.value - previousAverage.value).toFixed(6));
    const deltaPercent =
        previousAverage.value === 0
            ? null
            : Number(((delta / previousAverage.value) * 100).toFixed(2));

    return {
        status: "ok",
        current: currentAverage,
        previous: previousAverage,
        delta,
        deltaPercent,
    };
}

function computeRollingComparisons({ entries, metricKeys, windowsDays, nowMs, minSamplesPerWindow }) {
    const comparisons = {};
    for (const metricKey of metricKeys) {
        comparisons[metricKey] = {};
        for (const days of windowsDays) {
            comparisons[metricKey][`${days}d`] = computeRollingWindow(
                entries,
                metricKey,
                days,
                nowMs,
                minSamplesPerWindow
            );
        }
    }

    return comparisons;
}

function buildFreshness(latestIso, nowMs) {
    if (!latestIso) {
        return {
            status: "missing",
            ageMinutes: null,
        };
    }

    const latestMs = new Date(latestIso).getTime();
    if (!Number.isFinite(latestMs)) {
        return {
            status: "invalid",
            ageMinutes: null,
        };
    }

    const ageMinutes = Number(((nowMs - latestMs) / (60 * 1000)).toFixed(2));
    return {
        status: ageMinutes <= 24 * 60 ? "fresh" : "stale",
        ageMinutes,
    };
}

function resolveReportsDirectory(workspaceRoot) {
    const override = process.env.TELEMETRY_HISTORY_REPORTS_DIR?.trim();
    if (override) {
        return path.resolve(override);
    }

    return path.join(workspaceRoot, "docs", "reports");
}

function main() {
    const workspaceRoot = path.resolve(__dirname, "../../..");
    const reportsDir = resolveReportsDirectory(workspaceRoot);
    const configPath =
        process.env.TELEMETRY_HISTORY_CONFIG_PATH?.trim() ||
        path.join(__dirname, "..", "config", "telemetry-history-store.json");
    const config = loadConfig(path.resolve(configPath));

    const now = new Date();
    const nowIso = now.toISOString();
    const nowMs = now.getTime();

    const defaultStorePath = path.join(reportsDir, "wave7-telemetry-history-store.json");
    const storePath =
        process.env.TELEMETRY_HISTORY_STORE_PATH?.trim() || defaultStorePath;
    const outputPath =
        process.env.REPORT_PATH ||
        path.join(reportsDir, `wave7-telemetry-history-${formatTimestamp(now)}.json`);

    const store = normalizeHistoryStore(
        readJsonSafe(path.resolve(storePath), null),
        config,
        nowIso
    );

    const latestConversionReport = readLatestReport(reportsDir, [
        "wave7-conversion-trend-live-",
        "wave6-conversion-trend-live-",
        "wave5-conversion-trend-",
    ]);
    const latestSentinelReport = readLatestReport(reportsDir, [
        "wave7-conversion-sentinel-",
        "wave6-conversion-sentinel-",
        "wave5-conversion-sentinel-",
    ]);
    const latestPerfReport = readLatestReport(reportsDir, [
        "wave7-perf-trend-",
        "wave6-perf-trend-",
        "wave5-perf-trend-",
    ]);

    const ingestStatus = {
        conversion: {
            sourceReport: latestConversionReport ? path.resolve(latestConversionReport) : null,
            appended: false,
        },
        sentinel: {
            sourceReport: latestSentinelReport ? path.resolve(latestSentinelReport) : null,
            appended: false,
        },
        perf: {
            sourceReport: latestPerfReport ? path.resolve(latestPerfReport) : null,
            appended: false,
        },
    };

    if (latestConversionReport) {
        const payload = readJsonSafe(latestConversionReport, {});
        ingestStatus.conversion.appended = addUniqueEntry(
            store.streams.conversion,
            buildConversionEntry(latestConversionReport, payload, nowIso)
        );
    }

    if (latestSentinelReport) {
        const payload = readJsonSafe(latestSentinelReport, {});
        ingestStatus.sentinel.appended = addUniqueEntry(
            store.streams.sentinel,
            buildSentinelEntry(latestSentinelReport, payload, nowIso)
        );
    }

    if (latestPerfReport) {
        const payload = readJsonSafe(latestPerfReport, {});
        ingestStatus.perf.appended = addUniqueEntry(
            store.streams.perf,
            buildPerfEntry(latestPerfReport, payload, nowIso)
        );
    }

    store.streams.conversion = applyRetentionAndCompaction(
        store.streams.conversion,
        config,
        nowMs
    );
    store.streams.sentinel = applyRetentionAndCompaction(
        store.streams.sentinel,
        config,
        nowMs
    );
    store.streams.perf = applyRetentionAndCompaction(
        store.streams.perf,
        config,
        nowMs
    );

    store.updatedAt = nowIso;

    const latestConversionIso =
        store.streams.conversion.length > 0
            ? store.streams.conversion[store.streams.conversion.length - 1].generatedAt
            : null;
    const latestSentinelIso =
        store.streams.sentinel.length > 0
            ? store.streams.sentinel[store.streams.sentinel.length - 1].generatedAt
            : null;
    const latestPerfIso =
        store.streams.perf.length > 0
            ? store.streams.perf[store.streams.perf.length - 1].generatedAt
            : null;

    const rollingComparisons = {
        conversion: computeRollingComparisons({
            entries: store.streams.conversion,
            metricKeys: [
                "completionRateFromFormStart",
                "captchaFailRate",
                "qualityScore",
            ],
            windowsDays: config.rollingWindowsDays,
            nowMs,
            minSamplesPerWindow: config.minSamplesPerWindow,
        }),
        sentinel: computeRollingComparisons({
            entries: store.streams.sentinel.map((entry) => ({
                ...entry,
                failSignal:
                    entry.status === "fail" ||
                    entry.status === "pass_with_emergency_bypass"
                        ? 1
                        : 0,
            })),
            metricKeys: ["failSignal"],
            windowsDays: config.rollingWindowsDays,
            nowMs,
            minSamplesPerWindow: config.minSamplesPerWindow,
        }),
        perf: computeRollingComparisons({
            entries: store.streams.perf,
            metricKeys: ["lcpP75", "clsP75", "jsBytesP75", "imageBytesP75"],
            windowsDays: config.rollingWindowsDays,
            nowMs,
            minSamplesPerWindow: config.minSamplesPerWindow,
        }),
    };

    const freshness = {
        conversion: buildFreshness(latestConversionIso, nowMs),
        sentinel: buildFreshness(latestSentinelIso, nowMs),
        perf: buildFreshness(latestPerfIso, nowMs),
    };

    const output = {
        generatedAt: nowIso,
        reportsDir: path.resolve(reportsDir),
        historyStorePath: path.resolve(storePath),
        status: [freshness.conversion, freshness.sentinel, freshness.perf].some(
            (streamFreshness) => streamFreshness.status === "stale"
        )
            ? "warning"
            : "pass",
        policies: {
            retentionDays: config.retentionDays,
            maxEntriesPerStream: config.maxEntriesPerStream,
            rollingWindowsDays: config.rollingWindowsDays,
            minSamplesPerWindow: config.minSamplesPerWindow,
        },
        ingestStatus,
        streamCounts: {
            conversion: store.streams.conversion.length,
            sentinel: store.streams.sentinel.length,
            perf: store.streams.perf.length,
        },
        freshness,
        rollingComparisons,
    };

    fs.mkdirSync(path.dirname(path.resolve(storePath)), { recursive: true });
    fs.writeFileSync(
        path.resolve(storePath),
        `${JSON.stringify(store, null, 2)}\n`,
        "utf8"
    );

    fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
    fs.writeFileSync(
        path.resolve(outputPath),
        `${JSON.stringify(output, null, 2)}\n`,
        "utf8"
    );

    console.log(`Wave 7 telemetry history report: ${path.resolve(outputPath)}`);
    console.log(JSON.stringify(output, null, 2));
}

main();
