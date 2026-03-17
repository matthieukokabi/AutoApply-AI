import { NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

const CONTACT_RATE_LIMIT_MAX_REQUESTS = 5;
const CONTACT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const CONTACT_MIN_SUBMIT_MS = 2500;
const CONTACT_MAX_FORM_AGE_MS = 2 * 60 * 60 * 1000;
const contactRequestLog = new Map<string, number[]>();

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
    try {
        const body = await req.json();
        const { name, email, subject, message, website, formStartedAt } = body;

        // Honeypot: bots filling hidden fields are accepted but dropped silently.
        if (typeof website === "string" && website.trim().length > 0) {
            return NextResponse.json({ success: true });
        }

        const startedAt = Number(formStartedAt);
        const now = Date.now();
        if (!Number.isFinite(startedAt)) {
            return NextResponse.json(
                { error: "Invalid form session. Please refresh and try again." },
                { status: 400 }
            );
        }

        const elapsedMs = now - startedAt;
        if (elapsedMs < CONTACT_MIN_SUBMIT_MS) {
            return NextResponse.json(
                { error: "Please take a moment before submitting the form." },
                { status: 400 }
            );
        }

        if (elapsedMs > CONTACT_MAX_FORM_AGE_MS) {
            return NextResponse.json(
                { error: "Form session expired. Please refresh and submit again." },
                { status: 400 }
            );
        }

        if (!name || !email || !message) {
            return NextResponse.json(
                { error: "Name, email, and message are required" },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: "Invalid email format" },
                { status: 400 }
            );
        }

        const resendApiKey = process.env.RESEND_API_KEY;
        if (!resendApiKey) {
            console.error("RESEND_API_KEY is required for /api/contact");
            return NextResponse.json({ error: "Contact endpoint misconfigured" }, { status: 503 });
        }

        const clientIp = getClientIp(req);
        if (
            clientIp &&
            isRateLimited({
                store: contactRequestLog,
                key: clientIp,
                maxRequests: CONTACT_RATE_LIMIT_MAX_REQUESTS,
                windowMs: CONTACT_RATE_LIMIT_WINDOW_MS,
            })
        ) {
            return NextResponse.json(
                { error: "Too many requests. Please try again in a few minutes." },
                { status: 429 }
            );
        }

        if (message.length > 5000) {
            return NextResponse.json(
                { error: "Message too long (max 5000 characters)" },
                { status: 400 }
            );
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

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("POST /api/contact error:", error);
        return NextResponse.json(
            { error: "Failed to send message. Please try again." },
            { status: 500 }
        );
    }
}
