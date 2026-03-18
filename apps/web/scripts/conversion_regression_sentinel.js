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

function toNumberOrNull(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    return null;
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

function average(values) {
    if (values.length === 0) {
        return null;
    }

    const total = values.reduce((sum, value) => sum + value, 0);
    return Number((total / values.length).toFixed(4));
}

function readWindowData(report) {
    const days = report?.funnel?.weekly?.days;
    if (!Array.isArray(days)) {
        return [];
    }

    return days
        .map((day) => ({
            date: typeof day?.date === "string" ? day.date : "unknown",
            formStarts: toNumberOrNull(day?.summary?.formStarts),
            completionRateFromFormStart: toNumberOrNull(
                day?.summary?.completionRateFromFormStart
            ),
        }))
        .filter(
            (item) =>
                item.formStarts !== null &&
                item.completionRateFromFormStart !== null
        );
}

function evaluateWindows(windows, config) {
    const evaluations = [];
    let activeConsecutiveRegressionWindows = 0;
    let maxConsecutiveRegressionWindows = 0;

    for (let index = 0; index < windows.length; index += 1) {
        const window = windows[index];
        const baselineCandidates = windows
            .slice(Math.max(0, index - config.baselineWindowSize), index)
            .filter((candidate) => candidate.formStarts >= config.minFormStartsPerWindow)
            .map((candidate) => candidate.completionRateFromFormStart);

        if (baselineCandidates.length < config.minBaselineWindows) {
            evaluations.push({
                date: window.date,
                status: "insufficient_baseline",
                formStarts: window.formStarts,
                completionRateFromFormStart: window.completionRateFromFormStart,
                baselineCompletionRate: null,
                dropPercent: null,
                thresholdPercent: config.dropThresholdPercent,
                consecutiveRegressionWindows: activeConsecutiveRegressionWindows,
            });
            continue;
        }

        if (window.formStarts < config.minFormStartsPerWindow) {
            evaluations.push({
                date: window.date,
                status: "insufficient_volume",
                formStarts: window.formStarts,
                completionRateFromFormStart: window.completionRateFromFormStart,
                baselineCompletionRate: average(baselineCandidates),
                dropPercent: null,
                thresholdPercent: config.dropThresholdPercent,
                consecutiveRegressionWindows: activeConsecutiveRegressionWindows,
            });
            continue;
        }

        const baselineCompletionRate = average(baselineCandidates);
        if (baselineCompletionRate === null || baselineCompletionRate <= 0) {
            evaluations.push({
                date: window.date,
                status: "baseline_zero",
                formStarts: window.formStarts,
                completionRateFromFormStart: window.completionRateFromFormStart,
                baselineCompletionRate,
                dropPercent: null,
                thresholdPercent: config.dropThresholdPercent,
                consecutiveRegressionWindows: activeConsecutiveRegressionWindows,
            });
            continue;
        }

        const dropPercent = Number(
            (
                ((baselineCompletionRate - window.completionRateFromFormStart) /
                    baselineCompletionRate) *
                100
            ).toFixed(2)
        );
        const isRegression = dropPercent > config.dropThresholdPercent;

        activeConsecutiveRegressionWindows = isRegression
            ? activeConsecutiveRegressionWindows + 1
            : 0;
        maxConsecutiveRegressionWindows = Math.max(
            maxConsecutiveRegressionWindows,
            activeConsecutiveRegressionWindows
        );

        evaluations.push({
            date: window.date,
            status: isRegression ? "regression" : "ok",
            formStarts: window.formStarts,
            completionRateFromFormStart: window.completionRateFromFormStart,
            baselineCompletionRate,
            dropPercent,
            thresholdPercent: config.dropThresholdPercent,
            consecutiveRegressionWindows: activeConsecutiveRegressionWindows,
        });
    }

    return {
        evaluations,
        latestConsecutiveRegressionWindows: activeConsecutiveRegressionWindows,
        maxConsecutiveRegressionWindows,
    };
}

function main() {
    const workspaceRoot = path.resolve(__dirname, "../../..");
    const reportsDir = path.join(workspaceRoot, "docs", "reports");
    const configPath = path.join(
        __dirname,
        "..",
        "config",
        "conversion-regression-sentinel.json"
    );

    const reportCandidates = listMatchingReports(reportsDir, "wave5-conversion-trend-");
    const sourceReportPath =
        process.env.CONVERSION_SENTINEL_SOURCE_REPORT ||
        process.argv[2] ||
        reportCandidates[reportCandidates.length - 1];

    const emergencyBypass =
        process.env.CONVERSION_SENTINEL_EMERGENCY_BYPASS?.trim() || "";
    const bypassActive = emergencyBypass.length > 0;

    if (!sourceReportPath || !fs.existsSync(sourceReportPath)) {
        const failurePayload = {
            generatedAt: new Date().toISOString(),
            status: bypassActive ? "pass_with_emergency_bypass" : "fail",
            sourceReport: sourceReportPath || null,
            failureReason: "missing_conversion_trend_report",
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

        const outputPath =
            process.env.REPORT_PATH ||
            path.join(
                reportsDir,
                `wave5-conversion-sentinel-${formatTimestamp()}.json`
            );
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, `${JSON.stringify(failurePayload, null, 2)}\n`, "utf8");
        console.log(`Wave 5 conversion sentinel report: ${outputPath}`);
        console.log(JSON.stringify(failurePayload, null, 2));

        if (!bypassActive) {
            process.exit(1);
        }

        return;
    }

    const config = readJson(configPath);
    const report = readJson(sourceReportPath);
    const windows = readWindowData(report);

    if (windows.length === 0) {
        console.error(`No valid weekly windows found in ${sourceReportPath}`);
        process.exit(1);
    }

    const evaluation = evaluateWindows(windows, config);
    const hasRegression =
        evaluation.maxConsecutiveRegressionWindows >=
        config.consecutiveWindowsToFail;

    const status = hasRegression
        ? bypassActive
            ? "pass_with_emergency_bypass"
            : "fail"
        : "pass";

    const outputPayload = {
        generatedAt: new Date().toISOString(),
        status,
        sourceReport: path.resolve(sourceReportPath),
        config,
        summary: {
            requiredConsecutiveRegressionWindows: config.consecutiveWindowsToFail,
            latestConsecutiveRegressionWindows:
                evaluation.latestConsecutiveRegressionWindows,
            maxConsecutiveRegressionWindows:
                evaluation.maxConsecutiveRegressionWindows,
            triggered: hasRegression,
            triggerReason: hasRegression
                ? "completion_rate_drop_consecutive_windows"
                : null,
        },
        windows: evaluation.evaluations,
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

    const outputPath =
        process.env.REPORT_PATH ||
        path.join(reportsDir, `wave5-conversion-sentinel-${formatTimestamp()}.json`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(outputPayload, null, 2)}\n`, "utf8");
    console.log(`Wave 5 conversion sentinel report: ${outputPath}`);
    console.log(JSON.stringify(outputPayload, null, 2));

    if (hasRegression && !bypassActive) {
        process.exit(1);
    }
}

main();
