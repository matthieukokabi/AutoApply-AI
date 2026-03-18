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

function pickLatestPassingAttempt(report) {
    if (!Array.isArray(report.attempts)) {
        return null;
    }

    const passingAttempts = report.attempts.filter((attempt) => attempt?.status === "pass");
    if (passingAttempts.length === 0) {
        return null;
    }

    return passingAttempts[passingAttempts.length - 1];
}

function findViolation(metric, currentValue, thresholdValue) {
    if (currentValue === null) {
        return {
            type: "missing_metric",
            metric,
            message: `Metric ${metric} is missing from Lighthouse reliability report`,
        };
    }

    if (currentValue > thresholdValue) {
        return {
            type: "threshold_exceeded",
            metric,
            currentValue,
            thresholdValue,
            delta: currentValue - thresholdValue,
            message: `${metric} exceeded threshold (${currentValue} > ${thresholdValue})`,
        };
    }

    return null;
}

function findRegressionViolation(metric, currentValue, baselineValue, maxRegressionPercent) {
    if (
        baselineValue === null ||
        baselineValue <= 0 ||
        currentValue === null ||
        maxRegressionPercent === null
    ) {
        return null;
    }

    const regressionPercent = ((currentValue - baselineValue) / baselineValue) * 100;
    if (regressionPercent > maxRegressionPercent) {
        return {
            type: "regression_exceeded",
            metric,
            currentValue,
            baselineValue,
            regressionPercent: Number(regressionPercent.toFixed(2)),
            maxRegressionPercent,
            message: `${metric} regressed by ${regressionPercent.toFixed(2)}% (limit ${maxRegressionPercent}%)`,
        };
    }

    return null;
}

function main() {
    const workspaceRoot = path.resolve(__dirname, "../../..");
    const reportsDir = path.join(workspaceRoot, "docs", "reports");
    const budgetsPath = path.join(__dirname, "..", "config", "performance-budgets.json");
    const reportCandidates = listMatchingReports(reportsDir, "wave4-lighthouse-reliability-");
    const sourceReportPath =
        process.env.PERF_BUDGET_SOURCE_REPORT ||
        process.argv[2] ||
        reportCandidates[reportCandidates.length - 1];

    if (!sourceReportPath) {
        console.error("No Lighthouse reliability report found for performance budget gate.");
        process.exit(1);
    }

    const report = readJson(sourceReportPath);
    const route = report?.target?.route;
    if (!route) {
        console.error(`Invalid report: missing target.route (${sourceReportPath})`);
        process.exit(1);
    }

    const budgets = readJson(budgetsPath);
    const routeThresholds =
        budgets.routeThresholds?.[route] || budgets.defaultThresholds || {};
    const regressionThresholds = budgets.maxRegressionPercent || {};
    const latestPassingAttempt = pickLatestPassingAttempt(report);

    if (!latestPassingAttempt || !latestPassingAttempt.metrics) {
        console.error(`No passing Lighthouse attempt found in ${sourceReportPath}`);
        process.exit(1);
    }

    const currentMetrics = {
        lcpMs: toNumberOrNull(latestPassingAttempt.metrics.lcpMs),
        cls: toNumberOrNull(latestPassingAttempt.metrics.cls),
        jsBytes: toNumberOrNull(latestPassingAttempt.metrics.jsBytes),
        imageBytes: toNumberOrNull(latestPassingAttempt.metrics.imageBytes),
    };

    const baselineCandidates = listMatchingReports(reportsDir, "wave4-performance-budget-");
    const explicitBaselinePath = process.env.PERF_BUDGET_BASELINE_REPORT;
    const baselinePath = explicitBaselinePath || baselineCandidates[baselineCandidates.length - 1];
    let baselineMetrics = {
        lcpMs: null,
        cls: null,
        jsBytes: null,
        imageBytes: null,
    };
    let baselineSource = null;

    if (baselinePath && fs.existsSync(baselinePath)) {
        try {
            const baselineReport = readJson(baselinePath);
            if (baselineReport?.route === route && baselineReport?.metrics) {
                baselineMetrics = {
                    lcpMs: toNumberOrNull(baselineReport.metrics.lcpMs),
                    cls: toNumberOrNull(baselineReport.metrics.cls),
                    jsBytes: toNumberOrNull(baselineReport.metrics.jsBytes),
                    imageBytes: toNumberOrNull(baselineReport.metrics.imageBytes),
                };
                baselineSource = baselinePath;
            }
        } catch (error) {
            console.warn(`Skipping invalid baseline report ${baselinePath}:`, error);
        }
    }

    const violations = [];
    for (const metric of METRIC_KEYS) {
        const thresholdValue = toNumberOrNull(routeThresholds[metric]);
        if (thresholdValue === null) {
            violations.push({
                type: "missing_threshold",
                metric,
                message: `Missing threshold for ${metric} on route ${route}`,
            });
            continue;
        }

        const currentValue = currentMetrics[metric];
        const thresholdViolation = findViolation(metric, currentValue, thresholdValue);
        if (thresholdViolation) {
            violations.push(thresholdViolation);
        }

        const regressionViolation = findRegressionViolation(
            metric,
            currentValue,
            baselineMetrics[metric],
            toNumberOrNull(regressionThresholds[metric])
        );
        if (regressionViolation) {
            violations.push(regressionViolation);
        }
    }

    const emergencyBypass = process.env.PERF_BUDGET_EMERGENCY_BYPASS?.trim() || "";
    const bypassActive = emergencyBypass.length > 0;
    const hasViolations = violations.length > 0;
    const status = hasViolations ? (bypassActive ? "pass_with_emergency_bypass" : "fail") : "pass";

    const outputPath =
        process.env.REPORT_PATH ||
        path.join(reportsDir, `wave4-performance-budget-${formatTimestamp()}.json`);
    const outputPayload = {
        generatedAt: new Date().toISOString(),
        status,
        sourceReport: path.resolve(sourceReportPath),
        route,
        metrics: currentMetrics,
        thresholds: routeThresholds,
        regressionThresholds,
        baseline: {
            sourceReport: baselineSource,
            metrics: baselineMetrics,
        },
        violations,
        emergencyBypass: bypassActive
            ? {
                  active: true,
                  reason: emergencyBypass,
              }
            : {
                  active: false,
                  reason: null,
              },
    };

    fs.writeFileSync(outputPath, `${JSON.stringify(outputPayload, null, 2)}\n`, "utf8");
    console.log(`Wave 4 performance budget report: ${outputPath}`);
    console.log(JSON.stringify(outputPayload, null, 2));

    if (hasViolations && !bypassActive) {
        process.exit(1);
    }
}

main();
