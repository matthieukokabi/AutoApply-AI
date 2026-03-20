import {
    Prisma,
    RecruiterCandidatePipelineStatus,
    RecruiterMembershipStatus,
    RecruiterRequisitionStatus,
    RecruiterSeatRole,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SCORE_STOP_WORDS = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "into",
    "will",
    "you",
    "your",
    "our",
    "are",
    "have",
    "has",
    "job",
    "role",
    "team",
    "work",
]);

const DEFAULT_RECRUITER_STAGES = [
    { name: "New", position: 1, isDefault: true, isTerminal: false },
    { name: "Screening", position: 2, isDefault: false, isTerminal: false },
    { name: "Interview", position: 3, isDefault: false, isTerminal: false },
    { name: "Offer", position: 4, isDefault: false, isTerminal: false },
    { name: "Hired", position: 5, isDefault: false, isTerminal: true },
    { name: "Rejected", position: 6, isDefault: false, isTerminal: true },
];

function toTokenSet(raw: string): Set<string> {
    return new Set(
        raw
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .map((token) => token.trim())
            .filter((token) => token.length >= 3)
            .filter((token) => !SCORE_STOP_WORDS.has(token))
    );
}

function sanitizeSlug(raw: string): string {
    const normalized = raw
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    return normalized || "recruiter-team";
}

async function requireRecruiterMembership(
    userId: string,
    organizationId: string
) {
    const membership = await prisma.recruiterOrganizationMembership.findFirst({
        where: {
            organizationId,
            userId,
            status: RecruiterMembershipStatus.ACTIVE,
        },
    });

    if (!membership) {
        throw new Error("Recruiter workspace access denied.");
    }

    return membership;
}

export function computeRecruiterMatchScore(
    candidateText: string,
    requisitionText: string
): number {
    const candidateTokens = toTokenSet(candidateText);
    const requisitionTokens = toTokenSet(requisitionText);

    if (requisitionTokens.size === 0) {
        return 0;
    }

    let overlap = 0;
    requisitionTokens.forEach((token) => {
        if (candidateTokens.has(token)) {
            overlap += 1;
        }
    });

    return Math.max(
        0,
        Math.min(100, Math.round((overlap / requisitionTokens.size) * 100))
    );
}

export function derivePipelineStatusFromStage(
    stageName: string,
    isTerminal: boolean
): RecruiterCandidatePipelineStatus {
    if (!isTerminal) {
        return RecruiterCandidatePipelineStatus.ACTIVE;
    }

    const normalized = stageName.toLowerCase();
    if (normalized.includes("hire")) {
        return RecruiterCandidatePipelineStatus.HIRED;
    }
    if (normalized.includes("reject")) {
        return RecruiterCandidatePipelineStatus.REJECTED;
    }
    return RecruiterCandidatePipelineStatus.WITHDRAWN;
}

export async function ensureRecruiterWorkspaceForOwner(params: {
    userId: string;
    email: string;
    displayName: string;
}) {
    const { userId, email, displayName } = params;
    const existing = await prisma.recruiterOrganizationMembership.findFirst({
        where: {
            userId,
            status: RecruiterMembershipStatus.ACTIVE,
        },
        include: {
            organization: true,
            teamMemberships: {
                include: {
                    team: true,
                },
            },
        },
        orderBy: {
            createdAt: "asc",
        },
    });

    if (existing) {
        return existing;
    }

    const organizationBase = sanitizeSlug(displayName || email.split("@")[0] || "recruiter");
    const organizationSlug = `${organizationBase}-${userId.slice(-6).toLowerCase()}`;
    const organizationName =
        displayName?.trim() || email?.split("@")[0] || "Recruiter Workspace";

    return prisma.$transaction(async (tx) => {
        const organization = await tx.recruiterOrganization.create({
            data: {
                slug: organizationSlug,
                name: `${organizationName} Recruiting`,
                createdByUserId: userId,
            },
        });

        const membership = await tx.recruiterOrganizationMembership.create({
            data: {
                organizationId: organization.id,
                userId,
                invitedEmail: email,
                role: RecruiterSeatRole.OWNER,
                status: RecruiterMembershipStatus.ACTIVE,
                joinedAt: new Date(),
                seatLabel: "Owner Seat",
            },
        });

        const team = await tx.recruiterTeam.create({
            data: {
                organizationId: organization.id,
                name: "Core Recruiting",
                description: "Default team for recruiter beta operations",
                createdByUserId: userId,
            },
        });

        await tx.recruiterTeamMembership.create({
            data: {
                teamId: team.id,
                membershipId: membership.id,
            },
        });

        await tx.recruiterPipelineStage.createMany({
            data: DEFAULT_RECRUITER_STAGES.map((stage) => ({
                organizationId: organization.id,
                ...stage,
            })),
        });

        await tx.recruiterActivityLog.create({
            data: {
                organizationId: organization.id,
                actorUserId: userId,
                actorMembershipId: membership.id,
                entityType: "ORGANIZATION",
                entityId: organization.id,
                action: "workspace.initialized",
                payload: {
                    initialTeamId: team.id,
                    stageCount: DEFAULT_RECRUITER_STAGES.length,
                } as Prisma.InputJsonValue,
                correlationId: `workspace-${organization.id}`,
            },
        });

        return tx.recruiterOrganizationMembership.findUniqueOrThrow({
            where: { id: membership.id },
            include: {
                organization: true,
                teamMemberships: {
                    include: {
                        team: true,
                    },
                },
            },
        });
    });
}

