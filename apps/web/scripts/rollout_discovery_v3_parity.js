#!/usr/bin/env node

/**
 * Patch/publish live discovery v3 workflow for controlled parity rollout.
 *
 * Usage:
 *   node scripts/rollout_discovery_v3_parity.js --workflow-id wjATx0lg85LnQqd4 --user-id <id> --user-id <id>
 *   node scripts/rollout_discovery_v3_parity.js --json
 *   node scripts/rollout_discovery_v3_parity.js --dry-run
 */

const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { PrismaClient } = require("@prisma/client");

const DEFAULT_DISCOVERY_V3_WORKFLOW_ID = "wjATx0lg85LnQqd4";

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
        if (!trimmed || trimmed.startsWith("#")) continue;
        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex <= 0) continue;
        const key = trimmed.slice(0, separatorIndex).trim();
        let value = trimmed.slice(separatorIndex + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        if (!key || process.env[key] !== undefined) continue;
        process.env[key] = value;
    }
}

function parseArgs(argv) {
    const args = {
        workflowId: DEFAULT_DISCOVERY_V3_WORKFLOW_ID,
        userIds: [],
        dryRun: false,
        jsonOnly: false,
        author: "AutoApply Parity Rollout Bot",
    };

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === "--workflow-id") {
            args.workflowId = String(argv[i + 1] || "").trim() || args.workflowId;
            i += 1;
            continue;
        }
        if (token === "--user-id") {
            const userId = String(argv[i + 1] || "").trim();
            if (userId) args.userIds.push(userId);
            i += 1;
            continue;
        }
        if (token === "--dry-run") {
            args.dryRun = true;
            continue;
        }
        if (token === "--json") {
            args.jsonOnly = true;
            continue;
        }
        if (token === "--author") {
            const author = String(argv[i + 1] || "").trim();
            if (author) args.author = author;
            i += 1;
            continue;
        }
    }

    args.userIds = [...new Set(args.userIds)];
    return args;
}

function getNodeByName(nodes, name) {
    return (nodes || []).find((node) => node && node.name === name) || null;
}

function stringifyUserIds(userIds) {
    return JSON.stringify(userIds);
}

function buildPrepareCanaryJsCode(controlledUserIds) {
    const serialized = stringifyUserIds(controlledUserIds);
    return `const CONTROLLED_CANARY_USER_IDS = ${serialized};
const base = $('Parse Lock Result v3').first().json || {};
const payload = $input.first().json || {};
const users = Array.isArray(payload.users) ? payload.users : [];
const allowlistFromRuntime = new Set(Array.isArray(base.canaryAllowlist) ? base.canaryAllowlist : []);
const controlledAllowlist = new Set(CONTROLLED_CANARY_USER_IDS.map((id) => String(id || '').trim()).filter(Boolean));
const allowlist = controlledAllowlist.size > 0 ? controlledAllowlist : allowlistFromRuntime;
const sampleRateRaw = Number(
  base.config && base.config.v3CanarySampleRate ? base.config.v3CanarySampleRate : 0
);
const sampleRate = Number.isFinite(sampleRateRaw)
  ? Math.max(0, Math.min(1, sampleRateRaw))
  : 0;

function hashToUnitInterval(input) {
  let hash = 0;
  const value = String(input || '');
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash / 4294967295;
}

function isSelectedByCanary(userId) {
  if (allowlist.size > 0) {
    return allowlist.has(userId);
  }

  if (sampleRate <= 0) {
    return true;
  }

  if (sampleRate >= 1) {
    return true;
  }

  return hashToUnitInterval(userId) < sampleRate;
}

const canaryMode = controlledAllowlist.size > 0
  ? 'controlled_allowlist'
  : allowlistFromRuntime.size > 0
    ? 'allowlist'
    : sampleRate > 0
      ? 'sample'
      : 'all';

const canaryUsers = users.filter((user) => {
  if (!user || typeof user !== 'object') return false;
  const userId = String(user.id || '').trim();
  if (!userId) return false;
  return isSelectedByCanary(userId);
});

if (canaryUsers.length === 0) {
  return [{
    json: {
      ...base,
      user: null,
      userId: null,
      usersSeen: users.length,
      usersCanary: 0,
      canaryMode
    }
  }];
}

return canaryUsers.map((user) => {
  const userId = String(user.id || '').trim();
  return {
    json: {
      ...base,
      user,
      userId,
      usersSeen: users.length,
      usersCanary: canaryUsers.length,
      canaryMode
    }
  };
});`;
}

