#!/usr/bin/env node

/**
 * P0 incident patch for n8n Job Discovery pipeline.
 *
 * - Restores robust source fetching/normalization path
 * - Adds callback hard-fail semantics (no silent failures)
 * - Adds run correlation id propagation (x-run-id + payload runId)
 * - Keeps live secrets in the deployed workflow by preserving Load Config node
 *
 * Usage:
 *   node scripts/incident_patch_job_discovery_workflow.js
 *   node scripts/incident_patch_job_discovery_workflow.js --apply-prod --workflow-id <id>
 */

const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { PrismaClient } = require("@prisma/client");

function parseArgs(argv) {
    return {
        applyProd: argv.includes("--apply-prod"),
        workflowId: (() => {
            const idx = argv.indexOf("--workflow-id");
            return idx >= 0 ? argv[idx + 1] || null : null;
        })(),
    };
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

const FETCH_NORMALIZE_JS = `// Flatten jobs returned by Fetch Jobs via App API (all incoming items)
const inputs = $input.all();
const out = [];

for (const item of inputs) {
  const payload = item && item.json && typeof item.json === 'object' ? item.json : null;
  if (!payload) continue;

  if (payload.externalId && payload.userId && payload.title && String(payload.description || '').length > 50) {
    out.push({ json: payload });
    continue;
  }

  const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
  for (const job of jobs) {
    if (job && typeof job === 'object' && job.externalId && job.title && String(job.description || '').length > 50) {
      out.push({ json: job });
    }
  }
}

return out;`;

const FETCH_JOBS_VIA_APP_API_NODE = {
    id: "fetch-jobs-via-app-api",
    name: "Fetch Jobs via App API",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.1,
    position: [900, 0],
    parameters: {
        method: "POST",
        url: "={{ $('Load Config').first().json.appUrl + '/api/webhooks/n8n' }}",
        sendHeaders: true,
        headerParameters: {
            parameters: [
                { name: "content-type", value: "application/json" },
                {
                    name: "x-webhook-secret",
                    value: "={{ $('Load Config').first().json.webhookSecret }}",
                },
                {
                    name: "x-run-id",
                    value: "={{ String($execution.id || Date.now()) }}",
                },
            ],
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ JSON.stringify({ type: 'fetch_jobs_for_user', runId: String($execution.id || Date.now()), data: { user: { userId: $json.userId, targetTitles: $json.targetTitles, locations: $json.locations, remotePreference: $json.remotePreference, masterCvText: $json.masterCvText, subscriptionStatus: $json.subscriptionStatus, creditsRemaining: $json.creditsRemaining }, sourceConfig: { adzunaAppId: $('Load Config').first().json.adzunaAppId || '', adzunaAppKey: $('Load Config').first().json.adzunaAppKey || '', jsearchApiKey: $('Load Config').first().json.jsearchApiKey || '', joobleApiKey: $('Load Config').first().json.joobleApiKey || '', reedApiKey: $('Load Config').first().json.reedApiKey || '' } } }) }}",
        options: { timeout: 30000 },
    },
};

const PARSE_SCORING_JS = `// Parse scoring response, carry forward job + user data
const item = $input.first();
const prev = $('Fetch & Normalize All Job Sources').item;

function parseJsonFromText(rawText) {
  const text = typeof rawText === 'string' ? rawText : '';
  const candidates = [];

  if (text) candidates.push(text);

  const fenced = text.match(new RegExp("\\x60\\x60\\x60(?:json)?\\\\s*([\\\\s\\\\S]*?)\\x60\\x60\\x60", "i"));
  if (fenced && fenced[1]) candidates.unshift(fenced[1]);

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(String(candidate).trim());
    } catch {}
  }

  return null;
}

const text = item && item.json && Array.isArray(item.json.content) && item.json.content[0]
  ? (item.json.content[0].text || '')
  : '';
const parsed = parseJsonFromText(text);

if (!parsed || typeof parsed !== 'object') {
  return [{ json: {
    ...prev.json,
    compatibilityScore: 0,
    atsKeywords: [],
    matchingStrengths: [],
    gaps: [],
    recommendation: 'skip',
    scoringParseError: true
  }}];
}

return [{ json: {
  ...prev.json,
  compatibilityScore: parsed.compatibility_score || 0,
  atsKeywords: Array.isArray(parsed.ats_keywords) ? parsed.ats_keywords : [],
  matchingStrengths: Array.isArray(parsed.matching_strengths) ? parsed.matching_strengths : [],
  gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
  recommendation: parsed.recommendation || 'skip',
  scoringParseError: false
}}];`;

