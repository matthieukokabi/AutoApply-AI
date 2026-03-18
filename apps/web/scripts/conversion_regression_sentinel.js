#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const CONFIDENCE_RANK = {
    none: 0,
    low: 1,
    medium: 2,
    high: 3,
};

const FAILURE_RUNBOOK_MAP = {
    missing_conversion_trend_report:
        "docs/conversion-sentinel-failure-runbook.md#missing_conversion_trend_report",
    missing_weekly_windows:
        "docs/conversion-sentinel-failure-runbook.md#missing_weekly_windows",
    source_report_failed:
        "docs/conversion-sentinel-failure-runbook.md#source_report_failed",
    source_stale:
        "docs/conversion-sentinel-failure-runbook.md#source_stale",
    fallback_window_exceeded:
        "docs/conversion-sentinel-failure-runbook.md#fallback_window_exceeded",
    required_funnel_events_missing:
        "docs/conversion-sentinel-failure-runbook.md#required_funnel_events_missing",
    quality_score_below_threshold:
        "docs/conversion-sentinel-failure-runbook.md#quality_score_below_threshold",
    route_dimension_missing:
        "docs/conversion-sentinel-failure-runbook.md#route_dimension_missing",
    campaign_dimension_missing:
        "docs/conversion-sentinel-failure-runbook.md#campaign_dimension_missing",
    completion_rate_drop_consecutive_windows:
        "docs/conversion-sentinel-failure-runbook.md#completion_rate_drop_consecutive_windows",
    organic_baseline_regression:
        "docs/conversion-sentinel-failure-runbook.md#organic_baseline_regression",
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

function readJsonSafe(filePath) {
    try {
        return readJson(filePath);
    } catch {
        return null;
    }
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

function standardDeviation(values) {
    if (values.length < 2) {
        return 0;
    }

    const mean = average(values);
    if (mean === null) {
        return 0;
    }

    const variance =
        values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    return Number(Math.sqrt(variance).toFixed(4));
}

function confidenceAtOrAbove(value, threshold) {
    return (CONFIDENCE_RANK[value] || 0) >= (CONFIDENCE_RANK[threshold] || 0);
}

function classifyRegressionConfidence(dropPercent, formStarts, config) {
    if (dropPercent === null || formStarts === null || dropPercent <= 0) {
        return "none";
    }

    if (
        dropPercent >= config.dropThresholdPercentHigh &&
        formStarts >= config.highConfidenceMinFormStarts
    ) {
        return "high";
    }

    if (
        dropPercent >= config.dropThresholdPercent &&
        formStarts >= config.mediumConfidenceMinFormStarts
    ) {
        return "medium";
    }

    if (dropPercent >= config.dropThresholdPercent) {
        return "low";
    }

    return "none";
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
    let highestRegressionConfidence = "none";

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
                confidenceTier: "none",
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
                confidenceTier: "none",
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
                confidenceTier: "none",
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
        const confidenceTier = classifyRegressionConfidence(
            dropPercent,
            window.formStarts,
            config
        );

        activeConsecutiveRegressionWindows = isRegression
            ? activeConsecutiveRegressionWindows + 1
            : 0;
        maxConsecutiveRegressionWindows = Math.max(
            maxConsecutiveRegressionWindows,
            activeConsecutiveRegressionWindows
        );
        if (isRegression && confidenceAtOrAbove(confidenceTier, highestRegressionConfidence)) {
            highestRegressionConfidence = confidenceTier;
        }

        evaluations.push({
            date: window.date,
            status: isRegression ? "regression" : "ok",
            formStarts: window.formStarts,
            completionRateFromFormStart: window.completionRateFromFormStart,
            baselineCompletionRate,
            dropPercent,
            thresholdPercent: config.dropThresholdPercent,
            confidenceTier,
            consecutiveRegressionWindows: activeConsecutiveRegressionWindows,
        });
    }

    return {
        evaluations,
        latestConsecutiveRegressionWindows: activeConsecutiveRegressionWindows,
        maxConsecutiveRegressionWindows,
        highestRegressionConfidence,
    };
}

function uniqueStringList(values) {
    return Array.from(
        new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === "string"))
    );
}

function resolveHistoryStorePath(reportsDir) {
    const envPath = process.env.CONVERSION_SENTINEL_HISTORY_STORE_PATH?.trim();
    if (envPath) {
        return path.resolve(envPath);
    }

    return path.join(reportsDir, "wave7-telemetry-history-store.json");
}

