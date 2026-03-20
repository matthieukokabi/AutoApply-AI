import { randomUUID } from "crypto";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { RecruiterMembershipStatus, RecruiterRequisitionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAccessRecruiterBeta } from "@/lib/recruiter-beta";

const HEALTH_TOKEN_HEADER = "x-recruiter-beta-health-token";
const FAILURE_LOOKBACK_MS = 60 * 60 * 1000;
const ACTIVITY_LOOKBACK_MS = 24 * 60 * 60 * 1000;

type RecruiterHealthAlert = {
    code: string;
    severity: "warning" | "critical";
    message: string;
};

function withNoIndex(response: NextResponse) {
    response.headers.set("Cache-Control", "no-store, max-age=0");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
}

function resolveProvidedToken(req: Request) {
    const headerToken = req.headers.get(HEALTH_TOKEN_HEADER)?.trim();
    if (headerToken) {
        return headerToken;
    }

    const authorization = req.headers.get("authorization")?.trim() || "";
    if (authorization.startsWith("Bearer ")) {
        return authorization.slice("Bearer ".length).trim();
    }

    return "";
}

function summarizeStatus(alerts: RecruiterHealthAlert[]) {
    if (alerts.some((alert) => alert.severity === "critical")) {
        return "critical";
    }
    if (alerts.some((alert) => alert.severity === "warning")) {
        return "warning";
    }
    return "healthy";
}

function buildAlerts(metrics: {
    organizations: number;
    activeMemberships: number;
    pipelineStages: number;
    pipelinesWithoutStage: number;
    failuresLastHour: number;
    activityLast24Hours: number;
}) {
    const alerts: RecruiterHealthAlert[] = [];

    if (metrics.organizations === 0) {
        alerts.push({
            code: "recruiter_workspace_missing",
            severity: "critical",
            message: "No recruiter organization is initialized.",
        });
    }

    if (metrics.activeMemberships === 0) {
        alerts.push({
            code: "recruiter_membership_missing",
            severity: "critical",
            message: "No active recruiter memberships found.",
        });
    }

    if (metrics.pipelineStages === 0) {
        alerts.push({
            code: "recruiter_pipeline_stage_missing",
            severity: "critical",
            message: "No recruiter pipeline stages configured.",
        });
    }

    if (metrics.failuresLastHour > 0) {
        alerts.push({
            code: "recruiter_workflow_failures",
            severity: "critical",
            message: `Detected ${metrics.failuresLastHour} recruiter workflow failures in the last hour.`,
        });
    }

    if (metrics.pipelinesWithoutStage > 0) {
        alerts.push({
            code: "recruiter_pipeline_unassigned_stage",
            severity: "warning",
            message: `${metrics.pipelinesWithoutStage} candidate pipelines are missing a stage.`,
        });
    }

    if (metrics.activityLast24Hours === 0) {
        alerts.push({
            code: "recruiter_activity_stale",
            severity: "warning",
            message: "No recruiter activity was logged in the last 24 hours.",
        });
    }

    return alerts;
}

function logRecruiterHealthEvent(event: string, payload: Record<string, unknown>) {
    console.info("[recruiter-beta-health]", {
        scope: "recruiter_beta_health",
        event,
        at: new Date().toISOString(),
        ...payload,
    });
}

/**
 * GET /api/recruiter-beta/health
 * Protected health indicators + minimal alerts for recruiter beta workflows.
 */
export async function GET(req: Request) {
    const requestId = `recruiter-health-${randomUUID()}`;
    const { userId } = await auth();

    if (!userId) {
        return withNoIndex(
            NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        );
    }

    if (!canAccessRecruiterBeta(userId)) {
        return withNoIndex(
            NextResponse.json({ error: "Recruiter beta access denied" }, { status: 403 })
        );
    }

    const expectedToken = process.env.RECRUITER_BETA_HEALTH_TOKEN?.trim();
    if (expectedToken) {
        const providedToken = resolveProvidedToken(req);
        if (!providedToken || providedToken !== expectedToken) {
            return withNoIndex(
                NextResponse.json({ error: "Unauthorized" }, { status: 401 })
            );
        }
    }

    const now = Date.now();
    const failureSince = new Date(now - FAILURE_LOOKBACK_MS);
    const activitySince = new Date(now - ACTIVITY_LOOKBACK_MS);

    const [
        organizations,
        activeMemberships,
        pipelineStages,
        openRequisitions,
        candidates,
        pipelines,
        pipelinesWithoutStage,
        failuresLastHour,
        activityLast24Hours,
    ] = await Promise.all([
        prisma.recruiterOrganization.count(),
        prisma.recruiterOrganizationMembership.count({
            where: {
                status: RecruiterMembershipStatus.ACTIVE,
            },
        }),
        prisma.recruiterPipelineStage.count(),
        prisma.recruiterRequisition.count({
            where: {
                status: RecruiterRequisitionStatus.OPEN,
            },
        }),
        prisma.recruiterCandidate.count(),
        prisma.recruiterCandidatePipeline.count(),
        prisma.recruiterCandidatePipeline.count({
            where: {
                currentStageId: null,
            },
        }),
        prisma.recruiterActivityLog.count({
            where: {
                action: {
                    endsWith: ".failed",
                },
                createdAt: {
                    gte: failureSince,
                },
            },
        }),
        prisma.recruiterActivityLog.count({
            where: {
                createdAt: {
                    gte: activitySince,
                },
            },
        }),
    ]);

    const metrics = {
        organizations,
        activeMemberships,
        pipelineStages,
        openRequisitions,
        candidates,
        pipelines,
        pipelinesWithoutStage,
        failuresLastHour,
        activityLast24Hours,
    };
    const alerts = buildAlerts(metrics);
    const status = summarizeStatus(alerts);

    logRecruiterHealthEvent("snapshot.generated", {
        requestId,
        userId,
        status,
        alertCount: alerts.length,
        criticalAlertCount: alerts.filter((alert) => alert.severity === "critical")
            .length,
    });

    return withNoIndex(
        NextResponse.json({
            requestId,
            generatedAt: new Date(now).toISOString(),
            status,
            metrics,
            alerts,
        })
    );
}
