import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { sendCreditsLowEmail } from "@/lib/email";

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
        const {
            jobDescription,
            jobUrl,
            jobTitle,
            company,
            additionalContext,
            jobId: existingJobId,
        } = body;

        if (!existingJobId && !jobDescription) {
            return NextResponse.json(
                { error: "Job description is required" },
                { status: 400 }
            );
        }

        // If re-tailoring an existing job, use the existing job record directly
        let job;
        let effectiveJobDescription = typeof jobDescription === "string"
            ? jobDescription.trim()
            : "";
        if (existingJobId) {
            job = await prisma.job.findUnique({ where: { id: existingJobId } });
            if (!job) {
                return NextResponse.json(
                    { error: "Job not found" },
                    { status: 404 }
                );
            }

            if (!effectiveJobDescription) {
                effectiveJobDescription = (job.description || "").trim();
            }

            if (!effectiveJobDescription) {
                return NextResponse.json(
                    { error: "Job description is required for this job" },
                    { status: 400 }
                );
            }
        } else {
            // Create or find the job record for new tailoring
            const externalId = jobUrl || `manual-${Date.now()}`;
            job = await prisma.job.upsert({
                where: { externalId },
                create: {
                    externalId,
                    title: jobTitle || "Untitled Position",
                    company: company || "Unknown Company",
                    location: "Not specified",
                    description: effectiveJobDescription,
                    source: "manual",
                    url: jobUrl || "",
                },
                update: {},
            });
        }

        // Trigger n8n single-job tailoring webhook (fire-and-forget)
        // n8n processes asynchronously and calls back to /api/webhooks/n8n when done
        const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
        if (n8nWebhookUrl) {
            fetch(`${n8nWebhookUrl}/webhook/single-job-tailor`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId: user.id,
                    jobId: job.id,
                    jobTitle: jobTitle || job.title || "Untitled Position",
                    company: company || job.company || "Unknown Company",
                    jobDescription: effectiveJobDescription,
                    masterCvText: user.masterProfile.rawText,
                    additionalContext: additionalContext || "",
                }),
            }).catch((err) =>
                console.error("n8n webhook trigger failed:", err.message)
            );
        }

        // Deduct credit
        if (user.subscriptionStatus !== "unlimited") {
            const updatedUser = await prisma.user.update({
                where: { id: user.id },
                data: { creditsRemaining: { decrement: 1 } },
            });

            // Send credits-low email when running low (non-blocking)
            if (updatedUser.creditsRemaining <= 1 && updatedUser.creditsRemaining >= 0) {
                sendCreditsLowEmail(user.email, user.name, updatedUser.creditsRemaining).catch(
                    (err) => console.error("Credits low email failed:", err)
                );
            }
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
