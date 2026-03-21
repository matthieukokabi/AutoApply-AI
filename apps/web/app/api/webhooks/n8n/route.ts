import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendJobMatchEmail, sendTailoringCompleteEmail, sendCreditsLowEmail } from "@/lib/email";

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
        const data =
            body?.data && typeof body.data === "object" && !Array.isArray(body.data)
                ? (body.data as Record<string, unknown>)
                : null;
        const allowsMissingData = type === "fetch_active_users";
        const webhookData = data ?? {};

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

            case "new_applications": {
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

                const createdApps = [];
                let discoveredCount = 0;
                let tailoredCount = 0;

                for (let index = 0; index < applications.length; index += 1) {
                    const app = applications[index];
                    const appData =
                        app && typeof app === "object" && !Array.isArray(app)
                            ? (app as Record<string, any>)
                            : {};
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
                            tailoredCvMarkdown: appData.tailoredCvMarkdown || null,
                            coverLetterMarkdown: appData.coverLetterMarkdown || null,
                            status: appData.status || (appData.tailoredCvMarkdown ? "tailored" : "discovered"),
                        },
                        update: {
                            compatibilityScore: appData.compatibilityScore || 0,
                            atsKeywords: appData.atsKeywords || [],
                            matchingStrengths: appData.matchingStrengths || [],
                            gaps: appData.gaps || [],
                            recommendation: appData.recommendation || "skip",
                            tailoredCvMarkdown: appData.tailoredCvMarkdown || null,
                            coverLetterMarkdown: appData.coverLetterMarkdown || null,
                            status: appData.status || (appData.tailoredCvMarkdown ? "tailored" : "discovered"),
                        },
                        include: { job: true },
                    });
                    if (result.status === "tailored") {
                        tailoredCount += 1;
                    } else {
                        discoveredCount += 1;
                    }
                    createdApps.push(result);
                }

                logPipelineEvent("info", "new_applications_persisted", {
                    runId,
                    userId,
                    createdCount: createdApps.length,
                    tailoredCount,
                    discoveredCount,
                });

                // Send email notification for new job matches
                try {
                    const user = await prisma.user.findUnique({ where: { id: userId } });
                    if (user && createdApps.length > 0) {
                        const matchedJobs = createdApps.map((a) => ({
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

                // Save tailoring results to database
                const application = await prisma.application.upsert({
                    where: {
                        userId_jobId: {
                            userId: normalizedTailorUserId,
                            jobId: normalizedTailorJobId,
                        },
                    },
                    create: {
                        userId: normalizedTailorUserId,
                        jobId: normalizedTailorJobId,
                        compatibilityScore: compatibilityScore || 0,
                        atsKeywords: atsKeywords || [],
                        matchingStrengths: matchingStrengths || [],
                        gaps: gaps || [],
                        recommendation: recommendation || "stretch",
                        tailoredCvMarkdown: tailoredCvMarkdown || null,
                        coverLetterMarkdown: coverLetterMarkdown || null,
                        status: tailoredCvMarkdown ? "tailored" : "discovered",
                    },
                    update: {
                        compatibilityScore: compatibilityScore || 0,
                        atsKeywords: atsKeywords || [],
                        matchingStrengths: matchingStrengths || [],
                        gaps: gaps || [],
                        recommendation: recommendation || "stretch",
                        tailoredCvMarkdown: tailoredCvMarkdown || null,
                        coverLetterMarkdown: coverLetterMarkdown || null,
                        status: tailoredCvMarkdown ? "tailored" : "discovered",
                    },
                    include: { job: true },
                });

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

                logPipelineEvent("error", "workflow_error_logged", {
                    runId,
                    workflowId: webhookData.workflowId.trim(),
                    nodeName: webhookData.nodeName.trim(),
                    errorType: webhookData.errorType.trim(),
                });

                return NextResponse.json({ message: "Error logged", runId });
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