function readHistoryConversionEntries(historyStorePath) {
    const payload = readJsonSafe(historyStorePath);
    if (!payload || typeof payload !== "object") {
        return [];
    }

    const conversionEntries = payload?.streams?.conversion;
    if (!Array.isArray(conversionEntries)) {
        return [];
    }

    return conversionEntries
        .filter((entry) => entry && typeof entry === "object")
        .map((entry) => ({
            generatedAt:
                typeof entry.generatedAt === "string" ? entry.generatedAt : null,
            sourceMode:
                typeof entry.sourceMode === "string" ? entry.sourceMode : "unknown",
            channels: entry.channels && typeof entry.channels === "object"
                ? entry.channels
                : {},
        }))
        .filter((entry) => entry.generatedAt !== null);
}

function resolveCurrentOrganicSnapshot(report) {
    if (report?.channels?.organic && typeof report.channels.organic === "object") {
        return report.channels.organic;
    }

    const breakdown = Array.isArray(report?.channels?.breakdown)
        ? report.channels.breakdown
        : [];
    return breakdown.find((item) => item?.channel === "organic") || null;
}

function evaluateOrganicBaseline({
    report,
    config,
    historyEntries,
    previousState,
}) {
    const organicConfig = {
        dropThresholdPercent:
            toNumberOrNull(config?.organicBaseline?.dropThresholdPercent) ?? 35,
        consecutiveRunsToFail:
            toNumberOrNull(config?.organicBaseline?.consecutiveRunsToFail) ?? 2,
        minCurrentFormStarts:
            toNumberOrNull(config?.organicBaseline?.minCurrentFormStarts) ?? 8,
        minHistoryEntries:
            toNumberOrNull(config?.organicBaseline?.minHistoryEntries) ?? 4,
        minHistoryFormStarts:
            toNumberOrNull(config?.organicBaseline?.minHistoryFormStarts) ?? 25,
        sameWeekdayMinEntries:
            toNumberOrNull(config?.organicBaseline?.sameWeekdayMinEntries) ?? 2,
        volatilityGuardCoefficient:
            toNumberOrNull(config?.organicBaseline?.volatilityGuardCoefficient) ?? 0.45,
    };

    const currentOrganic = resolveCurrentOrganicSnapshot(report) || {};
    const currentGeneratedAt =
        typeof report?.generatedAt === "string"
            ? new Date(report.generatedAt)
            : new Date();
    const currentCompletionRate =
        toNumberOrNull(currentOrganic.completionRateFromFormStart) ?? 0;
    const currentFormStarts = toNumberOrNull(currentOrganic.formStarts) ?? 0;
    const currentWeekday = currentGeneratedAt.getUTCDay();

    const normalizedHistory = historyEntries
        .map((entry) => {
            const timestamp = new Date(entry.generatedAt);
            if (Number.isNaN(timestamp.getTime())) {
                return null;
            }

            const organicChannel = entry.channels?.organic;
            if (!organicChannel || typeof organicChannel !== "object") {
                return null;
            }

            const completionRate = toNumberOrNull(
                organicChannel.completionRateFromFormStart
            );
            const formStarts = toNumberOrNull(organicChannel.formStarts);
            if (completionRate === null || formStarts === null) {
                return null;
            }

            return {
                generatedAt: timestamp.toISOString(),
                weekday: timestamp.getUTCDay(),
                completionRate,
                formStarts,
                sourceMode: entry.sourceMode,
            };
        })
        .filter(Boolean)
        .filter(
            (entry) =>
                new Date(entry.generatedAt).getTime() <
                currentGeneratedAt.getTime()
        );

    const liveHistory = normalizedHistory.filter(
        (entry) => entry.sourceMode === "live"
    );
    const usableHistory = liveHistory.length > 0 ? liveHistory : normalizedHistory;
    const sameWeekdayHistory = usableHistory.filter(
        (entry) => entry.weekday === currentWeekday
    );
    const baselineHistory =
        sameWeekdayHistory.length >= organicConfig.sameWeekdayMinEntries
            ? sameWeekdayHistory
            : usableHistory;

    const historyRates = baselineHistory.map((entry) => entry.completionRate);
    const baselineCompletionRate = average(historyRates);
    const baselineFormStarts = baselineHistory.reduce(
        (sum, entry) => sum + entry.formStarts,
        0
    );
    const volatilityStdDev = standardDeviation(historyRates);
    const volatilityCoefficient =
        baselineCompletionRate && baselineCompletionRate > 0
            ? Number((volatilityStdDev / baselineCompletionRate).toFixed(4))
            : 0;

    let status = "eligible";
    if (currentFormStarts < organicConfig.minCurrentFormStarts) {
        status = "guarded_sparse_current";
    } else if (baselineHistory.length < organicConfig.minHistoryEntries) {
        status = "insufficient_history_entries";
    } else if (baselineFormStarts < organicConfig.minHistoryFormStarts) {
        status = "insufficient_history_volume";
    } else if (baselineCompletionRate === null || baselineCompletionRate <= 0) {
        status = "invalid_baseline";
    } else if (volatilityCoefficient > organicConfig.volatilityGuardCoefficient) {
        status = "guarded_volatile";
    }

    const dropPercent =
        baselineCompletionRate === null || baselineCompletionRate <= 0
            ? null
            : Number(
                  (
                      ((baselineCompletionRate - currentCompletionRate) /
                          baselineCompletionRate) *
                      100
                  ).toFixed(2)
              );
    const isRegression =
        typeof dropPercent === "number" &&
        dropPercent > organicConfig.dropThresholdPercent;
    const previousConsecutiveRuns = Number(
        previousState?.organicBaseline?.consecutiveRuns || 0
    );
    const nextConsecutiveRuns =
        status === "eligible" && isRegression ? previousConsecutiveRuns + 1 : 0;
    const triggered =
        status === "eligible" &&
        isRegression &&
        nextConsecutiveRuns >= organicConfig.consecutiveRunsToFail;

    return {
        status,
        config: organicConfig,
        seasonalityMode:
            baselineHistory === sameWeekdayHistory ? "same_weekday" : "rolling_all_days",
        sourceMode: liveHistory.length > 0 ? "live_history" : "mixed_history",
        current: {
            generatedAt: currentGeneratedAt.toISOString(),
            completionRateFromFormStart: currentCompletionRate,
            formStarts: currentFormStarts,
        },
        baseline: {
            sampleCount: baselineHistory.length,
            totalFormStarts: baselineFormStarts,
            completionRateFromFormStart: baselineCompletionRate,
            sameWeekdaySampleCount: sameWeekdayHistory.length,
            volatilityStdDev,
            volatilityCoefficient,
        },
        dropPercent,
        isRegression,
        triggered,
        previousConsecutiveRuns,
        nextConsecutiveRuns,
    };
}

