#!/usr/bin/env node

/**
 * Safe recovery run for one profile.
 *
 * Supports:
 * - dry-run (default)
 * - real-run persistence via /api/webhooks/n8n callback
 *
 * Usage examples:
 *   node scripts/automation_pipeline_recovery_run.js --email matthieu.kokabi@gmail.com
 *   node scripts/automation_pipeline_recovery_run.js --email matthieu.kokabi@gmail.com --real-run --max-jobs 3
 */

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

function parseArgs(argv) {
    const args = {
        userId: null,
        email: null,
        help: false,
        realRun: false,
        maxJobs: 3,
        tailorThreshold: 70,
        baseUrl: "https://autoapply.works",
    };

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === "--user-id") {
            args.userId = argv[i + 1] || null;
            i += 1;
        } else if (token === "--email") {
            args.email = argv[i + 1] || null;
            i += 1;
        } else if (token === "--real-run") {
            args.realRun = true;
        } else if (token === "--help" || token === "-h") {
            args.help = true;
        } else if (token === "--max-jobs") {
            args.maxJobs = Math.max(1, Number(argv[i + 1] || 3));
            i += 1;
        } else if (token === "--tailor-threshold") {
            args.tailorThreshold = Math.max(0, Math.min(100, Number(argv[i + 1] || 70)));
            i += 1;
        } else if (token === "--base-url") {
            args.baseUrl = argv[i + 1] || args.baseUrl;
            i += 1;
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

async function safeFetchJson(url, options = {}) {
    const { timeoutMs = 20000, ...fetchOptions } = options;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const resp = await fetch(url, { ...fetchOptions, signal: controller.signal });
        clearTimeout(timeout);
        const text = await resp.text();
        let body = null;
        try {
            body = JSON.parse(text);
        } catch {
            body = null;
        }
        return { ok: resp.ok, status: resp.status, body, raw: text };
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

function parseJsonFromModelText(rawText) {
    const text = typeof rawText === "string" ? rawText : "";
    const candidates = [];

    if (text) {
        candidates.push(text);
    }

    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
        candidates.unshift(fenced[1]);
    }

    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        candidates.push(text.slice(firstBrace, lastBrace + 1));
    }

    for (const candidate of candidates) {
        try {
            return JSON.parse(String(candidate).trim());
        } catch {
            // keep trying fallback candidates
        }
    }

    return null;
}

function extractConfigFromLoadNode(jsCode) {
    const pick = (key) => {
        const regex = new RegExp(`${key}: '([^']*)'`);
        const match = jsCode.match(regex);
        return match ? match[1] : "";
    };

    return {
        anthropicApiKey: pick("anthropicApiKey"),
        webhookSecret: pick("webhookSecret"),
        adzunaAppId: pick("adzunaAppId"),
        adzunaAppKey: pick("adzunaAppKey"),
        jsearchApiKey: pick("jsearchApiKey"),
        joobleApiKey: pick("joobleApiKey"),
        reedApiKey: pick("reedApiKey"),
    };
}

function detectAdzunaCountry(location) {
    const locationLower = (location || "").toLowerCase();
    if (
        locationLower.includes("zurich") ||
        locationLower.includes("z\u00fcrich") ||
        locationLower.includes("bern") ||
        locationLower.includes("geneva") ||
        locationLower.includes("basel") ||
        locationLower.includes("switzerland") ||
        locationLower.includes("swiss") ||
        locationLower.includes("lausanne")
    ) {
        return "ch";
    }
    if (
        locationLower.includes("london") ||
        locationLower.includes("manchester") ||
        locationLower.includes("uk") ||
        locationLower.includes("united kingdom") ||
        locationLower.includes("england")
    ) {
        return "gb";
    }
    if (
        locationLower.includes("berlin") ||
        locationLower.includes("munich") ||
        locationLower.includes("hamburg") ||
        locationLower.includes("germany") ||
        locationLower.includes("frankfurt") ||
        locationLower.includes("deutschland")
    ) {
        return "de";
    }
    if (
        locationLower.includes("paris") ||
        locationLower.includes("lyon") ||
        locationLower.includes("france") ||
        locationLower.includes("marseille")
    ) {
        return "fr";
    }
    if (
        locationLower.includes("amsterdam") ||
        locationLower.includes("netherlands") ||
        locationLower.includes("rotterdam")
    ) {
        return "nl";
    }
    if (
        locationLower.includes("vienna") ||
        locationLower.includes("austria") ||
        locationLower.includes("wien")
    ) {
        return "at";
    }
    return "us";
}

