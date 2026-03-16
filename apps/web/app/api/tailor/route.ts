import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { sendCreditsLowEmail } from "@/lib/email";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

const TAILOR_RATE_LIMIT_MAX_REQUESTS = 8;
const TAILOR_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_JOB_DESCRIPTION_LENGTH = 12000;
const MAX_ADDITIONAL_CONTEXT_LENGTH = 3000;
const MAX_JOB_TITLE_LENGTH = 200;
const MAX_COMPANY_LENGTH = 200;
const MAX_JOB_ID_LENGTH = 100;
const tailorRequestLog = new Map<string, number[]>();

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

        const clientIp = getClientIp(req);
        if (
            clientIp &&
            isRateLimited({
                store: tailorRequestLog,
                key: clientIp,
                maxRequests: TAILOR_RATE_LIMIT_MAX_REQUESTS,
                windowMs: TAILOR_RATE_LIMIT_WINDOW_MS,
            })
        ) {
            return NextResponse.json(
                { error: "Too many tailoring requests. Please try again shortly." },
                { status: 429 }
            );
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

        const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;
        if (!n8nWebhookUrl) {
            return NextResponse.json(
                { error: "Tailoring service unavailable. Please try again later." },
                { status: 503 }
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

        const sanitizedJobDescription =
            typeof jobDescription === "string" ? jobDescription.trim() : "";
        const sanitizedJobUrl = typeof jobUrl === "string" ? jobUrl.trim() : "";
        const sanitizedJobTitle = typeof jobTitle === "string" ? jobTitle.trim() : "";
        const sanitizedCompany = typeof company === "string" ? company.trim() : "";
        const sanitizedAdditionalContext =
            typeof additionalContext === "string" ? additionalContext.trim() : "";
        const sanitizedExistingJobId =
            typeof existingJobId === "string" ? existingJobId.trim() : "";

        if (
            sanitizedJobDescription.length > MAX_JOB_DESCRIPTION_LENGTH ||
            sanitizedAdditionalContext.length > MAX_ADDITIONAL_CONTEXT_LENGTH ||
            sanitizedJobTitle.length > MAX_JOB_TITLE_LENGTH ||
            sanitizedCompany.length > MAX_COMPANY_LENGTH ||
            sanitizedExistingJobId.length > MAX_JOB_ID_LENGTH
        ) {
            return NextResponse.json(
                { error: "One or more fields exceed maximum allowed length" },
                { status: 400 }
            );
        }

        if (sanitizedJobUrl) {
            try {
                const parsedUrl = new URL(sanitizedJobUrl);
                const isHttpUrl = parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
                if (!isHttpUrl) {
                    return NextResponse.json(
                        { error: "Job URL must use HTTP or HTTPS" },
                        { status: 400 }
                    );
                }
            } catch {
                return NextResponse.json(
                    { error: "Job URL is invalid" },
                    { status: 400 }
                );
            }
        }

        if (!sanitizedExistingJobId && !sanitizedJobDescription) {
            return NextResponse.json(
                { error: "Job description is required" },
                { status: 400 }
            );
        }

        // If re-tailoring an existing job, use the existing job record directly
        let job;
        let effectiveJobDescription = sanitizedJobDescription;
        if (sanitizedExistingJobId) {
            job = await prisma.job.findUnique({ where: { id: sanitizedExistingJobId } });
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
            const externalId = sanitizedJobUrl || `manual-${Date.now()}`;
            job = await prisma.job.upsert({
                where: { externalId },
                create: {
                    externalId,
                    title: sanitizedJobTitle || "Untitled Position",
                    company: sanitizedCompany || "Unknown Company",
                    location: "Not specified",
                    description: effectiveJobDescription,
                    source: "manual",
                    url: sanitizedJobUrl || "",
                },
                update: {},
            });
        }

        // Trigger n8n single-job tailoring webhook.
        // Credits are deducted only after webhook dispatch succeeds.
        const webhookResponse = await fetch(`${n8nWebhookUrl}/webhook/single-job-tailor`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: user.id,
                jobId: job.id,
                jobTitle: sanitizedJobTitle || job.title || "Untitled Position",
                company: sanitizedCompany || job.company || "Unknown Company",
                jobDescription: effectiveJobDescription,
                masterCvText: user.masterProfile.rawText,
                additionalContext: sanitizedAdditionalContext || "",
            }),
        }).catch((err) => {
            console.error("n8n webhook trigger failed:", err.message);
            return null;
        });

        if (!webhookResponse || !webhookResponse.ok) {
            return NextResponse.json(
                { error: "Tailoring dispatch failed. Please try again." },
                { status: 502 }
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
