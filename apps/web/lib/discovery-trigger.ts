import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildDiscoveryRunId, resolveDiscoveryWebhookUrl } from "@/lib/discovery-scheduler";

type TriggerKind = "scheduled" | "manual";

type TriggerRunParams = {
    slotKey: string;
    schedulerSource: string;
    triggerKind: TriggerKind;
    reason?: string | null;
};

function isUniqueConstraintError(error: unknown) {
    return (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
    );
}

function sanitizeError(error: unknown) {
    if (error instanceof Error) {
        return error.message.slice(0, 500);
    }
    return String(error).slice(0, 500);
}

function resolveWebhookSecret() {
    return process.env.N8N_WEBHOOK_SECRET?.trim() || null;
}

export async function triggerDiscoveryRun(params: TriggerRunParams) {
    const requestedAt = new Date();
    const runId = buildDiscoveryRunId(params.slotKey, params.triggerKind);
    const payload = {
        runId,
        slotKey: params.slotKey,
        schedulerSource: params.schedulerSource,
        triggerKind: params.triggerKind,
        requestedAt: requestedAt.toISOString(),
    };

    let runRecord:
        | {
              id: string;
              runId: string | null;
              status: string;
              slotKey: string;
          }
        | null = null;

    try {
        runRecord = await prisma.discoveryScheduleRun.create({
            data: {
                slotKey: params.slotKey,
                schedulerSource: params.schedulerSource,
                triggerKind: params.triggerKind,
                status: "accepted",
                runId,
                requestedAt,
                startedAt: requestedAt,
                metadata: {
                    reason: params.reason || null,
                },
            },
            select: {
                id: true,
                runId: true,
                status: true,
                slotKey: true,
            },
        });
    } catch (error) {
        if (!isUniqueConstraintError(error)) {
            throw error;
        }

        const existing = await prisma.discoveryScheduleRun.findFirst({
            where: {
                slotKey: params.slotKey,
                triggerKind: params.triggerKind,
            },
            orderBy: { requestedAt: "desc" },
            select: {
                id: true,
                runId: true,
                status: true,
                slotKey: true,
                requestedAt: true,
                startedAt: true,
                finishedAt: true,
            },
        });

        return {
            ok: true as const,
            accepted: false as const,
            duplicate: true as const,
            slotKey: params.slotKey,
            runId: existing?.runId || runId,
            ledgerId: existing?.id || null,
            existingStatus: existing?.status || null,
            requestedAt:
                existing?.requestedAt?.toISOString() || requestedAt.toISOString(),
            startedAt: existing?.startedAt?.toISOString() || null,
            finishedAt: existing?.finishedAt?.toISOString() || null,
        };
    }

    const webhookUrl = resolveDiscoveryWebhookUrl();
    const webhookSecret = resolveWebhookSecret();

    if (!webhookUrl || !webhookSecret) {
        await prisma.discoveryScheduleRun.update({
            where: { id: runRecord.id },
            data: {
                status: "trigger_failed",
                finishedAt: new Date(),
                errorCode: !webhookUrl
                    ? "MISSING_DISCOVERY_WEBHOOK_URL"
                    : "MISSING_N8N_WEBHOOK_SECRET",
                errorMessage: "Discovery scheduler endpoint is not fully configured.",
            },
        });

        return {
            ok: false as const,
            accepted: false as const,
            duplicate: false as const,
            slotKey: params.slotKey,
            runId,
            ledgerId: runRecord.id,
            errorCode: !webhookUrl
                ? "MISSING_DISCOVERY_WEBHOOK_URL"
                : "MISSING_N8N_WEBHOOK_SECRET",
            errorMessage: "Discovery scheduler endpoint is not fully configured.",
        };
    }

    try {
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-webhook-secret": webhookSecret,
                "x-run-id": runId,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const bodyText = await response.text();
            await prisma.discoveryScheduleRun.update({
                where: { id: runRecord.id },
                data: {
                    status: "trigger_failed",
                    finishedAt: new Date(),
                    errorCode: `N8N_TRIGGER_HTTP_${response.status}`,
                    errorMessage: bodyText.slice(0, 500),
                },
            });

            return {
                ok: false as const,
                accepted: false as const,
                duplicate: false as const,
                slotKey: params.slotKey,
                runId,
                ledgerId: runRecord.id,
                errorCode: `N8N_TRIGGER_HTTP_${response.status}`,
                errorMessage: bodyText.slice(0, 500),
            };
        }

        await prisma.discoveryScheduleRun.update({
            where: { id: runRecord.id },
            data: {
                status: "triggered",
            },
        });

        return {
            ok: true as const,
            accepted: true as const,
            duplicate: false as const,
            slotKey: params.slotKey,
            runId,
            ledgerId: runRecord.id,
            webhookStatus: response.status,
        };
    } catch (error) {
        const errorMessage = sanitizeError(error);
        await prisma.discoveryScheduleRun.update({
            where: { id: runRecord.id },
            data: {
                status: "trigger_failed",
                finishedAt: new Date(),
                errorCode: "N8N_TRIGGER_NETWORK_ERROR",
                errorMessage,
            },
        });

        return {
            ok: false as const,
            accepted: false as const,
            duplicate: false as const,
            slotKey: params.slotKey,
            runId,
            ledgerId: runRecord.id,
            errorCode: "N8N_TRIGGER_NETWORK_ERROR",
            errorMessage,
        };
    }
}

