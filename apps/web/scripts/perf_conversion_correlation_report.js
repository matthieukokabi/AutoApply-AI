#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const METRIC_KEYS = ["lcpMs", "cls", "jsBytes", "imageBytes"];

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

function readLatestFromPrefixes(directory, prefixes) {
    const candidates = prefixes
        .flatMap((prefix) => listMatchingReports(directory, prefix))
        .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);

    if (candidates.length === 0) {
        return null;
    }

    return candidates[candidates.length - 1];
}

function toNumberOrNull(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    return null;
}

function metricRegressions(perfDeltas, thresholds) {
    return METRIC_KEYS.map((metric) => {
        const percent = toNumberOrNull(perfDeltas?.[metric]?.vsPrevious?.percent);
        const threshold = toNumberOrNull(thresholds?.[metric]);
        const regressed =
            percent !== null && threshold !== null ? percent > threshold : false;

        return {
            metric,
            percentDeltaVsPrevious: percent,
            thresholdPercent: threshold,
            regressed,
        };
    });
}

function mapRoutesToConversion(segments = []) {
    const routeMap = new Map();
    for (const segment of Array.isArray(segments) ? segments : []) {
        if (typeof segment?.segment !== "string") {
            continue;
        }

        routeMap.set(segment.segment, segment.summary || {});
    }

    return routeMap;
}

function calculateDropPercent(baseline, current) {
    if (
        typeof baseline !== "number" ||
        !Number.isFinite(baseline) ||
        baseline <= 0 ||
        typeof current !== "number" ||
        !Number.isFinite(current)
    ) {
        return null;
    }

    return Number((((baseline - current) / baseline) * 100).toFixed(2));
}

function main() {
    const workspaceRoot = path.resolve(__dirname, "../../..");
    const reportsDir = path.resolve(
        process.env.PERF_CONVERSION_REPORTS_DIR ||
            path.join(workspaceRoot, "docs", "reports")
    );
    const configPath = path.join(
        __dirname,
        "..",
        "config",
        "perf-conversion-correlation.json"
    );
    const outputPath =
        process.env.REPORT_PATH ||
        path.join(
            reportsDir,
            `wave6-perf-conversion-correlation-${formatTimestamp()}.json`
        );

    const perfTrendPath =
        process.env.PERF_TREND_SOURCE_REPORT ||
        process.argv[2] ||
        readLatestFromPrefixes(reportsDir, [
            "wave6-perf-trend-",
            "wave5-perf-trend-",
        ]);
    const conversionTrendPath =
        process.env.CONVERSION_TREND_SOURCE_REPORT ||
        process.argv[3] ||
        readLatestFromPrefixes(reportsDir, ["wave6-conversion-trend-live-"]);

    if (!perfTrendPath || !conversionTrendPath) {
        console.error(
            "Missing input reports for perf/conversion correlation.",
            JSON.stringify({ perfTrendPath, conversionTrendPath })
        );
        process.exit(1);
    }

    const config = readJson(configPath);
    const perfTrend = readJson(perfTrendPath);
    const conversionTrend = readJson(conversionTrendPath);

    const baselineCompletionRate =
        toNumberOrNull(
            conversionTrend?.funnel?.weekly?.trend?.completionRateFromFormStart?.baseline
        ) ??
        toNumberOrNull(conversionTrend?.keyMetrics?.weeklyCompletionRateBaseline);
    const routeConversionMap = mapRoutesToConversion(
        conversionTrend?.funnel?.daily?.segmentation?.byRoute || []
    );

    const routeInsights = (Array.isArray(perfTrend?.routeTrends)
        ? perfTrend.routeTrends
        : []
    ).map((routeTrend) => {
        const route = typeof routeTrend?.route === "string" ? routeTrend.route : "unknown";
        const regressions = metricRegressions(
            routeTrend?.perRouteRegressionDeltas,
            config.perfRegressionThresholdPercent
        );
        const hasPerfRegression = regressions.some((item) => item.regressed);
        const conversionSummary = routeConversionMap.get(route) || null;
        const formStarts = toNumberOrNull(conversionSummary?.formStarts);
        const completionRate = toNumberOrNull(
            conversionSummary?.completionRateFromFormStart
        );
        const conversionDropPercent = calculateDropPercent(
            baselineCompletionRate,
            completionRate
        );
        const conversionDropTriggered =
            formStarts !== null &&
            formStarts >= config.minFormStarts &&
            conversionDropPercent !== null &&
            conversionDropPercent > config.conversionDropThresholdPercent;

        const cooccurrence = hasPerfRegression && conversionDropTriggered;

        return {
            route,
            perf: {
                hasRegression: hasPerfRegression,
                metrics: regressions,
            },
            conversion: {
                formStarts,
                completionRateFromFormStart: completionRate,
                baselineCompletionRate,
                dropPercentFromBaseline: conversionDropPercent,
                thresholdPercent: config.conversionDropThresholdPercent,
                dropTriggered: conversionDropTriggered,
            },
            cooccurrence,
        };
    });

    const cooccurrenceFlags = routeInsights
        .filter((item) => item.cooccurrence)
        .sort((a, b) => {
            const deltaA = a.conversion.dropPercentFromBaseline || 0;
            const deltaB = b.conversion.dropPercentFromBaseline || 0;
            return deltaB - deltaA;
        })
        .slice(0, 10);

    const output = {
        generatedAt: new Date().toISOString(),
        status: cooccurrenceFlags.length > 0 ? "warning" : "pass",
        sources: {
            perfTrend: path.resolve(perfTrendPath),
            conversionTrend: path.resolve(conversionTrendPath),
        },
        thresholds: config,
        totals: {
            routesAnalyzed: routeInsights.length,
            cooccurrenceCount: cooccurrenceFlags.length,
            perfOnlyCount: routeInsights.filter(
                (item) => item.perf.hasRegression && !item.conversion.dropTriggered
            ).length,
            conversionOnlyCount: routeInsights.filter(
                (item) => !item.perf.hasRegression && item.conversion.dropTriggered
            ).length,
        },
        cooccurrenceFlags,
        routeInsights,
    };

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    console.log(`Wave 6 perf/conversion correlation report: ${outputPath}`);
    console.log(JSON.stringify(output, null, 2));

    const failOnFlag =
        String(process.env.PERF_CONVERSION_CORRELATION_FAIL_ON_FLAG || "").toLowerCase() ===
        "true";
    if (failOnFlag && cooccurrenceFlags.length > 0) {
        process.exit(1);
    }
}

main();
