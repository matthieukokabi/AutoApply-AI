#!/usr/bin/env node

/**
 * Operator-safe audit for recent discovery run ledger health.
 *
 * Usage:
 *   node scripts/discovery_run_ledger_audit.js [--count <n>] [--hours <n>] [--run-id <id>] [--workflow-id <id>] [--json] [--fail-on-anomaly]
 */

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const DEFAULT_COUNT = 12;
const DEFAULT_WORKFLOW_ID = "job-discovery-pipeline-v3";
const DEFAULT_ZERO_TAILORED_STREAK_THRESHOLD = 2;
const DEFAULT_BLOCK_RATE_SPIKE_THRESHOLD = 0.5;
const DEFAULT_MIN_RUNS_FOR_SPIKE = 3;

const COMPLETED_STATUS = "completed";
const FAILED_STATUSES = new Set(["failed", "trigger_failed"]);
const TERMINAL_STATUSES = new Set(["completed", "failed", "trigger_failed", "lock_skipped"]);
const RUN_METRIC_KEYS = [
    "tailoredCount",
    "discoveredCount",
    "factualGuardBlockedCount",
    "coverLetterQualityBlockedCount",
];

function loadEnvIfPresent() {
    if (process.env.DATABASE_URL) {
        return;
    }

    const envPath = path.join(process.cwd(), ".env.local");
    if (!fs.existsSync(envPath)) {
        return;
    }

    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }
        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex <= 0) {
            continue;
        }
        const key = trimmed.slice(0, separatorIndex).trim();
        let value = trimmed.slice(separatorIndex + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        if (!key || process.env[key] !== undefined) {
            continue;
        }
        process.env[key] = value;
    }
}

function toPositiveInt(value, fallback) {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return parsed;
}

function toNonNegativeInt(value, fallback = null) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(0, Math.floor(parsed));
}

function toIsoOrNull(value) {
    if (!value) {
        return null;
    }
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString();
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseArgs(argv) {
    const parsed = {
        count: DEFAULT_COUNT,
        hours: null,
        runId: null,
        workflowId: DEFAULT_WORKFLOW_ID,
        jsonOnly: false,
        failOnAnomaly: false,
        zeroTailoredStreakThreshold: DEFAULT_ZERO_TAILORED_STREAK_THRESHOLD,
        blockRateSpikeThreshold: DEFAULT_BLOCK_RATE_SPIKE_THRESHOLD,
        minRunsForSpike: DEFAULT_MIN_RUNS_FOR_SPIKE,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === "--count") {
            parsed.count = toPositiveInt(argv[i + 1], DEFAULT_COUNT);
            i += 1;
        } else if (token === "--hours") {
            parsed.hours = toPositiveInt(argv[i + 1], null);
            i += 1;
        } else if (token === "--run-id") {
            parsed.runId = String(argv[i + 1] || "").trim() || null;
            i += 1;
        } else if (token === "--workflow-id") {
            parsed.workflowId = String(argv[i + 1] || "").trim() || DEFAULT_WORKFLOW_ID;
            i += 1;
        } else if (token === "--json") {
            parsed.jsonOnly = true;
        } else if (token === "--fail-on-anomaly") {
            parsed.failOnAnomaly = true;
        } else if (token === "--zero-tailored-streak-threshold") {
            parsed.zeroTailoredStreakThreshold = toPositiveInt(
                argv[i + 1],
                DEFAULT_ZERO_TAILORED_STREAK_THRESHOLD
            );
            i += 1;
        } else if (token === "--block-rate-spike-threshold") {
            const threshold = Number(argv[i + 1]);
            if (Number.isFinite(threshold) && threshold >= 0 && threshold <= 1) {
                parsed.blockRateSpikeThreshold = threshold;
            }
            i += 1;
        } else if (token === "--min-runs-for-spike") {
            parsed.minRunsForSpike = toPositiveInt(argv[i + 1], DEFAULT_MIN_RUNS_FOR_SPIKE);
            i += 1;
        }
    }

    if (parsed.runId) {
        parsed.count = 1;
    }

    return parsed;
}

function extractRunMetrics(metadata) {
    const metadataObject =
        metadata && typeof metadata === "object" && !Array.isArray(metadata)
            ? metadata
            : {};
    const runMetrics =
        metadataObject.runMetrics &&
        typeof metadataObject.runMetrics === "object" &&
        !Array.isArray(metadataObject.runMetrics)
            ? metadataObject.runMetrics
            : {};

    return {
        tailoredCount: toNonNegativeInt(runMetrics.tailoredCount),
        discoveredCount: toNonNegativeInt(runMetrics.discoveredCount),
        factualGuardBlockedCount: toNonNegativeInt(runMetrics.factualGuardBlockedCount),
        coverLetterQualityBlockedCount: toNonNegativeInt(
            runMetrics.coverLetterQualityBlockedCount
        ),
        metricsUpdatedAt: toIsoOrNull(metadataObject.metricsUpdatedAt),
    };
}

