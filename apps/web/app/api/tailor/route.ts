import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/**
 * POST /api/tailor
 * User-initiated single job tailoring.
 * Triggers the n8n webhook for on-demand tailoring.
 */
export async function POST(req: Request) {
    try {
        const authUser = await getAuthUser(req);
        if (!authUser) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get the user with profile from our database
        const user = await prisma.user.findFirst({
            where: { id: authUser.id },
            include: { masterProfile: true },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (!user.masterProfile) {
            return NextResponse.json(
                { error: "Please upload your CV first" },
                { status: 400 }
            );
        }

        // Check credits
        if (user.creditsRemaining <= 0 && user.subscriptionStatus !== "unlimited") {
            return NextResponse.json(
                { error: "No credits remaining. Please upgrade your plan." },
                { status: 403 }
            );
        }

        const body = await req.json();
        const { jobDescription, jobUrl, jobTitle, company } = body;

        if (!jobDescription) {
            return NextResponse.json(
                { error: "Job description is required" },
                { status: 400 }
            );
        }

        // Create or find the job record
        const externalId = jobUrl || `manual-${Date.now()}`;
        const job = await prisma.job.upsert({
            where: { externalId },
            create: {
                externalId,
                title: jobTitle || "Untitled Position",
                company: company || "Unknown Company",
                location: "Not specified",
                description: jobDescription,
                source: "manual",
                url: jobUrl || "",
            },
            update: {},
        });

        // Trigger n8n single-job tailoring webhook
        const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
        if (n8nWebhookUrl) {
            const webhookResponse = await fetch(
                `${n8nWebhookUrl}/webhook/single-job-tailor`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userId: user.id,
                        jobId: job.id,
                        jobDescription,
                        masterCvText: user.masterProfile.rawText,
                        masterCvJson: user.masterProfile.structuredJson,
                    }),
                }
            );

            if (!webhookResponse.ok) {
                console.error("n8n webhook failed:", await webhookResponse.text());
            }
        }

        // Deduct credit
        if (user.subscriptionStatus !== "unlimited") {
            await prisma.user.update({
                where: { id: user.id },
                data: { creditsRemaining: { decrement: 1 } },
            });
        }

        return NextResponse.json({
            message: "Tailoring job started",
            jobId: job.id,
        });
    } catch (error) {
        console.error("Tailor API error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
