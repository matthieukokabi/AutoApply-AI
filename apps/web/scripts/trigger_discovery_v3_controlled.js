#!/usr/bin/env node

/**
 * Operator-safe controlled trigger for discovery v3.
 *
 * Defaults to dry-run mode.
 *
 * Examples:
 *   node scripts/trigger_discovery_v3_controlled.js --dry-run
 *   node scripts/trigger_discovery_v3_controlled.js --real-run --lookup --wait-seconds 90 --user-id <userId>
 */

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const DEFAULT_WORKFLOW_ID = "wjATx0lg85LnQqd4";
const DEFAULT_SCHEDULER_SOURCE = "manual_operator";
const DEFAULT_TRIGGER_KIND = "manual_controlled_verification";

function parseArgs(argv) {
    const args = {
        workflowId: DEFAULT_WORKFLOW_ID,
        baseUrl: null,
        runId: null,
        slotId: null,
        schedulerSource: DEFAULT_SCHEDULER_SOURCE,
        triggerKind: DEFAULT_TRIGGER_KIND,
        userId: null,
        dryRun: true,
        lookup: true,
        waitSeconds: 90,
        pollIntervalSeconds: 5,
        n8nApiKey: process.env.N8N_API_KEY || null,
        help: false,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];

        if (token === "--workflow-id") {
            args.workflowId = String(argv[i + 1] || "").trim() || args.workflowId;
            i += 1;
            continue;
        }
        if (token === "--base-url") {
            args.baseUrl = String(argv[i + 1] || "").trim() || null;
            i += 1;
            continue;
        }
        if (token === "--run-id") {
            args.runId = String(argv[i + 1] || "").trim() || null;
            i += 1;
            continue;
        }
        if (token === "--slot-id") {
            args.slotId = String(argv[i + 1] || "").trim() || null;
            i += 1;
            continue;
        }
        if (token === "--scheduler-source") {
            args.schedulerSource = String(argv[i + 1] || "").trim() || args.schedulerSource;
            i += 1;
            continue;
        }
        if (token === "--trigger-kind") {
            args.triggerKind = String(argv[i + 1] || "").trim() || args.triggerKind;
            i += 1;
            continue;
        }
        if (token === "--user-id") {
            args.userId = String(argv[i + 1] || "").trim() || null;
            i += 1;
            continue;
        }
        if (token === "--wait-seconds") {
            const parsed = Number(argv[i + 1]);
            if (Number.isFinite(parsed) && parsed >= 0) {
                args.waitSeconds = parsed;
            }
            i += 1;
            continue;
        }
        if (token === "--poll-interval-seconds") {
            const parsed = Number(argv[i + 1]);
            if (Number.isFinite(parsed) && parsed > 0) {
                args.pollIntervalSeconds = parsed;
            }
            i += 1;
            continue;
        }
        if (token === "--n8n-api-key") {
            args.n8nApiKey = String(argv[i + 1] || "").trim() || null;
            i += 1;
            continue;
        }
        if (token === "--dry-run") {
            args.dryRun = true;
            continue;
        }
        if (token === "--real-run") {
            args.dryRun = false;
            continue;
        }
        if (token === "--lookup") {
            args.lookup = true;
            continue;
        }
        if (token === "--no-lookup") {
            args.lookup = false;
            continue;
        }
        if (token === "--help" || token === "-h") {
            args.help = true;
            continue;
        }
    }

    return args;
}

function printUsage() {
    console.log(`
trigger_discovery_v3_controlled

Usage:
  node scripts/trigger_discovery_v3_controlled.js [options]

Options:
  --dry-run                     Default mode. Resolve metadata and print what would run.
  --real-run                    Trigger webhook for one controlled execution.
  --lookup                      After trigger, poll persistence evidence (default).
  --no-lookup                   Skip post-trigger evidence lookup.
  --workflow-id <id>            Workflow id (default: ${DEFAULT_WORKFLOW_ID}).
  --base-url <url>              n8n base URL (default: N8N_WEBHOOK_URL from env).
  --run-id <id>                 Optional explicit runId.
  --slot-id <id>                Optional explicit slotId.
  --scheduler-source <value>    Default: ${DEFAULT_SCHEDULER_SOURCE}.
  --trigger-kind <value>        Default: ${DEFAULT_TRIGGER_KIND}.
  --user-id <id>                Optional app userId for app persistence summary.
  --wait-seconds <n>            Evidence lookup timeout in seconds (default: 90).
  --poll-interval-seconds <n>   Evidence poll interval in seconds (default: 5).
  --n8n-api-key <key>           Optional explicit n8n API key (fallback to DB lookup).
  --help, -h                    Show this help.

Examples:
  node scripts/trigger_discovery_v3_controlled.js --dry-run
  node scripts/trigger_discovery_v3_controlled.js --real-run --lookup --wait-seconds 90 --user-id cmnvjricy00003eg3bl335i2r
`);
}

