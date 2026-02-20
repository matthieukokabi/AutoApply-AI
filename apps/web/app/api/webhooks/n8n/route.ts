import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

                for (const app of applications) {
                    await prisma.application.upsert({
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
                    });
                }

                return NextResponse.json({
                    message: `Processed ${applications.length} applications`,
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
