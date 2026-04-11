#!/usr/bin/env node

/**
 * Backfill `payload.applicationId` for recent FACTUAL_GUARD_BLOCKED workflow errors.
 *
 * Safety contract:
 * - Dry-run by default (no DB writes).
 * - Bounded recent window (default last 90 days).
 * - Updates only when exactly one unambiguous application is resolvable.
 * - Preserves all existing payload fields.
 *
 * Usage:
 *   node scripts/backfill_factual_guard_application_id.js --dry-run --days 90
 *   node scripts/backfill_factual_guard_application_id.js --apply --days 90
 */

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const FACTUAL_GUARD_BLOCKED = "FACTUAL_GUARD_BLOCKED";
const DEFAULT_DAYS = 90;
const MAX_SAMPLE_IDS = 10;

function parseArgs(argv) {
    const args = {
        dryRun: true,
        days: DEFAULT_DAYS,
        maxRows: null,
        help: false,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === "--apply") {
            args.dryRun = false;
        } else if (token === "--dry-run") {
            args.dryRun = true;
        } else if (token === "--days") {
            const value = Number(argv[i + 1]);
            if (Number.isFinite(value) && value > 0) {
                args.days = Math.max(1, Math.floor(value));
            }
            i += 1;
        } else if (token === "--max-rows") {
            const value = Number(argv[i + 1]);
            if (Number.isFinite(value) && value > 0) {
                args.maxRows = Math.max(1, Math.floor(value));
            }
            i += 1;
        } else if (token === "--help" || token === "-h") {
            args.help = true;
        }
    }

    return args;
}

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

function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getPayloadString(payload, key) {
    const value = payload[key];
    return typeof value === "string" ? value.trim() : "";
}

