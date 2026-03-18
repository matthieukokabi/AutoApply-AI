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
export type ContactFunnelEvent =
    | "page_view"
    | "cta_click"
    | "form_start"
    | "captcha_pass"
    | "captcha_fail"
    | "submit_success"
    | "submit_fail";

type FunnelAnomaly = {
    id: "completion_drop" | "captcha_fail_spike";
    severity: "warning";
    message: string;
    value: number;
    threshold: number;
};

const contactAbuseCounters = new Map<ContactAbuseReason, number>();
const captchaOutcomeCounters = new Map<CaptchaOutcome, number>([
    ["solve", 0],
    ["fail", 0],
    ["error", 0],
]);
const captchaErrorCodeCounters = new Map<string, number>();
const contactFunnelCounters = new Map<ContactFunnelEvent, number>([
    ["page_view", 0],
    ["cta_click", 0],
    ["form_start", 0],
    ["captcha_pass", 0],
    ["captcha_fail", 0],
    ["submit_success", 0],
    ["submit_fail", 0],
]);
const funnelEventHistory: Array<{
    event: ContactFunnelEvent;
    timestamp: number;
}> = [];

const CONTACT_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const CONTACT_COMPLETION_DROP_MIN_FORM_STARTS = 10;
const CONTACT_COMPLETION_DROP_THRESHOLD = 0.2;
const CONTACT_CAPTCHA_FAIL_SPIKE_MIN_ATTEMPTS = 10;
const CONTACT_CAPTCHA_FAIL_SPIKE_THRESHOLD = 0.6;
const CONTACT_FUNNEL_HISTORY_LIMIT = 5000;

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

function buildFunnelCountersObject(
    source: Map<ContactFunnelEvent, number>
): Record<ContactFunnelEvent, number> {
    return Object.fromEntries(
        Array.from(source.entries()).sort(([a], [b]) => a.localeCompare(b))
    ) as Record<ContactFunnelEvent, number>;
}

function buildFunnelSummary(counters: Record<ContactFunnelEvent, number>) {
    const pageViews = counters.page_view || 0;
    const ctaClicks = counters.cta_click || 0;
    const formStarts = counters.form_start || 0;
    const captchaPass = counters.captcha_pass || 0;
    const captchaFail = counters.captcha_fail || 0;
    const submitSuccess = counters.submit_success || 0;
    const submitFail = counters.submit_fail || 0;
    const captchaAttempts = captchaPass + captchaFail;
    const completionRateFromPageView =
        pageViews > 0 ? Number((submitSuccess / pageViews).toFixed(4)) : 0;
    const completionRateFromFormStart =
        formStarts > 0 ? Number((submitSuccess / formStarts).toFixed(4)) : 0;
    const ctaToSubmitRate =
        ctaClicks > 0 ? Number((submitSuccess / ctaClicks).toFixed(4)) : 0;
    const captchaFailRate =
        captchaAttempts > 0 ? Number((captchaFail / captchaAttempts).toFixed(4)) : 0;

    const anomalies: FunnelAnomaly[] = [];
    if (
        formStarts >= CONTACT_COMPLETION_DROP_MIN_FORM_STARTS &&
        completionRateFromFormStart < CONTACT_COMPLETION_DROP_THRESHOLD
    ) {
        anomalies.push({
            id: "completion_drop",
            severity: "warning",
            message:
                "Completion drop detected: submit success rate from form starts is below threshold.",
            value: completionRateFromFormStart,
            threshold: CONTACT_COMPLETION_DROP_THRESHOLD,
        });
    }

    if (
        captchaAttempts >= CONTACT_CAPTCHA_FAIL_SPIKE_MIN_ATTEMPTS &&
        captchaFailRate > CONTACT_CAPTCHA_FAIL_SPIKE_THRESHOLD
    ) {
        anomalies.push({
            id: "captcha_fail_spike",
            severity: "warning",
            message:
                "CAPTCHA fail spike detected: fail rate exceeded daily threshold.",
            value: captchaFailRate,
            threshold: CONTACT_CAPTCHA_FAIL_SPIKE_THRESHOLD,
        });
    }

    return {
        pageViews,
        ctaClicks,
        formStarts,
        captchaPass,
        captchaFail,
        submitSuccess,
        submitFail,
        completionRateFromPageView,
        completionRateFromFormStart,
        ctaToSubmitRate,
        captchaFailRate,
        anomalies,
    };
}

function getFunnelCountersInWindow(windowMs: number, now = Date.now()) {
    const windowStart = now - windowMs;
    const counters = new Map<ContactFunnelEvent, number>(contactFunnelCounters.entries());
    for (const key of Array.from(counters.keys())) {
        counters.set(key, 0);
    }

    for (const item of funnelEventHistory) {
        if (item.timestamp < windowStart) {
            continue;
        }
        counters.set(item.event, (counters.get(item.event) || 0) + 1);
    }

    return buildFunnelCountersObject(counters);
}

export function getContactFunnelDailySummary(now = Date.now()) {
    const dailyCounters = getFunnelCountersInWindow(CONTACT_DAILY_WINDOW_MS, now);
    return {
        windowHours: 24,
        events: dailyCounters,
        summary: buildFunnelSummary(dailyCounters),
    };
}

export function incrementFunnelEvent(event: ContactFunnelEvent) {
    const nextCount = (contactFunnelCounters.get(event) || 0) + 1;
    contactFunnelCounters.set(event, nextCount);
    funnelEventHistory.push({ event, timestamp: Date.now() });

    if (funnelEventHistory.length > CONTACT_FUNNEL_HISTORY_LIMIT) {
        funnelEventHistory.splice(0, funnelEventHistory.length - CONTACT_FUNNEL_HISTORY_LIMIT);
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
    incrementFunnelEvent(outcome === "solve" ? "captcha_pass" : "captcha_fail");

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
    const funnelLifetimeEvents = buildFunnelCountersObject(contactFunnelCounters);
    const funnelLifetimeSummary = buildFunnelSummary(funnelLifetimeEvents);
    const funnelDaily = getContactFunnelDailySummary();

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
        funnel: {
            lifetime: {
                events: funnelLifetimeEvents,
                summary: funnelLifetimeSummary,
            },
            daily: funnelDaily,
        },
    };
}

export function resetContactTelemetryForTests() {
    contactAbuseCounters.clear();
    captchaErrorCodeCounters.clear();
    captchaOutcomeCounters.set("solve", 0);
    captchaOutcomeCounters.set("fail", 0);
    captchaOutcomeCounters.set("error", 0);
    for (const key of Array.from(contactFunnelCounters.keys())) {
        contactFunnelCounters.set(key, 0);
    }
    funnelEventHistory.splice(0, funnelEventHistory.length);
}