async function resolveWorkflow(prisma, workflowId) {
    const rows = await prisma.$queryRawUnsafe(
        `SELECT id, name, active, nodes, connections, settings, description, "versionId", "activeVersionId", "updatedAt", "versionCounter"
         FROM n8n.workflow_entity
         WHERE id = $1
         LIMIT 1;`,
        workflowId
    );
    return rows[0] || null;
}

async function resolveLatestWorkflowHistory(prisma, workflowId) {
    const rows = await prisma.$queryRawUnsafe(
        `SELECT "versionId", "workflowId", authors, autosaved, name, description
         FROM n8n.workflow_history
         WHERE "workflowId" = $1
         ORDER BY "createdAt" DESC
         LIMIT 1;`,
        workflowId
    );
    return rows[0] || null;
}

async function appendPublishHistoryActivatedEvent(prisma, workflowId, versionId) {
    const rows = await prisma.$queryRawUnsafe(
        `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM n8n.workflow_publish_history;`
    );
    const nextId = Number(rows?.[0]?.next_id || 1);
    await prisma.$executeRawUnsafe(
        `INSERT INTO n8n.workflow_publish_history (id, "workflowId", "versionId", event, "userId", "createdAt")
         VALUES ($1, $2, $3, 'activated', NULL, NOW());`,
        nextId,
        workflowId,
        versionId
    );
}

async function upsertPublishedVersion(tx, workflowId, versionId) {
    const rows = await tx.$queryRawUnsafe(
        `SELECT "workflowId"
         FROM n8n.workflow_published_version
         WHERE "workflowId" = $1
         LIMIT 1;`,
        workflowId
    );

    if (rows.length === 0) {
        await tx.$executeRawUnsafe(
            `INSERT INTO n8n.workflow_published_version ("workflowId", "publishedVersionId", "createdAt", "updatedAt")
             VALUES ($1, $2, NOW(), NOW());`,
            workflowId,
            versionId
        );
        return;
    }

    await tx.$executeRawUnsafe(
        `UPDATE n8n.workflow_published_version
         SET "publishedVersionId" = $1,
             "updatedAt" = NOW()
         WHERE "workflowId" = $2;`,
        versionId,
        workflowId
    );
}

function applyRuntimePatch(templateWorkflow, liveWorkflow, controlledUserIds) {
    const patched = JSON.parse(JSON.stringify(templateWorkflow));
    const liveLoadConfig = getNodeByName(liveWorkflow.nodes, "Load Config v3");
    const patchedLoadConfig = getNodeByName(patched.nodes, "Load Config v3");
    if (!liveLoadConfig || !patchedLoadConfig) {
        throw new Error("load_config_v3_node_missing");
    }

    patchedLoadConfig.parameters = {
        ...(patchedLoadConfig.parameters || {}),
        jsCode: liveLoadConfig.parameters?.jsCode || patchedLoadConfig.parameters?.jsCode || "",
    };

    const patchedCanaryNode = getNodeByName(patched.nodes, "Prepare Canary Users v3");
    if (!patchedCanaryNode) {
        throw new Error("prepare_canary_v3_node_missing");
    }

    patchedCanaryNode.parameters = {
        ...(patchedCanaryNode.parameters || {}),
        jsCode: buildPrepareCanaryJsCode(controlledUserIds),
    };

    return patched;
}