function evaluateSourceGuard(report, config) {
    const sourceStatus =
        typeof report?.status === "string" ? report.status.trim() : "unknown";
    const sourceMode =
        typeof report?.sourceMode === "string" ? report.sourceMode.trim() : null;
    const sourceFailureCodes = uniqueStringList(report?.failureCodes || []);
    const configuredFailureCodes = new Set(
        uniqueStringList(config.sourceFailureCodesToFail || [])
    );
    const matchedSourceFailures = sourceFailureCodes.filter((code) =>
        configuredFailureCodes.has(code)
    );
    const triggerCodes = [...matchedSourceFailures];

    if (sourceStatus === "fail" && triggerCodes.length === 0) {
        triggerCodes.push("source_report_failed");
    }

    return {
        sourceStatus,
        sourceMode,
        sourceFailureCodes,
        matchedSourceFailures,
        triggerCodes: uniqueStringList(triggerCodes),
        triggered: triggerCodes.length > 0,
    };
}

function resolveLatestTrendReport(reportsDir) {
    const candidates = [
        ...listMatchingReports(reportsDir, "wave7-conversion-trend-live-"),
        ...listMatchingReports(reportsDir, "wave5-conversion-trend-"),
        ...listMatchingReports(reportsDir, "wave6-conversion-trend-live-"),
    ].sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);

    if (candidates.length === 0) {
        return null;
    }

    return candidates[candidates.length - 1];
}

function resolveStatePath(reportsDir, sourceReportPath) {
    const envPath = process.env.CONVERSION_SENTINEL_STATE_PATH?.trim();
    if (envPath) {
        return path.resolve(envPath);
    }

    if (sourceReportPath) {
        return path.join(path.dirname(path.resolve(sourceReportPath)), "wave6-conversion-sentinel-state.json");
    }

    return path.join(reportsDir, "wave6-conversion-sentinel-state.json");
}