function normalizeLedgerRow(row) {
    const metrics = extractRunMetrics(row.metadata);
    const missingExpectedSummaryFields = [];

    if (!row.runId) {
        missingExpectedSummaryFields.push("runId");
    }
    if (TERMINAL_STATUSES.has(row.status) && !row.finishedAt) {
        missingExpectedSummaryFields.push("finishedAt");
    }
    if (row.status === COMPLETED_STATUS) {
        for (const metricKey of RUN_METRIC_KEYS) {
            if (metrics[metricKey] === null) {
                missingExpectedSummaryFields.push(`metadata.runMetrics.${metricKey}`);
            }
        }
    }

    return {
        id: row.id,
        runId: row.runId,
        slotKey: row.slotKey,
        status: row.status,
        triggerKind: row.triggerKind,
        schedulerSource: row.schedulerSource,
        n8nExecutionId: row.n8nExecutionId,
        requestedAt: toIsoOrNull(row.requestedAt),
        startedAt: toIsoOrNull(row.startedAt),
        finishedAt: toIsoOrNull(row.finishedAt),
        usersProcessed: row.usersProcessed,
        persistedApplications: row.persistedApplications,
        errorCode: row.errorCode,
        errorMessage: row.errorMessage,
        ...metrics,
        missingExpectedSummaryFields,
    };
}

function detectAnomalies(normalizedRuns, options = {}) {
    const anomalies = [];
    if (!Array.isArray(normalizedRuns) || normalizedRuns.length === 0) {
        anomalies.push({
            code: "no_recent_runs_found",
            severity: "warning",
            detail: "No discovery ledger rows matched the audit scope.",
        });
        return anomalies;
    }

    const zeroTailoredStreakThreshold =
        options.zeroTailoredStreakThreshold || DEFAULT_ZERO_TAILORED_STREAK_THRESHOLD;
    const blockRateSpikeThreshold =
        typeof options.blockRateSpikeThreshold === "number"
            ? options.blockRateSpikeThreshold
            : DEFAULT_BLOCK_RATE_SPIKE_THRESHOLD;
    const minRunsForSpike = options.minRunsForSpike || DEFAULT_MIN_RUNS_FOR_SPIKE;

    const failedRuns = normalizedRuns.filter((run) => FAILED_STATUSES.has(run.status));
    if (failedRuns.length > 0) {
        anomalies.push({
            code: "failed_runs_present",
            severity: "warning",
            detail: `${failedRuns.length} failed discovery run(s) in audit window.`,
        });
    }

    const latestRun = normalizedRuns[0];
    if (latestRun.missingExpectedSummaryFields.length > 0) {
        anomalies.push({
            code: "latest_run_missing_summary_fields",
            severity: "warning",
            detail: `Latest run is missing summary fields: ${latestRun.missingExpectedSummaryFields.join(", ")}`,
        });
    }

    let zeroTailoredStreak = 0;
    for (const run of normalizedRuns) {
        if (run.status !== COMPLETED_STATUS) {
            continue;
        }
        if (run.tailoredCount === 0) {
            zeroTailoredStreak += 1;
        } else {
            break;
        }
    }
    if (zeroTailoredStreak >= zeroTailoredStreakThreshold) {
        anomalies.push({
            code: "repeated_zero_tailored_runs",
            severity: "warning",
            detail: `${zeroTailoredStreak} consecutive completed run(s) with zero tailored outputs.`,
        });
    }

    const completedRuns = normalizedRuns.filter((run) => run.status === COMPLETED_STATUS);
    if (completedRuns.length >= minRunsForSpike) {
        const factualBlockRate =
            completedRuns.filter((run) => (run.factualGuardBlockedCount || 0) > 0).length /
            completedRuns.length;
        if (factualBlockRate >= blockRateSpikeThreshold) {
            anomalies.push({
                code: "factual_guard_block_rate_spike",
                severity: "warning",
                detail: `Factual-guard block rate ${factualBlockRate.toFixed(2)} across completed runs.`,
            });
        }

        const coverBlockRate =
            completedRuns.filter((run) => (run.coverLetterQualityBlockedCount || 0) > 0).length /
            completedRuns.length;
        if (coverBlockRate >= blockRateSpikeThreshold) {
            anomalies.push({
                code: "cover_letter_block_rate_spike",
                severity: "warning",
                detail: `Cover-letter block rate ${coverBlockRate.toFixed(2)} across completed runs.`,
            });
        }
    }

    return anomalies;
}

