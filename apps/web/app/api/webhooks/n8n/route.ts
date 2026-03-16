import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendJobMatchEmail, sendTailoringCompleteEmail, sendCreditsLowEmail } from "@/lib/email";

/**
 * POST /api/webhooks/n8n
 * Receives notifications from n8n workflows (new tailored documents, errors, etc.)
 * Protected by a shared secret header.
 */
export async function POST(req: Request) {
    try {
        const expectedWebhookSecret = process.env.N8N_WEBHOOK_SECRET;
        if (!expectedWebhookSecret) {
            console.error("N8N_WEBHOOK_SECRET is not configured");
            return NextResponse.json(
                { error: "Webhook endpoint misconfigured" },
                { status: 503 }
            );
        }

        // Verify webhook secret
        const webhookSecret = req.headers.get("x-webhook-secret");
        if (!webhookSecret || webhookSecret !== expectedWebhookSecret) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const type = typeof body?.type === "string" ? body.type : "";
        const data =
            body?.data && typeof body.data === "object" && !Array.isArray(body.data)
                ? (body.data as Record<string, unknown>)
                : null;

        if (!type || !data) {
            return NextResponse.json(
                { error: "Invalid webhook payload" },
                { status: 400 }
            );
        }

        switch (type) {
            case "new_applications": {
                // n8n sends discovered/tailored jobs from automated pipeline
                const userId = typeof data.userId === "string" ? data.userId.trim() : "";
                const applications = Array.isArray(data.applications) ? data.applications : null;

                if (!userId || !applications) {
                    return NextResponse.json(
                        { error: "Invalid new_applications payload" },
                        { status: 400 }
                    );
                }

                const createdApps = [];

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
                    createdApps.push(result);
                }

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
                    console.error("Email notification failed (non-blocking):", emailError);
                }

                return NextResponse.json({
                    message: `Processed ${applications.length} applications`,
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
                } = data as Record<string, any>;

                if (
                    typeof tailorUserId !== "string" ||
                    !tailorUserId.trim() ||
                    typeof tailorJobId !== "string" ||
                    !tailorJobId.trim()
                ) {
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
                    console.error("Tailoring email failed (non-blocking):", emailError);
                }

                return NextResponse.json({
                    message: "Tailoring results saved",
                    applicationId: application.id,
                });
            }

            case "workflow_error": {
                // Log workflow errors
                if (
                    typeof data.workflowId !== "string" ||
                    typeof data.nodeName !== "string" ||
                    typeof data.errorType !== "string" ||
                    typeof data.message !== "string" ||
                    !data.workflowId.trim() ||
                    !data.nodeName.trim() ||
                    !data.errorType.trim() ||
                    !data.message.trim()
                ) {
                    return NextResponse.json(
                        { error: "Invalid workflow_error payload" },
                        { status: 400 }
                    );
                }

                await prisma.workflowError.create({
                    data: {
                        workflowId: data.workflowId.trim(),
                        nodeName: data.nodeName.trim(),
                        errorType: data.errorType.trim(),
                        message: data.message.trim(),
                        payload: data.payload as any,
                        userId: typeof data.userId === "string" ? data.userId : undefined,
                    },
                });

                return NextResponse.json({ message: "Error logged" });
            }

            default:
                return NextResponse.json(
                    { error: `Unknown webhook type: ${type}` },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error("n8n webhook error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