export async function getRecruiterWorkspaceForUser(userId: string) {
    return prisma.recruiterOrganizationMembership.findFirst({
        where: {
            userId,
            status: RecruiterMembershipStatus.ACTIVE,
        },
        include: {
            organization: true,
            teamMemberships: {
                include: {
                    team: true,
                },
            },
        },
        orderBy: {
            createdAt: "asc",
        },
    });
}

export async function listRecruiterDashboardData(organizationId: string) {
    const [
        teams,
        stages,
        requisitions,
        candidates,
        pipelines,
        members,
        activityLogs,
    ] = await Promise.all([
        prisma.recruiterTeam.findMany({
            where: { organizationId },
            orderBy: { createdAt: "asc" },
        }),
        prisma.recruiterPipelineStage.findMany({
            where: { organizationId },
            orderBy: { position: "asc" },
        }),
        prisma.recruiterRequisition.findMany({
            where: { organizationId },
            orderBy: { createdAt: "desc" },
            include: {
                team: true,
            },
        }),
        prisma.recruiterCandidate.findMany({
            where: { organizationId },
            orderBy: { createdAt: "desc" },
        }),
        prisma.recruiterCandidatePipeline.findMany({
            where: { organizationId },
            orderBy: { updatedAt: "desc" },
            include: {
                candidate: true,
                requisition: true,
                currentStage: true,
            },
        }),
        prisma.recruiterOrganizationMembership.findMany({
            where: { organizationId },
            orderBy: { createdAt: "asc" },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        }),
        prisma.recruiterActivityLog.findMany({
            where: { organizationId },
            orderBy: { createdAt: "desc" },
            take: 20,
            include: {
                actorUser: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        }),
    ]);

    return {
        teams,
        stages,
        requisitions,
        candidates,
        pipelines,
        members,
        activityLogs,
    };
}

export async function createRecruiterRequisition(params: {
    userId: string;
    organizationId: string;
    title: string;
    description: string;
    teamId?: string;
    department?: string;
    location?: string;
    employmentType?: string;
}) {
    const {
        userId,
        organizationId,
        title,
        description,
        teamId,
        department,
        location,
        employmentType,
    } = params;

    const membership = await requireRecruiterMembership(userId, organizationId);
    const resolvedTeamId = teamId?.trim() || undefined;

    if (resolvedTeamId) {
        const existingTeam = await prisma.recruiterTeam.findFirst({
            where: {
                id: resolvedTeamId,
                organizationId,
            },
            select: { id: true },
        });
        if (!existingTeam) {
            throw new Error("Selected team is not part of this organization.");
        }
    }

    const requisition = await prisma.recruiterRequisition.create({
        data: {
            organizationId,
            teamId: resolvedTeamId,
            title: title.trim(),
            description: description.trim(),
            department: department?.trim() || null,
            location: location?.trim() || null,
            employmentType: employmentType?.trim() || null,
            createdByUserId: userId,
            status: RecruiterRequisitionStatus.OPEN,
            openedAt: new Date(),
        },
    });

    await prisma.recruiterActivityLog.create({
        data: {
            organizationId,
            actorUserId: userId,
            actorMembershipId: membership.id,
            entityType: "REQUISITION",
            entityId: requisition.id,
            action: "requisition.created",
            payload: {
                title: requisition.title,
                teamId: requisition.teamId,
                status: requisition.status,
            } as Prisma.InputJsonValue,
            correlationId: `requisition-${requisition.id}`,
        },
    });

    return requisition;
}

export async function importRecruiterCandidate(params: {
    userId: string;
    organizationId: string;
    fullName: string;
    email?: string;
    phone?: string;
    location?: string;
    headline?: string;
    profileText?: string;
}) {
    const {
        userId,
        organizationId,
        fullName,
        email,
        phone,
        location,
        headline,
        profileText,
    } = params;

    const membership = await requireRecruiterMembership(userId, organizationId);

    const candidate = await prisma.recruiterCandidate.create({
        data: {
            organizationId,
            fullName: fullName.trim(),
            email: email?.trim() || null,
            phone: phone?.trim() || null,
            location: location?.trim() || null,
            headline: headline?.trim() || null,
            profileJson: profileText?.trim()
                ? ({
                      summary: profileText.trim(),
                  } as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            createdByUserId: userId,
            source: "MANUAL",
        },
    });

    await prisma.recruiterActivityLog.create({
        data: {
            organizationId,
            actorUserId: userId,
            actorMembershipId: membership.id,
            entityType: "CANDIDATE",
            entityId: candidate.id,
            action: "candidate.imported_manual",
            payload: {
                fullName: candidate.fullName,
                hasEmail: Boolean(candidate.email),
            } as Prisma.InputJsonValue,
            correlationId: `candidate-${candidate.id}`,
        },
    });

    return candidate;
}

export async function matchCandidateToRequisition(params: {
    userId: string;
    organizationId: string;
    candidateId: string;
    requisitionId: string;
}) {
    const { userId, organizationId, candidateId, requisitionId } = params;
    const membership = await requireRecruiterMembership(userId, organizationId);

    const [candidate, requisition, defaultStage] = await Promise.all([
        prisma.recruiterCandidate.findFirst({
            where: {
                id: candidateId,
                organizationId,
            },
        }),
        prisma.recruiterRequisition.findFirst({
            where: {
                id: requisitionId,
                organizationId,
            },
        }),
        prisma.recruiterPipelineStage.findFirst({
            where: {
                organizationId,
                isDefault: true,
            },
            orderBy: {
                position: "asc",
            },
        }),
    ]);

    if (!candidate || !requisition) {
        throw new Error("Candidate or requisition not found in this organization.");
    }

    const stage =
        defaultStage ||
        (await prisma.recruiterPipelineStage.findFirst({
            where: { organizationId },
            orderBy: { position: "asc" },
        }));

    if (!stage) {
        throw new Error("No pipeline stages configured for this organization.");
    }

    const candidateText = [
        candidate.fullName,
        candidate.headline || "",
        candidate.location || "",
        candidate.email || "",
        candidate.phone || "",
        JSON.stringify(candidate.profileJson ?? {}),
    ].join(" ");
    const score = computeRecruiterMatchScore(candidateText, requisition.description);

    const pipeline = await prisma.recruiterCandidatePipeline.upsert({
        where: {
            candidateId_requisitionId: {
                candidateId: candidate.id,
                requisitionId: requisition.id,
            },
        },
        create: {
            organizationId,
            candidateId: candidate.id,
            requisitionId: requisition.id,
            currentStageId: stage.id,
            matchScore: score,
            status: RecruiterCandidatePipelineStatus.ACTIVE,
            lastMovedAt: new Date(),
        },
        update: {
            currentStageId: stage.id,
            matchScore: score,
            status: RecruiterCandidatePipelineStatus.ACTIVE,
            lastMovedAt: new Date(),
        },
    });

    await prisma.recruiterActivityLog.create({
        data: {
            organizationId,
            actorUserId: userId,
            actorMembershipId: membership.id,
            entityType: "CANDIDATE_PIPELINE",
            entityId: pipeline.id,
            action: "candidate.matched_to_requisition",
            payload: {
                candidateId: candidate.id,
                requisitionId: requisition.id,
                matchScore: score,
                stageId: stage.id,
            } as Prisma.InputJsonValue,
            correlationId: `match-${pipeline.id}`,
        },
    });

    return pipeline;
}

export async function moveCandidatePipelineStage(params: {
    userId: string;
    organizationId: string;
    pipelineId: string;
    stageId: string;
}) {
    const { userId, organizationId, pipelineId, stageId } = params;
    const membership = await requireRecruiterMembership(userId, organizationId);

    const [pipeline, stage] = await Promise.all([
        prisma.recruiterCandidatePipeline.findFirst({
            where: {
                id: pipelineId,
                organizationId,
            },
            include: {
                candidate: true,
                requisition: true,
            },
        }),
        prisma.recruiterPipelineStage.findFirst({
            where: {
                id: stageId,
                organizationId,
            },
        }),
    ]);

    if (!pipeline || !stage) {
        throw new Error("Pipeline entry or stage not found in this organization.");
    }

    const status = derivePipelineStatusFromStage(stage.name, stage.isTerminal);

    const updated = await prisma.recruiterCandidatePipeline.update({
        where: { id: pipeline.id },
        data: {
            currentStageId: stage.id,
            status,
            lastMovedAt: new Date(),
        },
    });

    await prisma.recruiterActivityLog.create({
        data: {
            organizationId,
            actorUserId: userId,
            actorMembershipId: membership.id,
            entityType: "CANDIDATE_PIPELINE",
            entityId: updated.id,
            action: "candidate.stage_moved",
            payload: {
                candidateId: pipeline.candidateId,
                requisitionId: pipeline.requisitionId,
                stageId: stage.id,
                stageName: stage.name,
                status,
            } as Prisma.InputJsonValue,
            correlationId: `stage-${updated.id}`,
        },
    });

    return updated;
}
