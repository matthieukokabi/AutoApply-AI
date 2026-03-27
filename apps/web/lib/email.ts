/**
 * Centralized email service using Resend
 * Used for: welcome emails, job match alerts, tailoring notifications, weekly digests
 */

// Lazy-load Resend to avoid build-time initialization errors
function getResend() {
    const { Resend } = require("resend");
    return new Resend(process.env.RESEND_API_KEY);
}

const FROM_EMAIL_NOREPLY = process.env.RESEND_FROM_NOREPLY?.trim() || "AutoApply AI <no-reply@send.autoapply.works>";
const FROM_EMAIL_JOBS = process.env.RESEND_FROM_JOBS?.trim() || "AutoApply AI Jobs <jobs@send.autoapply.works>";
const FROM_EMAIL_ALERTS = process.env.RESEND_FROM_ALERTS?.trim() || "AutoApply AI Alerts <alerts@send.autoapply.works>";
const REPLY_TO_SUPPORT = process.env.RESEND_REPLY_TO_SUPPORT?.trim() || "support@autoapply.works";
const REPLY_TO_JOBS = process.env.RESEND_REPLY_TO_JOBS?.trim() || "jobs@autoapply.works";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://autoapply.works";

// ─── Email Template Wrapper ─────────────────────────────────

function emailWrapper(content: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AutoApply AI</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #2563eb, #3b82f6); padding: 32px 40px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
                                ✨ AutoApply AI
                            </h1>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            ${content}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 24px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center; line-height: 1.6;">
                                <a href="${APP_URL}" style="color: #6b7280; text-decoration: none;">AutoApply AI</a> &mdash; AI-powered career assistant<br />
                                <a href="${APP_URL}/settings" style="color: #6b7280; text-decoration: underline;">Manage notification preferences</a> &bull;
                                <a href="${APP_URL}/privacy" style="color: #6b7280; text-decoration: underline;">Privacy Policy</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

// ─── Welcome Email ──────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
    const content = `
        <h2 style="margin: 0 0 16px; font-size: 22px; color: #111827;">Welcome to AutoApply AI, ${escapeHtml(name)}! 🎉</h2>
        <p style="margin: 0 0 16px; font-size: 15px; color: #374151; line-height: 1.6;">
            You're now set up to supercharge your job search with AI-powered resume tailoring and job matching.
        </p>
        <p style="margin: 0 0 8px; font-size: 15px; color: #374151; font-weight: 600;">Here's how to get started:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
            <tr>
                <td style="padding: 8px 0;">
                    <span style="display: inline-block; width: 28px; height: 28px; background: #eff6ff; color: #2563eb; border-radius: 50%; text-align: center; line-height: 28px; font-weight: 700; font-size: 13px; margin-right: 12px;">1</span>
                    <span style="font-size: 14px; color: #374151;"><strong>Upload your CV</strong> — We'll parse it into a master profile</span>
                </td>
            </tr>
            <tr>
                <td style="padding: 8px 0;">
                    <span style="display: inline-block; width: 28px; height: 28px; background: #eff6ff; color: #2563eb; border-radius: 50%; text-align: center; line-height: 28px; font-weight: 700; font-size: 13px; margin-right: 12px;">2</span>
                    <span style="font-size: 14px; color: #374151;"><strong>Set job preferences</strong> — Titles, locations, salary, remote/hybrid</span>
                </td>
            </tr>
            <tr>
                <td style="padding: 8px 0;">
                    <span style="display: inline-block; width: 28px; height: 28px; background: #eff6ff; color: #2563eb; border-radius: 50%; text-align: center; line-height: 28px; font-weight: 700; font-size: 13px; margin-right: 12px;">3</span>
                    <span style="font-size: 14px; color: #374151;"><strong>Get tailored docs</strong> — AI-optimized CVs and cover letters per job</span>
                </td>
            </tr>
        </table>
        <div style="text-align: center; margin: 32px 0 16px;">
            <a href="${APP_URL}/dashboard" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
                Go to Dashboard →
            </a>
        </div>
        <p style="margin: 16px 0 0; font-size: 13px; color: #9ca3af; text-align: center;">
            Free plan includes 3 tailored documents per month.
        </p>
    `;

    try {
        const resend = getResend();
        await resend.emails.send({
            from: FROM_EMAIL_NOREPLY,
            replyTo: REPLY_TO_SUPPORT,
            to: [to],
            subject: "Welcome to AutoApply AI — Let's land your dream job 🚀",
            html: emailWrapper(content),
        });
    } catch (error) {
        console.error("Failed to send welcome email:", error);
    }
}

// ─── New Jobs Matched Notification ──────────────────────────

interface MatchedJob {
    title: string;
    company: string;
    score: number;
    applicationId?: string;
}