function readState(statePath) {
    return readJsonSafe(statePath) || {};
}

function mapRunbook(codes) {
    return uniqueStringList(codes).map((code) => ({
        code,
        runbook: FAILURE_RUNBOOK_MAP[code] || "docs/conversion-sentinel-failure-runbook.md#general",
    }));
}

function buildAlertDispatch({
    now,
    cooldownMinutes,
    previousState,
    triggered,
    triggerCode,
    alertFingerprint,
}) {
    if (!triggered || !triggerCode) {
        return {
            status: "no_alert",
            cooldownSuppressed: false,
            cooldownMinutes,
            alertFingerprint,
            minutesSinceLastAlert: null,
        };
    }

    const previousTriggeredAt =
        typeof previousState?.lastTriggeredAt === "string"
            ? new Date(previousState.lastTriggeredAt)
            : null;
    const previousValid = previousTriggeredAt && !Number.isNaN(previousTriggeredAt.getTime());
    const minutesSinceLastAlert = previousValid
        ? Number(((now.getTime() - previousTriggeredAt.getTime()) / (60 * 1000)).toFixed(2))
        : null;
    const sameFingerprint =
        previousState?.lastTriggerCode === triggerCode &&
        previousState?.lastAlertFingerprint === alertFingerprint;
    const cooldownSuppressed =
        sameFingerprint &&
        minutesSinceLastAlert !== null &&
        minutesSinceLastAlert < cooldownMinutes;

    return {
        status: cooldownSuppressed ? "suppressed_cooldown" : "dispatch",
        cooldownSuppressed,
        cooldownMinutes,
        alertFingerprint,
        minutesSinceLastAlert,
    };
}

function persistState(statePath, statePayload) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, `${JSON.stringify(statePayload, null, 2)}\n`, "utf8");
}

