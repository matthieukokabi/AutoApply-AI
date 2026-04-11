import { prisma } from "@/lib/prisma";

const FACTUAL_GUARD_BLOCKED_ERROR_TYPE = "FACTUAL_GUARD_BLOCKED";
const FACTUAL_GUARD_REASON_PREFIX = "FACTUAL_GUARD_";
const FACTUAL_GUARD_RELEVANT_WORKFLOW_IDS = [
    "job-discovery-pipeline-v3",
    "single-job-tailoring-v3",
];

type WorkflowErrorPayload = Record<string, unknown>;

type ApplicationGuardReadInput = {
    id: string;
    jobId: string;
    status: string;
    tailoredCvMarkdown: string | null;
    coverLetterMarkdown: string | null;
    job?: {
        externalId?: string | null;
    } | null;
};

export type ApplicationFactualGuardInfo = {
    blocked: true;
    reasonCodes: string[];
    blockedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPayloadString(payload: WorkflowErrorPayload, key: string): string {
    const value = payload[key];
    return typeof value === "string" ? value.trim() : "";
}

function dedupeReasonCodes(reasonCodes: string[]): string[] {
    const unique = new Set<string>();
    for (const reasonCode of reasonCodes) {
        const normalized = reasonCode.trim();
        if (normalized.startsWith(FACTUAL_GUARD_REASON_PREFIX)) {
            unique.add(normalized);
        }
    }
    return Array.from(unique);
}

function getReasonCodes(payload: WorkflowErrorPayload, message: string): string[] {
    const payloadReasonCodes = Array.isArray(payload.reasonCodes)
        ? payload.reasonCodes.filter((value): value is string => typeof value === "string")
        : [];
    const dedupedPayloadReasonCodes = dedupeReasonCodes(payloadReasonCodes);
    if (dedupedPayloadReasonCodes.length > 0) {
        return dedupedPayloadReasonCodes;
    }

    const fallbackMessageReasonCodes = message
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

    return dedupeReasonCodes(fallbackMessageReasonCodes);
}

function hasPersistedTailoredContent(application: ApplicationGuardReadInput): boolean {
    const tailoredCv = typeof application.tailoredCvMarkdown === "string"
        ? application.tailoredCvMarkdown.trim()
        : "";
    const coverLetter = typeof application.coverLetterMarkdown === "string"
        ? application.coverLetterMarkdown.trim()
        : "";
    return Boolean(tailoredCv || coverLetter);
}

export async function getFactualGuardByApplicationId(params: {
    userId: string;
    applications: ApplicationGuardReadInput[];
}): Promise<Map<string, ApplicationFactualGuardInfo>> {
    const { userId, applications } = params;
    if (!userId || applications.length === 0) {
        return new Map();
    }

    const workflowErrors = await prisma.workflowError.findMany({
        where: {
            userId,
            errorType: FACTUAL_GUARD_BLOCKED_ERROR_TYPE,
            workflowId: { in: FACTUAL_GUARD_RELEVANT_WORKFLOW_IDS },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
        select: {
            createdAt: true,
            message: true,
            payload: true,
        },
    });

    const latestByJobId = new Map<string, ApplicationFactualGuardInfo>();
    const latestByExternalId = new Map<string, ApplicationFactualGuardInfo>();

    for (const workflowError of workflowErrors) {
        if (!isRecord(workflowError.payload)) {
            continue;
        }
        const payload = workflowError.payload as WorkflowErrorPayload;
        const reasonCodes = getReasonCodes(payload, workflowError.message);
        if (reasonCodes.length === 0) {
            continue;
        }

        const guardInfo: ApplicationFactualGuardInfo = {
            blocked: true,
            reasonCodes,
            blockedAt: workflowError.createdAt.toISOString(),
        };

        const jobId = getPayloadString(payload, "jobId");
        if (jobId && !latestByJobId.has(jobId)) {
            latestByJobId.set(jobId, guardInfo);
        }

        const externalId = getPayloadString(payload, "externalId");
        if (externalId && !latestByExternalId.has(externalId)) {
            latestByExternalId.set(externalId, guardInfo);
        }
    }

    const factualGuardByApplicationId = new Map<string, ApplicationFactualGuardInfo>();

    for (const application of applications) {
        if (application.status !== "discovered") {
            continue;
        }
        if (hasPersistedTailoredContent(application)) {
            continue;
        }

        const signalFromJobId = latestByJobId.get(application.jobId);
        const externalId = application.job?.externalId?.trim() || "";
        const signalFromExternalId = externalId
            ? latestByExternalId.get(externalId)
            : undefined;
        const factualGuardSignal = signalFromJobId || signalFromExternalId;

        if (factualGuardSignal) {
            factualGuardByApplicationId.set(application.id, factualGuardSignal);
        }
    }

    return factualGuardByApplicationId;
}