export async function sendJobMatchEmail(
    to: string,
    name: string,
    jobs: MatchedJob[]
): Promise<void> {
    const jobRows = jobs
        .slice(0, 10)
        .map(
            (job) => `
            <tr>
                <td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6;">
                    <div style="font-size: 14px; font-weight: 600; color: #111827;">${escapeHtml(job.title)}</div>
                    <div style="font-size: 13px; color: #6b7280; margin-top: 2px;">${escapeHtml(job.company)}</div>
                </td>
                <td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6; text-align: center; width: 80px;">
                    <span style="display: inline-block; background: ${job.score >= 80 ? "#dcfce7" : job.score >= 60 ? "#fef9c3" : "#fee2e2"}; color: ${job.score >= 80 ? "#166534" : job.score >= 60 ? "#854d0e" : "#991b1b"}; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 700;">
                        ${job.score}%
                    </span>
                </td>
                <td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6; text-align: center; width: 80px;">
                    ${job.applicationId
                        ? `<a href="${APP_URL}/documents/${job.applicationId}" style="color: #2563eb; font-size: 13px; text-decoration: none; font-weight: 500;">View →</a>`
                        : `<span style="color: #9ca3af; font-size: 13px;">Pending</span>`
                    }
                </td>
            </tr>`
        )
        .join("");

    const content = `
        <h2 style="margin: 0 0 8px; font-size: 22px; color: #111827;">New Job Matches Found! 🎯</h2>
        <p style="margin: 0 0 24px; font-size: 15px; color: #374151; line-height: 1.6;">
            Hi ${escapeHtml(name)}, we found <strong>${jobs.length} new job${jobs.length > 1 ? "s" : ""}</strong> matching your profile.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <tr style="background: #f9fafb;">
                <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Position</td>
                <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; text-align: center; letter-spacing: 0.5px;">Match</td>
                <td style="padding: 10px 16px; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; text-align: center; letter-spacing: 0.5px;">Action</td>
            </tr>
            ${jobRows}
        </table>
        ${jobs.length > 10 ? `<p style="margin: 12px 0 0; font-size: 13px; color: #6b7280; text-align: center;">...and ${jobs.length - 10} more</p>` : ""}
        <div style="text-align: center; margin: 28px 0 8px;">
            <a href="${APP_URL}/jobs" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                View All Jobs →
            </a>
        </div>
    `;

    try {
        const resend = getResend();
        await resend.emails.send({
            from: FROM_EMAIL_JOBS,
            replyTo: REPLY_TO_JOBS,
            to: [to],
            subject: `${jobs.length} new job match${jobs.length > 1 ? "es" : ""} found — AutoApply AI`,
            html: emailWrapper(content),
        });
    } catch (error) {
        console.error("Failed to send job match email:", error);
    }
}

// ─── Tailoring Complete Notification ────────────────────────

export async function sendTailoringCompleteEmail(
    to: string,
    name: string,
    jobTitle: string,
    company: string,
    score: number,
    applicationId: string
): Promise<void> {
    const content = `
        <h2 style="margin: 0 0 8px; font-size: 22px; color: #111827;">Your Tailored Documents Are Ready! 📄</h2>
        <p style="margin: 0 0 24px; font-size: 15px; color: #374151; line-height: 1.6;">
            Hi ${escapeHtml(name)}, your AI-tailored CV and cover letter for the following position are ready to download:
        </p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
            <div style="font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 4px;">${escapeHtml(jobTitle)}</div>
            <div style="font-size: 14px; color: #6b7280; margin-bottom: 12px;">${escapeHtml(company)}</div>
            <div style="display: flex; gap: 12px; align-items: center;">
                <span style="display: inline-block; background: ${score >= 80 ? "#dcfce7" : score >= 60 ? "#fef9c3" : "#fee2e2"}; color: ${score >= 80 ? "#166534" : score >= 60 ? "#854d0e" : "#991b1b"}; padding: 6px 14px; border-radius: 16px; font-size: 14px; font-weight: 700;">
                    ${score}% match
                </span>
            </div>
        </div>
        <p style="margin: 0 0 8px; font-size: 14px; color: #374151;">Your documents include:</p>
        <ul style="margin: 0 0 24px; padding-left: 20px; color: #374151; font-size: 14px; line-height: 1.8;">
            <li>ATS-optimized tailored CV with relevant keywords</li>
            <li>Personalized cover letter (250-350 words)</li>
            <li>Compatibility analysis with strengths and gaps</li>
        </ul>
        <div style="text-align: center; margin: 28px 0 8px;">
            <a href="${APP_URL}/documents/${applicationId}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                View & Download Documents →
            </a>
        </div>
        <p style="margin: 16px 0 0; font-size: 13px; color: #9ca3af; text-align: center;">
            Remember: We never fabricate experience or skills. All content comes directly from your master CV.
        </p>
    `;

    try {
        const resend = getResend();
        await resend.emails.send({
            from: FROM_EMAIL_JOBS,
            replyTo: REPLY_TO_JOBS,
            to: [to],
            subject: `Tailored CV ready: ${jobTitle} at ${company} — AutoApply AI`,
            html: emailWrapper(content),
        });
    } catch (error) {
        console.error("Failed to send tailoring complete email:", error);
    }
}

// ─── Weekly Digest Email ────────────────────────────────────

