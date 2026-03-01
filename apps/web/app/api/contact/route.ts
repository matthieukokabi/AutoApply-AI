import { NextResponse } from "next/server";

function getResend() {
    const { Resend } = require("resend");
    return new Resend(process.env.RESEND_API_KEY);
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

        // Rate limiting: basic check (in production, use Redis or similar)
        // For now, just cap message length
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

        const resend = getResend();
        await resend.emails.send({
            from: "AutoApply AI <noreply@autoapply.works>",
            to: ["support@autoapply.works"],
            replyTo: email,
            subject: subjectLine,
            html: `
                <h2>New Contact Form Submission</h2>
                <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
                <p><strong>Subject:</strong> ${subjectLabels[subject] || "General"}</p>
                <hr />
                <p>${message.replace(/\n/g, "<br />")}</p>
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