function summarizeRuns(rows, options = {}) {
    const normalizedRuns = Array.isArray(rows) ? rows.map(normalizeLedgerRow) : [];
    const totalRunsInspected = normalizedRuns.length;
    const completedRuns = normalizedRuns.filter(
        (run) => run.status === COMPLETED_STATUS
    ).length;
    const failedRuns = normalizedRuns.filter((run) => FAILED_STATUSES.has(run.status)).length;
    const runsWithZeroTailoredOutputs = normalizedRuns.filter(
        (run) => run.status === COMPLETED_STATUS && run.tailoredCount === 0
    ).length;
    const runsWithFactualGuardBlocks = normalizedRuns.filter(
        (run) => (run.factualGuardBlockedCount || 0) > 0
    ).length;
    const runsWithCoverLetterQualityBlocks = normalizedRuns.filter(
        (run) => (run.coverLetterQualityBlockedCount || 0) > 0
    ).length;
    const runsMissingExpectedSummaryFields = normalizedRuns.filter(
        (run) => run.missingExpectedSummaryFields.length > 0
    ).length;
    const latestRun = normalizedRuns[0] || null;
    const anomalies = detectAnomalies(normalizedRuns, options);

    return {
        totalRunsInspected,
        completedRuns,
        failedRuns,
        runsWithZeroTailoredOutputs,
        runsWithFactualGuardBlocks,
        runsWithCoverLetterQualityBlocks,
        runsMissingExpectedSummaryFields,
        latestRunStatus: latestRun ? latestRun.status : null,
        latestRunRequestedAt: latestRun ? latestRun.requestedAt : null,
        latestRunFinishedAt: latestRun ? latestRun.finishedAt : null,
        anomalies,
        runs: normalizedRuns,
    };
}

async function fetchLedgerRows(prisma, args) {
    const where = {
        workflowId: args.workflowId,
    };

    if (args.runId) {
        where.runId = args.runId;
    }
    if (args.hours) {
        where.requestedAt = {
            gte: new Date(Date.now() - args.hours * 60 * 60 * 1000),
        };
    }

    return prisma.discoveryScheduleRun.findMany({
        where,
        orderBy: { requestedAt: "desc" },
        take: args.count,
        select: {
            id: true,
            runId: true,
            slotKey: true,
            status: true,
            triggerKind: true,
            schedulerSource: true,
            n8nExecutionId: true,
            requestedAt: true,
            startedAt: true,
            finishedAt: true,
            usersProcessed: true,
            persistedApplications: true,
            errorCode: true,
            errorMessage: true,
            metadata: true,
        },
    });
}

function printHuman(report) {
    const summary = report.summary;
    process.stdout.write(
        [
            `discovery_ledger_audit workflow=${report.scope.workflowId}`,
            `inspected=${summary.totalRunsInspected}`,
            `completed=${summary.completedRuns}`,
            `failed=${summary.failedRuns}`,
            `zero_tailored_runs=${summary.runsWithZeroTailoredOutputs}`,
            `factual_block_runs=${summary.runsWithFactualGuardBlocks}`,
            `cover_block_runs=${summary.runsWithCoverLetterQualityBlocks}`,
            `missing_summary_runs=${summary.runsMissingExpectedSummaryFields}`,
            `latest_status=${summary.latestRunStatus || "none"}`,
            `latest_requested_at=${summary.latestRunRequestedAt || "none"}`,
        ].join("\n") + "\n"
    );

    if (summary.anomalies.length > 0) {
        process.stdout.write("anomalies:\n");
        for (const anomaly of summary.anomalies) {
            process.stdout.write(
                `- [${anomaly.severity}] ${anomaly.code}: ${anomaly.detail}\n`
            );
        }
    } else {
        process.stdout.write("anomalies:\n- none\n");
    }
}

async function main() {
    loadEnvIfPresent();
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is required (env or apps/web/.env.local)");
    }

    const args = parseArgs(process.argv.slice(2));
    const prisma = new PrismaClient();
    try {
        const rows = await fetchLedgerRows(prisma, args);
        const summary = summarizeRuns(rows, args);

        const report = {
            generatedAt: new Date().toISOString(),
            scope: {
                workflowId: args.workflowId,
                runId: args.runId,
                count: args.count,
                hours: args.hours,
            },
            summary: {
                totalRunsInspected: summary.totalRunsInspected,
                completedRuns: summary.completedRuns,
                failedRuns: summary.failedRuns,
                runsWithZeroTailoredOutputs: summary.runsWithZeroTailoredOutputs,
                runsWithFactualGuardBlocks: summary.runsWithFactualGuardBlocks,
                runsWithCoverLetterQualityBlocks: summary.runsWithCoverLetterQualityBlocks,
                runsMissingExpectedSummaryFields: summary.runsMissingExpectedSummaryFields,
                latestRunStatus: summary.latestRunStatus,
                latestRunRequestedAt: summary.latestRunRequestedAt,
                latestRunFinishedAt: summary.latestRunFinishedAt,
                anomalies: summary.anomalies,
            },
            runs: summary.runs,
        };

        if (args.jsonOnly) {
            process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        } else {
            printHuman(report);
        }

        if (args.failOnAnomaly && summary.anomalies.length > 0) {
            process.exitCode = 1;
        }
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main().catch((error) => {
        process.stderr.write(`discovery_run_ledger_audit_failed: ${error.message}\n`);
        process.exitCode = 1;
    });
}

module.exports = {
    parseArgs,
    extractRunMetrics,
    summarizeRuns,
    detectAnomalies,
};
