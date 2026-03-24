#!/usr/bin/env node

/**
 * Publish additive v3 n8n workflows as NEW workflow entities.
 * This script is intentionally additive:
 * - never updates existing workflow ids
 * - skips creation if an unarchived workflow with the same name already exists
 *
 * Usage:
 *   node scripts/publish_v3_workflows.js
 *   node scripts/publish_v3_workflows.js --dry-run
 *   node scripts/publish_v3_workflows.js --json
 *   node scripts/publish_v3_workflows.js --author "AutoApply Release Bot"
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { randomUUID } = require("crypto");
const { PrismaClient } = require("@prisma/client");

const TEMPLATE_FILES = [
    "job-discovery-pipeline-v3.json",
    "single-job-tailoring-v3.json",
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
    const args = {
        jsonOnly: false,
        dryRun: false,
        author: "AutoApply v3 Publisher",
    };

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === "--json") {
            args.jsonOnly = true;
            continue;
        }
        if (token === "--dry-run") {
            args.dryRun = true;
            continue;
        }
        if (token === "--author") {
            const author = String(argv[i + 1] || "").trim();
            if (author) {
                args.author = author;
            }
            i += 1;
        }
    }

    return args;
}

function randomWorkflowId(length = 16) {
    let candidate = "";
    while (candidate.length < length) {
        candidate += crypto
            .randomBytes(12)
            .toString("base64url")
            .replace(/[^a-zA-Z0-9]/g, "");
    }
    return candidate.slice(0, length);
}

function parseJsonFile(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function findExistingWorkflowByName(prisma, name) {
    const rows = await prisma.$queryRawUnsafe(
        `SELECT id, name, active, "versionId", "activeVersionId", "updatedAt", "isArchived"
         FROM n8n.workflow_entity
         WHERE name = $1
           AND "isArchived" = false
         ORDER BY "updatedAt" DESC
         LIMIT 1;`,
        name
    );

    if (!rows || rows.length === 0) {
        return null;
    }

    const entity = rows[0];
    const publishedRows = await prisma.$queryRawUnsafe(
        `SELECT "publishedVersionId"
         FROM n8n.workflow_published_version
         WHERE "workflowId" = $1
         LIMIT 1;`,
        entity.id
    );

    return {
        ...entity,
        publishedVersionId: publishedRows?.[0]?.publishedVersionId || null,
    };
}

async function allocateWorkflowId(tx) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
        const candidate = randomWorkflowId(16);
        const rows = await tx.$queryRawUnsafe(
            `SELECT id
             FROM n8n.workflow_entity
             WHERE id = $1
             LIMIT 1;`,
            candidate
        );
        if (!rows || rows.length === 0) {
            return candidate;
        }
    }
    throw new Error("workflow_id_allocation_failed");
}

async function nextPublishHistoryId(tx) {
    const rows = await tx.$queryRawUnsafe(
        `SELECT COALESCE(MAX(id), 0) + 1 AS next_id
         FROM n8n.workflow_publish_history;`
    );
    return Number(rows?.[0]?.next_id || 1);
}

async function createWorkflowEntityFromTemplate(tx, template, author) {
    const workflowId = await allocateWorkflowId(tx);
    const versionId = randomUUID();
    const nowName = String(template.name || "").trim();
    if (!nowName) {
        throw new Error("template_name_missing");
    }

    const nodes = Array.isArray(template.nodes) ? template.nodes : [];
    const connections = template.connections && typeof template.connections === "object"
        ? template.connections
        : {};
    const settings = template.settings && typeof template.settings === "object"
        ? template.settings
        : {};
    const staticData = template.staticData && typeof template.staticData === "object"
        ? template.staticData
        : null;
    const pinData = template.pinData && typeof template.pinData === "object"
        ? template.pinData
        : null;
    const meta = template.meta && typeof template.meta === "object" ? template.meta : null;
    const description = template.description ? String(template.description) : null;
    const active = Boolean(template.active);
    const triggerCount = Number.isInteger(template.triggerCount)
        ? Math.max(0, template.triggerCount)
        : 0;
    const versionCounter = Number.isInteger(template.versionCounter)
        ? Math.max(1, template.versionCounter)
        : 1;

    await tx.$executeRawUnsafe(
        `INSERT INTO n8n.workflow_entity (
            name,
            active,
            nodes,
            connections,
            "createdAt",
            "updatedAt",
            settings,
            "staticData",
            "pinData",
            "versionId",
            "triggerCount",
            id,
            meta,
            "parentFolderId",
            "isArchived",
            "versionCounter",
            description,
            "activeVersionId"
        ) VALUES (
            $1,
            $2,
            $3::json,
            $4::json,
            NOW(),
            NOW(),
            $5::json,
            $6::json,
            $7::json,
            $8,
            $9,
            $10,
            $11::json,
            NULL,
            false,
            $12,
            $13,
            $14
        );`,
        nowName,
        active,
        JSON.stringify(nodes),
        JSON.stringify(connections),
        JSON.stringify(settings),
        JSON.stringify(staticData),
        JSON.stringify(pinData),
        versionId,
        triggerCount,
        workflowId,
        JSON.stringify(meta),
        versionCounter,
        description,
        versionId
    );

    await tx.$executeRawUnsafe(
        `INSERT INTO n8n.workflow_history (
            "versionId",
            "workflowId",
            authors,
            "createdAt",
            "updatedAt",
            nodes,
            connections,
            name,
            autosaved,
            description
        ) VALUES (
            $1,
            $2,
            $3,
            NOW(),
            NOW(),
            $4::json,
            $5::json,
            $6,
            false,
            $7
        );`,
        versionId,
        workflowId,
        author,
        JSON.stringify(nodes),
        JSON.stringify(connections),
        nowName,
        description
    );

    await tx.$executeRawUnsafe(
        `INSERT INTO n8n.workflow_published_version (
            "workflowId",
            "publishedVersionId",
            "createdAt",
            "updatedAt"
        ) VALUES (
            $1,
            $2,
            NOW(),
            NOW()
        );`,
        workflowId,
        versionId
    );

    const publishHistoryId = await nextPublishHistoryId(tx);
    await tx.$executeRawUnsafe(
        `INSERT INTO n8n.workflow_publish_history (
            id,
            "workflowId",
            "versionId",
            event,
            "userId",
            "createdAt"
        ) VALUES (
            $1,
            $2,
            $3,
            'activated',
            NULL,
            NOW()
        );`,
        publishHistoryId,
        workflowId,
        versionId
    );

    return {
        workflowId,
        versionId,
        publishedVersionId: versionId,
        publishHistoryId,
        active,
        name: nowName,
    };
}

function printHuman(report) {
    console.log("publish_v3_workflows");
    console.log(`mode: ${report.mode}`);
    console.log(`generatedAt: ${report.generatedAt}`);
    console.log(`templates: ${report.results.length}`);
    console.log("");

    for (const item of report.results) {
        console.log(`- ${item.templateFile}`);
        console.log(`  name: ${item.name}`);
        console.log(`  status: ${item.status}`);
        if (item.workflowId) {
            console.log(`  workflowId: ${item.workflowId}`);
        }
        if (item.versionId) {
            console.log(`  versionId: ${item.versionId}`);
        }
        if (item.publishedVersionId) {
            console.log(`  publishedVersionId: ${item.publishedVersionId}`);
        }
    }

    console.log("");
    console.log(
        `created: ${report.summary.created}, skipped_existing: ${report.summary.skippedExisting}, dry_run_candidates: ${report.summary.dryRunCandidates}`
    );
}

async function main() {
    loadEnvIfPresent();
    const args = parseArgs(process.argv.slice(2));

    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is required");
    }

    const workspaceRoot = path.resolve(__dirname, "..", "..", "..");
    const templateDir = path.join(workspaceRoot, "n8n", "workflows");
    const prisma = new PrismaClient();

    try {
        const results = [];
        for (const templateFile of TEMPLATE_FILES) {
            const templatePath = path.join(templateDir, templateFile);
            if (!fs.existsSync(templatePath)) {
                throw new Error(`template_not_found:${templateFile}`);
            }

            const template = parseJsonFile(templatePath);
            const name = String(template.name || "").trim();
            if (!name) {
                throw new Error(`template_name_missing:${templateFile}`);
            }

            const existing = await findExistingWorkflowByName(prisma, name);
            if (existing) {
                results.push({
                    templateFile,
                    name,
                    status: "skipped_existing",
                    workflowId: existing.id,
                    versionId: existing.versionId,
                    publishedVersionId: existing.publishedVersionId || null,
                });
                continue;
            }

            if (args.dryRun) {
                results.push({
                    templateFile,
                    name,
                    status: "dry_run_candidate",
                    workflowId: null,
                    versionId: null,
                    publishedVersionId: null,
                });
                continue;
            }

            const created = await prisma.$transaction((tx) =>
                createWorkflowEntityFromTemplate(tx, template, args.author)
            );

            results.push({
                templateFile,
                name,
                status: "created",
                workflowId: created.workflowId,
                versionId: created.versionId,
                publishedVersionId: created.publishedVersionId,
            });
        }

        const report = {
            generatedAt: new Date().toISOString(),
            mode: args.dryRun ? "dry_run" : "apply",
            author: args.author,
            results,
            summary: {
                created: results.filter((r) => r.status === "created").length,
                skippedExisting: results.filter((r) => r.status === "skipped_existing").length,
                dryRunCandidates: results.filter((r) => r.status === "dry_run_candidate").length,
            },
        };

        if (args.jsonOnly) {
            console.log(JSON.stringify(report, null, 2));
            return;
        }

        printHuman(report);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error(`publish_v3_workflows_failed: ${error.message}`);
    process.exit(1);
});
