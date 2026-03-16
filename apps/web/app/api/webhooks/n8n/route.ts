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
        const { type, data } = body;

        switch (type) {
            case "new_applications": {
                // n8n sends discovered/tailored jobs from automated pipeline
                const { userId, applications } = data;

                const createdApps = [];

                for (const [index, app] of applications.entries()) {
                    const externalId =
                        app.externalId ||
                        app.url ||
                        `manual-${userId}-${Date.now()}-${index}`;

                    // First, create/upsert the Job record (discovery pipeline finds NEW jobs)
                    const job = await prisma.job.upsert({
                        where: { externalId },
                        create: {
                            externalId,
                            title: app.title || "Untitled Position",
                            company: app.company || "Unknown Company",
                            location: app.location || "Not specified",
                            description: app.description || "",
                            source: app.source || "manual",
                            url: app.url || "",
                            salary: app.salary || null,
                            postedAt: app.postedAt ? new Date(app.postedAt) : null,
                        },
                        update: {
                            title: app.title || "Untitled Position",
                            company: app.company || "Unknown Company",
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
                            compatibilityScore: app.compatibilityScore || 0,
                            atsKeywords: app.atsKeywords || [],
                            matchingStrengths: app.matchingStrengths || [],
                            gaps: app.gaps || [],
                            recommendation: app.recommendation || "skip",
                            tailoredCvMarkdown: app.tailoredCvMarkdown || null,
                            coverLetterMarkdown: app.coverLetterMarkdown || null,
                            status: app.status || (app.tailoredCvMarkdown ? "tailored" : "discovered"),
                        },
                        update: {
                            compatibilityScore: app.compatibilityScore || 0,
                            atsKeywords: app.atsKeywords || [],
                            matchingStrengths: app.matchingStrengths || [],
                            gaps: app.gaps || [],
                            recommendation: app.recommendation || "skip",
                            tailoredCvMarkdown: app.tailoredCvMarkdown || null,
                            coverLetterMarkdown: app.coverLetterMarkdown || null,
                            status: app.status || (app.tailoredCvMarkdown ? "tailored" : "discovered"),
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
                } = data;

                // Save tailoring results to database
                const application = await prisma.application.upsert({
                    where: {
                        userId_jobId: {
                            userId: tailorUserId,
                            jobId: tailorJobId,
                        },
                    },
                    create: {
                        userId: tailorUserId,
                        jobId: tailorJobId,
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
                        where: { id: tailorUserId },
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
                await prisma.workflowError.create({
                    data: {
                        workflowId: data.workflowId,
                        nodeName: data.nodeName,
                        errorType: data.errorType,
                        message: data.message,
                        payload: data.payload,
                        userId: data.userId,
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
