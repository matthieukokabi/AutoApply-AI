import { NextResponse } from "next/server";

const CONTACT_RATE_LIMIT_MAX_REQUESTS = 5;
const CONTACT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const contactRequestLog = new Map<string, number[]>();

function getResend() {
    const { Resend } = require("resend");
    return new Resend(process.env.RESEND_API_KEY);
}

function getClientIp(req: Request): string | null {
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) {
        return forwardedFor.split(",")[0]?.trim() || null;
    }

    return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || null;
}

function isRateLimited(clientIp: string, now = Date.now()): boolean {
    const windowStart = now - CONTACT_RATE_LIMIT_WINDOW_MS;
    const recentRequests = (contactRequestLog.get(clientIp) || []).filter(
        (timestamp) => timestamp > windowStart
    );

    if (recentRequests.length >= CONTACT_RATE_LIMIT_MAX_REQUESTS) {
        contactRequestLog.set(clientIp, recentRequests);
        return true;
    }

    recentRequests.push(now);
    contactRequestLog.set(clientIp, recentRequests);
    return false;
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
        const { name, email, subject, message } = body;

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

        const clientIp = getClientIp(req);
        if (clientIp && isRateLimited(clientIp)) {
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

        const resend = getResend();
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