function uniqueNonEmpty(values, max = 3) {
    const out = [];
    const seen = new Set();
    for (const value of values || []) {
        const normalized = typeof value === "string" ? value.trim() : "";
        if (!normalized) {
            continue;
        }
        const key = normalized.toLowerCase();
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        out.push(normalized);
        if (out.length >= max) {
            break;
        }
    }
    return out;
}

function normalizeForMatch(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function buildSearchCriteria(preferences) {
    const preferredTitles = uniqueNonEmpty(preferences?.targetTitles, 3);
    const preferredLocations = uniqueNonEmpty(preferences?.locations, 3);
    const remotePreference = String(preferences?.remotePreference || "any")
        .trim()
        .toLowerCase();

    const titleCandidates = uniqueNonEmpty(
        [
            ...preferredTitles,
            preferredTitles[0]
                ? preferredTitles[0]
                      .replace(/\b(lead|manager|head)\b/gi, "")
                      .replace(/\s{2,}/g, " ")
                      .trim()
                : "",
            "IT Operations",
        ],
        4
    );

    if (titleCandidates.length === 0) {
        titleCandidates.push("software engineer");
    }

    return {
        searchTitle: titleCandidates[0],
        searchLocation: preferredLocations[0] || "",
        titleCandidates,
        locationCandidates: preferredLocations,
        remotePreference:
            remotePreference === "remote" ||
            remotePreference === "hybrid" ||
            remotePreference === "onsite"
                ? remotePreference
                : "any",
    };
}

function matchesLocationPreference(job, options) {
    const locationNeedles = (options?.locationCandidates || []).map(normalizeForMatch);
    const remotePreference = options?.remotePreference || "any";
    const haystack = normalizeForMatch(
        `${job?.location || ""} ${job?.title || ""} ${job?.description || ""}`
    );

    const hasLocationPreference = locationNeedles.length > 0;
    const matchesLocation = !hasLocationPreference
        ? true
        : locationNeedles.some((needle) => haystack.includes(needle));
    const mentionsRemote = /(remote|home office|work from home|hybrid|teletravail|hybride)/.test(
        haystack
    );

    if (remotePreference === "remote") {
        return mentionsRemote;
    }

    if (remotePreference === "onsite") {
        return matchesLocation && !mentionsRemote;
    }

    if (remotePreference === "hybrid") {
        if (hasLocationPreference) {
            return matchesLocation;
        }
        return haystack.includes("hybrid") || mentionsRemote;
    }

    if (hasLocationPreference) {
        return matchesLocation;
    }

    return true;
}

function aggregateConnectorResponses(responses, shapeKey) {
    const items = [];
    let ok = false;
    let status = null;
    let error = null;
    for (const response of responses) {
        if (!response) {
            continue;
        }
        if (response.ok) {
            ok = true;
            status = response.status || status || 200;
            const bucket = response.body?.[shapeKey];
            if (Array.isArray(bucket)) {
                items.push(...bucket);
            }
        } else if (!ok) {
            status = response.status ?? status;
            error = response.error || error;
        }
    }

    return {
        ok,
        status: ok ? status || 200 : status,
        error: ok ? null : error,
        body: { [shapeKey]: items },
    };
}

function normalizeJobs(source, payload) {
    const out = [];

    switch (source) {
        case "adzuna": {
            for (const j of payload?.results || []) {
                out.push({
                    externalId: `adzuna-${j.id}`,
                    title: j.title || "",
                    company: j.company?.display_name || "Unknown",
                    location: j.location?.display_name || "",
                    description: j.description || "",
                    source: "adzuna",
                    url: j.redirect_url || "",
                    salary: j.salary_is_predicted === "0" ? `${j.salary_min}-${j.salary_max}` : null,
                    postedAt: j.created ? new Date(j.created).toISOString() : null,
                });
            }
            break;
        }
        case "themuse": {
            for (const j of payload?.results || []) {
                out.push({
                    externalId: `themuse-${j.id}`,
                    title: j.name || "",
                    company: j.company?.name || "Unknown",
                    location: (j.locations || []).map((l) => l.name).join(", "),
                    description: (j.contents || "").replace(/<[^>]*>/g, "").substring(0, 3000),
                    source: "themuse",
                    url: j.refs?.landing_page || "",
                    salary: null,
                    postedAt: j.publication_date || null,
                });
            }
            break;
        }
        case "remotive": {
            for (const j of payload?.jobs || []) {
                out.push({
                    externalId: `remotive-${j.id}`,
                    title: j.title || "",
                    company: j.company_name || "Unknown",
                    location: j.candidate_required_location || "Remote",
                    description: (j.description || "").replace(/<[^>]*>/g, "").substring(0, 3000),
                    source: "remotive",
                    url: j.url || "",
                    salary: j.salary || null,
                    postedAt: j.publication_date || null,
                });
            }
            break;
        }
        case "arbeitnow": {
            for (const j of payload?.data || []) {
                out.push({
                    externalId: `arbeitnow-${j.slug || j.id || Date.now()}`,
                    title: j.title || "",
                    company: j.company_name || "Unknown",
                    location: j.location || "",
                    description: (j.description || "").replace(/<[^>]*>/g, "").substring(0, 3000),
                    source: "arbeitnow",
                    url: j.url || "",
                    salary: null,
                    postedAt: j.created_at || null,
                });
            }
            break;
        }
        case "jsearch": {
            for (const j of payload?.data || []) {
                out.push({
                    externalId: `jsearch-${j.job_id}`,
                    title: j.job_title || "",
                    company: j.employer_name || "Unknown",
                    location: j.job_city
                        ? `${j.job_city}, ${j.job_state || j.job_country || ""}`
                        : (j.job_country || ""),
                    description: (j.job_description || "").substring(0, 3000),
                    source: "jsearch",
                    url: j.job_apply_link || j.job_google_link || "",
                    salary: j.job_min_salary ? `${j.job_min_salary}-${j.job_max_salary}` : null,
                    postedAt: j.job_posted_at_datetime_utc || null,
                });
            }
            break;
        }
        case "jooble": {
            for (const j of payload?.jobs || []) {
                out.push({
                    externalId: `jooble-${j.id || Date.now()}`,
                    title: j.title || "",
                    company: j.company || "Unknown",
                    location: j.location || "",
                    description: (j.snippet || "").substring(0, 3000),
                    source: "jooble",
                    url: j.link || "",
                    salary: j.salary || null,
                    postedAt: j.updated || null,
                });
            }
            break;
        }
        case "reed": {
            for (const j of payload?.results || []) {
                out.push({
                    externalId: `reed-${j.jobId}`,
                    title: j.jobTitle || "",
                    company: j.employerName || "Unknown",
                    location: j.locationName || "",
                    description: (j.jobDescription || "").substring(0, 3000),
                    source: "reed",
                    url: j.jobUrl || "",
                    salary: j.minimumSalary ? `${j.minimumSalary}-${j.maximumSalary}` : null,
                    postedAt: j.date || null,
                });
            }
            break;
        }
        default:
            break;
    }

    return out;
}

function dedupeJobs(jobs) {
    const seen = new Set();
    const out = [];
    for (const job of jobs) {
        if (!job.externalId || seen.has(job.externalId)) {
            continue;
        }
        if (!job.title || (job.description || "").length <= 50) {
            continue;
        }
        seen.add(job.externalId);
        out.push(job);
    }
    return out;
}

function buildConnectorResult(source, response) {
    return {
        source,
        ok: Boolean(response?.ok),
        status: response?.status ?? null,
        error: response?.error || null,
        normalized: response?.ok ? normalizeJobs(source, response?.body) : [],
    };
}

function buildApplicationsPayload(scored, tailoredByExternalId, runId) {
    return scored.map((job) => {
        const tailored = tailoredByExternalId.get(job.externalId);
        const isTailored = Boolean(tailored?.tailoredCvMarkdown);
        return {
            externalId: job.externalId,
            title: job.title,
            company: job.company,
            location: job.location,
            description: job.description,
            source: job.source,
            url: job.url,
            salary: job.salary,
            postedAt: job.postedAt,
            compatibilityScore: job.compatibilityScore || 0,
            atsKeywords: job.atsKeywords || [],
            matchingStrengths: job.matchingStrengths || [],
            gaps: job.gaps || [],
            recommendation: job.recommendation || "skip",
            tailoredCvMarkdown: tailored?.tailoredCvMarkdown || null,
            coverLetterMarkdown: tailored?.coverLetterMarkdown || null,
            scoringError: job.scoringError || null,
            tailoringError: tailored?.tailoringError || null,
            status: isTailored ? "tailored" : "discovered",
            runId,
        };
    });
}

async function scoreJob(job, masterCvText, anthropicApiKey) {
    if (!anthropicApiKey) {
        return {
            compatibilityScore: 0,
            atsKeywords: [],
            matchingStrengths: [],
            gaps: [],
            recommendation: "skip",
            scoringError: "missing_anthropic_api_key",
        };
    }

    const prompt = `You are an expert ATS analyst. Analyze this job against the candidate CV.\n\nReturn ONLY raw JSON (no markdown, no code blocks):\n{"compatibility_score":<0-100>,"ats_keywords":[<up to 10>],"matching_strengths":[<up to 5>],"gaps":[<up to 5>],"recommendation":"apply"|"stretch"|"skip"}\n\nScoring: skills 40%, experience 25%, education 15%, industry 20%. apply=80+, stretch=60-79, skip=<60.\n\nJOB TITLE: ${job.title}\nCOMPANY: ${job.company}\nJOB DESCRIPTION:\n${(job.description || "").substring(0, 3000)}\n\nCANDIDATE CV:\n${(masterCvText || "").substring(0, 5000)}`;

    const response = await safeFetchJson("https://api.anthropic.com/v1/messages", {
        timeoutMs: 120000,
        method: "POST",
        headers: {
            "x-api-key": anthropicApiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1024,
            temperature: 0.1,
            messages: [{ role: "user", content: prompt }],
        }),
    });

    if (!response.ok) {
        return {
            compatibilityScore: 0,
            atsKeywords: [],
            matchingStrengths: [],
            gaps: [],
            recommendation: "skip",
            scoringError: `anthropic_scoring_http_${response.status || "unknown"}`,
        };
    }

    const text = response.body?.content?.[0]?.text || "";
    const parsed = parseJsonFromModelText(text);
    if (parsed && typeof parsed === "object") {
        return {
            compatibilityScore: parsed.compatibility_score || 0,
            atsKeywords: parsed.ats_keywords || [],
            matchingStrengths: parsed.matching_strengths || [],
            gaps: parsed.gaps || [],
            recommendation: parsed.recommendation || "skip",
            scoringError: null,
        };
    }

    return {
        compatibilityScore: 0,
        atsKeywords: [],
        matchingStrengths: [],
        gaps: [],
        recommendation: "skip",
        scoringError: "scoring_parse_error",
    };
}