type DiscoveryRunSummary = {
    runId?: unknown;
    slotKey?: unknown;
    schedulerSource?: unknown;
    triggerKind?: unknown;
    n8nExecutionId?: unknown;
    executionId?: unknown;
    status?: unknown;
    reason?: unknown;
    reasonCode?: unknown;
    usersSeen?: unknown;
    usersCanary?: unknown;
    usersProcessed?: unknown;
    usersFailed?: unknown;
    persistedApplications?: unknown;
    tailoredCount?: unknown;
    discoveredCount?: unknown;
    factualGuardBlockedCount?: unknown;
    coverLetterQualityBlockedCount?: unknown;
    lockAcquired?: unknown;
    lockReleased?: unknown;
};

function safeNumber(value: unknown, fallback = 0) {
    const numeric =
        typeof value === "number" ? value : Number.parseInt(String(value || ""), 10);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    return Math.max(0, Math.floor(numeric));
}

function toOptionalBoolean(value: unknown) {
    if (typeof value === "boolean") {
        return value;
    }
    if (value === "true") {
        return true;
    }
    if (value === "false") {
        return false;
    }
    return undefined;
}

function toStringOrNull(value: unknown) {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function toOptionalPositiveInt(value: unknown) {
    const numeric =
        typeof value === "number" ? value : Number.parseInt(String(value || ""), 10);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return null;
    }
    return Math.floor(numeric);
}

const RUN_METRIC_KEYS = [
    "tailoredCount",
    "discoveredCount",
    "factualGuardBlockedCount",
    "coverLetterQualityBlockedCount",
] as const;
type RunMetricKey = (typeof RUN_METRIC_KEYS)[number];

function extractRunMetric(value: unknown) {
    const numeric =
        typeof value === "number" ? value : Number.parseInt(String(value || ""), 10);
    if (!Number.isFinite(numeric)) {
        return undefined;
    }
    return Math.max(0, Math.floor(numeric));
}