function main() {
    const now = new Date();
    const workspaceRoot = path.resolve(__dirname, "../../..");
    const reportsDir = path.join(workspaceRoot, "docs", "reports");
    const configPath = path.join(
        __dirname,
        "..",
        "config",
        "conversion-regression-sentinel.json"
    );

    const sourceReportPath =
        process.env.CONVERSION_SENTINEL_SOURCE_REPORT ||
        process.argv[2] ||
        resolveLatestTrendReport(reportsDir);
    const historyStorePath = resolveHistoryStorePath(reportsDir);
    const statePath = resolveStatePath(reportsDir, sourceReportPath);
    const emergencyBypass =
        process.env.CONVERSION_SENTINEL_EMERGENCY_BYPASS?.trim() || "";
    const bypassActive = emergencyBypass.length > 0;
    const outputPath =
        process.env.REPORT_PATH ||
        path.join(reportsDir, `wave6-conversion-sentinel-${formatTimestamp()}.json`);

    if (!sourceReportPath || !fs.existsSync(sourceReportPath)) {
        const failureCodes = ["missing_conversion_trend_report"];
        const outputPayload = {
            generatedAt: now.toISOString(),
            status: bypassActive ? "pass_with_emergency_bypass" : "fail",
            sourceReport: sourceReportPath || null,
            summary: {
                triggered: true,
                triggerCode: failureCodes[0],
                triggerCodes: failureCodes,
                triggerReason: "missing conversion trend report",
                confidenceTier: "none",
            },
            failureCodes,
            runbook: mapRunbook(failureCodes),
            emergencyBypass: bypassActive
                ? { active: true, reason: emergencyBypass }
                : { active: false, reason: null },
        };
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, `${JSON.stringify(outputPayload, null, 2)}\n`, "utf8");
        console.log(`Wave 6 conversion sentinel report: ${outputPath}`);
        console.log(JSON.stringify(outputPayload, null, 2));
        if (!bypassActive) {
            process.exit(1);
        }
        return;
    }

    const config = readJson(configPath);
    const report = readJson(sourceReportPath);
    const historyEntries = readHistoryConversionEntries(historyStorePath);
    const windows = readWindowData(report);

    if (windows.length === 0) {
        const failureCodes = ["missing_weekly_windows"];
        const outputPayload = {
            generatedAt: now.toISOString(),
            status: bypassActive ? "pass_with_emergency_bypass" : "fail",
            sourceReport: path.resolve(sourceReportPath),
            summary: {
                triggered: true,
                triggerCode: failureCodes[0],
                triggerCodes: failureCodes,
                triggerReason: "source trend report has no usable weekly windows",
                confidenceTier: "none",
            },
            failureCodes,
            runbook: mapRunbook(failureCodes),
            emergencyBypass: bypassActive
                ? { active: true, reason: emergencyBypass }
                : { active: false, reason: null },
        };
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, `${JSON.stringify(outputPayload, null, 2)}\n`, "utf8");
        console.log(`Wave 6 conversion sentinel report: ${outputPath}`);
        console.log(JSON.stringify(outputPayload, null, 2));
        if (!bypassActive) {
            process.exit(1);
        }
        return;
    }

    const sourceGuard = evaluateSourceGuard(report, config);
    const evaluation = evaluateWindows(windows, config);
    const previousState = readState(statePath);
    const organicBaseline = evaluateOrganicBaseline({
        report,
        config,
        historyEntries,
        previousState,
    });
    const regressionTriggered =
        evaluation.maxConsecutiveRegressionWindows >=
            config.consecutiveWindowsToFail &&
        confidenceAtOrAbove(evaluation.highestRegressionConfidence, "medium");

    const triggerCodes = uniqueStringList([
        ...sourceGuard.triggerCodes,
        ...(regressionTriggered
            ? ["completion_rate_drop_consecutive_windows"]
            : []),
        ...(organicBaseline.triggered
            ? ["organic_baseline_regression"]
            : []),
    ]);
    const triggered = triggerCodes.length > 0;
    const triggerCode = triggerCodes[0] || null;
    const alertFingerprint = triggerCode
        ? `${triggerCode}:${evaluation.maxConsecutiveRegressionWindows}:${evaluation.highestRegressionConfidence}:${sourceGuard.sourceMode || "none"}`
        : null;
    const alertDispatch = buildAlertDispatch({
        now,
        cooldownMinutes:
            typeof config.alertCooldownMinutes === "number"
                ? config.alertCooldownMinutes
                : 180,
        previousState,
        triggered,
        triggerCode,
        alertFingerprint,
    });

    const status = triggered
        ? bypassActive
            ? "pass_with_emergency_bypass"
            : "fail"
        : "pass";

    const outputPayload = {
        generatedAt: now.toISOString(),
        status,
        sourceReport: path.resolve(sourceReportPath),
        statePath: path.resolve(statePath),
        historyStorePath: path.resolve(historyStorePath),
        sourceGuard,
        config,
        summary: {
            requiredConsecutiveRegressionWindows: config.consecutiveWindowsToFail,
            latestConsecutiveRegressionWindows:
                evaluation.latestConsecutiveRegressionWindows,
            maxConsecutiveRegressionWindows:
                evaluation.maxConsecutiveRegressionWindows,
            highestRegressionConfidence:
                evaluation.highestRegressionConfidence,
            triggered,
            triggerCode,
            triggerCodes,
            triggerReason: triggerCode
                ? `triggered by ${triggerCode}`
                : null,
            regressionTriggered,
            organicBaseline: {
                status: organicBaseline.status,
                triggered: organicBaseline.triggered,
                dropPercent: organicBaseline.dropPercent,
                consecutiveRuns: organicBaseline.nextConsecutiveRuns,
                seasonalityMode: organicBaseline.seasonalityMode,
                volatilityCoefficient:
                    organicBaseline.baseline.volatilityCoefficient,
            },
            alertDispatch,
        },
        failureCodes: triggerCodes,
        runbook: mapRunbook(triggerCodes),
        windows: evaluation.evaluations,
        channelTracks: {
            organic: organicBaseline,
        },
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

    persistState(statePath, {
        generatedAt: now.toISOString(),
        lastStatus: status,
        lastTriggerCode: triggerCode,
        lastTriggerCodes: triggerCodes,
        lastAlertFingerprint: alertFingerprint,
        lastTriggeredAt: triggered ? now.toISOString() : null,
        lastAlertDispatchStatus: alertDispatch.status,
        organicBaseline: {
            lastStatus: organicBaseline.status,
            consecutiveRuns: organicBaseline.nextConsecutiveRuns,
            lastDropPercent: organicBaseline.dropPercent,
            updatedAt: now.toISOString(),
        },
    });

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(outputPayload, null, 2)}\n`, "utf8");
    console.log(`Wave 6 conversion sentinel report: ${outputPath}`);
    console.log(JSON.stringify(outputPayload, null, 2));

    if (triggered && !bypassActive) {
        process.exit(1);
    }
}

main();
