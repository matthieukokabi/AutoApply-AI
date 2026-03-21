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

const FETCH_NORMALIZE_JS = `// Fetch jobs from all sources for this user, normalize, and deduplicate
const user = $input.first().json;
const config = $('Load Config').first().json;
const primaryTitle = (user.targetTitles && user.targetTitles[0] ? user.targetTitles[0] : 'software engineer').trim();
const fallbackTitle = (user.targetTitles && user.targetTitles[1] ? user.targetTitles[1] : '').trim();
const titleCandidates = [primaryTitle, fallbackTitle].filter(Boolean);
const searchTitle = titleCandidates.length > 0 ? titleCandidates[0] : 'software engineer';
const normalizedTitleCandidates = titleCandidates.length > 0 ? titleCandidates : [searchTitle];
const locationCandidates = Array.isArray(user.locations)
  ? user.locations.map((location) => String(location || '').trim()).filter(Boolean).slice(0, 3)
  : [];
const searchLocation = locationCandidates.length > 0 ? locationCandidates[0] : '';
const remotePreference = String(user.remotePreference || 'any').toLowerCase();
const runId = String($execution.id || Date.now());

const allJobs = [];
const httpRequestHelper =
  (typeof $httpRequest === 'function')
    ? $httpRequest
    : (typeof this !== 'undefined' && this.helpers && typeof this.helpers.httpRequest === 'function')
    ? ((requestOptions) => this.helpers.httpRequest(requestOptions))
    : null;

function buildSearchPairs(titles, locations, limit) {
  const pairs = [];
  const safeTitles = Array.isArray(titles) && titles.length > 0 ? titles : ['software engineer'];
  const safeLocations = Array.isArray(locations) && locations.length > 0 ? locations : [''];
  const max = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 4;
  for (const title of safeTitles) {
    for (const location of safeLocations) {
      pairs.push({ title, location });
      if (pairs.length >= max) return pairs;
    }
  }
  return pairs;
}

function detectAdzunaCountry(location) {
  const locationLower = (location || '').toLowerCase();
  if (locationLower.includes('zurich') || locationLower.includes('z\u00fcrich') || locationLower.includes('bern') || locationLower.includes('geneva') || locationLower.includes('basel') || locationLower.includes('switzerland') || locationLower.includes('swiss') || locationLower.includes('lausanne')) return 'ch';
  if (locationLower.includes('london') || locationLower.includes('manchester') || locationLower.includes('uk') || locationLower.includes('united kingdom') || locationLower.includes('england')) return 'gb';
  if (locationLower.includes('berlin') || locationLower.includes('munich') || locationLower.includes('hamburg') || locationLower.includes('germany') || locationLower.includes('frankfurt') || locationLower.includes('deutschland')) return 'de';
  if (locationLower.includes('paris') || locationLower.includes('lyon') || locationLower.includes('france') || locationLower.includes('marseille')) return 'fr';
  if (locationLower.includes('amsterdam') || locationLower.includes('netherlands') || locationLower.includes('rotterdam')) return 'nl';
  if (locationLower.includes('vienna') || locationLower.includes('austria') || locationLower.includes('wien')) return 'at';
  return 'us';
}

async function safeFetch(url, options) {
  const requestOptions = options || {};
  const method = String(requestOptions.method || 'GET').toUpperCase();
  const headers = requestOptions.headers || {};
  const body = requestOptions.body;
  let helperFailed = false;

  if (httpRequestHelper) {
    try {
      const helperOptions = {
        method,
        url,
        headers,
        timeout: 15000,
        json: true
      };
      if (method !== 'GET' && method !== 'HEAD' && body !== undefined) {
        const contentType = String(headers['Content-Type'] || headers['content-type'] || '').toLowerCase();
        if (typeof body === 'string' && contentType.includes('application/json')) {
          try {
            helperOptions.body = JSON.parse(body);
          } catch {
            helperOptions.body = body;
          }
        } else {
          helperOptions.body = body;
        }
      }
      return await httpRequestHelper(helperOptions);
    } catch {
      helperFailed = true;
    }
  }

  if (typeof fetch !== 'function') {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const merged = Object.assign({}, requestOptions, { signal: controller.signal });
    const resp = await fetch(url, merged);
    clearTimeout(timeout);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    if (helperFailed) {
      return null;
    }
    clearTimeout(timeout);
    return null;
  }
}

const adzunaCountry = detectAdzunaCountry(searchLocation);
const searchPairs = buildSearchPairs(normalizedTitleCandidates.slice(0, 3), locationCandidates, 6);

// 1) Adzuna
if (config.adzunaAppId && config.adzunaAppKey) {
  try {
    for (const pair of searchPairs.slice(0, 4)) {
      const adzunaUrl = 'https://api.adzuna.com/v1/api/jobs/' + adzunaCountry + '/search/1?app_id=' + config.adzunaAppId + '&app_key=' + config.adzunaAppKey + '&what=' + encodeURIComponent(pair.title || searchTitle) + '&where=' + encodeURIComponent(pair.location || searchLocation) + '&results_per_page=15&content-type=application/json';
      const data = await safeFetch(adzunaUrl);
      if (data && Array.isArray(data.results)) {
        for (const j of data.results) {
          allJobs.push({
            externalId: 'adzuna-' + j.id,
            title: j.title || '',
            company: (j.company && j.company.display_name) || 'Unknown',
            location: (j.location && j.location.display_name) || '',
            description: j.description || '',
            source: 'adzuna',
            url: j.redirect_url || '',
            salary: j.salary_is_predicted === '0' ? String(j.salary_min) + '-' + String(j.salary_max) : null,
            postedAt: j.created ? new Date(j.created).toISOString() : null
          });
        }
      }
    }
  } catch { /* continue */ }
}

// 2) The Muse
try {
  const data = await safeFetch('https://www.themuse.com/api/public/jobs?category=Engineering&level=Mid%20Level&page=1');
  if (data && Array.isArray(data.results)) {
    for (const j of data.results) {
      allJobs.push({
        externalId: 'themuse-' + j.id,
        title: j.name || '',
        company: (j.company && j.company.name) || 'Unknown',
        location: Array.isArray(j.locations) ? j.locations.map((l) => l.name).join(', ') : '',
        description: (j.contents || '').replace(/<[^>]*>/g, '').substring(0, 3000),
        source: 'themuse',
        url: (j.refs && j.refs.landing_page) || '',
        salary: null,
        postedAt: j.publication_date || null
      });
    }
  }
} catch { /* continue */ }

// 3) Remotive
try {
  for (const title of normalizedTitleCandidates.slice(0, 3)) {
    const remotiveUrl = 'https://remotive.com/api/remote-jobs?search=' + encodeURIComponent(title || searchTitle) + '&limit=15';
    const data = await safeFetch(remotiveUrl);
    if (data && Array.isArray(data.jobs)) {
      for (const j of data.jobs) {
        allJobs.push({
          externalId: 'remotive-' + j.id,
          title: j.title || '',
          company: j.company_name || 'Unknown',
          location: j.candidate_required_location || 'Remote',
          description: (j.description || '').replace(/<[^>]*>/g, '').substring(0, 3000),
          source: 'remotive',
          url: j.url || '',
          salary: j.salary || null,
          postedAt: j.publication_date || null
        });
      }
    }
  }
} catch { /* continue */ }

// 4) Arbeitnow
try {
  for (const title of normalizedTitleCandidates.slice(0, 3)) {
    const arbeitnowUrl = 'https://www.arbeitnow.com/api/job-board-api?search=' + encodeURIComponent(title || searchTitle) + '&page=1';
    const data = await safeFetch(arbeitnowUrl);
    if (data && Array.isArray(data.data)) {
      for (const j of data.data) {
        allJobs.push({
          externalId: 'arbeitnow-' + (j.slug || j.id || Date.now()),
          title: j.title || '',
          company: j.company_name || 'Unknown',
          location: j.location || '',
          description: (j.description || '').replace(/<[^>]*>/g, '').substring(0, 3000),
          source: 'arbeitnow',
          url: j.url || '',
          salary: null,
          postedAt: j.created_at || null
        });
      }
    }
  }
} catch { /* continue */ }

// 5) JSearch
if (config.jsearchApiKey) {
  try {
    const jsearchPair = searchPairs.length > 0 ? searchPairs[0] : { title: searchTitle, location: searchLocation };
    const query = String(jsearchPair.title || searchTitle || 'software engineer') + ' ' + String(jsearchPair.location || searchLocation || 'remote');
    const jsearchUrl = 'https://jsearch.p.rapidapi.com/search?query=' + encodeURIComponent(query) + '&page=1&num_pages=1';
    const data = await safeFetch(jsearchUrl, {
      headers: {
        'X-RapidAPI-Key': config.jsearchApiKey,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
      }
    });
    if (data && Array.isArray(data.data)) {
      for (const j of data.data) {
        allJobs.push({
          externalId: 'jsearch-' + j.job_id,
          title: j.job_title || '',
          company: j.employer_name || 'Unknown',
          location: j.job_city ? (j.job_city + ', ' + (j.job_state || j.job_country || '')) : (j.job_country || ''),
          description: (j.job_description || '').substring(0, 3000),
          source: 'jsearch',
          url: j.job_apply_link || j.job_google_link || '',
          salary: j.job_min_salary ? String(j.job_min_salary) + '-' + String(j.job_max_salary) : null,
          postedAt: j.job_posted_at_datetime_utc || null
        });
      }
    }
  } catch { /* continue */ }
}

// 6) Jooble
if (config.joobleApiKey) {
  try {
    for (const pair of searchPairs.slice(0, 4)) {
      const data = await safeFetch('https://jooble.org/api/' + config.joobleApiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: (pair.title || searchTitle), location: (pair.location || searchLocation), page: 1 })
      });
      if (data && Array.isArray(data.jobs)) {
        for (const j of data.jobs) {
          allJobs.push({
            externalId: 'jooble-' + (j.id || Date.now()),
            title: j.title || '',
            company: j.company || 'Unknown',
            location: j.location || '',
            description: (j.snippet || '').substring(0, 3000),
            source: 'jooble',
            url: j.link || '',
            salary: j.salary || null,
            postedAt: j.updated || null
          });
        }
      }
    }
  } catch { /* continue */ }
}

// 7) Reed
if (config.reedApiKey) {
  try {
    const reedAuth = btoa(config.reedApiKey + ':');
    for (const pair of searchPairs.slice(0, 4)) {
      const reedUrl = 'https://www.reed.co.uk/api/1.0/search?keywords=' + encodeURIComponent(pair.title || searchTitle) + '&locationName=' + encodeURIComponent(pair.location || searchLocation) + '&resultsToTake=15';
      const data = await safeFetch(reedUrl, {
        headers: { Authorization: 'Basic ' + reedAuth }
      });
      if (data && Array.isArray(data.results)) {
        for (const j of data.results) {
          allJobs.push({
            externalId: 'reed-' + j.jobId,
            title: j.jobTitle || '',
            company: j.employerName || 'Unknown',
            location: j.locationName || '',
            description: (j.jobDescription || '').substring(0, 3000),
            source: 'reed',
            url: j.jobUrl || '',
            salary: j.minimumSalary ? String(j.minimumSalary) + '-' + String(j.maximumSalary) : null,
            postedAt: j.date || null
          });
        }
      }
    }
  } catch { /* continue */ }
}

const seen = new Set();
const uniqueJobs = [];
for (const job of allJobs) {
  if (!seen.has(job.externalId) && job.title && job.description.length > 50) {
    seen.add(job.externalId);
    uniqueJobs.push(job);
  }
}

function normalizeForMatch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase();
}

function matchesPreferredLocation(job, locationNeedles, preference) {
  if (!Array.isArray(locationNeedles) || locationNeedles.length === 0) return true;
  const haystack = normalizeForMatch((job.location || '') + ' ' + (job.title || '') + ' ' + (job.description || ''));
  const matchesLocation = locationNeedles.some((needle) => haystack.includes(needle));
  const mentionsRemote = /(remote|home office|work from home|hybrid|teletravail|hybride)/.test(haystack);

  if (preference === 'remote') return mentionsRemote;
  if (preference === 'onsite') return matchesLocation && !mentionsRemote;
  if (preference === 'hybrid') return matchesLocation;
  return matchesLocation;
}

const locationNeedles = locationCandidates.map(normalizeForMatch);
const filteredJobs = uniqueJobs.filter((job) =>
  matchesPreferredLocation(job, locationNeedles, remotePreference)
);
const finalJobs = filteredJobs.length > 0 ? filteredJobs : uniqueJobs;

if (finalJobs.length === 0) return [];

return finalJobs.map((job) => ({
  json: {
    ...job,
    runId,
    userId: user.userId,
    masterCvText: user.masterCvText,
    subscriptionStatus: user.subscriptionStatus,
    creditsRemaining: user.creditsRemaining
  }
}));`;

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
                mode: "runOnceForEachItem",
                jsCode: FETCH_NORMALIZE_JS,
            };
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