const PARSE_TAILORED_JS = `// Parse tailoring response
const item = $input.first();
const prev = $('Score >= 70?').first().json;

function parseJsonFromText(rawText) {
  const text = typeof rawText === 'string' ? rawText : '';
  const candidates = [];

  if (text) candidates.push(text);

  const fenced = text.match(new RegExp("\\x60\\x60\\x60(?:json)?\\\\s*([\\\\s\\\\S]*?)\\x60\\x60\\x60", "i"));
  if (fenced && fenced[1]) candidates.unshift(fenced[1]);

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(String(candidate).trim());
    } catch {}
  }

  return null;
}

const text = item && item.json && Array.isArray(item.json.content) && item.json.content[0]
  ? (item.json.content[0].text || '')
  : '';
const parsed = parseJsonFromText(text);

if (!parsed || typeof parsed !== 'object') {
  if (text && text.trim().length >= 200) {
    return [{ json: {
      ...prev,
      tailoredCvMarkdown: text.trim(),
      coverLetterMarkdown: '',
      status: 'tailored',
      tailoringParseError: true,
      tailoringParseFallback: 'raw_text'
    }}];
  }

  return [{ json: {
    ...prev,
    tailoredCvMarkdown: '',
    coverLetterMarkdown: '',
    status: 'discovered',
    tailoringParseError: true
  }}];
}

const tailoredCvMarkdown = parsed.tailored_cv_markdown || parsed.tailoredCvMarkdown || parsed.cv_markdown || '';
const coverLetterMarkdown = parsed.motivation_letter_markdown || parsed.cover_letter_markdown || parsed.coverLetterMarkdown || '';

if (!tailoredCvMarkdown && !coverLetterMarkdown && text && text.trim().length >= 200) {
  return [{ json: {
    ...prev,
    tailoredCvMarkdown: text.trim(),
    coverLetterMarkdown: '',
    status: 'tailored',
    tailoringParseError: true,
    tailoringParseFallback: 'raw_text'
  }}];
}

return [{ json: {
  ...prev,
  tailoredCvMarkdown,
  coverLetterMarkdown,
  status: tailoredCvMarkdown ? 'tailored' : 'discovered',
  tailoringParseError: false
}}];`;

const BATCH_SAVE_JS = `// Collect all processed jobs (tailored + discovered) and callback to web app
const items = $input.all();
const config = $('Load Config').first().json;

if (items.length === 0) return [];

const byUser = {};
for (const item of items) {
  const d = item.json;
  if (!d || !d.userId) continue;
  if (!byUser[d.userId]) byUser[d.userId] = [];
  byUser[d.userId].push({
    externalId: d.externalId,
    title: d.title,
    company: d.company,
    location: d.location,
    description: d.description,
    source: d.source,
    url: d.url,
    salary: d.salary,
    postedAt: d.postedAt,
    compatibilityScore: d.compatibilityScore,
    atsKeywords: d.atsKeywords,
    matchingStrengths: d.matchingStrengths,
    gaps: d.gaps,
    recommendation: d.recommendation,
    tailoredCvMarkdown: d.tailoredCvMarkdown || null,
    coverLetterMarkdown: d.coverLetterMarkdown || null,
    status: d.status,
    runId: d.runId || null
  });
}

const appUrl = config.appUrl || 'https://autoapply.works';
const secret = config.webhookSecret || '';
const callbackErrors = [];
let processed = 0;

for (const [userId, apps] of Object.entries(byUser)) {
  const runId = apps[0] && apps[0].runId ? String(apps[0].runId) : String($execution.id || Date.now());
  try {
    const resp = await fetch(appUrl + '/api/webhooks/n8n', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': secret,
        'x-run-id': runId
      },
      body: JSON.stringify({
        type: 'new_applications',
        runId,
        data: { userId, applications: apps }
      })
    });

    if (!resp.ok) {
      const body = await resp.text();
      callbackErrors.push({ userId, status: resp.status, body: String(body || '').slice(0, 300) });
      continue;
    }

    processed += apps.length;
  } catch (e) {
    callbackErrors.push({ userId, status: null, body: e && e.message ? e.message : 'network_error' });
  }
}

if (callbackErrors.length > 0) {
  throw new Error('batch_save_callback_failed:' + JSON.stringify(callbackErrors).slice(0, 500));
}

return [{ json: { processed, users: Object.keys(byUser).length } }];`;