interface DigestStats {
    newJobsCount: number;
    tailoredCount: number;
    appliedCount: number;
    avgScore: number;
    topJobs: MatchedJob[];
}

export async function sendWeeklyDigestEmail(
    to: string,
    name: string,
    stats: DigestStats
): Promise<void> {
    const topJobRows = stats.topJobs
        .slice(0, 5)
        .map(
            (job) => `
            <tr>
                <td style="padding: 10px 16px; border-bottom: 1px solid #f3f4f6;">
                    <div style="font-size: 14px; font-weight: 600; color: #111827;">${escapeHtml(job.title)}</div>
                    <div style="font-size: 12px; color: #6b7280;">${escapeHtml(job.company)}</div>
                </td>
                <td style="padding: 10px 16px; border-bottom: 1px solid #f3f4f6; text-align: center; width: 70px;">
                    <span style="font-weight: 700; color: ${job.score >= 80 ? "#166534" : "#854d0e"};">${job.score}%</span>
                </td>
            </tr>`
        )
        .join("");

    const content = `
        <h2 style="margin: 0 0 8px; font-size: 22px; color: #111827;">Your Weekly Job Search Report 📊</h2>
        <p style="margin: 0 0 24px; font-size: 15px; color: #374151; line-height: 1.6;">
            Hi ${escapeHtml(name)}, here's a summary of your job search activity this week:
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
            <tr>
                <td style="padding: 16px; text-align: center; background: #eff6ff; border-radius: 8px 0 0 8px; width: 25%;">
                    <div style="font-size: 28px; font-weight: 700; color: #2563eb;">${stats.newJobsCount}</div>
                    <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Jobs Found</div>
                </td>
                <td style="padding: 16px; text-align: center; background: #f0fdf4; width: 25%;">
                    <div style="font-size: 28px; font-weight: 700; color: #16a34a;">${stats.tailoredCount}</div>
                    <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">CVs Tailored</div>
                </td>
                <td style="padding: 16px; text-align: center; background: #fefce8; width: 25%;">
                    <div style="font-size: 28px; font-weight: 700; color: #ca8a04;">${stats.appliedCount}</div>
                    <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Applied</div>
                </td>
                <td style="padding: 16px; text-align: center; background: #faf5ff; border-radius: 0 8px 8px 0; width: 25%;">
                    <div style="font-size: 28px; font-weight: 700; color: #9333ea;">${stats.avgScore}%</div>
                    <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px;">Avg Match</div>
                </td>
            </tr>
        </table>
        ${stats.topJobs.length > 0 ? `
        <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #374151;">Top Matches This Week:</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin: 0 0 24px;">
            ${topJobRows}
        </table>
        ` : ""}
        <div style="text-align: center; margin: 24px 0 8px;">
            <a href="${APP_URL}/dashboard" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                View Dashboard →
            </a>
        </div>
    `;

    try {
        const resend = getResend();
        await resend.emails.send({
            from: FROM_EMAIL_JOBS,
            replyTo: REPLY_TO_JOBS,
            to: [to],
            subject: `Weekly report: ${stats.newJobsCount} jobs found, ${stats.tailoredCount} CVs tailored — AutoApply AI`,
            html: emailWrapper(content),
        });
    } catch (error) {
        console.error("Failed to send weekly digest email:", error);
    }
}

// ─── Credits Low Notification ───────────────────────────────

export async function sendCreditsLowEmail(
    to: string,
    name: string,
    creditsRemaining: number
): Promise<void> {
    const content = `
        <h2 style="margin: 0 0 8px; font-size: 22px; color: #111827;">Credits Running Low ⚠️</h2>
        <p style="margin: 0 0 16px; font-size: 15px; color: #374151; line-height: 1.6;">
            Hi ${escapeHtml(name)}, you have <strong>${creditsRemaining} credit${creditsRemaining !== 1 ? "s" : ""}</strong> remaining for tailored documents this month.
        </p>
        <p style="margin: 0 0 24px; font-size: 14px; color: #6b7280; line-height: 1.6;">
            Each credit lets you generate an ATS-optimized CV and cover letter for one job. Top up your credits or upgrade your plan to keep your job search going.
        </p>
        <div style="text-align: center; margin: 24px 0 12px;">
            <a href="${APP_URL}/settings" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-right: 8px;">
                Upgrade Plan →
            </a>
        </div>
        <p style="margin: 12px 0 0; font-size: 13px; color: #9ca3af; text-align: center;">
            Or buy a 10-credit pack for $19 — no subscription needed.
        </p>
    `;

    try {
        const resend = getResend();
        await resend.emails.send({
            from: FROM_EMAIL_ALERTS,
            replyTo: REPLY_TO_SUPPORT,
            to: [to],
            subject: `${creditsRemaining} credit${creditsRemaining !== 1 ? "s" : ""} remaining — AutoApply AI`,
            html: emailWrapper(content),
        });
    } catch (error) {
        console.error("Failed to send credits low email:", error);
    }
}

// ─── Utility ────────────────────────────────────────────────

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
