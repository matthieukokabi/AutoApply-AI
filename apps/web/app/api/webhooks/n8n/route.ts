import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendJobMatchEmail, sendTailoringCompleteEmail, sendCreditsLowEmail } from "@/lib/email";
import { normalizeCoverLetterMarkdown, normalizeCvMarkdown } from "@/lib/document-model";
import { markDiscoveryRunFailed, updateDiscoveryRunSummary } from "@/lib/discovery-trigger";

const DISCOVERY_WORKFLOW_ID = "eddfsS251UHbmNIj";
const DISCOVERY_CADENCE_MINUTES = 240;

function logPipelineEvent(
    level: "info" | "warn" | "error",
    event: string,
    fields: Record<string, unknown>
) {
    const logger =
        level === "warn" ? console.warn : level === "error" ? console.error : console.info;
    logger(
        JSON.stringify({
            scope: "automation_pipeline",
            event,
            ...fields,
        })
    );
}

function safeNormalizeTailoredCv(markdown: unknown) {
    if (typeof markdown !== "string") {
        return null;
    }
    const trimmed = markdown.trim();
    if (!trimmed) {
        return null;
    }

    try {
        return normalizeCvMarkdown(trimmed);
    } catch {
        return trimmed;
    }
}

function safeNormalizeCoverLetter(markdown: unknown) {
    if (typeof markdown !== "string") {
        return null;
    }
    const trimmed = markdown.trim();
    if (!trimmed) {
        return null;
    }

    try {
        return normalizeCoverLetterMarkdown(trimmed);
    } catch {
        return trimmed;
    }
}

async function getDiscoveryCadenceState() {
    const rows = await prisma.$queryRawUnsafe<{ startedAt: Date | null }[]>(
        `SELECT e."startedAt"
         FROM n8n.execution_entity e
         WHERE e."workflowId" = $1
           AND e.status = 'success'
         ORDER BY e."startedAt" DESC
         LIMIT 1;`,
        DISCOVERY_WORKFLOW_ID
    );

    const latestSuccessAt = rows[0]?.startedAt ? new Date(rows[0].startedAt) : null;
    if (!latestSuccessAt) {
        return {
            throttled: false,
            latestSuccessAt: null as Date | null,
            nextAllowedAt: null as Date | null,
        };
    }

    const nextAllowedAt = new Date(latestSuccessAt.getTime() + DISCOVERY_CADENCE_MINUTES * 60_000);
    return {
        throttled: Date.now() < nextAllowedAt.getTime(),
        latestSuccessAt,
        nextAllowedAt,
    };
}

async function fetchAutomationUsers() {
    const users = await prisma.user.findMany({
        where: {
            automationEnabled: true,
            subscriptionStatus: { in: ["pro", "unlimited"] },
            masterProfile: { isNot: null },
            preferences: { isNot: null },
        },
        orderBy: { createdAt: "asc" },
        select: {
            id: true,
            email: true,
            name: true,
            subscriptionStatus: true,
            creditsRemaining: true,
            masterProfile: { select: { rawText: true } },
            preferences: {
                select: {
                    targetTitles: true,
                    locations: true,
                    remotePreference: true,
                    salaryMin: true,
                    industries: true,
                },
            },
        },
    });

    return users
        .filter((user) => Boolean(user.masterProfile?.rawText))
        .map((user) => ({
            id: user.id,
            email: user.email,
            name: user.name,
            subscriptionStatus: user.subscriptionStatus,
            creditsRemaining: user.creditsRemaining,
            targetTitles: user.preferences?.targetTitles ?? [],
            locations: user.preferences?.locations ?? [],
            remotePreference: user.preferences?.remotePreference ?? "any",
            salaryMin: user.preferences?.salaryMin ?? 0,
            industries: user.preferences?.industries ?? [],
            masterCvText: user.masterProfile?.rawText ?? "",
        }));
}

type DiscoveryUserPayload = {
    userId: string;
    targetTitles: string[];
    locations: string[];
    remotePreference: string;
    masterCvText: string;
    subscriptionStatus: string;
    creditsRemaining: number;
};

type DiscoverySourceConfig = {
    adzunaAppId: string;
    adzunaAppKey: string;
    jsearchApiKey: string;
    joobleApiKey: string;
    reedApiKey: string;
};

type DiscoveryConnectorStatus = {
    source: string;
    ok: boolean;
    status: number | null;
    error: string | null;
    normalizedCount: number;
};

type DiscoveryJob = {
    externalId: string;
    title: string;
    company: string;
    location: string;
    description: string;
    source: string;
    url: string;
    salary: string | null;
    postedAt: string | null;
};

function toStringArray(value: unknown, fallback: string[] = []) {
    if (!Array.isArray(value)) {
        return fallback;
    }
    return value
        .map((entry) => String(entry ?? "").trim())
        .filter((entry) => Boolean(entry));
}

function buildSearchPairs(titles: string[], locations: string[], maxPairs = 6) {
    const safeTitles = titles.length > 0 ? titles : ["software engineer"];
    const safeLocations = locations.length > 0 ? locations : [""];
    const pairs: Array<{ title: string; location: string }> = [];

    for (const title of safeTitles) {
        for (const location of safeLocations) {
            pairs.push({ title, location });
            if (pairs.length >= maxPairs) {
                return pairs;
            }
        }
    }

    return pairs;
}

function detectAdzunaCountry(location: string) {
    const normalized = String(location || "").toLowerCase();
    if (
        normalized.includes("zurich") ||
        normalized.includes("zürich") ||
        normalized.includes("bern") ||
        normalized.includes("geneva") ||
        normalized.includes("basel") ||
        normalized.includes("switzerland") ||
        normalized.includes("swiss") ||
        normalized.includes("lausanne")
    ) {
        return "ch";
    }
    if (
        normalized.includes("london") ||
        normalized.includes("manchester") ||
        normalized.includes("uk") ||
        normalized.includes("united kingdom") ||
        normalized.includes("england")
    ) {
        return "gb";
    }
    if (
        normalized.includes("berlin") ||
        normalized.includes("munich") ||
        normalized.includes("hamburg") ||
        normalized.includes("germany") ||
        normalized.includes("frankfurt") ||
        normalized.includes("deutschland")
    ) {
        return "de";
    }
    if (
        normalized.includes("paris") ||
        normalized.includes("lyon") ||
        normalized.includes("france") ||
        normalized.includes("marseille")
    ) {
        return "fr";
    }
    if (
        normalized.includes("amsterdam") ||
        normalized.includes("netherlands") ||
        normalized.includes("rotterdam")
    ) {
        return "nl";
    }
    if (
        normalized.includes("vienna") ||
        normalized.includes("austria") ||
        normalized.includes("wien")
    ) {
        return "at";
    }
    return "us";
}