const ERROR_HANDLER_JS = `// Error handler - log to workflow_errors via web app
const error = $input.first().json;
const config = $('Load Config').first().json;
const appUrl = config.appUrl || 'https://autoapply.works';
const secret = config.webhookSecret || '';
const runId = String($execution.id || Date.now());

try {
  await fetch(appUrl + '/api/webhooks/n8n', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': secret,
      'x-run-id': runId
    },
    body: JSON.stringify({
      type: 'workflow_error',
      runId,
      data: {
        workflowId: 'job-discovery-pipeline',
        nodeName: error.node && error.node.name ? error.node.name : 'unknown',
        errorType: error.type || 'UNKNOWN',
        message: error.message || 'Unknown error',
        payload: JSON.stringify(error)
      }
    })
  });
} catch (e) {
  console.log('Error logging failed:', e && e.message ? e.message : e);
}

return [{ json: { logged: true } }];`;

const PREPARE_USER_DATA_JS = `// Normalize active-users payload into per-user pipeline items
const items = $input.all();
const users = [];

for (const item of items) {
  const payload = item.json || {};
  const rows = Array.isArray(payload.users) ? payload.users : [payload];

  for (const row of rows) {
    if (row && row.id && row.masterCvText) {
      users.push({
        json: {
          userId: row.id,
          email: row.email || '',
          name: row.name || '',
          subscriptionStatus: row.subscriptionStatus || 'free',
          creditsRemaining: typeof row.creditsRemaining === 'number' ? row.creditsRemaining : 0,
          targetTitles: Array.isArray(row.targetTitles) ? row.targetTitles : ['software engineer'],
          locations: Array.isArray(row.locations) ? row.locations : ['remote'],
          remotePreference: row.remotePreference || 'any',
          salaryMin: typeof row.salaryMin === 'number' ? row.salaryMin : 0,
          industries: Array.isArray(row.industries) ? row.industries : [],
          masterCvText: row.masterCvText
        }
      });
    }
  }
}

if (users.length === 0) {
  return [];
}

return users;`;

