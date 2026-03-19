import {
    OFFICIAL_CONTACT_EMAIL,
    OFFICIAL_LINKEDIN_URL,
    OFFICIAL_X_URL,
} from "@/lib/brand-identity";

export { OFFICIAL_CONTACT_EMAIL, OFFICIAL_LINKEDIN_URL, OFFICIAL_X_URL };

const MAX_RECENT_ATTEMPTS = 25;

export type ContactMailTransportKind = "smtp" | "resend" | "none";

export type ContactMailReasonCode =
    | "mail_sent"
    | "missing_mail_transport"
    | "smtp_send_failed"
    | "resend_send_failed"
    | "queued_for_manual_followup"
    | "fallback_queue_failed";

type ContactMailAttempt = {
    at: string;
    outcome: "sent" | "queued" | "failed";
    transport: "smtp" | "resend" | "fallback_queue" | "none";
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

type ContactSmtpTransportConfig = {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
};

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

function normalizeSmtpPort(value: string | undefined) {
    if (!value) {
        return 465;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeSmtpSecure(value: string | undefined, port: number) {
    if (!value) {
        return port === 465;
    }

    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
}

export function getContactSmtpTransportConfig():
    | {
          configured: true;
          missingEnv: [];
          config: ContactSmtpTransportConfig;
      }
    | {
          configured: false;
          missingEnv: string[];
          config: null;
      } {
    const missingEnv: string[] = [];
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    const portValue = process.env.SMTP_PORT?.trim();
    const port = normalizeSmtpPort(portValue);

    if (!host) {
        missingEnv.push("SMTP_HOST");
    }
    if (!user) {
        missingEnv.push("SMTP_USER");
    }
    if (!pass) {
        missingEnv.push("SMTP_PASS");
    }
    if (port === null) {
        missingEnv.push("SMTP_PORT");
    }

    if (missingEnv.length > 0 || port === null || !host || !user || !pass) {
        return {
            configured: false,
            missingEnv,
            config: null,
        };
    }

    return {
        configured: true,
        missingEnv: [],
        config: {
            host,
            port,
            secure: normalizeSmtpSecure(process.env.SMTP_SECURE, port),
            user,
            pass,
        },
    };
}

export function getContactMailConfigSnapshot() {
    const smtp = getContactSmtpTransportConfig();
    const resendApiKey = process.env.RESEND_API_KEY?.trim() || "";
    const resendConfigured = Boolean(resendApiKey);

    if (smtp.configured) {
        return {
            destinationEmail: getContactDestinationEmail(),
            fromEmail: getContactFromEmail(),
            replyToPolicy: "submitter_email",
            transport: "smtp" as ContactMailTransportKind,
            transportConfigured: true,
            missingEnv: [] as string[],
            smtp: {
                configured: true,
                missingEnv: [] as string[],
                host: smtp.config.host,
                port: smtp.config.port,
                secure: smtp.config.secure,
            },
            resend: {
                configured: resendConfigured,
                missingEnv: resendConfigured ? [] : ["RESEND_API_KEY"],
            },
        };
    }

    if (resendConfigured) {
        return {
            destinationEmail: getContactDestinationEmail(),
            fromEmail: getContactFromEmail(),
            replyToPolicy: "submitter_email",
            transport: "resend" as ContactMailTransportKind,
            transportConfigured: true,
            missingEnv: [] as string[],
            smtp: {
                configured: false,
                missingEnv: smtp.missingEnv,
                host: null,
                port: null,
                secure: null,
            },
            resend: {
                configured: true,
                missingEnv: [] as string[],
            },
        };
    }

    const missingEnv = Array.from(new Set([...smtp.missingEnv, "RESEND_API_KEY"]));
    return {
        destinationEmail: getContactDestinationEmail(),
        fromEmail: getContactFromEmail(),
        replyToPolicy: "submitter_email",
        transport: "none" as ContactMailTransportKind,
        transportConfigured: missingEnv.length === 0,
        missingEnv,
        smtp: {
            configured: false,
            missingEnv: smtp.missingEnv,
            host: null,
            port: null,
            secure: null,
        },
        resend: {
            configured: false,
            missingEnv: ["RESEND_API_KEY"],
        },
    };
}

export function recordContactMailAttempt(input: {
    outcome: "sent" | "queued" | "failed";
    transport: "smtp" | "resend" | "fallback_queue" | "none";
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
