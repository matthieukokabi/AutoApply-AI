import { NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import {
    incrementAbuseCounter,
    incrementCaptchaCounter,
    incrementFunnelEvent,
    type ContactFunnelEventContext,
} from "@/lib/contact-telemetry";

const CONTACT_RATE_LIMIT_MAX_REQUESTS = 5;
const CONTACT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const CONTACT_SESSION_RATE_LIMIT_MAX_REQUESTS = 3;
const CONTACT_SESSION_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const CONTACT_MIN_SUBMIT_MS = 2500;
const CONTACT_MAX_FORM_AGE_MS = 2 * 60 * 60 * 1000;
const contactRequestLog = new Map<string, number[]>();
const contactSessionRequestLog = new Map<string, number[]>();

function isValidFormSessionId(value: unknown): value is string {
    if (typeof value !== "string") {
        return false;
    }

    const trimmed = value.trim();
    return /^[A-Za-z0-9_-]{16,128}$/.test(trimmed);
}

type TurnstileVerificationResult = {
    success: boolean;
    "error-codes"?: string[];
};

type TurnstileVerificationOutcome = {
    outcome: "solve" | "fail" | "error";
    errorCodes: string[];
};

async function verifyTurnstileToken(
    secretKey: string,
    token: string,
    clientIp: string | null
): Promise<TurnstileVerificationOutcome> {
    try {
        const payload = new URLSearchParams({
            secret: secretKey,
            response: token,
        });

        if (clientIp) {
            payload.set("remoteip", clientIp);
        }

        const verificationResponse = await fetch(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: payload.toString(),
            }
        );

        if (!verificationResponse.ok) {
            return {
                outcome: "error",
                errorCodes: [`http_${verificationResponse.status}`],
            };
        }

        const result =
            (await verificationResponse.json()) as TurnstileVerificationResult;

        if (result.success === true) {
            return { outcome: "solve", errorCodes: [] };
        }

        return {
            outcome: "fail",
            errorCodes: result["error-codes"] || [],
        };
    } catch {
        return { outcome: "error", errorCodes: ["network_error"] };
    }
}