function patchWorkflowJson(workflow) {
    const copy = JSON.parse(JSON.stringify(workflow));
    let hasFetchJobsViaAppApiNode = false;

    for (const node of copy.nodes || []) {
        if (node.name === "Schedule Trigger") {
            node.parameters = {
                ...node.parameters,
                rule: {
                    interval: [{ field: "hours", hoursInterval: 4, triggerAtMinute: 0 }],
                },
            };
        }

        if (node.name === "Fetch & Normalize All Job Sources") {
            node.parameters = {
                ...(node.parameters || {}),
                mode: "runOnceForAllItems",
                jsCode: FETCH_NORMALIZE_JS,
            };
        }

        if (node.name === "Fetch Jobs via App API") {
            hasFetchJobsViaAppApiNode = true;
            node.parameters = JSON.parse(JSON.stringify(FETCH_JOBS_VIA_APP_API_NODE.parameters));
            node.type = FETCH_JOBS_VIA_APP_API_NODE.type;
            node.typeVersion = FETCH_JOBS_VIA_APP_API_NODE.typeVersion;
            if (!Array.isArray(node.position) || node.position.length !== 2) {
                node.position = FETCH_JOBS_VIA_APP_API_NODE.position;
            }
            delete node.credentials;
        }

        if (node.name === "Fetch Active Users with Prefs & CV") {
            node.parameters = {
                method: "POST",
                url: "={{ $('Load Config').first().json.appUrl + '/api/webhooks/n8n' }}",
                sendHeaders: true,
                headerParameters: {
                    parameters: [
                        { name: "content-type", value: "application/json" },
                        {
                            name: "x-webhook-secret",
                            value: "={{ $('Load Config').first().json.webhookSecret }}",
                        },
                        {
                            name: "x-run-id",
                            value: "={{ String($execution.id || Date.now()) }}",
                        },
                    ],
                },
                sendBody: true,
                specifyBody: "json",
                jsonBody: "={{ JSON.stringify({ type: 'fetch_active_users', runId: String($execution.id || Date.now()) }) }}",
                options: { timeout: 20000 },
            };
            node.type = "n8n-nodes-base.httpRequest";
            node.typeVersion = 4.1;
            delete node.credentials;
        }

        if (node.name === "Prepare User Data") {
            node.parameters = { ...(node.parameters || {}), jsCode: PREPARE_USER_DATA_JS };
        }

        if (node.name === "Batch Save via App API") {
            node.parameters = { ...(node.parameters || {}), jsCode: BATCH_SAVE_JS };
        }

        if (node.name === "Parse Scoring Response") {
            node.parameters = {
                ...(node.parameters || {}),
                mode: "runOnceForEachItem",
                jsCode: PARSE_SCORING_JS,
            };
        }

        if (node.name === "Parse Tailored Response") {
            node.parameters = {
                ...(node.parameters || {}),
                mode: "runOnceForEachItem",
                jsCode: PARSE_TAILORED_JS,
            };
        }

        if (node.name === "Mark as Discovered") {
            node.parameters = {
                ...(node.parameters || {}),
                mode: "runOnceForEachItem",
            };
        }

        if (node.name === "Error Handler") {
            node.parameters = { ...(node.parameters || {}), jsCode: ERROR_HANDLER_JS };
        }
    }

    if (!hasFetchJobsViaAppApiNode) {
        copy.nodes.push(JSON.parse(JSON.stringify(FETCH_JOBS_VIA_APP_API_NODE)));
    }

    copy.connections = copy.connections || {};
    copy.connections["Prepare User Data"] = {
        main: [[{ node: "Fetch Jobs via App API", type: "main", index: 0 }]],
    };
    copy.connections["Fetch Jobs via App API"] = {
        main: [[{ node: "Fetch & Normalize All Job Sources", type: "main", index: 0 }]],
    };

    return copy;
}

