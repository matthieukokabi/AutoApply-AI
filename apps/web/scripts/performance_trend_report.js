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

function toNumberOrNull(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    return null;
}

function calculatePercentile(values, percentile) {
    if (!Array.isArray(values) || values.length === 0) {
        return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const rank = (percentile / 100) * (sorted.length - 1);
    const low = Math.floor(rank);
    const high = Math.ceil(rank);

    if (low === high) {
        return Number(sorted[low].toFixed(4));
    }

    const interpolated = sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
    return Number(interpolated.toFixed(4));
}

function metricDelta(currentValue, referenceValue) {
    if (currentValue === null || referenceValue === null || referenceValue <= 0) {
        return {
            value: null,
            percent: null,
        };
    }

    return {
        value: Number((currentValue - referenceValue).toFixed(4)),
        percent: Number((((currentValue - referenceValue) / referenceValue) * 100).toFixed(2)),
    };
}

function buildRouteTrend(route, routeReports) {
    const latestReport = routeReports[routeReports.length - 1] || null;
    const latestMetrics = latestReport?.metrics || {};

    const metricSeries = Object.fromEntries(
        METRIC_KEYS.map((metric) => {
            const values = routeReports
                .map((report) => toNumberOrNull(report?.metrics?.[metric]))
                .filter((value) => value !== null);
            return [metric, values];
        })
    );

    const percentiles = Object.fromEntries(
        METRIC_KEYS.map((metric) => {
            const values = metricSeries[metric];
            return [
                metric,
                {
                    sampleCount: values.length,
                    p50: calculatePercentile(values, 50),
                    p75: calculatePercentile(values, 75),
                    p90: calculatePercentile(values, 90),
                },
            ];
        })
    );

    const perRouteRegressionDeltas = Object.fromEntries(
        METRIC_KEYS.map((metric) => {
            const currentValue = toNumberOrNull(latestMetrics?.[metric]);
            const p75 = toNumberOrNull(percentiles?.[metric]?.p75);
            const p90 = toNumberOrNull(percentiles?.[metric]?.p90);
            const previousReport = routeReports.length > 1 ? routeReports[routeReports.length - 2] : null;
            const previousValue = toNumberOrNull(previousReport?.metrics?.[metric]);

            return [
                metric,
                {
                    currentValue,
                    vsPrevious: metricDelta(currentValue, previousValue),
                    vsP75: metricDelta(currentValue, p75),
                    vsP90: metricDelta(currentValue, p90),
                },
            ];
        })
    );

    const latestStatus = typeof latestReport?.status === "string" ? latestReport.status : "unavailable";
    const status = latestStatus.startsWith("fail")
        ? "fail"
        : routeReports.length < 3
          ? "warning"
          : "pass";

    return {
        route,
        status,
        samples: routeReports.length,
        latestReport: latestReport?.__source || null,
        latestStatus,
        percentiles,
        perRouteRegressionDeltas,
    };
}

function main() {
    const workspaceRoot = path.resolve(__dirname, "../../..");
    const reportsDir = path.resolve(
        process.env.PERF_REPORTS_DIR || path.join(workspaceRoot, "docs", "reports")
    );
    const routeConfigPath = path.join(__dirname, "..", "config", "performance-audit-routes.json");
    const outputPath =
        process.env.REPORT_PATH ||
        path.join(reportsDir, `wave5-perf-trend-${formatTimestamp()}.json`);

    const routeConfig = readJson(routeConfigPath);
    const requiredRoutes = Array.isArray(routeConfig.requiredRoutes)
        ? routeConfig.requiredRoutes
        : [];

    if (requiredRoutes.length === 0) {
        console.error("No requiredRoutes found in performance-audit-routes.json");
        process.exit(1);
    }

    const reportFiles = [
        ...listMatchingReports(reportsDir, "wave4-performance-budget-"),
        ...listMatchingReports(reportsDir, "wave5-performance-budget-"),
    ];

    const parsedReports = reportFiles
        .map((filePath) => {
            try {
                const payload = readJson(filePath);
                return {
                    ...payload,
                    __source: filePath,
                };
            } catch {
                return null;
            }
        })
        .filter(Boolean);

    const routeTrends = requiredRoutes.map((route) => {
        const routeReports = parsedReports.filter((report) => report.route === route);
        return buildRouteTrend(route, routeReports);
    });

    const overallStatus = routeTrends.some((item) => item.status === "fail")
        ? "fail"
        : routeTrends.some((item) => item.status === "warning")
          ? "warning"
          : "pass";

    const output = {
        generatedAt: new Date().toISOString(),
        reportsDir,
        deterministicRoutes: {
            requiredRoutes,
            highIntentRoute: routeConfig.highIntentRoute || null,
        },
        overallStatus,
        routeTrends,
    };

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    console.log(`Wave 5 performance trend report: ${outputPath}`);
    console.log(JSON.stringify(output, null, 2));

    if (overallStatus === "fail") {
        process.exit(1);
    }
}

main();