function normalizeForLocationMatch(value: string) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function matchesPreferredLocation(
    job: DiscoveryJob,
    locationNeedles: string[],
    remotePreference: string
) {
    if (locationNeedles.length === 0) {
        return true;
    }

    const haystack = normalizeForLocationMatch(
        `${job.location || ""} ${job.title || ""} ${job.description || ""}`
    );
    const matchesLocation = locationNeedles.some((needle) => haystack.includes(needle));
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
        return matchesLocation;
    }
    return matchesLocation;
}

async function safeFetchJson(
    url: string,
    init?: RequestInit
): Promise<{
    ok: boolean;
    status: number | null;
    error: string | null;
    body: any;
}> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(url, {
            ...(init || {}),
            signal: controller.signal,
        });
        const status = response.status;

        let body: any = null;
        try {
            body = await response.json();
        } catch {
            body = null;
        }

        if (!response.ok) {
            return {
                ok: false,
                status,
                error: typeof body?.error === "string" ? body.error : null,
                body,
            };
        }

        return { ok: true, status, error: null, body };
    } catch (error) {
        return {
            ok: false,
            status: null,
            error: error instanceof Error ? error.message : "network_error",
            body: null,
        };
    } finally {
        clearTimeout(timeout);
    }
}

function dedupeJobs(jobs: DiscoveryJob[]) {
    const seen = new Set<string>();
    const deduped: DiscoveryJob[] = [];

    for (const job of jobs) {
        const key =
            job.externalId ||
            `${job.source}:${job.title}:${job.company}:${job.location}`.toLowerCase();
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        deduped.push(job);
    }

    return deduped;
}

function isUniqueConstraintError(error: unknown) {
    if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
    ) {
        return true;
    }

    if (error !== null && typeof error === "object" && "code" in error) {
        return (error as { code?: string }).code === "P2002";
    }

    return false;
}

function normalizeIdempotencyKey(value: unknown) {
    if (typeof value !== "string") {
        return null;
    }
    const key = value.trim();
    return key ? key.slice(0, 200) : null;
}

function resolveIdempotencyKey(
    req: Request,
    body: Record<string, unknown>,
    webhookData: Record<string, unknown>
) {
    const fromHeader = normalizeIdempotencyKey(req.headers.get("x-idempotency-key"));
    if (fromHeader) {
        return fromHeader;
    }

    const fromBody = normalizeIdempotencyKey(body.idempotencyKey);
    if (fromBody) {
        return fromBody;
    }

    return normalizeIdempotencyKey(webhookData.idempotencyKey);
}

async function hasProcessedWebhookEvent(idempotencyKey: string) {
    const existing = await prisma.n8nWebhookEvent.findUnique({
        where: { idempotencyKey },
        select: { id: true },
    });
    return Boolean(existing);
}

async function markWebhookEventProcessed(
    idempotencyKey: string,
    type: string,
    runId: string
) {
    try {
        await prisma.n8nWebhookEvent.create({
            data: {
                idempotencyKey,
                type,
                runId,
            },
        });
        return true;
    } catch (error) {
        if (isUniqueConstraintError(error)) {
            return false;
        }
        throw error;
    }
}

async function acquireAutomationLock(params: {
    lockName: string;
    runId: string;
    workflow: string;
    slotId: string;
    ttlSeconds: number;
}) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + params.ttlSeconds * 1000);

    try {
        const lock = await prisma.automationLock.create({
            data: {
                name: params.lockName,
                runId: params.runId,
                workflow: params.workflow,
                slotId: params.slotId,
                expiresAt,
            },
            select: {
                id: true,
                expiresAt: true,
            },
        });

        return {
            acquired: true,
            lockId: lock.id,
            expiresAt: lock.expiresAt,
        };
    } catch (error) {
        if (!isUniqueConstraintError(error)) {
            throw error;
        }
    }

    const updated = await prisma.automationLock.updateMany({
        where: {
            name: params.lockName,
            expiresAt: { lte: now },
        },
        data: {
            runId: params.runId,
            workflow: params.workflow,
            slotId: params.slotId,
            expiresAt,
            updatedAt: new Date(),
        },
    });

    if (updated.count === 0) {
        return { acquired: false as const };
    }

    const lock = await prisma.automationLock.findUnique({
        where: { name: params.lockName },
        select: {
            id: true,
            expiresAt: true,
        },
    });

    if (!lock) {
        return { acquired: false as const };
    }

    return {
        acquired: true as const,
        lockId: lock.id,
        expiresAt: lock.expiresAt,
    };
}

async function releaseAutomationLockForRun(lockId: string, runId: string) {
    const existing = await prisma.automationLock.findUnique({
        where: { id: lockId },
        select: {
            id: true,
            runId: true,
            expiresAt: true,
        },
    });

    if (!existing) {
        return { released: false as const, reason: "not_found" };
    }

    if (existing.runId !== runId) {
        return { released: false as const, reason: "not_owner" };
    }

    const deleted = await prisma.automationLock.deleteMany({
        where: {
            id: lockId,
            runId,
        },
    });

    if (deleted.count === 0) {
        return { released: false as const, reason: "already_released" };
    }

    return {
        released: true as const,
        reason:
            existing.expiresAt.getTime() <= Date.now()
                ? "released_expired_lock"
                : "released",
    };
}

/**
 * POST /api/webhooks/n8n
 * Receives notifications from n8n workflows (new tailored documents, errors, etc.)
 * Protected by a shared secret header.
 */