async function tailorJob(job, masterCvText, anthropicApiKey, atsKeywords) {
    if (!anthropicApiKey) {
        return {
            tailoredCvMarkdown: "",
            coverLetterMarkdown: "",
            tailoringError: "missing_anthropic_api_key",
        };
    }

    const prompt = `You are an expert ATS resume writer. Rewrite this CV for the job below.\n\nReturn ONLY raw JSON (no markdown fences):\n{"tailored_cv_markdown":"<CV in markdown>","motivation_letter_markdown":"<cover letter in markdown>"}\n\nRULES: NEVER fabricate. ONLY use info from CV. MAY reorder/rephrase with ATS keywords. Clean Markdown, single-column, max 2 pages. Cover letter: 250-350 words, reference company+role, no cliches.\n\nATS KEYWORDS: ${JSON.stringify(atsKeywords || [])}\n\nJOB: ${job.title} at ${job.company}\n${(job.description || "").substring(0, 3000)}\n\nCV:\n${(masterCvText || "").substring(0, 5000)}`;

    const response = await safeFetchJson("https://api.anthropic.com/v1/messages", {
        timeoutMs: 120000,
        method: "POST",
        headers: {
            "x-api-key": anthropicApiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            temperature: 0.2,
            messages: [{ role: "user", content: prompt }],
        }),
    });

    if (!response.ok) {
        return {
            tailoredCvMarkdown: "",
            coverLetterMarkdown: "",
            tailoringError: `anthropic_tailor_http_${response.status || "unknown"}`,
        };
    }

    const text = response.body?.content?.[0]?.text || "";
    const parsed = parseJsonFromModelText(text);
    if (parsed && typeof parsed === "object") {
        const tailoredCvMarkdown =
            parsed.tailored_cv_markdown ||
            parsed.tailoredCvMarkdown ||
            parsed.cv_markdown ||
            "";
        const coverLetterMarkdown =
            parsed.motivation_letter_markdown ||
            parsed.cover_letter_markdown ||
            parsed.coverLetterMarkdown ||
            "";

        if (!tailoredCvMarkdown && !coverLetterMarkdown && text.trim().length >= 200) {
            return {
                tailoredCvMarkdown: text.trim(),
                coverLetterMarkdown: "",
                tailoringError: "tailoring_parse_fallback_raw",
            };
        }

        return {
            tailoredCvMarkdown,
            coverLetterMarkdown,
            tailoringError: null,
        };
    }

    if (text.trim().length >= 200) {
        return {
            tailoredCvMarkdown: text.trim(),
            coverLetterMarkdown: "",
            tailoringError: "tailoring_parse_fallback_raw",
        };
    }

    return {
        tailoredCvMarkdown: "",
        coverLetterMarkdown: "",
        tailoringError: "tailoring_parse_error",
    };
}

