#!/usr/bin/env node

/**
 * Production incident diagnostics for 4h automation pipeline.
 *
 * Usage:
 *   node scripts/automation_pipeline_diagnostics.js [--workflow-id <id>] [--email <user@email>] [--json]
 */

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

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

const DEFAULT_WINDOW_RUNS = 10;
const ALERTS = {
    schedulerMissedMultiplier: 1.5,
    repeatedZeroJobsThreshold: 3,
};

function parseArgs(argv) {
    const parsed = {
        workflowId: null,
        email: null,
        jsonOnly: false,
        failOnAlert: false,
        minSeverity: "critical",
    };

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === "--workflow-id") {
            parsed.workflowId = argv[i + 1] || null;
            i += 1;
        } else if (token === "--email") {
            parsed.email = argv[i + 1] || null;
            i += 1;
        } else if (token === "--json") {
            parsed.jsonOnly = true;
        } else if (token === "--fail-on-alert") {
            parsed.failOnAlert = true;
        } else if (token === "--min-severity") {
            const severity = String(argv[i + 1] || "").toLowerCase();
            if (severity === "warning" || severity === "critical") {
                parsed.minSeverity = severity;
            }
            i += 1;
        }
    }

    return parsed;
}

function countMainItems(main) {
    if (!Array.isArray(main)) {
        return 0;
    }
    return main.reduce((sum, branch) => {
        if (!Array.isArray(branch)) {
            return sum;
        }
        return sum + branch.length;
    }, 0);
}

function resolveCompact(value, pool, cache = new Map()) {
    if (typeof value === "string" && /^\d+$/.test(value)) {
        const idx = Number(value);
        if (!Number.isInteger(idx) || idx < 0 || idx >= pool.length) {
            return value;
        }

        if (cache.has(idx)) {
            return cache.get(idx);
        }

        const target = pool[idx];
        if (target === null || typeof target !== "object") {
            const primitive = resolveCompact(target, pool, cache);
            cache.set(idx, primitive);
            return primitive;
        }

        const container = Array.isArray(target) ? [] : {};
        cache.set(idx, container);

        if (Array.isArray(target)) {
            for (const item of target) {
                container.push(resolveCompact(item, pool, cache));
            }
        } else {
            for (const [k, v] of Object.entries(target)) {
                container[k] = resolveCompact(v, pool, cache);
            }
        }

        return container;
    }

    if (Array.isArray(value)) {
        return value.map((item) => resolveCompact(item, pool, cache));
    }

    if (value && typeof value === "object") {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = resolveCompact(v, pool, cache);
        }
        return out;
    }

    return value;
}

function decodeExecutionData(rawDataText) {
    if (!rawDataText) {
        return null;
    }

    try {
        const parsed = JSON.parse(rawDataText);
        if (Array.isArray(parsed) && parsed.length > 0) {
            return resolveCompact(parsed[0], parsed);
        }
        return parsed;
    } catch {
        return null;
    }
}

function stageSummaryFromRunData(runData) {
    const stageSummaries = [];

    for (const [stageName, entries] of Object.entries(runData || {})) {
        const safeEntries = Array.isArray(entries) ? entries : [];
        let timeMs = 0;
        let itemCount = 0;
        let hasError = false;
        let status = "unknown";
        let errorMessage = null;

        for (const entry of safeEntries) {
            if (!entry || typeof entry !== "object") {
                continue;
            }

            if (typeof entry.executionTime === "number") {
                timeMs += entry.executionTime;
            }

            if (entry.executionStatus === "error") {
                hasError = true;
                status = "error";
            } else if (entry.executionStatus === "success" && !hasError) {
                status = "success";
            }

            itemCount += countMainItems(entry.data?.main);

            if (!errorMessage && entry.error?.message) {
                errorMessage = String(entry.error.message);
            }
        }

        stageSummaries.push({
            stage: stageName,
            executions: safeEntries.length,
            status,
            hasError,
            timeMs,
            itemCount,
            errorMessage,
        });
    }

    return stageSummaries;
}

function getStage(stageSummaries, stageName) {
    return stageSummaries.find((stage) => stage.stage === stageName) || null;
}

