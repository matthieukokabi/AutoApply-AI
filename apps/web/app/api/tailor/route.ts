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
const TAILOR_WEBHOOK_PATH_CANDIDATES = [
    "single-job-tailor-v3",
    "single-job-tailor-v2",
    "single-job-tailor",
] as const;
const WEBHOOK_PATH_SEGMENT = "/webhook/";

function detectJobSourceFromUrl(jobUrl: string) {
    if (!jobUrl) {
        return "manual";
    }

    try {
        const hostname = new URL(jobUrl).hostname.toLowerCase();
        if (hostname.includes("linkedin.com")) {
            return "linkedin";
        }
    } catch {
        return "manual";
    }

    return "manual";
}

function normalizePathname(pathname: string) {
    const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
    const collapsed = withLeadingSlash.replace(/\/{2,}/g, "/");
    if (collapsed === "/") {
        return "";
    }
    return collapsed.replace(/\/$/, "");
}

function toAbsolutePathname(pathname: string) {
    const normalized = normalizePathname(pathname);
    return normalized || "/";
}

function buildTailorWebhookEndpoints(n8nWebhookUrl: string) {
    const parsedN8nWebhookUrl = new URL(n8nWebhookUrl);
    if (
        parsedN8nWebhookUrl.protocol !== "http:" &&
        parsedN8nWebhookUrl.protocol !== "https:"
    ) {
        throw new Error("invalid_webhook_protocol");
    }

    parsedN8nWebhookUrl.search = "";
    parsedN8nWebhookUrl.hash = "";

    const configuredPath = normalizePathname(parsedN8nWebhookUrl.pathname);
    const configuredPathLower = configuredPath.toLowerCase();
    const webhookIndex = configuredPathLower.indexOf(WEBHOOK_PATH_SEGMENT);

    const endpoints: string[] = [];
    const seen = new Set<string>();
    const pushEndpoint = (pathname: string) => {
        const endpoint = new URL(parsedN8nWebhookUrl.toString());
        endpoint.pathname = toAbsolutePathname(pathname);
        endpoint.search = "";
        endpoint.hash = "";

        const value = endpoint.toString();
        if (!seen.has(value)) {
            seen.add(value);
            endpoints.push(value);
        }
    };

    if (webhookIndex >= 0) {
        pushEndpoint(configuredPath);
        const basePath = configuredPath.slice(0, webhookIndex);
        for (const webhookPath of TAILOR_WEBHOOK_PATH_CANDIDATES) {
            pushEndpoint(`${basePath}/webhook/${webhookPath}`);
        }
    } else {
        for (const webhookPath of TAILOR_WEBHOOK_PATH_CANDIDATES) {
            pushEndpoint(`${configuredPath}/webhook/${webhookPath}`);
        }
    }

    return endpoints;
}

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

        const n8nWebhookSecret = process.env.N8N_WEBHOOK_SECRET?.trim();
        if (!n8nWebhookSecret) {
            return NextResponse.json(
                { error: "Tailoring service unavailable. Please try again later." },
                { status: 503 }
            );
        }

        let webhookEndpoints: string[];
        try {
            webhookEndpoints = buildTailorWebhookEndpoints(n8nWebhookUrl);
        } catch {
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
            const detectedSource = detectJobSourceFromUrl(sanitizedJobUrl);
            job = await prisma.job.upsert({
                where: { externalId },
                create: {
                    externalId,
                    title: sanitizedJobTitle || "Untitled Position",
                    company: sanitizedCompany || "Unknown Company",
                    location: "Not specified",
                    description: effectiveJobDescription,
                    source: detectedSource,
                    url: sanitizedJobUrl || "",
                },
                update: {},
            });
        }

        // Trigger n8n single-job tailoring webhook.
        // Credits are deducted only after webhook dispatch succeeds.
        const webhookPayload = JSON.stringify({
            userId: user.id,
            jobId: job.id,
            jobTitle: sanitizedJobTitle || job.title || "Untitled Position",
            company: sanitizedCompany || job.company || "Unknown Company",
            jobDescription: effectiveJobDescription,
            masterCvText: user.masterProfile.rawText,
            additionalContext: sanitizedAdditionalContext || "",
        });

        let webhookResponse: Response | null = null;
        let lastDispatchError:
            | {
                  endpoint: string;
                  status: number | null;
                  bodySnippet?: string;
                  error?: string;
              }
            | null = null;

        for (const webhookEndpoint of webhookEndpoints) {
            try {
                const response = await fetch(webhookEndpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-webhook-secret": n8nWebhookSecret,
                    },
                    body: webhookPayload,
                });

                if (response.ok) {
                    webhookResponse = response;
                    break;
                }

                const bodySnippet = await response
                    .text()
                    .then((value) => String(value || "").slice(0, 300))
                    .catch(() => "");

                lastDispatchError = {
                    endpoint: webhookEndpoint,
                    status: response.status,
                    bodySnippet: bodySnippet || undefined,
                };

                if (response.status !== 404 && response.status !== 405) {
                    break;
                }
            } catch (err) {
                lastDispatchError = {
                    endpoint: webhookEndpoint,
                    status: null,
                    error: err instanceof Error ? err.message : String(err),
                };
            }
        }

        if (!webhookResponse || !webhookResponse.ok) {
            console.error("n8n webhook trigger failed", {
                attempts: webhookEndpoints.length,
                lastDispatchError,
            });
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
