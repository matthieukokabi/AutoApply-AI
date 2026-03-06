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
        // Verify webhook secret
        const webhookSecret = req.headers.get("x-webhook-secret");
        if (webhookSecret !== process.env.N8N_WEBHOOK_SECRET) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { type, data } = body;

        switch (type) {
            case "new_applications": {
                // n8n sends newly tailored applications
                const { userId, applications } = data;

                const createdApps = [];

                for (const app of applications) {
                    const result = await prisma.application.upsert({
                        where: {
                            userId_jobId: {
                                userId,
                                jobId: app.jobId,
                            },
                        },
                        create: {
                            userId,
                            jobId: app.jobId,
                            compatibilityScore: app.compatibilityScore,
                            atsKeywords: app.atsKeywords || [],
                            matchingStrengths: app.matchingStrengths || [],
                            gaps: app.gaps || [],
                            recommendation: app.recommendation,
                            tailoredCvUrl: app.tailoredCvUrl,
                            coverLetterUrl: app.coverLetterUrl,
                            tailoredCvMarkdown: app.tailoredCvMarkdown,
                            coverLetterMarkdown: app.coverLetterMarkdown,
                            status: "tailored",
                        },
                        update: {
                            compatibilityScore: app.compatibilityScore,
                            tailoredCvUrl: app.tailoredCvUrl,
                            coverLetterUrl: app.coverLetterUrl,
                            tailoredCvMarkdown: app.tailoredCvMarkdown,
                            coverLetterMarkdown: app.coverLetterMarkdown,
                            status: "tailored",
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
                // Single job tailoring result from user-initiated request
                const { userId, applicationId, jobId } = data;

                try {
                    const user = await prisma.user.findUnique({ where: { id: userId } });
                    const application = await prisma.application.findUnique({
                        where: { id: applicationId },
                        include: { job: true },
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
                    console.error("Tailoring email notification failed (non-blocking):", emailError);
                }

                return NextResponse.json({ message: "Tailoring notification sent" });
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