function getResend(apiKey: string) {
    const { Resend } = require("resend");
    return new Resend(apiKey);
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * POST /api/contact — send contact form message via email
 * Body: { name, email, subject, message }
 */
export async function POST(req: Request) {
    let funnelContext: ContactFunnelEventContext = {};
    const submitFailResponse = (error: string, status: number) => {
        incrementFunnelEvent("submit_fail", funnelContext);
        return NextResponse.json({ error }, { status });
    };

    try {
        const body = await req.json();
        const { name, email, subject, message, website, formStartedAt, formSessionId } = body;
        funnelContext = {
            routePath:
                typeof body.routePath === "string" ? body.routePath : undefined,
            campaign:
                typeof body.campaign === "string" ? body.campaign : undefined,
        };

        // Honeypot: bots filling hidden fields are accepted but dropped silently.
        if (typeof website === "string" && website.trim().length > 0) {
            incrementAbuseCounter("honeypot");
            return NextResponse.json({ success: true });
        }

        if (!isValidFormSessionId(formSessionId)) {
            incrementAbuseCounter("invalid_form_session");
            return submitFailResponse(
                "Invalid form session. Please refresh and try again.",
                400
            );
        }

        const normalizedSessionId = formSessionId.trim();
        const startedAt = Number(formStartedAt);
        const now = Date.now();
        if (!Number.isFinite(startedAt)) {
            incrementAbuseCounter("invalid_form_timing");
            return submitFailResponse(
                "Invalid form session. Please refresh and try again.",
                400
            );
        }

        const elapsedMs = now - startedAt;
        if (elapsedMs < CONTACT_MIN_SUBMIT_MS) {
            incrementAbuseCounter("form_too_fast");
            return submitFailResponse(
                "Please take a moment before submitting the form.",
                400
            );
        }

        if (elapsedMs > CONTACT_MAX_FORM_AGE_MS) {
            incrementAbuseCounter("form_expired");
            return submitFailResponse(
                "Form session expired. Please refresh and submit again.",
                400
            );
        }

        if (!name || !email || !message) {
            incrementAbuseCounter("missing_required_fields");
            return submitFailResponse("Name, email, and message are required", 400);
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            incrementAbuseCounter("invalid_email");
            return submitFailResponse("Invalid email format", 400);
        }

        const clientIp = getClientIp(req);
        const turnstileSecret = process.env.TURNSTILE_SECRET_KEY?.trim();
        if (turnstileSecret) {
            const token =
                typeof body.turnstileToken === "string"
                    ? body.turnstileToken.trim()
                    : "";

            if (!token) {
                incrementAbuseCounter("missing_turnstile_token");
                incrementCaptchaCounter("fail", ["missing_token"]);
                return submitFailResponse(
                    "Verification challenge is required.",
                    400
                );
            }

            const turnstileOutcome = await verifyTurnstileToken(
                turnstileSecret,
                token,
                clientIp
            );
            incrementCaptchaCounter(
                turnstileOutcome.outcome,
                turnstileOutcome.errorCodes,
                funnelContext
            );

            if (turnstileOutcome.outcome !== "solve") {
                incrementAbuseCounter("turnstile_failed");
                return submitFailResponse(
                    "Verification challenge failed. Please try again.",
                    400
                );
            }
        }

        const resendApiKey = process.env.RESEND_API_KEY;
        if (!resendApiKey) {
            console.error("RESEND_API_KEY is required for /api/contact");
            return submitFailResponse("Contact endpoint misconfigured", 503);
        }

        if (
            clientIp &&
            isRateLimited({
                store: contactRequestLog,
                key: clientIp,
                maxRequests: CONTACT_RATE_LIMIT_MAX_REQUESTS,
                windowMs: CONTACT_RATE_LIMIT_WINDOW_MS,
            })
        ) {
            incrementAbuseCounter("ip_rate_limited");
            return submitFailResponse(
                "Too many requests. Please try again in a few minutes.",
                429
            );
        }

        if (
            isRateLimited({
                store: contactSessionRequestLog,
                key: normalizedSessionId,
                maxRequests: CONTACT_SESSION_RATE_LIMIT_MAX_REQUESTS,
                windowMs: CONTACT_SESSION_RATE_LIMIT_WINDOW_MS,
            })
        ) {
            incrementAbuseCounter("session_rate_limited");
            return submitFailResponse(
                "Too many requests from this session. Please try again shortly.",
                429
            );
        }

        if (message.length > 5000) {
            incrementAbuseCounter("message_too_long");
            return submitFailResponse("Message too long (max 5000 characters)", 400);
        }

        const subjectLabels: Record<string, string> = {
            general: "General Inquiry",
            support: "Technical Support",
            billing: "Billing Question",
            privacy: "Privacy / Data Request",
            feedback: "Feedback",
        };

        const subjectLine = `[AutoApply Contact] ${subjectLabels[subject] || "General"} from ${name}`;
        const safeName = escapeHtml(name);
        const safeEmail = escapeHtml(email);
        const safeSubject = escapeHtml(subjectLabels[subject] || "General");
        const safeMessage = escapeHtml(message).replace(/\n/g, "<br />");

        const resend = getResend(resendApiKey);
        await resend.emails.send({
            from: "AutoApply AI <noreply@autoapply.works>",
            to: ["support@autoapply.works"],
            replyTo: email,
            subject: subjectLine,
            html: `
                <h2>New Contact Form Submission</h2>
                <p><strong>From:</strong> ${safeName} &lt;${safeEmail}&gt;</p>
                <p><strong>Subject:</strong> ${safeSubject}</p>
                <hr />
                <p>${safeMessage}</p>
                <hr />
                <p style="color: #666; font-size: 12px;">
                    Sent from the AutoApply AI contact form at ${new Date().toISOString()}
                </p>
            `,
        });

        incrementFunnelEvent("submit_success", funnelContext);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("POST /api/contact error:", error);
        return submitFailResponse("Failed to send message. Please try again.", 500);
    }
}