function stringifyJsonAscii(value, spaces) {
    return JSON.stringify(value, null, spaces).replace(
        /[\u007f-\uffff]/g,
        (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`
    );
}

function getLoadConfigJsCode(workflow) {
    const node = (workflow.nodes || []).find((item) => item.name === "Load Config");
    return node?.parameters?.jsCode || null;
}

async function resolveWorkflow(prisma, workflowId) {
    if (workflowId) {
        const rows = await prisma.$queryRawUnsafe(
            `SELECT id, name, active, nodes, connections, settings, description, "versionId", "activeVersionId", "updatedAt", "versionCounter"
             FROM n8n.workflow_entity
             WHERE id = $1
             LIMIT 1;`,
            workflowId
        );
        return rows[0] || null;
    }

    const rows = await prisma.$queryRawUnsafe(`
        SELECT id, name, active, nodes, connections, settings, description, "versionId", "activeVersionId", "updatedAt", "versionCounter"
        FROM n8n.workflow_entity
        WHERE name ILIKE '%Job Discovery%Pipeline%'
        ORDER BY "updatedAt" DESC
        LIMIT 1;
    `);
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

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const workspaceRoot = path.resolve(__dirname, "..", "..", "..");
    const templatePath = path.join(workspaceRoot, "n8n", "workflows", "job-discovery-pipeline.json");

    const templateWorkflow = JSON.parse(fs.readFileSync(templatePath, "utf8"));
    const patchedTemplate = patchWorkflowJson(templateWorkflow);
    fs.writeFileSync(templatePath, `${stringifyJsonAscii(patchedTemplate, 4)}\n`);

    if (!args.applyProd) {
        console.log(
            JSON.stringify(
                {
                    mode: "template_only",
                    templatePath,
                    message: "Patched local workflow template. Re-run with --apply-prod to update live n8n workflow.",
                },
                null,
                2
            )
        );
        return;
    }

    loadEnvIfPresent();
    const prisma = new PrismaClient();

    try {
        const liveWorkflow = await resolveWorkflow(prisma, args.workflowId);
        if (!liveWorkflow) {
            throw new Error("live_workflow_not_found");
        }

        const latestHistory = await resolveLatestWorkflowHistory(prisma, liveWorkflow.id);
        if (!latestHistory) {
            throw new Error("live_workflow_history_missing");
        }

        const liveLoadConfig = getLoadConfigJsCode(liveWorkflow);
        if (!liveLoadConfig) {
            throw new Error("live_load_config_missing");
        }

        const prodWorkflow = JSON.parse(JSON.stringify(patchedTemplate));
        for (const node of prodWorkflow.nodes || []) {
            if (node.name === "Load Config") {
                node.parameters = { ...(node.parameters || {}), jsCode: liveLoadConfig };
            }
        }

        const nextVersionId = randomUUID();
        const historyAuthors = latestHistory.authors || "AutoApply Incident Bot";
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
                JSON.stringify(prodWorkflow.nodes || []),
                JSON.stringify(prodWorkflow.connections || {}),
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
                JSON.stringify(prodWorkflow.nodes || []),
                JSON.stringify(prodWorkflow.connections || {}),
                JSON.stringify(prodWorkflow.settings || {}),
                nextVersionId,
                liveWorkflow.id
            );

            const publishedRows = await tx.$queryRawUnsafe(
                `SELECT "workflowId"
                 FROM n8n.workflow_published_version
                 WHERE "workflowId" = $1
                 LIMIT 1;`,
                liveWorkflow.id
            );

            if (publishedRows.length === 0) {
                await tx.$executeRawUnsafe(
                    `INSERT INTO n8n.workflow_published_version ("workflowId", "publishedVersionId", "createdAt", "updatedAt")
                     VALUES ($1, $2, NOW(), NOW());`,
                    liveWorkflow.id,
                    nextVersionId
                );
            } else {
                await tx.$executeRawUnsafe(
                    `UPDATE n8n.workflow_published_version
                     SET "publishedVersionId" = $1,
                         "updatedAt" = NOW()
                     WHERE "workflowId" = $2;`,
                    nextVersionId,
                    liveWorkflow.id
                );
            }

            await appendPublishHistoryActivatedEvent(tx, liveWorkflow.id, nextVersionId);
        });

        const updated = await resolveWorkflow(prisma, liveWorkflow.id);
        const scheduleNode = (updated.nodes || []).find((n) => n.name === "Schedule Trigger");
        const latestHistoryAfter = await resolveLatestWorkflowHistory(prisma, liveWorkflow.id);

        console.log(
            JSON.stringify(
                {
                    mode: "template_and_prod",
                    workflowId: updated.id,
                    name: updated.name,
                    active: updated.active,
                    updatedAt: updated.updatedAt,
                    previousVersionId: liveWorkflow.versionId || null,
                    previousActiveVersionId: liveWorkflow.activeVersionId || null,
                    currentVersionId: updated.versionId || null,
                    currentActiveVersionId: updated.activeVersionId || null,
                    latestHistoryVersionId: latestHistoryAfter?.versionId || null,
                    scheduleRule: scheduleNode?.parameters?.rule || null,
                    nodeCount: (updated.nodes || []).length,
                },
                null,
                2
            )
        );
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error(`incident_patch_job_discovery_workflow_failed: ${error.message}`);
    process.exit(1);
});