function addSampleId(target, rowId) {
    if (target.length >= MAX_SAMPLE_IDS) {
        return;
    }
    target.push(rowId);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        process.stdout.write(
            [
                "Usage:",
                "  node scripts/backfill_factual_guard_application_id.js --dry-run --days 90",
                "  node scripts/backfill_factual_guard_application_id.js --apply --days 90",
                "Options:",
                "  --dry-run      default mode; no database writes",
                "  --apply        perform updates",
                "  --days <n>     recent window in days (default 90)",
                "  --max-rows <n> optional cap on scanned rows",
            ].join("\n") + "\n"
        );
        return;
    }

    loadEnvIfPresent();
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is required (env or apps/web/.env.local)");
    }

    const prisma = new PrismaClient();
    const now = new Date();
    const windowStart = new Date(now.getTime() - args.days * 24 * 60 * 60 * 1000);

    const summary = {
        mode: args.dryRun ? "dry-run" : "apply",
        windowDays: args.days,
        windowStart: windowStart.toISOString(),
        matchingRules: [
            "Trusted user key required: row.userId or payload.userId",
            "Match path A: (userId + payload.jobId|payload.resolvedJobId) => Application(userId_jobId)",
            "Match path B: (userId + payload.externalId) => Job(externalId) => Application(userId_jobId)",
            "Backfill only when exactly one candidate applicationId is resolved",
            "Ambiguous or unresolved rows are skipped",
        ],
        scannedCount: 0,
        alreadyLinkedSkippedCount: 0,
        missingPayloadSkippedCount: 0,
        ambiguousSkippedCount: 0,
        unresolvedSkippedCount: 0,
        backfillableCount: 0,
        updatedCount: 0,
        errorCount: 0,
        samples: {
            ambiguousRowIds: [],
            unresolvedRowIds: [],
            missingPayloadRowIds: [],
            updatedRowIds: [],
            erroredRowIds: [],
        },
    };

    const appByUserJobCache = new Map();
    const jobIdByExternalIdCache = new Map();

    const buildRowsQuery = () => {
        const baseQuery = {
            where: {
                errorType: FACTUAL_GUARD_BLOCKED,
                createdAt: {
                    gte: windowStart,
                },
            },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                userId: true,
                payload: true,
            },
        };
        if (!args.maxRows) {
            return baseQuery;
        }
        return { ...baseQuery, take: args.maxRows };
    };

    async function findApplicationIdByUserJob(userId, jobId) {
        const cacheKey = `${userId}:${jobId}`;
        if (appByUserJobCache.has(cacheKey)) {
            return appByUserJobCache.get(cacheKey);
        }
        const app = await prisma.application.findUnique({
            where: {
                userId_jobId: {
                    userId,
                    jobId,
                },
            },
            select: { id: true },
        });
        const applicationId = app?.id || null;
        appByUserJobCache.set(cacheKey, applicationId);
        return applicationId;
    }

    async function findJobIdByExternalId(externalId) {
        if (jobIdByExternalIdCache.has(externalId)) {
            return jobIdByExternalIdCache.get(externalId);
        }
        const job = await prisma.job.findUnique({
            where: { externalId },
            select: { id: true },
        });
        const jobId = job?.id || null;
        jobIdByExternalIdCache.set(externalId, jobId);
        return jobId;
    }

    try {
        const rows = await prisma.workflowError.findMany(buildRowsQuery());
        summary.scannedCount = rows.length;

        for (const row of rows) {
            try {
                if (!isRecord(row.payload)) {
                    summary.missingPayloadSkippedCount += 1;
                    addSampleId(summary.samples.missingPayloadRowIds, row.id);
                    continue;
                }

                const payload = row.payload;
                const existingApplicationId = getPayloadString(payload, "applicationId");
                if (existingApplicationId) {
                    summary.alreadyLinkedSkippedCount += 1;
                    continue;
                }

                const resolvedUserId = String(
                    (row.userId || getPayloadString(payload, "userId") || "").trim()
                );
                if (!resolvedUserId) {
                    summary.unresolvedSkippedCount += 1;
                    addSampleId(summary.samples.unresolvedRowIds, row.id);
                    continue;
                }

                const candidateIds = new Set();
                const payloadJobId =
                    getPayloadString(payload, "jobId") || getPayloadString(payload, "resolvedJobId");
                const payloadExternalId = getPayloadString(payload, "externalId");

                if (payloadJobId) {
                    const byJobId = await findApplicationIdByUserJob(resolvedUserId, payloadJobId);
                    if (byJobId) {
                        candidateIds.add(byJobId);
                    }
                }

                if (payloadExternalId) {
                    const jobIdFromExternal = await findJobIdByExternalId(payloadExternalId);
                    if (jobIdFromExternal) {
                        const byExternal = await findApplicationIdByUserJob(
                            resolvedUserId,
                            jobIdFromExternal
                        );
                        if (byExternal) {
                            candidateIds.add(byExternal);
                        }
                    }
                }

                if (candidateIds.size === 0) {
                    summary.unresolvedSkippedCount += 1;
                    addSampleId(summary.samples.unresolvedRowIds, row.id);
                    continue;
                }

                if (candidateIds.size > 1) {
                    summary.ambiguousSkippedCount += 1;
                    addSampleId(summary.samples.ambiguousRowIds, row.id);
                    continue;
                }

                const [applicationId] = Array.from(candidateIds);
                summary.backfillableCount += 1;

                if (!args.dryRun) {
                    const nextPayload = {
                        ...payload,
                        applicationId,
                    };
                    await prisma.workflowError.update({
                        where: { id: row.id },
                        data: {
                            payload: nextPayload,
                        },
                    });
                    summary.updatedCount += 1;
                    addSampleId(summary.samples.updatedRowIds, row.id);
                }
            } catch (_rowError) {
                summary.errorCount += 1;
                addSampleId(summary.samples.erroredRowIds, row.id);
            }
        }

        process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main().catch((error) => {
        process.stderr.write(`backfill_factual_guard_application_id_failed: ${error.message}\n`);
        process.exitCode = 1;
    });
}

module.exports = {
    parseArgs,
};
