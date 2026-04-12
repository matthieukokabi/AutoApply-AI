import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const FACTUAL_GUARD_BLOCKED_ERROR_TYPE = "FACTUAL_GUARD_BLOCKED";
const FACTUAL_GUARD_REASON_PREFIX = "FACTUAL_GUARD_";
const COVER_LETTER_QUALITY_BLOCKED_ERROR_TYPE = "COVER_LETTER_QUALITY_BLOCKED";
const COVER_LETTER_QUALITY_REASON_PREFIX = "COVER_LETTER_QUALITY_";
const FACTUAL_GUARD_RELEVANT_WORKFLOW_IDS = [
    "job-discovery-pipeline-v3",
    "single-job-tailoring-v3",
];

type WorkflowErrorPayload = Record<string, unknown>;
type WorkflowErrorReadRow = {
    id: string;
    createdAt: Date;
    message: string;
    payload: unknown;
};

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

export type ApplicationCoverLetterQualityInfo = {
    blocked: true;
    reasonCodes: string[];
    blockedAt: string;
};

type ApplicationStateSummaryInput = {
    id: string;
    status: string;
};

export type ApplicationStateSummary = {
    totalCount: number;
    tailoredCount: number;
    discoveredCount: number;
    plainDiscoveredCount: number;
    guardBlockedCount: number;
    byStatus: Record<string, number>;
};

const WORKFLOW_ERROR_LOOKUP_OR_BATCH_SIZE = 150;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPayloadString(payload: WorkflowErrorPayload, key: string): string {
    const value = payload[key];
    return typeof value === "string" ? value.trim() : "";
}

function dedupeReasonCodes(reasonCodes: string[], reasonPrefix: string): string[] {
    const unique = new Set<string>();
    for (const reasonCode of reasonCodes) {
        const normalized = reasonCode.trim();
        if (normalized.startsWith(reasonPrefix)) {
            unique.add(normalized);
        }
    }
    return Array.from(unique);
}

function getReasonCodes(payload: WorkflowErrorPayload, message: string, reasonPrefix: string): string[] {
    const payloadReasonCodes = Array.isArray(payload.reasonCodes)
        ? payload.reasonCodes.filter((value): value is string => typeof value === "string")
        : [];
    const dedupedPayloadReasonCodes = dedupeReasonCodes(payloadReasonCodes, reasonPrefix);
    if (dedupedPayloadReasonCodes.length > 0) {
        return dedupedPayloadReasonCodes;
    }

    const fallbackMessageReasonCodes = message
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

    return dedupeReasonCodes(fallbackMessageReasonCodes, reasonPrefix);
}

function dedupeNonEmptyStrings(values: string[]): string[] {
    const unique = new Set<string>();
    for (const value of values) {
        const normalized = value.trim();
        if (normalized) {
            unique.add(normalized);
        }
    }
    return Array.from(unique);
}

function chunkArray<T>(values: T[], chunkSize: number): T[][] {
    if (values.length === 0) return [];
    const chunks: T[][] = [];
    for (let index = 0; index < values.length; index += chunkSize) {
        chunks.push(values.slice(index, index + chunkSize));
    }
    return chunks;
}

function buildWorkflowErrorPayloadMatchClauses(params: {
    applicationIds: string[];
    jobIds: string[];
    externalIds: string[];
}): Prisma.WorkflowErrorWhereInput[] {
    const { applicationIds, jobIds, externalIds } = params;
    const clauses: Prisma.WorkflowErrorWhereInput[] = [];

    for (const applicationId of applicationIds) {
        clauses.push({
            payload: {
                path: ["applicationId"],
                equals: applicationId,
            },
        });
    }
    for (const jobId of jobIds) {
        clauses.push({
            payload: {
                path: ["jobId"],
                equals: jobId,
            },
        });
    }
    for (const externalId of externalIds) {
        clauses.push({
            payload: {
                path: ["externalId"],
                equals: externalId,
            },
        });
    }

    return clauses;
}