function printResult(result, jsonOnly) {
    if (jsonOnly) {
        console.log(JSON.stringify(result, null, 2));
        return;
    }

    console.log("rollout_discovery_v3_parity");
    console.log(`mode: ${result.mode}`);
    console.log(`workflowId: ${result.workflowId}`);
    console.log(`controlledCanaryUserIds: ${result.controlledCanaryUserIds.join(",")}`);
    console.log(`previousVersionId: ${result.previousVersionId || "n/a"}`);
    console.log(`currentVersionId: ${result.currentVersionId || "n/a"}`);
    console.log(`active: ${result.active}`);
    console.log(`updatedAt: ${result.updatedAt}`);
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    loadEnvIfPresent();

    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is required");
    }

    const workspaceRoot = path.resolve(__dirname, "..", "..", "..");
    const templatePath = path.join(workspaceRoot, "n8n", "workflows", "job-discovery-pipeline-v3.json");
    const templateWorkflow = JSON.parse(fs.readFileSync(templatePath, "utf8"));
    const prisma = new PrismaClient();

    try {
        const liveWorkflow = await resolveWorkflow(prisma, args.workflowId);
        if (!liveWorkflow) {
            throw new Error("live_workflow_not_found");
        }
        const latestHistory = await resolveLatestWorkflowHistory(prisma, args.workflowId);
        if (!latestHistory) {
            throw new Error("live_workflow_history_missing");
        }

        const patchedWorkflow = applyRuntimePatch(templateWorkflow, liveWorkflow, args.userIds);
        const dryRunResult = {
            mode: args.dryRun ? "dry_run" : "apply",
            workflowId: liveWorkflow.id,
            workflowName: liveWorkflow.name,
            controlledCanaryUserIds: args.userIds,
            previousVersionId: liveWorkflow.versionId || null,
            currentVersionId: liveWorkflow.versionId || null,
            active: liveWorkflow.active,
            updatedAt: liveWorkflow.updatedAt,
            hasOldCanaryGuard: Boolean(
                (getNodeByName(liveWorkflow.nodes, "Prepare Canary Users v3")?.parameters?.jsCode || "").includes(
                    "if (allowlist.size === 0) return false;"
                )
            ),
            hasControlledAllowlistInPatch: Boolean(
                (getNodeByName(patchedWorkflow.nodes, "Prepare Canary Users v3")?.parameters?.jsCode || "").includes(
                    "CONTROLLED_CANARY_USER_IDS"
                )
            ),
        };

        if (args.dryRun) {
            printResult(dryRunResult, args.jsonOnly);
            return;
        }

        const nextVersionId = randomUUID();
        const historyAuthors = latestHistory.authors || args.author;
        const historyName =
            latestHistory.name !== null && latestHistory.name !== undefined
                ? latestHistory.name
                : liveWorkflow.name || null;
        const historyDescription =
            latestHistory.description !== null && latestHistory.description !== undefined
                ? latestHistory.description
                : liveWorkflow.description || null;

        await prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(
                `INSERT INTO n8n.workflow_history ("versionId", "workflowId", authors, "createdAt", "updatedAt", nodes, connections, name, autosaved, description)
                 VALUES ($1, $2, $3, NOW(), NOW(), $4::json, $5::json, $6, false, $7);`,
                nextVersionId,
                liveWorkflow.id,
                historyAuthors,
                JSON.stringify(patchedWorkflow.nodes || []),
                JSON.stringify(patchedWorkflow.connections || {}),
                historyName,
                historyDescription
            );

            await tx.$executeRawUnsafe(
                `UPDATE n8n.workflow_entity
                 SET nodes = $1::json,
                     connections = $2::json,
                     settings = $3::json,
                     "versionId" = $4,
                     "activeVersionId" = $4,
                     "versionCounter" = COALESCE("versionCounter", 0) + 1,
                     "updatedAt" = NOW(),
                     active = true
                 WHERE id = $5;`,
                JSON.stringify(patchedWorkflow.nodes || []),
                JSON.stringify(patchedWorkflow.connections || {}),
                JSON.stringify(patchedWorkflow.settings || {}),
                nextVersionId,
                liveWorkflow.id
            );

            await upsertPublishedVersion(tx, liveWorkflow.id, nextVersionId);
            await appendPublishHistoryActivatedEvent(tx, liveWorkflow.id, nextVersionId);
        });

        const updated = await resolveWorkflow(prisma, liveWorkflow.id);
        const result = {
            mode: "apply",
            workflowId: updated.id,
            workflowName: updated.name,
            controlledCanaryUserIds: args.userIds,
            previousVersionId: liveWorkflow.versionId || null,
            currentVersionId: updated.versionId || null,
            active: updated.active,
            updatedAt: updated.updatedAt,
        };
        printResult(result, args.jsonOnly);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error(`rollout_discovery_v3_parity_failed: ${error.message}`);
    process.exit(1);
});