function loadEnvFromFile(envPath) {
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

function loadEnvIfPresent() {
    if (process.env.DATABASE_URL && process.env.N8N_WEBHOOK_URL && process.env.N8N_WEBHOOK_SECRET) {
        return;
    }

    const candidatePaths = [
        path.join(process.cwd(), ".env.local"),
        path.join(process.cwd(), "apps", "web", ".env.local"),
        path.join(__dirname, "..", ".env.local"),
    ];

    for (const envPath of candidatePaths) {
        loadEnvFromFile(envPath);
    }
}

function sanitizeBaseUrl(input) {
    const value = String(input || "").trim();
    if (!value) {
        throw new Error("missing_n8n_base_url");
    }
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error(`invalid_n8n_base_protocol:${parsed.protocol}`);
    }
    parsed.search = "";
    parsed.hash = "";
    let out = parsed.toString();
    if (out.endsWith("/")) {
        out = out.slice(0, -1);
    }
    return out;
}

function buildCallableWebhookUrl(baseUrl, rawWebhookPath) {
    const trimmedPath = String(rawWebhookPath || "").replace(/^\/+/, "");
    if (!trimmedPath) {
        throw new Error("empty_webhook_path");
    }

    // n8n stores encoded path pieces (e.g. `%20`); runtime route in this env expects `%25` escape for `%`.
    const callablePath = trimmedPath.replace(/%/g, "%25");

    return {
        rawWebhookPath: trimmedPath,
        callableWebhookPath: callablePath,
        triggerUrl: `${baseUrl}/webhook/${callablePath}`,
    };
}

function buildDefaultRunId() {
    return `disc_v3_controlled_verify_${Date.now()}`;
}

function buildDefaultSlotId() {
    return `manual-${new Date().toISOString()}`;
}

async function safeFetchJson(url, options = {}) {
    const { timeoutMs = 20000, ...fetchOptions } = options;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
        clearTimeout(timeout);

        const text = await response.text();
        let body = null;

        try {
            body = JSON.parse(text);
        } catch {
            body = null;
        }

        return {
            ok: response.ok,
            status: response.status,
            body,
            raw: text,
        };
    } catch (error) {
        clearTimeout(timeout);
        return {
            ok: false,
            status: null,
            body: null,
            raw: null,
            error: error?.message || "fetch_failed",
        };
    }
}

async function resolveN8nApiKey(prisma, preferred) {
    if (preferred) {
        return {
            apiKey: preferred,
            source: "cli_or_env",
            label: null,
            updatedAt: null,
        };
    }

    const rows = await prisma.$queryRawUnsafe(
        `SELECT "apiKey", label, "updatedAt"
         FROM n8n.user_api_keys
         ORDER BY "updatedAt" DESC
         LIMIT 1;`
    );

    const row = rows[0] || null;
    if (!row || !row.apiKey) {
        return null;
    }

    return {
        apiKey: row.apiKey,
        source: "n8n.user_api_keys",
        label: row.label || null,
        updatedAt: row.updatedAt || null,
    };
}

async function fetchWorkflowMeta(baseUrl, workflowId, n8nApiKey) {
    if (!n8nApiKey) {
        return {
            ok: false,
            reason: "missing_n8n_api_key",
        };
    }

    const workflowResponse = await safeFetchJson(`${baseUrl}/api/v1/workflows/${workflowId}`, {
        method: "GET",
        headers: {
            accept: "application/json",
            "X-N8N-API-KEY": n8nApiKey,
        },
    });

    if (!workflowResponse.ok || !workflowResponse.body) {
        return {
            ok: false,
            reason: "workflow_api_request_failed",
            status: workflowResponse.status,
            bodyPreview: (workflowResponse.raw || "").slice(0, 300),
            fetchError: workflowResponse.error || null,
        };
    }

    return {
        ok: true,
        id: workflowResponse.body.id || workflowId,
        name: workflowResponse.body.name || null,
        active: workflowResponse.body.active === true,
        versionId: workflowResponse.body.versionId || null,
        activeVersionId: workflowResponse.body.activeVersionId || null,
        updatedAt: workflowResponse.body.updatedAt || null,
    };
}