async function getTargetedWorkflowErrors(params: {
    userId: string;
    errorType: string;
    applicationIds: string[];
    jobIds: string[];
    externalIds: string[];
}): Promise<WorkflowErrorReadRow[]> {
    const { userId, errorType, applicationIds, jobIds, externalIds } = params;
    const payloadMatchClauses = buildWorkflowErrorPayloadMatchClauses({
        applicationIds,
        jobIds,
        externalIds,
    });
    if (payloadMatchClauses.length === 0) {
        return [];
    }

    const clauseBatches = chunkArray(payloadMatchClauses, WORKFLOW_ERROR_LOOKUP_OR_BATCH_SIZE);
    const workflowErrorBatches = await Promise.all(
        clauseBatches.map((batchClauses) =>
            prisma.workflowError.findMany({
                where: {
                    userId,
                    errorType,
                    workflowId: { in: FACTUAL_GUARD_RELEVANT_WORKFLOW_IDS },
                    OR: batchClauses,
                },
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    createdAt: true,
                    message: true,
                    payload: true,
                },
            })
        )
    );

    const latestByWorkflowErrorId = new Map<string, WorkflowErrorReadRow>();
    for (const batch of workflowErrorBatches) {
        for (const workflowError of batch) {
            if (!latestByWorkflowErrorId.has(workflowError.id)) {
                latestByWorkflowErrorId.set(workflowError.id, workflowError);
            }
        }
    }

    return Array.from(latestByWorkflowErrorId.values()).sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
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

    const guardCandidateApplications = applications.filter((application) => {
        if (application.status !== "discovered") {
            return false;
        }
        if (hasPersistedTailoredContent(application)) {
            return false;
        }
        return true;
    });
    if (guardCandidateApplications.length === 0) {
        return new Map();
    }

    const targetedApplicationIds = dedupeNonEmptyStrings(
        guardCandidateApplications.map((application) => application.id)
    );
    const targetedJobIds = dedupeNonEmptyStrings(
        guardCandidateApplications.map((application) => application.jobId)
    );
    const targetedExternalIds = dedupeNonEmptyStrings(
        guardCandidateApplications.map((application) => application.job?.externalId || "")
    );

    const workflowErrors = await getTargetedWorkflowErrors({
        userId,
        errorType: FACTUAL_GUARD_BLOCKED_ERROR_TYPE,
        applicationIds: targetedApplicationIds,
        jobIds: targetedJobIds,
        externalIds: targetedExternalIds,
    });

    const latestByJobId = new Map<string, ApplicationFactualGuardInfo>();
    const latestByExternalId = new Map<string, ApplicationFactualGuardInfo>();
    const latestByApplicationId = new Map<string, ApplicationFactualGuardInfo>();

    for (const workflowError of workflowErrors) {
        if (!isRecord(workflowError.payload)) {
            continue;
        }
        const payload = workflowError.payload as WorkflowErrorPayload;
        const reasonCodes = getReasonCodes(
            payload,
            workflowError.message,
            FACTUAL_GUARD_REASON_PREFIX
        );
        if (reasonCodes.length === 0) {
            continue;
        }

        const guardInfo: ApplicationFactualGuardInfo = {
            blocked: true,
            reasonCodes,
            blockedAt: workflowError.createdAt.toISOString(),
        };

        const applicationId = getPayloadString(payload, "applicationId");
        if (applicationId && !latestByApplicationId.has(applicationId)) {
            latestByApplicationId.set(applicationId, guardInfo);
        }

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

    for (const application of guardCandidateApplications) {
        const signalFromApplicationId = latestByApplicationId.get(application.id);
        const signalFromJobId = latestByJobId.get(application.jobId);
        const externalId = application.job?.externalId?.trim() || "";
        const signalFromExternalId = externalId
            ? latestByExternalId.get(externalId)
            : undefined;
        const factualGuardSignal =
            signalFromApplicationId || signalFromJobId || signalFromExternalId;

        if (factualGuardSignal) {
            factualGuardByApplicationId.set(application.id, factualGuardSignal);
        }
    }

    return factualGuardByApplicationId;
}