function toObjectOrNull(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

function buildMetadataForSummary(
    existingMetadata: Prisma.JsonValue | null,
    summaryInput: DiscoveryRunSummary,
    now: Date
) {
    const existingMetadataObject = toObjectOrNull(existingMetadata) || {};
    const existingRunMetricsObject =
        toObjectOrNull(existingMetadataObject.runMetrics) || {};

    const mergedRunMetrics: Partial<Record<RunMetricKey, number>> = {};
    for (const key of RUN_METRIC_KEYS) {
        const fromSummary = extractRunMetric(summaryInput[key]);
        if (fromSummary !== undefined) {
            mergedRunMetrics[key] = fromSummary;
            continue;
        }

        const fromExisting = extractRunMetric(existingRunMetricsObject[key]);
        if (fromExisting !== undefined) {
            mergedRunMetrics[key] = fromExisting;
        }
    }

    if (Object.keys(mergedRunMetrics).length === 0) {
        return undefined;
    }

    return {
        ...existingMetadataObject,
        runMetrics: mergedRunMetrics,
        metricsUpdatedAt: now.toISOString(),
    } as Prisma.InputJsonValue;
}

function resolveLedgerStatus(summary: DiscoveryRunSummary) {
    const status = toStringOrNull(summary.status);
    const reason = toStringOrNull(summary.reason);
    const reasonCode = toStringOrNull(summary.reasonCode);

    if (status === "skipped_lock_not_acquired" || reason === "lock_not_acquired") {
        return "lock_skipped";
    }

    if (
        status === "failed" ||
        status === "error" ||
        reasonCode ||
        (reason && reason !== "lock_not_acquired")
    ) {
        return "failed";
    }

    return "completed";
}

export async function updateDiscoveryRunSummary(summaryInput: DiscoveryRunSummary) {
    const runId = toStringOrNull(summaryInput.runId);
    const slotKey = toStringOrNull(summaryInput.slotKey);
    const triggerKind = toStringOrNull(summaryInput.triggerKind) || "scheduled";
    const schedulerSource =
        toStringOrNull(summaryInput.schedulerSource) || "n8n_callback";
    const n8nExecutionId = toOptionalPositiveInt(
        summaryInput.n8nExecutionId ?? summaryInput.executionId
    );
    const status = resolveLedgerStatus(summaryInput);
    const now = new Date();
    const commonData: Prisma.DiscoveryScheduleRunUpdateInput = {
        status,
        finishedAt: now,
        usersSeen: safeNumber(summaryInput.usersSeen, 0),
        usersCanary: safeNumber(summaryInput.usersCanary, 0),
        usersProcessed: safeNumber(summaryInput.usersProcessed, 0),
        usersFailed: safeNumber(summaryInput.usersFailed, 0),
        persistedApplications: safeNumber(summaryInput.persistedApplications, 0),
        lockAcquired: toOptionalBoolean(summaryInput.lockAcquired),
        lockReleased: toOptionalBoolean(summaryInput.lockReleased),
        errorCode: toStringOrNull(summaryInput.reasonCode),
        errorMessage: toStringOrNull(summaryInput.reason),
    };
    if (n8nExecutionId !== null) {
        commonData.n8nExecutionId = n8nExecutionId;
    }

    if (runId) {
        const existing = await prisma.discoveryScheduleRun.findUnique({
            where: { runId },
            select: { id: true, metadata: true },
        });

        if (existing) {
            const metadata = buildMetadataForSummary(existing.metadata, summaryInput, now);
            await prisma.discoveryScheduleRun.update({
                where: { id: existing.id },
                data: {
                    ...commonData,
                    ...(metadata ? { metadata } : {}),
                },
            });
            return { updated: true as const, created: false as const, runId };
        }

        const metadata = buildMetadataForSummary(null, summaryInput, now);
        await prisma.discoveryScheduleRun.create({
            data: {
                slotKey: slotKey || runId,
                triggerKind,
                schedulerSource,
                runId,
                requestedAt: now,
                startedAt: now,
                ...commonData,
                ...(metadata ? { metadata } : {}),
            },
        });

        return { updated: true as const, created: true as const, runId };
    }

    if (!slotKey) {
        return { updated: false as const, created: false as const, runId };
    }

    const existingBySlot = await prisma.discoveryScheduleRun.findFirst({
        where: {
            slotKey,
            triggerKind,
        },
        select: {
            id: true,
            metadata: true,
        },
    });
    const metadata = buildMetadataForSummary(
        existingBySlot?.metadata ?? null,
        summaryInput,
        now
    );

    if (existingBySlot) {
        await prisma.discoveryScheduleRun.update({
            where: { id: existingBySlot.id },
            data: {
                ...commonData,
                ...(metadata ? { metadata } : {}),
            },
        });
        return { updated: true as const, created: false as const, runId };
    }

    await prisma.discoveryScheduleRun.create({
        data: {
            slotKey,
            triggerKind,
            schedulerSource,
            runId: runId || undefined,
            requestedAt: now,
            startedAt: now,
            ...commonData,
            ...(metadata ? { metadata } : {}),
        },
    });

    return { updated: true as const, created: true as const, runId };
}

export async function markDiscoveryRunFailed(params: {
    runId?: string | null;
    slotKey?: string | null;
    triggerKind?: string | null;
    schedulerSource?: string | null;
    errorCode: string;
    errorMessage: string;
}) {
    const now = new Date();
    const triggerKind = params.triggerKind || "scheduled";
    const runId = params.runId?.trim() || null;
    const slotKey = params.slotKey?.trim() || null;

    if (runId) {
        await prisma.discoveryScheduleRun.upsert({
            where: { runId },
            create: {
                slotKey: slotKey || runId,
                triggerKind,
                schedulerSource: params.schedulerSource || "n8n_callback",
                runId,
                status: "failed",
                requestedAt: now,
                startedAt: now,
                finishedAt: now,
                errorCode: params.errorCode,
                errorMessage: params.errorMessage.slice(0, 500),
            },
            update: {
                status: "failed",
                finishedAt: now,
                errorCode: params.errorCode,
                errorMessage: params.errorMessage.slice(0, 500),
            },
        });
        return;
    }

    if (!slotKey) {
        return;
    }

    await prisma.discoveryScheduleRun.upsert({
        where: {
            slotKey_triggerKind: {
                slotKey,
                triggerKind,
            },
        },
        create: {
            slotKey,
            triggerKind,
            schedulerSource: params.schedulerSource || "n8n_callback",
            runId: runId || undefined,
            status: "failed",
            requestedAt: now,
            startedAt: now,
            finishedAt: now,
            errorCode: params.errorCode,
            errorMessage: params.errorMessage.slice(0, 500),
        },
        update: {
            runId: runId || undefined,
            status: "failed",
            finishedAt: now,
            errorCode: params.errorCode,
            errorMessage: params.errorMessage.slice(0, 500),
        },
    });
}