async function resolveDiscoveryWebhookPath(prisma, workflowId) {
    const rows = await prisma.$queryRawUnsafe(
        `SELECT "webhookPath", method, node
         FROM n8n.webhook_entity
         WHERE "workflowId" = $1
         ORDER BY "webhookPath";`,
        workflowId
    );

    if (!rows.length) {
        return {
            selected: null,
            candidates: [],
        };
    }

    const candidates = rows.map((row) => ({
        webhookPath: row.webhookPath,
        method: row.method,
        node: row.node,
    }));

    const selected =
        candidates.find((candidate) => String(candidate.node || "").toLowerCase().includes("discovery")) ||
        candidates.find((candidate) => String(candidate.webhookPath || "").toLowerCase().includes("discovery")) ||
        candidates[0];

    return { selected, candidates };
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function lookupPersistenceEvidence(params) {
    const {
        prisma,
        workflowId,
        runId,
        startedAtIso,
        waitSeconds,
        pollIntervalSeconds,
        userId,
    } = params;

    const startedAt = new Date(startedAtIso);
    const timeoutMs = Math.max(0, Number(waitSeconds || 0)) * 1000;
    const intervalMs = Math.max(1, Number(pollIntervalSeconds || 1)) * 1000;
    const deadline = Date.now() + timeoutMs;

    let webhookEvents = [];
    let workflowErrors = [];
    let executions = [];

    do {
        webhookEvents = await prisma.$queryRawUnsafe(
            `SELECT id, type, "runId", "createdAt"
             FROM n8n_webhook_events
             WHERE "runId" = $1
             ORDER BY "createdAt" DESC
             LIMIT 50;`,
            runId
        );

        workflowErrors = await prisma.$queryRawUnsafe(
            `SELECT id, "errorType", payload, "userId", "createdAt"
             FROM workflow_errors
             WHERE payload ->> 'runId' = $1
             ORDER BY "createdAt" DESC
             LIMIT 50;`,
            runId
        );

        executions = await prisma.$queryRawUnsafe(
            `SELECT e.id, e.status, e.mode, e.finished, e."startedAt", e."stoppedAt"
             FROM n8n.execution_entity e
             JOIN n8n.execution_data d ON d."executionId" = e.id
             WHERE e."workflowId" = $1
               AND d.data LIKE $2
             ORDER BY e."startedAt" DESC
             LIMIT 5;`,
            workflowId,
            `%${runId}%`
        );

        const executionCompleted =
            executions.length > 0 &&
            ["success", "error", "crashed", "canceled"].includes(String(executions[0].status || "").toLowerCase());

        if (webhookEvents.length > 0 || executionCompleted || timeoutMs === 0) {
            break;
        }

        if (Date.now() >= deadline) {
            break;
        }

        await sleep(intervalMs);
    } while (Date.now() < deadline);

    let applicationSummary = null;
    if (userId) {
        const counts = await prisma.$queryRawUnsafe(
            `SELECT
                COUNT(*)::int AS total,
                SUM(CASE WHEN status='tailored' THEN 1 ELSE 0 END)::int AS tailored_count,
                SUM(CASE WHEN status='discovered' THEN 1 ELSE 0 END)::int AS discovered_count,
                SUM(CASE WHEN "tailoredCvMarkdown" IS NOT NULL THEN 1 ELSE 0 END)::int AS cv_markdown_count,
                SUM(CASE WHEN "coverLetterMarkdown" IS NOT NULL THEN 1 ELSE 0 END)::int AS cover_markdown_count,
                SUM(CASE WHEN "tailoredCvMarkdown" IS NOT NULL AND "coverLetterMarkdown" IS NULL THEN 1 ELSE 0 END)::int AS cv_only_count
             FROM applications
             WHERE "userId" = $1
               AND "updatedAt" >= $2::timestamptz;`,
            userId,
            startedAt.toISOString()
        );

        applicationSummary = counts[0] || null;
    }

    return {
        lookedUp: true,
        timeoutSeconds: Number(waitSeconds || 0),
        pollIntervalSeconds: Number(pollIntervalSeconds || 0),
        webhookEventCount: webhookEvents.length,
        webhookEventTypes: [...new Set(webhookEvents.map((event) => event.type))],
        workflowErrorCount: workflowErrors.length,
        workflowErrorTypes: [...new Set(workflowErrors.map((error) => error.errorType))],
        execution: executions[0] || null,
        webhookEvents,
        workflowErrors,
        applicationSummary,
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (args.help) {
        printUsage();
        return;
    }

    loadEnvIfPresent();

    const prisma = new PrismaClient();
    const startedAt = new Date();
    const runId = args.runId || buildDefaultRunId();
    const slotId = args.slotId || buildDefaultSlotId();

    try {
        const baseUrl = sanitizeBaseUrl(args.baseUrl || process.env.N8N_WEBHOOK_URL);
        const n8nApiKeyRecord = await resolveN8nApiKey(prisma, args.n8nApiKey);
        const workflowMeta = await fetchWorkflowMeta(
            baseUrl,
            args.workflowId,
            n8nApiKeyRecord ? n8nApiKeyRecord.apiKey : null
        );
        const resolvedWebhook = await resolveDiscoveryWebhookPath(prisma, args.workflowId);

        if (!resolvedWebhook.selected) {
            throw new Error(`no_discovery_webhook_path_for_workflow:${args.workflowId}`);
        }

        const callableUrl = buildCallableWebhookUrl(baseUrl, resolvedWebhook.selected.webhookPath);

        const output = {
            ok: true,
            script: "trigger_discovery_v3_controlled",
            startedAt: startedAt.toISOString(),
            mode: args.dryRun ? "dry_run" : "real_run",
            workflow: {
                id: args.workflowId,
                apiMeta: workflowMeta,
            },
            webhookPathResolution: {
                selected: resolvedWebhook.selected,
                candidateCount: resolvedWebhook.candidates.length,
                candidates: resolvedWebhook.candidates,
                rawWebhookPath: callableUrl.rawWebhookPath,
                callableWebhookPath: callableUrl.callableWebhookPath,
                triggerUrl: callableUrl.triggerUrl,
            },
            trigger: null,
            run: {
                runId,
                slotId,
                schedulerSource: args.schedulerSource,
                triggerKind: args.triggerKind,
                userId: args.userId || null,
            },
            evidence: null,
            apiKeySource: n8nApiKeyRecord
                ? {
                      source: n8nApiKeyRecord.source,
                      label: n8nApiKeyRecord.label,
                      updatedAt: n8nApiKeyRecord.updatedAt,
                  }
                : null,
        };

        if (args.dryRun) {
            output.trigger = {
                attempted: false,
                reason: "dry_run",
                requestBodyPreview: {
                    runId,
                    slotId,
                    schedulerSource: args.schedulerSource,
                    triggerKind: args.triggerKind,
                },
            };

            if (args.lookup) {
                output.evidence = {
                    lookedUp: false,
                    reason: "dry_run",
                };
            }

            console.log(JSON.stringify(output, null, 2));
            return;
        }

        const webhookSecret = String(process.env.N8N_WEBHOOK_SECRET || "").trim();
        if (!webhookSecret) {
            throw new Error("missing_n8n_webhook_secret");
        }

        const triggerResponse = await safeFetchJson(callableUrl.triggerUrl, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-webhook-secret": webhookSecret,
            },
            body: JSON.stringify({
                runId,
                slotId,
                schedulerSource: args.schedulerSource,
                triggerKind: args.triggerKind,
            }),
            timeoutMs: 30000,
        });

        output.trigger = {
            attempted: true,
            status: triggerResponse.status,
            ok: triggerResponse.ok,
            responseBody: triggerResponse.body,
            responseRawPreview: (triggerResponse.raw || "").slice(0, 300),
            fetchError: triggerResponse.error || null,
        };

        if (args.lookup) {
            output.evidence = await lookupPersistenceEvidence({
                prisma,
                workflowId: args.workflowId,
                runId,
                startedAtIso: startedAt.toISOString(),
                waitSeconds: args.waitSeconds,
                pollIntervalSeconds: args.pollIntervalSeconds,
                userId: args.userId,
            });
        }

        output.ok = triggerResponse.ok;
        console.log(JSON.stringify(output, null, 2));

        if (!triggerResponse.ok) {
            process.exitCode = 1;
        }
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    const payload = {
        ok: false,
        script: "trigger_discovery_v3_controlled",
        error: error?.message || "unexpected_error",
    };
    console.error(JSON.stringify(payload, null, 2));
    process.exit(1);
});