export async function POST(req: Request) {
    try {
        const expectedWebhookSecret = process.env.N8N_WEBHOOK_SECRET?.trim();
        if (!expectedWebhookSecret) {
            logPipelineEvent("error", "webhook_misconfigured", {
                reason: "missing_n8n_webhook_secret",
            });
            return NextResponse.json(
                { error: "Webhook endpoint misconfigured" },
                { status: 503 }
            );
        }

        // Verify webhook secret
        const webhookSecret = req.headers.get("x-webhook-secret")?.trim();
        if (!webhookSecret || webhookSecret !== expectedWebhookSecret) {
            logPipelineEvent("warn", "webhook_unauthorized", {
                reason: "invalid_secret",
                hasSecret: Boolean(webhookSecret),
            });
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const rawBody = await req.json();
        let parsedBody: unknown = rawBody;
        if (typeof rawBody === "string") {
            try {
                parsedBody = JSON.parse(rawBody);
            } catch {
                parsedBody = rawBody;
            }
        }
        const body =
            parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)
                ? (parsedBody as Record<string, unknown>)
                : {};
        const headerRunId = req.headers.get("x-run-id");
        const bodyRunId =
            typeof body?.runId === "string" && body.runId.trim() ? body.runId.trim() : null;
        const runId =
            (typeof headerRunId === "string" && headerRunId.trim()) ||
            bodyRunId ||
            `webhook-${Date.now()}`;
        const type = typeof body?.type === "string" ? body.type : "";
        const rawData = body?.data;
        let data: Record<string, unknown> | null = null;
        if (rawData && typeof rawData === "object" && !Array.isArray(rawData)) {
            data = rawData as Record<string, unknown>;
        } else if (typeof rawData === "string" && rawData.trim()) {
            try {
                const parsedData = JSON.parse(rawData);
                if (parsedData && typeof parsedData === "object" && !Array.isArray(parsedData)) {
                    data = parsedData as Record<string, unknown>;
                }
            } catch {
                data = null;
            }
        }
        const allowsMissingData = type === "fetch_active_users";
        const webhookData = data ?? {};
        const idempotencyKey = resolveIdempotencyKey(req, body, webhookData);

        if (!type || (!allowsMissingData && !data)) {
            logPipelineEvent("warn", "webhook_invalid_envelope", {
                runId,
                type,
            });
            return NextResponse.json(
                { error: "Invalid webhook payload" },
                { status: 400 }
            );
        }

        switch (type) {
            case "automation_lock_acquire": {
                const runIdForLock =
                    typeof webhookData.runId === "string" && webhookData.runId.trim()
                        ? webhookData.runId.trim()
                        : runId;
                const workflow =
                    typeof webhookData.workflow === "string" ? webhookData.workflow.trim() : "";
                const slotId =
                    typeof webhookData.slotId === "string" ? webhookData.slotId.trim() : "";
                const ttlSecondsRaw =
                    typeof webhookData.ttlSeconds === "number"
                        ? webhookData.ttlSeconds
                        : Number(webhookData.ttlSeconds);
                const ttlSeconds = Number.isFinite(ttlSecondsRaw)
                    ? Math.floor(ttlSecondsRaw)
                    : NaN;

                if (
                    !workflow ||
                    !slotId ||
                    !Number.isFinite(ttlSeconds) ||
                    ttlSeconds <= 0 ||
                    ttlSeconds > 86400
                ) {
                    logPipelineEvent("warn", "automation_lock_acquire_invalid_payload", {
                        runId: runIdForLock,
                        workflow,
                        hasSlotId: Boolean(slotId),
                        ttlSecondsRaw:
                            Number.isFinite(ttlSecondsRaw) && Math.abs(ttlSecondsRaw) < 1_000_000
                                ? ttlSecondsRaw
                                : null,
                    });
                    return NextResponse.json(
                        { error: "Invalid automation_lock_acquire payload" },
                        { status: 400 }
                    );
                }

                const lockName = `${workflow}:${slotId}`;
                const acquired = await acquireAutomationLock({
                    lockName,
                    runId: runIdForLock,
                    workflow,
                    slotId,
                    ttlSeconds,
                });

                if (!acquired.acquired) {
                    logPipelineEvent("info", "automation_lock_acquire_conflict", {
                        runId: runIdForLock,
                        workflow,
                        slotId,
                    });
                    return NextResponse.json({
                        runId: runIdForLock,
                        workflow,
                        slotId,
                        acquired: false,
                    });
                }

                logPipelineEvent("info", "automation_lock_acquired", {
                    runId: runIdForLock,
                    workflow,
                    slotId,
                    lockId: acquired.lockId,
                    expiresAt: acquired.expiresAt.toISOString(),
                });

                return NextResponse.json({
                    runId: runIdForLock,
                    workflow,
                    slotId,
                    acquired: true,
                    lockId: acquired.lockId,
                    expiresAt: acquired.expiresAt.toISOString(),
                });
            }

            case "automation_lock_release": {
                const runIdForLock =
                    typeof webhookData.runId === "string" && webhookData.runId.trim()
                        ? webhookData.runId.trim()
                        : runId;
                const lockId =
                    typeof webhookData.lockId === "string" ? webhookData.lockId.trim() : "";

                if (!lockId) {
                    logPipelineEvent("warn", "automation_lock_release_invalid_payload", {
                        runId: runIdForLock,
                    });
                    return NextResponse.json(
                        { error: "Invalid automation_lock_release payload" },
                        { status: 400 }
                    );
                }

                const release = await releaseAutomationLockForRun(lockId, runIdForLock);
                logPipelineEvent("info", "automation_lock_release_result", {
                    runId: runIdForLock,
                    lockId,
                    released: release.released,
                    reason: release.reason,
                });

                return NextResponse.json({
                    ok: true,
                    runId: runIdForLock,
                    lockId,
                    released: release.released,
                    reason: release.reason,
                });
            }

            case "fetch_active_users": {
                const cadence = await getDiscoveryCadenceState();
                const users = await fetchAutomationUsers();
                if (cadence.throttled) {
                    logPipelineEvent("warn", "fetch_active_users_cadence_window_active", {
                        runId,
                        usersCount: users.length,
                        latestSuccessAt: cadence.latestSuccessAt?.toISOString() ?? null,
                        nextAllowedAt: cadence.nextAllowedAt?.toISOString() ?? null,
                    });
                }

                logPipelineEvent("info", "fetch_active_users_success", {
                    runId,
                    usersCount: users.length,
                });

                return NextResponse.json({
                    runId,
                    users,
                    throttled: cadence.throttled,
                    latestSuccessAt: cadence.latestSuccessAt?.toISOString() ?? null,
                    nextAllowedAt: cadence.nextAllowedAt?.toISOString() ?? null,
                });
            }

            case "fetch_jobs_for_user": {
                const userPayload =
                    webhookData.user && typeof webhookData.user === "object"
                        ? (webhookData.user as Record<string, unknown>)
                        : null;
                const sourceConfigPayload =
                    webhookData.sourceConfig && typeof webhookData.sourceConfig === "object"
                        ? (webhookData.sourceConfig as Record<string, unknown>)
                        : null;

                if (!userPayload || !sourceConfigPayload) {
                    logPipelineEvent("warn", "fetch_jobs_for_user_invalid_payload", {
                        runId,
                        hasUserPayload: Boolean(userPayload),
                        hasSourceConfigPayload: Boolean(sourceConfigPayload),
                    });
                    return NextResponse.json(
                        { error: "Invalid fetch_jobs_for_user payload" },
                        { status: 400 }
                    );
                }

                const user: DiscoveryUserPayload = {
                    userId: typeof userPayload.userId === "string" ? userPayload.userId.trim() : "",
                    targetTitles: toStringArray(userPayload.targetTitles, ["software engineer"]).slice(
                        0,
                        4
                    ),
                    locations: toStringArray(userPayload.locations).slice(0, 3),
                    remotePreference:
                        typeof userPayload.remotePreference === "string"
                            ? userPayload.remotePreference.toLowerCase()
                            : "any",
                    masterCvText:
                        typeof userPayload.masterCvText === "string"
                            ? userPayload.masterCvText
                            : "",
                    subscriptionStatus:
                        typeof userPayload.subscriptionStatus === "string"
                            ? userPayload.subscriptionStatus
                            : "free",
                    creditsRemaining:
                        typeof userPayload.creditsRemaining === "number"
                            ? userPayload.creditsRemaining
                            : 0,
                };

                const sourceConfig: DiscoverySourceConfig = {
                    adzunaAppId:
                        typeof sourceConfigPayload.adzunaAppId === "string"
                            ? sourceConfigPayload.adzunaAppId.trim()
                            : "",
                    adzunaAppKey:
                        typeof sourceConfigPayload.adzunaAppKey === "string"
                            ? sourceConfigPayload.adzunaAppKey.trim()
                            : "",
                    jsearchApiKey:
                        typeof sourceConfigPayload.jsearchApiKey === "string"
                            ? sourceConfigPayload.jsearchApiKey.trim()
                            : "",
                    joobleApiKey:
                        typeof sourceConfigPayload.joobleApiKey === "string"
                            ? sourceConfigPayload.joobleApiKey.trim()
                            : "",
                    reedApiKey:
                        typeof sourceConfigPayload.reedApiKey === "string"
                            ? sourceConfigPayload.reedApiKey.trim()
                            : "",
                };

                if (!user.userId || !user.masterCvText) {
                    logPipelineEvent("warn", "fetch_jobs_for_user_missing_required_fields", {
                        runId,
                        hasUserId: Boolean(user.userId),
                        hasMasterCvText: Boolean(user.masterCvText),
                    });
                    return NextResponse.json(
                        { error: "Invalid fetch_jobs_for_user payload" },
                        { status: 400 }
                    );
                }

                const titleCandidates =
                    user.targetTitles.length > 0 ? user.targetTitles : ["software engineer"];
                const locationCandidates = user.locations;
                const searchTitle = titleCandidates[0] || "software engineer";
                const searchLocation = locationCandidates[0] || "";
                const adzunaCountry = detectAdzunaCountry(searchLocation);
                const searchPairs = buildSearchPairs(titleCandidates.slice(0, 3), locationCandidates, 6);

                const connectors: DiscoveryConnectorStatus[] = [];
                const allJobs: DiscoveryJob[] = [];
                const minInventoryBeforePaidApis = 25;
                const countCurrentInventory = () =>
                    dedupeJobs(
                        allJobs.filter(
                            (job) =>
                                Boolean(job.title) &&
                                String(job.description || "").length > 50
                        )
                    ).length;

                // 1) Adzuna
                if (sourceConfig.adzunaAppId && sourceConfig.adzunaAppKey) {
                    let normalizedCount = 0;
                    let status: number | null = null;
                    let error: string | null = null;

                    for (const pair of searchPairs.slice(0, 2)) {
                        const url = `https://api.adzuna.com/v1/api/jobs/${adzunaCountry}/search/1?app_id=${encodeURIComponent(sourceConfig.adzunaAppId)}&app_key=${encodeURIComponent(sourceConfig.adzunaAppKey)}&what=${encodeURIComponent(pair.title || searchTitle)}&where=${encodeURIComponent(pair.location || searchLocation)}&results_per_page=15&content-type=application/json`;
                        const response = await safeFetchJson(url);
                        status = response.status ?? status;
                        if (!response.ok) {
                            error = response.error ?? `http_${response.status ?? "error"}`;
                            continue;
                        }

                        const results = Array.isArray(response.body?.results)
                            ? response.body.results
                            : [];
                        for (const entry of results) {
                            allJobs.push({
                                externalId: `adzuna-${entry.id}`,
                                title: entry.title || "",
                                company: entry.company?.display_name || "Unknown",
                                location: entry.location?.display_name || "",
                                description: entry.description || "",
                                source: "adzuna",
                                url: entry.redirect_url || "",
                                salary:
                                    entry.salary_is_predicted === "0"
                                        ? `${entry.salary_min}-${entry.salary_max}`
                                        : null,
                                postedAt: entry.created ? new Date(entry.created).toISOString() : null,
                            });
                            normalizedCount += 1;
                        }
                    }

                    connectors.push({
                        source: "adzuna",
                        ok: normalizedCount > 0 || error === null,
                        status,
                        error,
                        normalizedCount,
                    });
                } else {
                    connectors.push({
                        source: "adzuna",
                        ok: false,
                        status: null,
                        error: "missing_adzuna_credentials",
                        normalizedCount: 0,
                    });
                }

                // 2) The Muse
                {
                    const response = await safeFetchJson(
                        "https://www.themuse.com/api/public/jobs?category=Engineering&level=Mid%20Level&page=1"
                    );
                    let normalizedCount = 0;

                    if (response.ok) {
                        const results = Array.isArray(response.body?.results)
                            ? response.body.results
                            : [];
                        for (const entry of results) {
                            allJobs.push({
                                externalId: `themuse-${entry.id}`,
                                title: entry.name || "",
                                company: entry.company?.name || "Unknown",
                                location: Array.isArray(entry.locations)
                                    ? entry.locations.map((item: any) => item.name).join(", ")
                                    : "",
                                description: String(entry.contents || "")
                                    .replace(/<[^>]*>/g, "")
                                    .slice(0, 3000),
                                source: "themuse",
                                url: entry.refs?.landing_page || "",
                                salary: null,
                                postedAt: entry.publication_date || null,
                            });
                            normalizedCount += 1;
                        }
                    }

                    connectors.push({
                        source: "themuse",
                        ok: response.ok,
                        status: response.status,
                        error: response.ok ? null : response.error,
                        normalizedCount,
                    });
                }

                // 3) Remotive
                {
                    let normalizedCount = 0;
                    let status: number | null = null;
                    let error: string | null = null;

                    for (const title of titleCandidates.slice(0, 3)) {
                        const response = await safeFetchJson(
                            `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(title || searchTitle)}&limit=15`
                        );
                        status = response.status ?? status;
                        if (!response.ok) {
                            error = response.error ?? `http_${response.status ?? "error"}`;
                            continue;
                        }

                        const jobs = Array.isArray(response.body?.jobs) ? response.body.jobs : [];
                        for (const entry of jobs) {
                            allJobs.push({
                                externalId: `remotive-${entry.id}`,
                                title: entry.title || "",
                                company: entry.company_name || "Unknown",
                                location: entry.candidate_required_location || "Remote",
                                description: String(entry.description || "")
                                    .replace(/<[^>]*>/g, "")
                                    .slice(0, 3000),
                                source: "remotive",
                                url: entry.url || "",
                                salary: entry.salary || null,
                                postedAt: entry.publication_date || null,
                            });
                            normalizedCount += 1;
                        }
                    }

                    connectors.push({
                        source: "remotive",
                        ok: normalizedCount > 0 || error === null,
                        status,
                        error,
                        normalizedCount,
                    });
                }

                // 4) Arbeitnow
                {
                    let normalizedCount = 0;
                    let status: number | null = null;
                    let error: string | null = null;

                    for (const title of titleCandidates.slice(0, 3)) {
                        const response = await safeFetchJson(
                            `https://www.arbeitnow.com/api/job-board-api?search=${encodeURIComponent(title || searchTitle)}&page=1`
                        );
                        status = response.status ?? status;
                        if (!response.ok) {
                            error = response.error ?? `http_${response.status ?? "error"}`;
                            continue;
                        }

                        const jobs = Array.isArray(response.body?.data) ? response.body.data : [];
                        for (const entry of jobs) {
                            allJobs.push({
                                externalId: `arbeitnow-${entry.slug || entry.id || Date.now()}`,
                                title: entry.title || "",
                                company: entry.company_name || "Unknown",
                                location: entry.location || "",
                                description: String(entry.description || "")
                                    .replace(/<[^>]*>/g, "")
                                    .slice(0, 3000),
                                source: "arbeitnow",
                                url: entry.url || "",
                                salary: null,
                                postedAt: entry.created_at || null,
                            });
                            normalizedCount += 1;
                        }
                    }

                    connectors.push({
                        source: "arbeitnow",
                        ok: normalizedCount > 0 || error === null,
                        status,
                        error,
                        normalizedCount,
                    });
                }

                // 5) JSearch (RapidAPI)
                if (sourceConfig.jsearchApiKey) {
                    const shouldQueryJsearch =
                        countCurrentInventory() < minInventoryBeforePaidApis;
                    if (!shouldQueryJsearch) {
                        connectors.push({
                            source: "jsearch",
                            ok: true,
                            status: null,
                            error: "skipped_sufficient_inventory",
                            normalizedCount: 0,
                        });
                    } else {
                        const searchPair =
                            searchPairs.length > 0
                                ? searchPairs[0]
                                : { title: searchTitle, location: searchLocation };
                        const query = `${searchPair.title || searchTitle} ${searchPair.location || searchLocation || "remote"}`;
                        const response = await safeFetchJson(
                            `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&page=1&num_pages=1`,
                            {
                                headers: {
                                    "X-RapidAPI-Key": sourceConfig.jsearchApiKey,
                                    "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
                                },
                            }
                        );
                        let normalizedCount = 0;

                        if (response.ok) {
                            const jobs = Array.isArray(response.body?.data)
                                ? response.body.data
                                : [];
                            for (const entry of jobs) {
                                allJobs.push({
                                    externalId: `jsearch-${entry.job_id}`,
                                    title: entry.job_title || "",
                                    company: entry.employer_name || "Unknown",
                                    location: entry.job_city
                                        ? `${entry.job_city}, ${entry.job_state || entry.job_country || ""}`
                                        : entry.job_country || "",
                                    description: String(entry.job_description || "").slice(0, 3000),
                                    source: "jsearch",
                                    url: entry.job_apply_link || entry.job_google_link || "",
                                    salary: entry.job_min_salary
                                        ? `${entry.job_min_salary}-${entry.job_max_salary}`
                                        : null,
                                    postedAt: entry.job_posted_at_datetime_utc || null,
                                });
                                normalizedCount += 1;
                            }
                        }

                        connectors.push({
                            source: "jsearch",
                            ok: response.ok,
                            status: response.status,
                            error: response.ok ? null : response.error,
                            normalizedCount,
                        });
                    }
                } else {
                    connectors.push({
                        source: "jsearch",
                        ok: false,
                        status: null,
                        error: "missing_jsearch_api_key",
                        normalizedCount: 0,
                    });
                }

                // 6) Jooble
                if (sourceConfig.joobleApiKey) {
                    let normalizedCount = 0;
                    let status: number | null = null;
                    let error: string | null = null;

                    for (const pair of searchPairs.slice(0, 2)) {
                        const response = await safeFetchJson(
                            `https://jooble.org/api/${sourceConfig.joobleApiKey}`,
                            {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    keywords: pair.title || searchTitle,
                                    location: pair.location || searchLocation,
                                    page: 1,
                                }),
                            }
                        );
                        status = response.status ?? status;
                        if (!response.ok) {
                            error = response.error ?? `http_${response.status ?? "error"}`;
                            continue;
                        }

                        const jobs = Array.isArray(response.body?.jobs) ? response.body.jobs : [];
                        for (const entry of jobs) {
                            allJobs.push({
                                externalId: `jooble-${entry.id || Date.now()}`,
                                title: entry.title || "",
                                company: entry.company || "Unknown",
                                location: entry.location || "",
                                description: String(entry.snippet || "").slice(0, 3000),
                                source: "jooble",
                                url: entry.link || "",
                                salary: entry.salary || null,
                                postedAt: entry.updated || null,
                            });
                            normalizedCount += 1;
                        }
                    }

                    connectors.push({
                        source: "jooble",
                        ok: normalizedCount > 0 || error === null,
                        status,
                        error,
                        normalizedCount,
                    });
                } else {
                    connectors.push({
                        source: "jooble",
                        ok: false,
                        status: null,
                        error: "missing_jooble_api_key",
                        normalizedCount: 0,
                    });
                }

                // 7) Reed
                if (sourceConfig.reedApiKey) {
                    const shouldQueryReed =
                        countCurrentInventory() < minInventoryBeforePaidApis;
                    if (!shouldQueryReed) {
                        connectors.push({
                            source: "reed",
                            ok: true,
                            status: null,
                            error: "skipped_sufficient_inventory",
                            normalizedCount: 0,
                        });
                    } else {
                        let normalizedCount = 0;
                        let status: number | null = null;
                        let error: string | null = null;

                        const auth = Buffer.from(`${sourceConfig.reedApiKey}:`).toString(
                            "base64"
                        );
                        for (const pair of searchPairs.slice(0, 2)) {
                            const response = await safeFetchJson(
                                `https://www.reed.co.uk/api/1.0/search?keywords=${encodeURIComponent(pair.title || searchTitle)}&locationName=${encodeURIComponent(pair.location || searchLocation)}&resultsToTake=15`,
                                {
                                    headers: { Authorization: `Basic ${auth}` },
                                }
                            );
                            status = response.status ?? status;
                            if (!response.ok) {
                                error = response.error ?? `http_${response.status ?? "error"}`;
                                continue;
                            }

                            const jobs = Array.isArray(response.body?.results)
                                ? response.body.results
                                : [];
                            for (const entry of jobs) {
                                allJobs.push({
                                    externalId: `reed-${entry.jobId}`,
                                    title: entry.jobTitle || "",
                                    company: entry.employerName || "Unknown",
                                    location: entry.locationName || "",
                                    description: String(entry.jobDescription || "").slice(0, 3000),
                                    source: "reed",
                                    url: entry.jobUrl || "",
                                    salary: entry.minimumSalary
                                        ? `${entry.minimumSalary}-${entry.maximumSalary}`
                                        : null,
                                    postedAt: entry.date || null,
                                });
                                normalizedCount += 1;
                            }
                        }

                        connectors.push({
                            source: "reed",
                            ok: normalizedCount > 0 || error === null,
                            status,
                            error,
                            normalizedCount,
                        });
                    }
                } else {
                    connectors.push({
                        source: "reed",
                        ok: false,
                        status: null,
                        error: "missing_reed_api_key",
                        normalizedCount: 0,
                    });
                }

                const uniqueJobs = dedupeJobs(
                    allJobs.filter(
                        (job) => Boolean(job.title) && String(job.description || "").length > 50
                    )
                );
                const locationNeedles = locationCandidates.map(normalizeForLocationMatch);
                const filteredJobs = uniqueJobs.filter((job) =>
                    matchesPreferredLocation(job, locationNeedles, user.remotePreference)
                );
                const finalJobs = filteredJobs.length > 0 ? filteredJobs : uniqueJobs;

                const jobs = finalJobs.map((job) => ({
                    ...job,
                    runId,
                    userId: user.userId,
                    masterCvText: user.masterCvText,
                    subscriptionStatus: user.subscriptionStatus,
                    creditsRemaining: user.creditsRemaining,
                }));

                logPipelineEvent("info", "fetch_jobs_for_user_completed", {
                    runId,
                    userId: user.userId,
                    titlesCount: titleCandidates.length,
                    locationsCount: locationCandidates.length,
                    dedupedCount: uniqueJobs.length,
                    filteredCount: filteredJobs.length,
                    returnedCount: jobs.length,
                    connectors: connectors.map((connector) => ({
                        source: connector.source,
                        ok: connector.ok,
                        status: connector.status,
                        normalizedCount: connector.normalizedCount,
                        error: connector.error,
                    })),
                });

                return NextResponse.json({
                    runId,
                    jobs,
                    connectors,
                    sourceInsights: {
                        linkedin: {
                            automaticDiscoveryEnabled: false,
                            reason: "linkedin_jobs_api_not_configured_in_automation_pipeline",
                            availableVia: "manual_job_url_import",
                        },
                    },
                });
            }

            case "new_applications": {
                if (idempotencyKey && (await hasProcessedWebhookEvent(idempotencyKey))) {
                    logPipelineEvent("info", "new_applications_duplicate_skipped", {
                        runId,
                        idempotencyKey,
                    });
                    return NextResponse.json({
                        message: "Duplicate event ignored",
                        runId,
                        idempotencyKey,
                        duplicate: true,
                    });
                }

                // n8n sends discovered/tailored jobs from automated pipeline
                const userId =
                    typeof webhookData.userId === "string" ? webhookData.userId.trim() : "";
                const applications = Array.isArray(webhookData.applications)
                    ? webhookData.applications
                    : null;

                if (!userId || !applications) {
                    logPipelineEvent("warn", "webhook_invalid_new_applications_payload", {
                        runId,
                        userId,
                        hasApplicationsArray: Array.isArray(applications),
                    });
                    return NextResponse.json(
                        { error: "Invalid new_applications payload" },
                        { status: 400 }
                    );
                }

                logPipelineEvent("info", "new_applications_received", {
                    runId,
                    userId,
                    applicationsCount: applications.length,
                });

                const persistedApps = [];
                const newlyCreatedApps = [];
                let discoveredCount = 0;
                let tailoredCount = 0;

                for (let index = 0; index < applications.length; index += 1) {
                    const app = applications[index];
                    const appData =
                        app && typeof app === "object" && !Array.isArray(app)
                            ? (app as Record<string, any>)
                            : {};
                    const normalizedTailoredCvMarkdown = safeNormalizeTailoredCv(
                        appData.tailoredCvMarkdown
                    );
                    const normalizedCoverLetterMarkdown = safeNormalizeCoverLetter(
                        appData.coverLetterMarkdown
                    );
                    const resolvedStatus =
                        appData.status ||
                        (normalizedTailoredCvMarkdown ? "tailored" : "discovered");
                    const externalId =
                        appData.externalId ||
                        appData.url ||
                        `manual-${userId}-${Date.now()}-${index}`;

                    // First, create/upsert the Job record (discovery pipeline finds NEW jobs)
                    const job = await prisma.job.upsert({
                        where: { externalId },
                        create: {
                            externalId,
                            title: appData.title || "Untitled Position",
                            company: appData.company || "Unknown Company",
                            location: appData.location || "Not specified",
                            description: appData.description || "",
                            source: appData.source || "manual",
                            url: appData.url || "",
                            salary: appData.salary || null,
                            postedAt: appData.postedAt ? new Date(appData.postedAt) : null,
                        },
                        update: {
                            title: appData.title || "Untitled Position",
                            company: appData.company || "Unknown Company",
                        },
                    });

                    // Then, create/upsert the Application record
                    const existingApplication = await prisma.application.findUnique({
                        where: {
                            userId_jobId: {
                                userId,
                                jobId: job.id,
                            },
                        },
                        select: { id: true },
                    });

                    const result = await prisma.application.upsert({
                        where: {
                            userId_jobId: {
                                userId,
                                jobId: job.id,
                            },
                        },
                        create: {
                            userId,
                            jobId: job.id,
                            compatibilityScore: appData.compatibilityScore || 0,
                            atsKeywords: appData.atsKeywords || [],
                            matchingStrengths: appData.matchingStrengths || [],
                            gaps: appData.gaps || [],
                            recommendation: appData.recommendation || "skip",
                            tailoredCvMarkdown: normalizedTailoredCvMarkdown,
                            coverLetterMarkdown: normalizedCoverLetterMarkdown,
                            status: resolvedStatus,
                        },
                        update: {
                            compatibilityScore: appData.compatibilityScore || 0,
                            atsKeywords: appData.atsKeywords || [],
                            matchingStrengths: appData.matchingStrengths || [],
                            gaps: appData.gaps || [],
                            recommendation: appData.recommendation || "skip",
                            tailoredCvMarkdown: normalizedTailoredCvMarkdown,
                            coverLetterMarkdown: normalizedCoverLetterMarkdown,
                            status: resolvedStatus,
                        },
                        include: { job: true },
                    });
                    if (result.status === "tailored") {
                        tailoredCount += 1;
                    } else {
                        discoveredCount += 1;
                    }
                    persistedApps.push(result);
                    if (!existingApplication) {
                        newlyCreatedApps.push(result);
                    }
                }

                logPipelineEvent("info", "new_applications_persisted", {
                    runId,
                    userId,
                    createdCount: newlyCreatedApps.length,
                    persistedCount: persistedApps.length,
                    tailoredCount,
                    discoveredCount,
                });

                if (idempotencyKey) {
                    const recorded = await markWebhookEventProcessed(
                        idempotencyKey,
                        type,
                        runId
                    );
                    if (!recorded) {
                        logPipelineEvent("info", "new_applications_duplicate_race_skipped", {
                            runId,
                            idempotencyKey,
                        });
                        return NextResponse.json({
                            message: "Duplicate event ignored",
                            runId,
                            idempotencyKey,
                            duplicate: true,
                        });
                    }
                }

                // Send email notification for new job matches
                try {
                    const user = await prisma.user.findUnique({ where: { id: userId } });
                    if (user && newlyCreatedApps.length > 0) {
                        const matchedJobs = newlyCreatedApps.map((a) => ({
                            title: a.job.title,
                            company: a.job.company,
                            score: a.compatibilityScore,
                            applicationId: a.id,
                        }));

                        await sendJobMatchEmail(user.email, user.name, matchedJobs);

                        // Check if credits are running low
                        if (
                            user.subscriptionStatus !== "unlimited" &&
                            user.creditsRemaining <= 2 &&
                            user.creditsRemaining > 0
                        ) {
                            await sendCreditsLowEmail(user.email, user.name, user.creditsRemaining);
                        }
                    }
                } catch (emailError) {
                    logPipelineEvent("warn", "new_applications_email_failed", {
                        runId,
                        userId,
                        error:
                            emailError instanceof Error
                                ? emailError.message
                                : String(emailError),
                    });
                }

                logPipelineEvent("info", "new_applications_completed", {
                    runId,
                    userId,
                    processedCount: applications.length,
                });

                return NextResponse.json({
                    message: `Processed ${applications.length} applications`,
                    runId,
                });
            }

            case "single_tailoring_complete": {
                if (idempotencyKey && (await hasProcessedWebhookEvent(idempotencyKey))) {
                    logPipelineEvent("info", "single_tailoring_duplicate_skipped", {
                        runId,
                        idempotencyKey,
                    });
                    return NextResponse.json({
                        message: "Duplicate event ignored",
                        runId,
                        idempotencyKey,
                        duplicate: true,
                    });
                }

                // Single job tailoring result — save data + send email
                const {
                    userId: tailorUserId,
                    jobId: tailorJobId,
                    jobTitle,
                    company,
                    compatibilityScore,
                    atsKeywords,
                    matchingStrengths,
                    gaps,
                    recommendation,
                    tailoredCvMarkdown,
                    coverLetterMarkdown,
                } = webhookData as Record<string, any>;

                if (
                    typeof tailorUserId !== "string" ||
                    !tailorUserId.trim() ||
                    typeof tailorJobId !== "string" ||
                    !tailorJobId.trim()
                ) {
                    logPipelineEvent("warn", "webhook_invalid_single_tailoring_payload", {
                        runId,
                    });
                    return NextResponse.json(
                        { error: "Invalid single_tailoring_complete payload" },
                        { status: 400 }
                    );
                }

                const normalizedTailorUserId = tailorUserId.trim();
                const normalizedTailorJobId = tailorJobId.trim();
                const normalizedTailoredCvMarkdown = safeNormalizeTailoredCv(
                    tailoredCvMarkdown
                );
                const normalizedCoverLetterMarkdown = safeNormalizeCoverLetter(
                    coverLetterMarkdown
                );
                const resolvedApplicationStatus = normalizedTailoredCvMarkdown
                    ? "tailored"
                    : "discovered";
                const existingJob = await prisma.job.findUnique({
                    where: { id: normalizedTailorJobId },
                    select: { id: true },
                });
                let resolvedJobId = existingJob?.id ?? null;

                if (!resolvedJobId) {
                    const manualExternalId = `manual-${normalizedTailorUserId}-${normalizedTailorJobId}`;
                    const manualTitle =
                        typeof jobTitle === "string" && jobTitle.trim()
                            ? jobTitle.trim()
                            : "Untitled Position";
                    const manualCompany =
                        typeof company === "string" && company.trim()
                            ? company.trim()
                            : "Unknown Company";
                    const manualLocation =
                        typeof webhookData.location === "string" && webhookData.location.trim()
                            ? webhookData.location.trim()
                            : "Not specified";
                    const manualDescription =
                        typeof webhookData.description === "string"
                            ? webhookData.description
                            : "";
                    const manualUrl =
                        typeof webhookData.url === "string" ? webhookData.url : "";

                    const manualJob = await prisma.job.upsert({
                        where: { externalId: manualExternalId },
                        create: {
                            externalId: manualExternalId,
                            title: manualTitle,
                            company: manualCompany,
                            location: manualLocation,
                            description: manualDescription,
                            source: "manual",
                            url: manualUrl,
                            salary: null,
                            postedAt: null,
                        },
                        update: {
                            title: manualTitle,
                            company: manualCompany,
                            location: manualLocation,
                            description: manualDescription,
                            source: "manual",
                            url: manualUrl,
                        },
                        select: { id: true },
                    });

                    resolvedJobId = manualJob.id;
                }

                // Save tailoring results to database
                const application = await prisma.application.upsert({
                    where: {
                        userId_jobId: {
                            userId: normalizedTailorUserId,
                            jobId: resolvedJobId,
                        },
                    },
                    create: {
                        userId: normalizedTailorUserId,
                        jobId: resolvedJobId,
                        compatibilityScore: compatibilityScore || 0,
                        atsKeywords: atsKeywords || [],
                        matchingStrengths: matchingStrengths || [],
                        gaps: gaps || [],
                        recommendation: recommendation || "stretch",
                        tailoredCvMarkdown: normalizedTailoredCvMarkdown,
                        coverLetterMarkdown: normalizedCoverLetterMarkdown,
                        status: resolvedApplicationStatus,
                    },
                    update: {
                        compatibilityScore: compatibilityScore || 0,
                        atsKeywords: atsKeywords || [],
                        matchingStrengths: matchingStrengths || [],
                        gaps: gaps || [],
                        recommendation: recommendation || "stretch",
                        tailoredCvMarkdown: normalizedTailoredCvMarkdown,
                        coverLetterMarkdown: normalizedCoverLetterMarkdown,
                        status: resolvedApplicationStatus,
                    },
                    include: { job: true },
                });

                if (idempotencyKey) {
                    const recorded = await markWebhookEventProcessed(
                        idempotencyKey,
                        type,
                        runId
                    );
                    if (!recorded) {
                        logPipelineEvent("info", "single_tailoring_duplicate_race_skipped", {
                            runId,
                            idempotencyKey,
                        });
                        return NextResponse.json({
                            message: "Duplicate event ignored",
                            runId,
                            idempotencyKey,
                            duplicate: true,
                        });
                    }
                }

                // Send email notification (non-blocking)
                try {
                    const user = await prisma.user.findUnique({
                        where: { id: normalizedTailorUserId },
                    });

                    if (user && application) {
                        await sendTailoringCompleteEmail(
                            user.email,
                            user.name,
                            application.job.title,
                            application.job.company,
                            application.compatibilityScore,
                            application.id
                        );
                    }
                } catch (emailError) {
                    logPipelineEvent("warn", "single_tailoring_email_failed", {
                        runId,
                        userId: normalizedTailorUserId,
                        error:
                            emailError instanceof Error
                                ? emailError.message
                                : String(emailError),
                    });
                }

                logPipelineEvent("info", "single_tailoring_completed", {
                    runId,
                    userId: normalizedTailorUserId,
                    jobId: normalizedTailorJobId,
                    applicationId: application.id,
                    status: application.status,
                });

                return NextResponse.json({
                    message: "Tailoring results saved",
                    applicationId: application.id,
                    runId,
                });
            }

            case "workflow_error": {
                // Log workflow errors
                if (
                    typeof webhookData.workflowId !== "string" ||
                    typeof webhookData.nodeName !== "string" ||
                    typeof webhookData.errorType !== "string" ||
                    typeof webhookData.message !== "string" ||
                    !webhookData.workflowId.trim() ||
                    !webhookData.nodeName.trim() ||
                    !webhookData.errorType.trim() ||
                    !webhookData.message.trim()
                ) {
                    logPipelineEvent("warn", "webhook_invalid_workflow_error_payload", {
                        runId,
                    });
                    return NextResponse.json(
                        { error: "Invalid workflow_error payload" },
                        { status: 400 }
                    );
                }

                await prisma.workflowError.create({
                    data: {
                        workflowId: webhookData.workflowId.trim(),
                        nodeName: webhookData.nodeName.trim(),
                        errorType: webhookData.errorType.trim(),
                        message: webhookData.message.trim(),
                        payload: webhookData.payload as any,
                        userId:
                            typeof webhookData.userId === "string"
                                ? webhookData.userId
                                : undefined,
                    },
                });

                if (webhookData.workflowId.trim() === "job-discovery-pipeline-v3") {
                    const payload =
                        webhookData.payload &&
                        typeof webhookData.payload === "object" &&
                        !Array.isArray(webhookData.payload)
                            ? (webhookData.payload as Record<string, unknown>)
                            : {};

                    const payloadRunId =
                        typeof payload.runId === "string" ? payload.runId : null;
                    const payloadSlotKey =
                        typeof payload.slotKey === "string"
                            ? payload.slotKey
                            : typeof payload.slotId === "string"
                              ? payload.slotId
                              : null;
                    const payloadTriggerKind =
                        typeof payload.triggerKind === "string"
                            ? payload.triggerKind
                            : "scheduled";
                    const payloadSource =
                        typeof payload.schedulerSource === "string"
                            ? payload.schedulerSource
                            : "n8n_callback";

                    await markDiscoveryRunFailed({
                        runId: payloadRunId || runId,
                        slotKey: payloadSlotKey,
                        triggerKind: payloadTriggerKind,
                        schedulerSource: payloadSource,
                        errorCode: webhookData.errorType.trim(),
                        errorMessage: webhookData.message.trim(),
                    });
                }

                logPipelineEvent("error", "workflow_error_logged", {
                    runId,
                    workflowId: webhookData.workflowId.trim(),
                    nodeName: webhookData.nodeName.trim(),
                    errorType: webhookData.errorType.trim(),
                });

                return NextResponse.json({ message: "Error logged", runId });
            }

            case "discovery_run_status": {
                const summaryData: Record<string, unknown> =
                    webhookData.summary &&
                    typeof webhookData.summary === "object" &&
                    !Array.isArray(webhookData.summary)
                        ? {
                              ...(webhookData.summary as Record<string, unknown>),
                              runId:
                                  (webhookData.summary as Record<string, unknown>).runId ||
                                  webhookData.runId ||
                                  runId,
                              slotKey:
                                  (webhookData.summary as Record<string, unknown>).slotKey ||
                                  webhookData.slotKey ||
                                  webhookData.slotId,
                              schedulerSource:
                                  (webhookData.summary as Record<string, unknown>)
                                      .schedulerSource || webhookData.schedulerSource,
                              triggerKind:
                                  (webhookData.summary as Record<string, unknown>)
                                      .triggerKind || webhookData.triggerKind,
                          }
                        : {
                              ...webhookData,
                              runId:
                                  (typeof webhookData.runId === "string" &&
                                      webhookData.runId.trim()) ||
                                  runId,
                              slotKey:
                                  (typeof webhookData.slotKey === "string" &&
                                      webhookData.slotKey.trim()) ||
                                  (typeof webhookData.slotId === "string" &&
                                      webhookData.slotId.trim()) ||
                                  null,
                          };

                const summaryResult = await updateDiscoveryRunSummary(summaryData);
                logPipelineEvent("info", "discovery_run_status_recorded", {
                    runId:
                        typeof summaryData.runId === "string"
                            ? summaryData.runId
                            : runId,
                    slotKey:
                        typeof summaryData.slotKey === "string"
                            ? summaryData.slotKey
                            : null,
                    status:
                        typeof summaryData.status === "string"
                            ? summaryData.status
                            : "completed",
                    updated: summaryResult.updated,
                    created: summaryResult.created,
                });

                return NextResponse.json({
                    ok: true,
                    runId:
                        typeof summaryData.runId === "string"
                            ? summaryData.runId
                            : runId,
                    updated: summaryResult.updated,
                    created: summaryResult.created,
                });
            }

            default:
                logPipelineEvent("warn", "webhook_unknown_type", {
                    runId,
                    type,
                });
                return NextResponse.json(
                    { error: `Unknown webhook type: ${type}` },
                    { status: 400 }
                );
        }
    } catch (error) {
        logPipelineEvent("error", "webhook_handler_error", {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