function inferFailureReason(execution, stageSummaries) {
    if (!execution) {
        return "execution_missing";
    }

    if (execution.status && execution.status !== "success" && execution.status !== "waiting") {
        return `execution_${execution.status}`;
    }

    const fetchUsers = getStage(stageSummaries, "Fetch Active Users with Prefs & CV");
    const normalized =
        getStage(stageSummaries, "Normalize & Deduplicate") ||
        getStage(stageSummaries, "Fetch & Normalize All Job Sources");
    const scoring = getStage(stageSummaries, "LLM Relevance Scoring");
    const tailoring = getStage(stageSummaries, "LLM CV Tailoring");
    const batchSave = getStage(stageSummaries, "Batch Save via App API");

    if (fetchUsers && fetchUsers.itemCount === 0) {
        return "no_eligible_profiles";
    }

    if (normalized && normalized.itemCount === 0) {
        return "zero_jobs_after_normalization";
    }

    if (normalized && normalized.itemCount > 0 && scoring && scoring.itemCount === 0) {
        return "scoring_not_reached";
    }

    if (scoring && scoring.itemCount > 0 && tailoring && tailoring.itemCount === 0) {
        return "no_jobs_above_tailoring_threshold";
    }

    if (!batchSave) {
        return "batch_save_not_reached";
    }

    return "ok";
}

function pickScheduleCadenceMinutes(workflowNodes) {
    const schedule = (workflowNodes || []).find((node) => node.name === "Schedule Trigger");
    const interval = schedule?.parameters?.rule?.interval;
    const first = Array.isArray(interval) ? interval[0] : null;
    if (!first || typeof first !== "object") {
        return null;
    }

    if (first.field === "hours" && typeof first.hoursInterval === "number") {
        return first.hoursInterval * 60;
    }
    if (first.field === "minutes" && typeof first.minutesInterval === "number") {
        return first.minutesInterval;
    }
    return null;
}

function toTimestamp(value) {
    if (!value) {
        return null;
    }
    const ms = new Date(value).getTime();
    if (!Number.isFinite(ms)) {
        return null;
    }
    return ms;
}

function inferAlerts({
    cadenceMinutes,
    latestSuccessfulRunAt,
    runSummaries,
    workflowUpdatedAt = null,
    eligibleProfileCount = 0,
}) {
    const alerts = [];
    const now = Date.now();
    const workflowUpdatedAtMs = toTimestamp(workflowUpdatedAt);

    const runsInScope =
        workflowUpdatedAtMs === null
            ? runSummaries
            : runSummaries.filter((run) => {
                  const startedAtMs = toTimestamp(run.startedAt);
                  return startedAtMs !== null && startedAtMs >= workflowUpdatedAtMs;
              });

    const terminalRunsInScope = runsInScope.filter((run) => run.status !== "waiting");

    if (workflowUpdatedAtMs !== null && terminalRunsInScope.length === 0) {
        alerts.push({
            code: "post_update_run_pending",
            severity: "warning",
            detail: "workflow updated but no terminal run observed yet in diagnostics window",
        });
    }

    if (cadenceMinutes && latestSuccessfulRunAt) {
        const thresholdMs = cadenceMinutes * ALERTS.schedulerMissedMultiplier * 60 * 1000;
        const lagMs = now - new Date(latestSuccessfulRunAt).getTime();
        if (lagMs > thresholdMs) {
            alerts.push({
                code: "scheduler_missed_threshold",
                severity: "critical",
                detail: `last success is ${(lagMs / 60000).toFixed(1)} minutes ago`,
            });
        }
    }

    const recentCompleted = terminalRunsInScope
        .filter((run) => run.status === "success")
        .slice(0, ALERTS.repeatedZeroJobsThreshold);

    const leadingZeroUsers = [];
    for (const run of recentCompleted) {
        if (run.usersProcessedCount === 0) {
            leadingZeroUsers.push(run);
            continue;
        }
        break;
    }

    if (eligibleProfileCount > 0 && leadingZeroUsers.length >= 2) {
        alerts.push({
            code: "repeated_zero_users_processed",
            severity: "critical",
            detail: `${leadingZeroUsers.length} consecutive successful runs processed zero users while ${eligibleProfileCount} eligible profiles exist`,
        });
    }

    if (
        recentCompleted.length >= ALERTS.repeatedZeroJobsThreshold &&
        recentCompleted.every((run) => run.failureReason === "zero_jobs_after_normalization")
    ) {
        alerts.push({
            code: "repeated_zero_jobs",
            severity: "critical",
            detail: `${recentCompleted.length} consecutive runs produced zero jobs after normalization`,
        });
    }

    const generationFailures = terminalRunsInScope.filter(
        (run) =>
            run.stageSummaries.some(
                (stage) =>
                    (stage.stage === "LLM CV Tailoring" || stage.stage === "Parse Tailored Response") &&
                    stage.hasError
            )
    );

    if (generationFailures.length > 0) {
        alerts.push({
            code: "generation_failures_detected",
            severity: "warning",
            detail: `${generationFailures.length} recent runs include generation-stage errors`,
        });
    }

    const e2eFailures = terminalRunsInScope.filter((run) => run.status !== "success");
    if (e2eFailures.length > 0) {
        alerts.push({
            code: "end_to_end_run_failure",
            severity: "critical",
            detail: `${e2eFailures.length} recent runs have non-success terminal status`,
        });
    }

    return alerts;
}

