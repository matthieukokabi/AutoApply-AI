export type ContactAbuseReason =
    | "honeypot"
    | "invalid_form_session"
    | "invalid_form_timing"
    | "form_too_fast"
    | "form_expired"
    | "missing_turnstile_token"
    | "turnstile_failed"
    | "ip_rate_limited"
    | "session_rate_limited"
    | "missing_required_fields"
    | "invalid_email"
    | "message_too_long";

export type CaptchaOutcome = "solve" | "fail" | "error";

const contactAbuseCounters = new Map<ContactAbuseReason, number>();
const captchaOutcomeCounters = new Map<CaptchaOutcome, number>([
    ["solve", 0],
    ["fail", 0],
    ["error", 0],
]);
const captchaErrorCodeCounters = new Map<string, number>();

function getMapTotal<T>(map: Map<T, number>): number {
    return Array.from(map.values()).reduce((sum, count) => sum + count, 0);
}

function recordCaptchaErrorCodes(errorCodes: string[]) {
    for (const code of errorCodes) {
        if (!code || typeof code !== "string") {
            continue;
        }

        const normalizedCode = code.trim();
        if (!normalizedCode) {
            continue;
        }

        const nextCount = (captchaErrorCodeCounters.get(normalizedCode) || 0) + 1;
        captchaErrorCodeCounters.set(normalizedCode, nextCount);
    }
}

export function incrementAbuseCounter(reason: ContactAbuseReason) {
    const nextCount = (contactAbuseCounters.get(reason) || 0) + 1;
    contactAbuseCounters.set(reason, nextCount);

    if (nextCount === 1 || nextCount % 25 === 0) {
        console.warn("[contact-abuse] blocked request", {
            reason,
            reasonCount: nextCount,
            totalBlocked: getMapTotal(contactAbuseCounters),
        });
    }
}

export function incrementCaptchaCounter(
    outcome: CaptchaOutcome,
    errorCodes: string[] = []
) {
    const nextCount = (captchaOutcomeCounters.get(outcome) || 0) + 1;
    captchaOutcomeCounters.set(outcome, nextCount);
    recordCaptchaErrorCodes(errorCodes);

    if (nextCount === 1 || nextCount % 25 === 0) {
        console.info("[contact-captcha] verification outcome", {
            outcome,
            outcomeCount: nextCount,
            errorCodes,
            totals: {
                solve: captchaOutcomeCounters.get("solve") || 0,
                fail: captchaOutcomeCounters.get("fail") || 0,
                error: captchaOutcomeCounters.get("error") || 0,
            },
        });
    }
}

export function getContactTelemetrySnapshot() {
    const captchaSolve = captchaOutcomeCounters.get("solve") || 0;
    const captchaFail = captchaOutcomeCounters.get("fail") || 0;
    const captchaError = captchaOutcomeCounters.get("error") || 0;
    const captchaAttempts = captchaSolve + captchaFail + captchaError;
    const captchaSuccessRate =
        captchaAttempts > 0 ? Number((captchaSolve / captchaAttempts).toFixed(4)) : 0;

    const blockedByReason = Object.fromEntries(
        Array.from(contactAbuseCounters.entries()).sort(([a], [b]) =>
            a.localeCompare(b)
        )
    );
    const captchaErrorCodes = Object.fromEntries(
        Array.from(captchaErrorCodeCounters.entries()).sort(([a], [b]) =>
            a.localeCompare(b)
        )
    );

    return {
        generatedAt: new Date().toISOString(),
        blocked: {
            total: getMapTotal(contactAbuseCounters),
            byReason: blockedByReason,
        },
        captcha: {
            solve: captchaSolve,
            fail: captchaFail,
            error: captchaError,
            attempts: captchaAttempts,
            successRate: captchaSuccessRate,
            errorCodes: captchaErrorCodes,
        },
    };
}

export function resetContactTelemetryForTests() {
    contactAbuseCounters.clear();
    captchaErrorCodeCounters.clear();
    captchaOutcomeCounters.set("solve", 0);
    captchaOutcomeCounters.set("fail", 0);
    captchaOutcomeCounters.set("error", 0);
}
