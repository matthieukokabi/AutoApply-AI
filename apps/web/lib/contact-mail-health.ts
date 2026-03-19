export const OFFICIAL_CONTACT_EMAIL = "contact@autoapply.works";
export const OFFICIAL_X_URL = "https://x.com/AutoApplyWorks";
export const OFFICIAL_LINKEDIN_URL =
    "https://www.linkedin.com/company/autoapply-works/";

const MAX_RECENT_ATTEMPTS = 25;

export type ContactMailReasonCode =
    | "mail_sent"
    | "missing_resend_api_key"
    | "resend_send_failed"
    | "queued_for_manual_followup"
    | "fallback_queue_failed";

type ContactMailAttempt = {
    at: string;
    outcome: "sent" | "queued" | "failed";
    transport: "resend" | "fallback_queue";
    reasonCode: ContactMailReasonCode;
    statusCode: number | null;
};

type ContactMailState = {
    recentAttempts: ContactMailAttempt[];
    lastDelivery: {
        destinationEmail: string;
        fromEmail: string;
        replyToEmail: string | null;
    } | null;
    sent: number;
    queued: number;
    failed: number;
    lastSentAt: string | null;
    lastQueuedAt: string | null;
    lastFailedAt: string | null;
};

const contactMailState: ContactMailState = {
    recentAttempts: [],
    lastDelivery: null,
    sent: 0,
    queued: 0,
    failed: 0,
    lastSentAt: null,
    lastQueuedAt: null,
    lastFailedAt: null,
};

function normalizeEmail(value: string) {
    return value.trim().toLowerCase();
}

export function getContactDestinationEmail() {
    const configured = process.env.CONTACT_INBOX_EMAIL?.trim();
    if (configured) {
        return normalizeEmail(configured);
    }

    return OFFICIAL_CONTACT_EMAIL;
}

export function getContactFromEmail() {
    const configured = process.env.CONTACT_FROM_EMAIL?.trim();
    if (configured) {
        return configured;
    }

    return `AutoApply Works <${OFFICIAL_CONTACT_EMAIL}>`;
}

export function getContactMailConfigSnapshot() {
    const missingEnv: string[] = [];
    const resendApiKey = process.env.RESEND_API_KEY?.trim();

    if (!resendApiKey) {
        missingEnv.push("RESEND_API_KEY");
    }

    return {
        destinationEmail: getContactDestinationEmail(),
        fromEmail: getContactFromEmail(),
        replyToPolicy: "submitter_email",
        transportConfigured: missingEnv.length === 0,
        missingEnv,
    };
}

export function recordContactMailAttempt(input: {
    outcome: "sent" | "queued" | "failed";
    transport: "resend" | "fallback_queue";
    reasonCode: ContactMailReasonCode;
    statusCode?: number | null;
    delivery?: {
        destinationEmail: string;
        fromEmail: string;
        replyToEmail: string | null;
    };
}) {
    const now = new Date().toISOString();
    const statusCode =
        typeof input.statusCode === "number" ? input.statusCode : null;
    const attempt: ContactMailAttempt = {
        at: now,
        outcome: input.outcome,
        transport: input.transport,
        reasonCode: input.reasonCode,
        statusCode,
    };

    contactMailState.recentAttempts.push(attempt);
    if (contactMailState.recentAttempts.length > MAX_RECENT_ATTEMPTS) {
        contactMailState.recentAttempts.splice(
            0,
            contactMailState.recentAttempts.length - MAX_RECENT_ATTEMPTS
        );
    }

    if (input.delivery) {
        contactMailState.lastDelivery = {
            destinationEmail: input.delivery.destinationEmail,
            fromEmail: input.delivery.fromEmail,
            replyToEmail: input.delivery.replyToEmail,
        };
    }

    if (input.outcome === "sent") {
        contactMailState.sent += 1;
        contactMailState.lastSentAt = now;
        return;
    }

    if (input.outcome === "queued") {
        contactMailState.queued += 1;
        contactMailState.lastQueuedAt = now;
        return;
    }

    contactMailState.failed += 1;
    contactMailState.lastFailedAt = now;
}

export function getContactMailHealthSnapshot() {
    return {
        config: getContactMailConfigSnapshot(),
        recent: {
            totals: {
                sent: contactMailState.sent,
                queued: contactMailState.queued,
                failed: contactMailState.failed,
            },
            lastSentAt: contactMailState.lastSentAt,
            lastQueuedAt: contactMailState.lastQueuedAt,
            lastFailedAt: contactMailState.lastFailedAt,
            lastDelivery: contactMailState.lastDelivery,
            attempts: [...contactMailState.recentAttempts],
        },
    };
}

export function resetContactMailHealthForTests() {
    contactMailState.recentAttempts.splice(0, contactMailState.recentAttempts.length);
    contactMailState.lastDelivery = null;
    contactMailState.sent = 0;
    contactMailState.queued = 0;
    contactMailState.failed = 0;
    contactMailState.lastSentAt = null;
    contactMailState.lastQueuedAt = null;
    contactMailState.lastFailedAt = null;
}