function severityRank(severity) {
    if (severity === "critical") {
        return 2;
    }
    if (severity === "warning") {
        return 1;
    }
    return 0;
}

async function resolveDiscoveryWorkflow(prisma, workflowIdOverride) {
    if (workflowIdOverride) {
        const [wf] = await prisma.$queryRawUnsafe(
            `SELECT id, name, active, nodes, settings, "updatedAt" FROM n8n.workflow_entity WHERE id = $1 LIMIT 1;`,
            workflowIdOverride
        );
        return wf || null;
    }

    const [wf] = await prisma.$queryRawUnsafe(`
        SELECT id, name, active, nodes, settings, "updatedAt"
        FROM n8n.workflow_entity
        WHERE name ILIKE '%Job Discovery%Pipeline%'
        ORDER BY "updatedAt" DESC
        LIMIT 1;
    `);

    return wf || null;
}

async function main() {
    loadEnvIfPresent();
    const args = parseArgs(process.argv.slice(2));
    const prisma = new PrismaClient();

    try {
        const workflow = await resolveDiscoveryWorkflow(prisma, args.workflowId);
        if (!workflow) {
            throw new Error("workflow_not_found");
        }

        const users = await prisma.user.findMany({
            where: args.email ? { email: args.email } : undefined,
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                email: true,
                name: true,
                automationEnabled: true,
                subscriptionStatus: true,
                createdAt: true,
                updatedAt: true,
                masterProfile: { select: { id: true, updatedAt: true } },
                preferences: { select: { id: true, targetTitles: true, locations: true } },
                _count: { select: { applications: true } },
            },
        });

        const executions = await prisma.$queryRawUnsafe(
            `SELECT e.id, e.mode, e.status, e.finished, e."startedAt", e."stoppedAt", e."workflowId"
             FROM n8n.execution_entity e
             WHERE e."workflowId" = $1
             ORDER BY e."startedAt" DESC
             LIMIT $2;`,
            workflow.id,
            DEFAULT_WINDOW_RUNS
        );

        const executionIds = executions.map((row) => row.id).filter((id) => typeof id === "number");
        const executionDataRows = executionIds.length
            ? await prisma.$queryRawUnsafe(
                  `SELECT "executionId", data
                   FROM n8n.execution_data
                   WHERE "executionId" = ANY($1::int[])`,
                  executionIds
              )
            : [];

        const executionDataMap = new Map();
        for (const row of executionDataRows) {
            executionDataMap.set(row.executionId, decodeExecutionData(row.data));
        }

        const runSummaries = executions.map((execution) => {
        const decoded = executionDataMap.get(execution.id);
        const runData = decoded?.resultData?.runData || {};
        const stageSummaries = stageSummaryFromRunData(runData);

        const usersStage = getStage(stageSummaries, "Prepare User Data");
        const normalized =
            getStage(stageSummaries, "Normalize & Deduplicate") ||
            getStage(stageSummaries, "Fetch & Normalize All Job Sources");
        const tailored = getStage(stageSummaries, "Parse Tailored Response");

        return {
            executionId: execution.id,
            status: execution.status,
            startedAt: execution.startedAt,
            stoppedAt: execution.stoppedAt,
            mode: execution.mode,
            usersProcessedCount: usersStage ? usersStage.itemCount : 0,
            jobsFoundCount: normalized ? normalized.itemCount : 0,
            documentsGeneratedCount: tailored ? tailored.itemCount : 0,
            failureReason: inferFailureReason(execution, stageSummaries),
            stageSummaries,
        };
        });

        const latestSuccessfulRun = runSummaries.find((run) => run.status === "success") || null;

        const perProfile = [];
        for (const user of users) {
        const appStats = await prisma.application.aggregate({
            where: { userId: user.id },
            _count: { id: true },
            _max: { createdAt: true },
        });

        const tailoredStats = await prisma.application.aggregate({
            where: {
                userId: user.id,
                OR: [
                    { tailoredCvMarkdown: { not: null } },
                    { coverLetterMarkdown: { not: null } },
                ],
            },
            _count: { id: true },
            _max: { createdAt: true },
        });

        const eligible =
            user.automationEnabled &&
            ["pro", "unlimited"].includes(user.subscriptionStatus) &&
            Boolean(user.masterProfile?.id) &&
            Boolean(user.preferences?.id);

            perProfile.push({
            userId: user.id,
            email: user.email,
            name: user.name,
            subscriptionStatus: user.subscriptionStatus,
            automationEnabled: user.automationEnabled,
            eligibleForAutomation: eligible,
            profileReady: Boolean(user.masterProfile?.id),
            preferencesReady: Boolean(user.preferences?.id),
            lastProfileUpdateAt: user.masterProfile?.updatedAt || null,
            lastPreferencesTitles: user.preferences?.targetTitles || [],
            lastPreferencesLocations: user.preferences?.locations || [],
            applicationsTotal: appStats._count.id,
            lastApplicationAt: appStats._max.createdAt,
            documentsGeneratedTotal: tailoredStats._count.id,
            lastDocumentGeneratedAt: tailoredStats._max.createdAt,
            });
        }

        const cadenceMinutes = pickScheduleCadenceMinutes(workflow.nodes || []);
        const alerts = inferAlerts({
            cadenceMinutes,
            latestSuccessfulRunAt: latestSuccessfulRun?.startedAt || null,
            runSummaries,
            workflowUpdatedAt: workflow.updatedAt || null,
            eligibleProfileCount: perProfile.filter((profile) => profile.eligibleForAutomation).length,
        });

        const summary = {
        generatedAt: new Date().toISOString(),
        workflow: {
            id: workflow.id,
            name: workflow.name,
            active: workflow.active,
            updatedAt: workflow.updatedAt,
            cadenceMinutes,
            cadenceHours: cadenceMinutes ? Number((cadenceMinutes / 60).toFixed(2)) : null,
        },
        latest: {
            latestRunAt: runSummaries[0]?.startedAt || null,
            latestRunStatus: runSummaries[0]?.status || null,
            latestSuccessAt: latestSuccessfulRun?.startedAt || null,
            latestFailureReason: runSummaries[0]?.failureReason || null,
        },
        profiles: perProfile,
        runs: runSummaries,
        alerts,
        };

        if (args.failOnAlert) {
            const minRank = severityRank(args.minSeverity);
            const blockingAlerts = alerts.filter(
                (alert) => severityRank(alert.severity) >= minRank
            );
            if (blockingAlerts.length > 0) {
                process.stderr.write(
                    `automation_pipeline_alert_check_failed: ${JSON.stringify(
                        {
                            threshold: args.minSeverity,
                            blockingAlerts,
                        },
                        null,
                        2
                    )}\n`
                );
                process.exitCode = 1;
            }
        }

        if (args.jsonOnly) {
            process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
            return;
        }

        process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main().catch((error) => {
        process.stderr.write(`automation_pipeline_diagnostics_failed: ${error.message}\n`);
        process.exitCode = 1;
    });
}

module.exports = {
    parseArgs,
    pickScheduleCadenceMinutes,
    inferAlerts,
    inferFailureReason,
    severityRank,
    stageSummaryFromRunData,
};