async function main() {
    loadEnvIfPresent();
    const args = parseArgs(process.argv.slice(2));

    if (args.help) {
        process.stdout.write(
            [
                "Usage:",
                "  npm run incident:pipeline:recovery -- --email <email> [--real-run] [--max-jobs 3] [--tailor-threshold 70] [--base-url https://autoapply.works]",
                "  npm run incident:pipeline:recovery -- --user-id <id> [--real-run]",
                "",
                "Notes:",
                "  - default mode is dry-run (no persistence callback)",
                "  - --real-run sends payload to /api/webhooks/n8n and writes applications",
            ].join("\n") + "\n"
        );
        return;
    }

    const prisma = new PrismaClient();

    try {
        const [workflow] = await prisma.$queryRawUnsafe(`
            SELECT id, name, nodes
            FROM n8n.workflow_entity
            WHERE name ILIKE '%Job Discovery%Pipeline%'
            ORDER BY "updatedAt" DESC
            LIMIT 1;
        `);

        if (!workflow) {
            throw new Error("workflow_not_found");
        }

        const loadNode = (workflow.nodes || []).find((node) => node.name === "Load Config");
        if (!loadNode?.parameters?.jsCode) {
            throw new Error("load_config_missing");
        }

        const config = extractConfigFromLoadNode(loadNode.parameters.jsCode);

        const userWhere = args.userId
            ? { id: args.userId }
            : args.email
              ? { email: args.email }
              : { automationEnabled: true };

        const user = await prisma.user.findFirst({
            where: userWhere,
            include: {
                masterProfile: true,
                preferences: true,
            },
        });

        if (!user) {
            throw new Error("user_not_found");
        }

        if (!user.masterProfile?.rawText) {
            throw new Error("user_master_profile_missing");
        }

        if (!user.preferences) {
            throw new Error("user_preferences_missing");
        }

        const criteria = buildSearchCriteria(user.preferences);
        const {
            searchTitle,
            searchLocation,
            titleCandidates,
            locationCandidates,
            remotePreference,
        } = criteria;
        const adzunaCountry = detectAdzunaCountry(searchLocation);
        const runId = `recovery-${Date.now()}-${user.id}`;
        const titleLocationPairs = [];
        const locationsForPairs =
            locationCandidates.length > 0 ? locationCandidates : [""];
        for (const title of titleCandidates) {
            for (const location of locationsForPairs) {
                titleLocationPairs.push({ title, location });
                if (titleLocationPairs.length >= 6) {
                    break;
                }
            }
            if (titleLocationPairs.length >= 6) {
                break;
            }
        }

        const connectors = [];
        connectors.push({
            source: "adzuna",
            fetcher: async () => {
                if (!config.adzunaAppId || !config.adzunaAppKey) {
                    return {
                        ok: false,
                        status: null,
                        error: "missing_adzuna_credentials",
                        body: { results: [] },
                    };
                }
                const responses = [];
                for (const pair of titleLocationPairs.slice(0, 4)) {
                    responses.push(
                        await safeFetchJson(
                            `https://api.adzuna.com/v1/api/jobs/${adzunaCountry}/search/1?app_id=${encodeURIComponent(config.adzunaAppId)}&app_key=${encodeURIComponent(config.adzunaAppKey)}&what=${encodeURIComponent(pair.title)}&where=${encodeURIComponent(pair.location)}&results_per_page=15&content-type=application/json`
                        )
                    );
                }
                return aggregateConnectorResponses(responses, "results");
            },
        });
        connectors.push({
            source: "themuse",
            fetcher: () =>
                safeFetchJson(
                    "https://www.themuse.com/api/public/jobs?category=Engineering&level=Mid%20Level&page=1"
                ),
        });
        connectors.push({
            source: "remotive",
            fetcher: async () => {
                const responses = [];
                for (const title of titleCandidates.slice(0, 3)) {
                    responses.push(
                        await safeFetchJson(
                            `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(title)}&limit=15`
                        )
                    );
                }
                return aggregateConnectorResponses(responses, "jobs");
            },
        });
        connectors.push({
            source: "arbeitnow",
            fetcher: async () => {
                const responses = [];
                for (const title of titleCandidates.slice(0, 3)) {
                    responses.push(
                        await safeFetchJson(
                            `https://www.arbeitnow.com/api/job-board-api?search=${encodeURIComponent(title)}&page=1`
                        )
                    );
                }
                return aggregateConnectorResponses(responses, "data");
            },
        });

        if (config.jsearchApiKey) {
            const query = `${searchTitle} ${searchLocation || "remote"}`.trim();
            connectors.push({
                source: "jsearch",
                fetcher: () =>
                    safeFetchJson(
                        `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&page=1&num_pages=1`,
                        {
                            headers: {
                                "X-RapidAPI-Key": config.jsearchApiKey,
                                "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
                            },
                        }
                    ),
            });
        }

        if (config.joobleApiKey) {
            connectors.push({
                source: "jooble",
                fetcher: async () => {
                    const responses = [];
                    for (const pair of titleLocationPairs.slice(0, 4)) {
                        responses.push(
                            await safeFetchJson(
                                `https://jooble.org/api/${config.joobleApiKey}`,
                                {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        keywords: pair.title,
                                        location: pair.location,
                                        page: 1,
                                    }),
                                }
                            )
                        );
                    }
                    return aggregateConnectorResponses(responses, "jobs");
                },
            });
        }

        if (config.reedApiKey) {
            connectors.push({
                source: "reed",
                fetcher: async () => {
                    const auth = Buffer.from(`${config.reedApiKey}:`).toString("base64");
                    const responses = [];
                    for (const pair of titleLocationPairs.slice(0, 4)) {
                        responses.push(
                            await safeFetchJson(
                                `https://www.reed.co.uk/api/1.0/search?keywords=${encodeURIComponent(pair.title)}&locationName=${encodeURIComponent(pair.location)}&resultsToTake=15`,
                                {
                                    headers: {
                                        Authorization: `Basic ${auth}`,
                                    },
                                }
                            )
                        );
                    }
                    return aggregateConnectorResponses(responses, "results");
                },
            });
        }

        const rawConnectorResults = [];
        for (const connector of connectors) {
            const response = await connector.fetcher();
            rawConnectorResults.push(buildConnectorResult(connector.source, response));
        }

        const allDedupedJobs = dedupeJobs(
            rawConnectorResults.flatMap((entry) => entry.normalized)
        );
        const preferenceFilteredJobs = allDedupedJobs.filter((job) =>
            matchesLocationPreference(job, {
                locationCandidates,
                remotePreference,
            })
        );
        const dedupedJobs = (
            preferenceFilteredJobs.length > 0
                ? preferenceFilteredJobs
                : allDedupedJobs
        ).slice(0, args.maxJobs);

        const beforeApplications = await prisma.application.count({ where: { userId: user.id } });

        const scored = [];
        for (const job of dedupedJobs) {
            const score = await scoreJob(job, user.masterProfile.rawText, config.anthropicApiKey);
            scored.push({ ...job, ...score });
        }

        let tailorCandidates = scored
            .filter((job) => job.compatibilityScore >= args.tailorThreshold)
            .slice(0, args.maxJobs);

        if (tailorCandidates.length === 0 && scored.length > 0) {
            const fallback = [...scored].sort(
                (a, b) => b.compatibilityScore - a.compatibilityScore
            )[0];
            tailorCandidates = [fallback];
        }

        const tailoredByExternalId = new Map();
        for (const candidate of tailorCandidates) {
            const tailored = await tailorJob(
                candidate,
                user.masterProfile.rawText,
                config.anthropicApiKey,
                candidate.atsKeywords
            );
            tailoredByExternalId.set(candidate.externalId, tailored);
        }

        const applicationsPayload = buildApplicationsPayload(scored, tailoredByExternalId, runId);

        let callbackResult = null;
        if (args.realRun && applicationsPayload.length > 0) {
            const webhookSecret = process.env.N8N_WEBHOOK_SECRET || config.webhookSecret;
            if (!webhookSecret) {
                throw new Error("webhook_secret_missing_for_real_run");
            }

            callbackResult = await safeFetchJson(`${args.baseUrl}/api/webhooks/n8n`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-webhook-secret": webhookSecret,
                    "x-run-id": runId,
                },
                body: JSON.stringify({
                    type: "new_applications",
                    runId,
                    data: {
                        userId: user.id,
                        applications: applicationsPayload,
                    },
                }),
            });

            if (!callbackResult.ok) {
                throw new Error(`recovery_callback_failed_${callbackResult.status || "unknown"}`);
            }
        }

        const afterApplications = await prisma.application.count({ where: { userId: user.id } });
        const recentTailored = await prisma.application.findMany({
            where: {
                userId: user.id,
                createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
                OR: [
                    { tailoredCvMarkdown: { not: null } },
                    { coverLetterMarkdown: { not: null } },
                ],
            },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
                id: true,
                createdAt: true,
                status: true,
                compatibilityScore: true,
                job: { select: { title: true, company: true, source: true } },
            },
        });

        const summary = {
            generatedAt: new Date().toISOString(),
            mode: args.realRun ? "real-run" : "dry-run",
            runId,
            user: {
                id: user.id,
                email: user.email,
                subscriptionStatus: user.subscriptionStatus,
                automationEnabled: user.automationEnabled,
            },
            criteria: {
                searchTitle,
                searchLocation,
                titleCandidates,
                locationCandidates,
                remotePreference,
                maxJobs: args.maxJobs,
                tailorThreshold: args.tailorThreshold,
            },
            sourceInsights: {
                linkedin: {
                    automaticDiscoveryEnabled: false,
                    reason:
                        "linkedin_jobs_api_not_configured_in_automation_pipeline",
                    availableVia: "manual_job_url_import",
                },
            },
            connectors: rawConnectorResults.map((entry) => ({
                source: entry.source,
                ok: entry.ok,
                status: entry.status,
                error: entry.error,
                normalizedCount: entry.normalized.length,
            })),
            jobs: {
                totalDedupedBeforePreferenceFilter: allDedupedJobs.length,
                preferenceFilteredCount: preferenceFilteredJobs.length,
                dedupedCount: dedupedJobs.length,
                scoredCount: scored.length,
                tailoredCandidatesCount: tailorCandidates.length,
                payloadCount: applicationsPayload.length,
                payloadTailoredCount: applicationsPayload.filter(
                    (app) => app.status === "tailored"
                ).length,
                scoringErrors: applicationsPayload
                    .map((app) => app.scoringError)
                    .filter(Boolean),
                tailoringErrors: applicationsPayload
                    .map((app) => app.tailoringError)
                    .filter(Boolean),
            },
            persistence: {
                beforeApplications,
                afterApplications,
                deltaApplications: afterApplications - beforeApplications,
                callbackStatus: callbackResult
                    ? {
                          ok: callbackResult.ok,
                          status: callbackResult.status,
                      }
                    : null,
                recentTailored,
            },
        };

        process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main().catch((error) => {
        process.stderr.write(`automation_pipeline_recovery_run_failed: ${error.message}\n`);
        process.exit(1);
    });
}

module.exports = {
    parseArgs,
    parseJsonFromModelText,
    detectAdzunaCountry,
    buildSearchCriteria,
    matchesLocationPreference,
    normalizeJobs,
    dedupeJobs,
    buildConnectorResult,
    buildApplicationsPayload,
};