export async function getCoverLetterQualityByApplicationId(params: {
    userId: string;
    applications: ApplicationGuardReadInput[];
}): Promise<Map<string, ApplicationCoverLetterQualityInfo>> {
    const { userId, applications } = params;
    if (!userId || applications.length === 0) {
        return new Map();
    }

    const coverLetterQualityCandidates = applications.filter((application) => {
        if (application.status !== "tailored") {
            return false;
        }
        const tailoredCv = typeof application.tailoredCvMarkdown === "string"
            ? application.tailoredCvMarkdown.trim()
            : "";
        const coverLetter = typeof application.coverLetterMarkdown === "string"
            ? application.coverLetterMarkdown.trim()
            : "";
        return Boolean(tailoredCv) && !coverLetter;
    });
    if (coverLetterQualityCandidates.length === 0) {
        return new Map();
    }

    const targetedApplicationIds = dedupeNonEmptyStrings(
        coverLetterQualityCandidates.map((application) => application.id)
    );
    const targetedJobIds = dedupeNonEmptyStrings(
        coverLetterQualityCandidates.map((application) => application.jobId)
    );
    const targetedExternalIds = dedupeNonEmptyStrings(
        coverLetterQualityCandidates.map((application) => application.job?.externalId || "")
    );

    const workflowErrors = await getTargetedWorkflowErrors({
        userId,
        errorType: COVER_LETTER_QUALITY_BLOCKED_ERROR_TYPE,
        applicationIds: targetedApplicationIds,
        jobIds: targetedJobIds,
        externalIds: targetedExternalIds,
    });

    const latestByJobId = new Map<string, ApplicationCoverLetterQualityInfo>();
    const latestByExternalId = new Map<string, ApplicationCoverLetterQualityInfo>();
    const latestByApplicationId = new Map<string, ApplicationCoverLetterQualityInfo>();

    for (const workflowError of workflowErrors) {
        if (!isRecord(workflowError.payload)) {
            continue;
        }
        const payload = workflowError.payload as WorkflowErrorPayload;
        const reasonCodes = getReasonCodes(
            payload,
            workflowError.message,
            COVER_LETTER_QUALITY_REASON_PREFIX
        );
        if (reasonCodes.length === 0) {
            continue;
        }

        const signal: ApplicationCoverLetterQualityInfo = {
            blocked: true,
            reasonCodes,
            blockedAt: workflowError.createdAt.toISOString(),
        };

        const applicationId = getPayloadString(payload, "applicationId");
        if (applicationId && !latestByApplicationId.has(applicationId)) {
            latestByApplicationId.set(applicationId, signal);
        }

        const jobId = getPayloadString(payload, "jobId");
        if (jobId && !latestByJobId.has(jobId)) {
            latestByJobId.set(jobId, signal);
        }

        const externalId = getPayloadString(payload, "externalId");
        if (externalId && !latestByExternalId.has(externalId)) {
            latestByExternalId.set(externalId, signal);
        }
    }

    const coverLetterQualityByApplicationId = new Map<string, ApplicationCoverLetterQualityInfo>();

    for (const application of coverLetterQualityCandidates) {
        const signalFromApplicationId = latestByApplicationId.get(application.id);
        const signalFromJobId = latestByJobId.get(application.jobId);
        const externalId = application.job?.externalId?.trim() || "";
        const signalFromExternalId = externalId ? latestByExternalId.get(externalId) : undefined;
        const signal = signalFromApplicationId || signalFromJobId || signalFromExternalId;
        if (signal) {
            coverLetterQualityByApplicationId.set(application.id, signal);
        }
    }

    return coverLetterQualityByApplicationId;
}

export function summarizeApplicationStates(params: {
    applications: ApplicationStateSummaryInput[];
    factualGuardByApplicationId: Map<string, ApplicationFactualGuardInfo>;
}): ApplicationStateSummary {
    const { applications, factualGuardByApplicationId } = params;
    const byStatus: Record<string, number> = {};
    let guardBlockedCount = 0;

    for (const application of applications) {
        byStatus[application.status] = (byStatus[application.status] || 0) + 1;
        if (application.status === "discovered" && factualGuardByApplicationId.has(application.id)) {
            guardBlockedCount += 1;
        }
    }

    const discoveredCount = byStatus.discovered || 0;
    const plainDiscoveredCount = Math.max(discoveredCount - guardBlockedCount, 0);

    return {
        totalCount: applications.length,
        tailoredCount: byStatus.tailored || 0,
        discoveredCount,
        plainDiscoveredCount,
        guardBlockedCount,
        byStatus,
    };
}
