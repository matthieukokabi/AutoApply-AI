#!/usr/bin/env node

/**
 * Create a rollback checkpoint for n8n workflows (version ids + integrity metadata).
 *
 * Usage:
 *   node scripts/n8n_workflow_checkpoint.js
 *   node scripts/n8n_workflow_checkpoint.js --workflow-id <id> --workflow-id <id> --json
 *   node scripts/n8n_workflow_checkpoint.js --output docs/reports/custom-checkpoint.json
 *   node scripts/n8n_workflow_checkpoint.js --no-output
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

const DEFAULT_WORKFLOW_IDS = [
    "hL4t2SFOT4IUeBcO", // Job Discovery & Tailoring Pipeline v2
    "inuJ5oto7szOIlRN", // User-Initiated Single Job Tailoring v2
    "eddfsS251UHbmNIj", // Job Discovery & Tailoring Pipeline (legacy)
    "3iUzBukfS6TME2yn", // User-Initiated Single Job Tailoring (legacy)
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

function parseArgs(argv) {
    const parsed = {
        workflowIds: [],
        jsonOnly: false,
        outputPath: null,
        writeOutput: true,
        historyDepth: 5,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === "--workflow-id") {
            const id = String(argv[i + 1] || "").trim();
            if (id) {
                parsed.workflowIds.push(id);
            }
            i += 1;
            continue;
        }
        if (token === "--json") {
            parsed.jsonOnly = true;
            continue;
        }
        if (token === "--output") {
            const p = String(argv[i + 1] || "").trim();
            if (p) {
                parsed.outputPath = p;
            }
            i += 1;
            continue;
        }
        if (token === "--no-output") {
            parsed.writeOutput = false;
            continue;
        }
        if (token === "--history-depth") {
            const depth = Number(argv[i + 1]);
            if (Number.isInteger(depth) && depth > 0 && depth <= 50) {
                parsed.historyDepth = depth;
            }
            i += 1;
        }
    }

    if (parsed.workflowIds.length === 0) {
        parsed.workflowIds = [...DEFAULT_WORKFLOW_IDS];
    }

    return parsed;
}

function unique(values) {
    return [...new Set(values.filter(Boolean).map((v) => String(v).trim()))];
}

function digest(value) {
    return crypto
        .createHash("sha256")
        .update(JSON.stringify(value ?? null))
        .digest("hex")
        .slice(0, 16);
}

function formatTimestampForFile(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
        "_",
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds()),
    ].join("");
}

function resolveDefaultReportsDir() {
    const cwdReports = path.resolve(process.cwd(), "docs", "reports");
    const workspaceReports = path.resolve(process.cwd(), "..", "..", "docs", "reports");
    if (fs.existsSync(workspaceReports) || process.cwd().endsWith(path.join("apps", "web"))) {
        return workspaceReports;
    }
    return cwdReports;
}

function summarizeWorkflow(entity, publishedVersionId, historyRows) {
    const versionIds = historyRows.map((row) => row.versionId);
    const rollbackVersionIds = versionIds.filter((id) => id !== entity.versionId);

    const alerts = [];
    if (!versionIds.includes(entity.versionId)) {
        alerts.push({
            code: "entity_version_not_in_history",
            severity: "critical",
            detail: `workflow_entity.versionId=${entity.versionId} not found in workflow_history`,
        });
    }
    if (entity.activeVersionId && !versionIds.includes(entity.activeVersionId)) {
        alerts.push({
            code: "active_version_not_in_history",
            severity: "critical",
            detail: `activeVersionId=${entity.activeVersionId} not found in workflow_history`,
        });
    }
    if (publishedVersionId && !versionIds.includes(publishedVersionId)) {
        alerts.push({
            code: "published_version_not_in_history",
            severity: "warning",
            detail: `publishedVersionId=${publishedVersionId} not found in workflow_history`,
        });
    }
    if (rollbackVersionIds.length === 0) {
        alerts.push({
            code: "no_rollback_candidate",
            severity: "warning",
            detail: "No previous workflow_history version available for rollback",
        });
    }

    return {
        id: entity.id,
        name: entity.name,
        active: Boolean(entity.active),
        versionId: entity.versionId,
        activeVersionId: entity.activeVersionId,
        publishedVersionId: publishedVersionId || null,
        updatedAt: entity.updatedAt,
        createdAt: entity.createdAt,
        nodeCount: Array.isArray(entity.nodes) ? entity.nodes.length : 0,
        nodeDigest: digest(entity.nodes),
        connectionDigest: digest(entity.connections),
        settingsDigest: digest(entity.settings),
        latestHistory: historyRows.map((row) => ({
            versionId: row.versionId,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            name: row.name,
            description: row.description || "",
        })),
        rollbackCandidateVersionId: rollbackVersionIds[0] || null,
        alerts,
    };
}

function printHuman(report, outputPath) {
    console.log("n8n workflow checkpoint");
    console.log(`generatedAt: ${report.generatedAt}`);
    for (const wf of report.workflows) {
        console.log("");
        console.log(
            `- ${wf.name} (${wf.id}) | active=${wf.active} | version=${wf.versionId} | published=${wf.publishedVersionId || "none"}`
        );
        console.log(
            `  rollbackCandidate=${wf.rollbackCandidateVersionId || "none"} | history=${wf.latestHistory.length} | nodeDigest=${wf.nodeDigest}`
        );
        if (wf.alerts.length > 0) {
            for (const alert of wf.alerts) {
                console.log(`  [${alert.severity}] ${alert.code}: ${alert.detail}`);
            }
        }
    }
    console.log("");
    console.log(`overallState: ${report.overallState}`);
    if (outputPath) {
        console.log(`output: ${outputPath}`);
    }
}

async function main() {
    loadEnvIfPresent();
    const args = parseArgs(process.argv.slice(2));
    const workflowIds = unique(args.workflowIds);

    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is required");
    }

    const prisma = new PrismaClient();

    try {
        const entities = await prisma.$queryRawUnsafe(
            `SELECT id, name, active, "versionId", "activeVersionId", "createdAt", "updatedAt", nodes, connections, settings
             FROM n8n.workflow_entity
             WHERE id = ANY($1::text[])
             ORDER BY "updatedAt" DESC;`,
            workflowIds
        );

        const entityById = new Map(entities.map((entity) => [entity.id, entity]));

        const publishedRows = await prisma.$queryRawUnsafe(
            `SELECT "workflowId", "publishedVersionId", "createdAt", "updatedAt"
             FROM n8n.workflow_published_version
             WHERE "workflowId" = ANY($1::text[]);`,
            workflowIds
        );
        const publishedByWorkflowId = new Map(
            publishedRows.map((row) => [row.workflowId, row.publishedVersionId])
        );

        const historyRows = await prisma.$queryRawUnsafe(
            `SELECT "workflowId", "versionId", "createdAt", "updatedAt", name, description
             FROM (
                 SELECT "workflowId", "versionId", "createdAt", "updatedAt", name, description,
                        ROW_NUMBER() OVER (PARTITION BY "workflowId" ORDER BY "createdAt" DESC) AS rn
                 FROM n8n.workflow_history
                 WHERE "workflowId" = ANY($1::text[])
             ) history_ranked
             WHERE rn <= $2
             ORDER BY "workflowId", "createdAt" DESC;`,
            workflowIds,
            args.historyDepth
        );

        const historyByWorkflowId = new Map();
        for (const row of historyRows) {
            if (!historyByWorkflowId.has(row.workflowId)) {
                historyByWorkflowId.set(row.workflowId, []);
            }
            historyByWorkflowId.get(row.workflowId).push(row);
        }

        const workflows = workflowIds.map((workflowId) => {
            const entity = entityById.get(workflowId);
            if (!entity) {
                return {
                    id: workflowId,
                    missing: true,
                    alerts: [
                        {
                            code: "workflow_not_found",
                            severity: "critical",
                            detail: "Workflow ID not found in n8n.workflow_entity",
                        },
                    ],
                };
            }

            return summarizeWorkflow(
                entity,
                publishedByWorkflowId.get(workflowId) || null,
                historyByWorkflowId.get(workflowId) || []
            );
        });

        const allAlerts = workflows.flatMap((wf) => wf.alerts || []);
        const hasCritical = allAlerts.some((alert) => alert.severity === "critical");
        const hasWarning = allAlerts.some((alert) => alert.severity === "warning");
        const overallState = hasCritical ? "critical" : hasWarning ? "warning" : "ok";

        const report = {
            generatedAt: new Date().toISOString(),
            workflowIds,
            overallState,
            workflowCount: workflows.length,
            workflows,
            alerts: allAlerts,
        };

        let resolvedOutputPath = null;
        if (args.writeOutput) {
            const defaultFileName = `n8n-workflow-checkpoint-${formatTimestampForFile(new Date())}.json`;
            const reportsDir = resolveDefaultReportsDir();
            resolvedOutputPath = args.outputPath
                ? path.resolve(process.cwd(), args.outputPath)
                : path.resolve(reportsDir, defaultFileName);
            fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
            fs.writeFileSync(resolvedOutputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
        }

        if (args.jsonOnly) {
            process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        } else {
            printHuman(report, resolvedOutputPath);
        }

        if (hasCritical) {
            process.exitCode = 1;
        }
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error(`n8n workflow checkpoint failed: ${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = {
    parseArgs,
    summarizeWorkflow,
    digest,
};
