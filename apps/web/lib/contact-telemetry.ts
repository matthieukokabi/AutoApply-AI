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

export type ContactFunnelEventContext = {
    routePath?: string | null;
    campaign?: string | null;
};

type FunnelAnomaly = {
    id: "completion_drop" | "captcha_fail_spike";
    severity: "warning";
    message: string;
    value: number;
    threshold: number;
};

type FunnelTrendAnomaly = {
    id: "weekly_completion_drop" | "weekly_captcha_fail_spike";
    severity: "warning";
    message: string;
    value: number;
    baseline: number;
};

type FunnelHistoryEntry = {
    event: ContactFunnelEvent;
    timestamp: number;
    routePath: string;
    campaign: string;
};

type SegmentSummary = {
    segment: string;
    events: Record<ContactFunnelEvent, number>;
    summary: ReturnType<typeof buildFunnelSummary>;
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
const funnelByRouteCounters = new Map<string, Map<ContactFunnelEvent, number>>();
const funnelByCampaignCounters = new Map<string, Map<ContactFunnelEvent, number>>();
const funnelEventHistory: FunnelHistoryEntry[] = [];

const CONTACT_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const CONTACT_DAY_MS = 24 * 60 * 60 * 1000;
const CONTACT_WEEKLY_DAYS = 7;
const CONTACT_COMPLETION_DROP_MIN_FORM_STARTS = 10;
const CONTACT_COMPLETION_DROP_THRESHOLD = 0.2;
const CONTACT_CAPTCHA_FAIL_SPIKE_MIN_ATTEMPTS = 10;
const CONTACT_CAPTCHA_FAIL_SPIKE_THRESHOLD = 0.6;
const CONTACT_WEEKLY_MIN_HISTORY_DAYS = 3;
const CONTACT_WEEKLY_COMPLETION_DROP_DELTA = 0.2;
const CONTACT_WEEKLY_CAPTCHA_FAIL_SPIKE_DELTA = 0.2;
const CONTACT_FUNNEL_HISTORY_LIMIT = 5000;
const CONTACT_SEGMENT_LIMIT = 100;
const CONTACT_SEGMENT_OTHER = "__other__";
const CONTACT_SEGMENT_UNKNOWN = "unknown";

function createZeroedFunnelCounterMap() {
    return new Map<ContactFunnelEvent, number>([
        ["page_view", 0],
        ["cta_click", 0],
        ["form_start", 0],
        ["captcha_pass", 0],
        ["captcha_fail", 0],
        ["submit_success", 0],
        ["submit_fail", 0],
    ]);
}

function getMapTotal<T>(map: Map<T, number>): number {
    return Array.from(map.values()).reduce((sum, count) => sum + count, 0);
}

function toAverage(values: number[]) {
    if (values.length === 0) {
        return 0;
    }

    return Number(
        (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4)
    );
}

function normalizeRoutePath(value: string | null | undefined) {
    if (typeof value !== "string") {
        return CONTACT_SEGMENT_UNKNOWN;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return CONTACT_SEGMENT_UNKNOWN;
    }

    const rawPath = trimmed.split("?")[0]?.split("#")[0] || "";
    const normalized = rawPath
        .replace(/[^a-zA-Z0-9/_-]/g, "-")
        .replace(/\/{2,}/g, "/")
        .slice(0, 120);

    if (!normalized) {
        return CONTACT_SEGMENT_UNKNOWN;
    }

    return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function normalizeCampaign(value: string | null | undefined) {
    if (typeof value !== "string") {
        return CONTACT_SEGMENT_UNKNOWN;
    }

    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
        return CONTACT_SEGMENT_UNKNOWN;
    }

    const normalized = trimmed.replace(/[^a-z0-9._-]/g, "-").slice(0, 80);
    return normalized || CONTACT_SEGMENT_UNKNOWN;
}

function getSegmentBucket(
    source: Map<string, Map<ContactFunnelEvent, number>>,
    segmentValue: string
) {
    if (source.has(segmentValue)) {
        return segmentValue;
    }

    if (source.size < CONTACT_SEGMENT_LIMIT) {
        return segmentValue;
    }

    return CONTACT_SEGMENT_OTHER;
}

function incrementSegmentEvent(
    source: Map<string, Map<ContactFunnelEvent, number>>,
    segmentValue: string,
    event: ContactFunnelEvent
) {
    const segmentBucket = getSegmentBucket(source, segmentValue);
    const segmentCounters = source.get(segmentBucket) || createZeroedFunnelCounterMap();
    segmentCounters.set(event, (segmentCounters.get(event) || 0) + 1);
    source.set(segmentBucket, segmentCounters);
}

function sortSegmentSummaries(a: SegmentSummary, b: SegmentSummary) {
    const submitDelta = b.summary.submitSuccess - a.summary.submitSuccess;
    if (submitDelta !== 0) {
        return submitDelta;
    }

    const formStartDelta = b.summary.formStarts - a.summary.formStarts;
    if (formStartDelta !== 0) {
        return formStartDelta;
    }

    const pageViewDelta = b.summary.pageViews - a.summary.pageViews;
    if (pageViewDelta !== 0) {
        return pageViewDelta;
    }

    return a.segment.localeCompare(b.segment);
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

function buildDropOffAttribution(counters: Record<ContactFunnelEvent, number>) {
    const stages: Array<{
        from: ContactFunnelEvent;
        to: ContactFunnelEvent;
        label: string;
    }> = [
        {
            from: "page_view",
            to: "cta_click",
            label: "page_view_to_cta_click",
        },
        {
            from: "cta_click",
            to: "form_start",
            label: "cta_click_to_form_start",
        },
        {
            from: "form_start",
            to: "captcha_pass",
            label: "form_start_to_captcha_pass",
        },
        {
            from: "captcha_pass",
            to: "submit_success",
            label: "captcha_pass_to_submit_success",
        },
    ];

    return stages.map(({ from, to, label }) => {
        const fromCount = counters[from] || 0;
        const toCount = counters[to] || 0;
        const dropOffCount = Math.max(fromCount - toCount, 0);
        const dropOffRate =
            fromCount > 0 ? Number((dropOffCount / fromCount).toFixed(4)) : 0;

        return {
            stage: label,
            from,
            to,
            fromCount,
            toCount,
            dropOffCount,
            dropOffRate,
        };
    });
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
        dropOffAttribution: buildDropOffAttribution(counters),
        anomalies,
    };
}

function buildSegmentSummary(
    source: Map<string, Map<ContactFunnelEvent, number>>,
    limit = 20
) {
    return Array.from(source.entries())
        .map(([segment, counters]) => {
            const events = buildFunnelCountersObject(counters);
            return {
                segment,
                events,
                summary: buildFunnelSummary(events),
            };
        })
        .sort(sortSegmentSummaries)
        .slice(0, limit);
}

function getFunnelCountersInWindow(
    windowMs: number,
    now = Date.now(),
    filters?: {
        routePath?: string;
        campaign?: string;
    }
) {
    const windowStart = now - windowMs;
    const counters = createZeroedFunnelCounterMap();
    const normalizedRouteFilter =
        typeof filters?.routePath === "string"
            ? normalizeRoutePath(filters.routePath)
            : null;
    const normalizedCampaignFilter =
        typeof filters?.campaign === "string"
            ? normalizeCampaign(filters.campaign)
            : null;

    for (const item of funnelEventHistory) {
        if (item.timestamp < windowStart) {
            continue;
        }
        if (normalizedRouteFilter && item.routePath !== normalizedRouteFilter) {
            continue;
        }
        if (normalizedCampaignFilter && item.campaign !== normalizedCampaignFilter) {
            continue;
        }
        counters.set(item.event, (counters.get(item.event) || 0) + 1);
    }

    return buildFunnelCountersObject(counters);
}

function getSegmentedCountersInWindow(windowMs: number, now = Date.now()) {
    const windowStart = now - windowMs;
    const routeCounters = new Map<string, Map<ContactFunnelEvent, number>>();
    const campaignCounters = new Map<string, Map<ContactFunnelEvent, number>>();

    for (const item of funnelEventHistory) {
        if (item.timestamp < windowStart) {
            continue;
        }

        incrementSegmentEvent(routeCounters, item.routePath, item.event);
        incrementSegmentEvent(campaignCounters, item.campaign, item.event);
    }

    return {
        byRoute: buildSegmentSummary(routeCounters),
        byCampaign: buildSegmentSummary(campaignCounters),
    };
}

export function getContactFunnelDailySummary(now = Date.now()) {
    const dailyCounters = getFunnelCountersInWindow(CONTACT_DAILY_WINDOW_MS, now);
    const segmentedDailyCounters = getSegmentedCountersInWindow(
        CONTACT_DAILY_WINDOW_MS,
        now
    );
    return {
        windowHours: 24,
        events: dailyCounters,
        summary: buildFunnelSummary(dailyCounters),
        segmentation: segmentedDailyCounters,
    };
}

function getStartOfUtcDay(timestamp: number) {
    const date = new Date(timestamp);
    return Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        0,
        0,
        0,
        0
    );
}

export function getContactFunnelWeeklyTrend(now = Date.now()) {
    const currentDayStart = getStartOfUtcDay(now);
    const daySummaries = [];

    for (let offset = CONTACT_WEEKLY_DAYS - 1; offset >= 0; offset -= 1) {
        const dayStart = currentDayStart - offset * CONTACT_DAY_MS;
        const dayEnd = dayStart + CONTACT_DAY_MS;
        const dayWindowMs = now - dayStart;
        const counters = getFunnelCountersInWindow(dayWindowMs, now);
        const priorCounters = getFunnelCountersInWindow(Math.max(now - dayEnd, 0), now);
        const dayEvents = {
            page_view: Math.max(counters.page_view - priorCounters.page_view, 0),
            cta_click: Math.max(counters.cta_click - priorCounters.cta_click, 0),
            form_start: Math.max(counters.form_start - priorCounters.form_start, 0),
            captcha_pass: Math.max(counters.captcha_pass - priorCounters.captcha_pass, 0),
            captcha_fail: Math.max(counters.captcha_fail - priorCounters.captcha_fail, 0),
            submit_success: Math.max(
                counters.submit_success - priorCounters.submit_success,
                0
            ),
            submit_fail: Math.max(counters.submit_fail - priorCounters.submit_fail, 0),
        };

        daySummaries.push({
            date: new Date(dayStart).toISOString().slice(0, 10),
            events: dayEvents,
            summary: buildFunnelSummary(dayEvents),
        });
    }

    const latestDay = daySummaries[daySummaries.length - 1];
    const previousDays = daySummaries.slice(0, -1);

    const completionHistory = previousDays
        .filter((day) => day.summary.formStarts > 0)
        .map((day) => day.summary.completionRateFromFormStart);
    const captchaFailHistory = previousDays
        .filter((day) => day.summary.captchaPass + day.summary.captchaFail > 0)
        .map((day) => day.summary.captchaFailRate);

    const baselineCompletionRate = toAverage(completionHistory);
    const baselineCaptchaFailRate = toAverage(captchaFailHistory);

    const anomalies: FunnelTrendAnomaly[] = [];
    if (
        completionHistory.length >= CONTACT_WEEKLY_MIN_HISTORY_DAYS &&
        latestDay.summary.completionRateFromFormStart <
            baselineCompletionRate * (1 - CONTACT_WEEKLY_COMPLETION_DROP_DELTA)
    ) {
        anomalies.push({
            id: "weekly_completion_drop",
            severity: "warning",
            message:
                "Weekly trend anomaly: completion rate dropped meaningfully below historical baseline.",
            value: latestDay.summary.completionRateFromFormStart,
            baseline: baselineCompletionRate,
        });
    }

    if (
        captchaFailHistory.length >= CONTACT_WEEKLY_MIN_HISTORY_DAYS &&
        latestDay.summary.captchaFailRate >
            baselineCaptchaFailRate + CONTACT_WEEKLY_CAPTCHA_FAIL_SPIKE_DELTA
    ) {
        anomalies.push({
            id: "weekly_captcha_fail_spike",
            severity: "warning",
            message:
                "Weekly trend anomaly: captcha fail rate spiked above historical baseline.",
            value: latestDay.summary.captchaFailRate,
            baseline: baselineCaptchaFailRate,
        });
    }

    return {
        windowDays: CONTACT_WEEKLY_DAYS,
        days: daySummaries,
        trend: {
            latestDate: latestDay.date,
            completionRateFromFormStart: {
                latest: latestDay.summary.completionRateFromFormStart,
                baseline: baselineCompletionRate,
                deltaFromBaseline: Number(
                    (
                        latestDay.summary.completionRateFromFormStart -
                        baselineCompletionRate
                    ).toFixed(4)
                ),
            },
            captchaFailRate: {
                latest: latestDay.summary.captchaFailRate,
                baseline: baselineCaptchaFailRate,
                deltaFromBaseline: Number(
                    (
                        latestDay.summary.captchaFailRate - baselineCaptchaFailRate
                    ).toFixed(4)
                ),
            },
        },
        anomalies,
    };
}

export function incrementFunnelEvent(
    event: ContactFunnelEvent,
    context: ContactFunnelEventContext = {}
) {
    const routePath = normalizeRoutePath(context.routePath);
    const campaign = normalizeCampaign(context.campaign);
    const nextCount = (contactFunnelCounters.get(event) || 0) + 1;
    contactFunnelCounters.set(event, nextCount);
    incrementSegmentEvent(funnelByRouteCounters, routePath, event);
    incrementSegmentEvent(funnelByCampaignCounters, campaign, event);

    funnelEventHistory.push({
        event,
        timestamp: Date.now(),
        routePath,
        campaign,
    });

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
    errorCodes: string[] = [],
    context: ContactFunnelEventContext = {}
) {
    const nextCount = (captchaOutcomeCounters.get(outcome) || 0) + 1;
    captchaOutcomeCounters.set(outcome, nextCount);
    recordCaptchaErrorCodes(errorCodes);
    incrementFunnelEvent(
        outcome === "solve" ? "captcha_pass" : "captcha_fail",
        context
    );

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
    const funnelWeekly = getContactFunnelWeeklyTrend();
    const funnelLifetimeSegmentation = {
        byRoute: buildSegmentSummary(funnelByRouteCounters),
        byCampaign: buildSegmentSummary(funnelByCampaignCounters),
    };

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
                segmentation: funnelLifetimeSegmentation,
            },
            daily: funnelDaily,
            weekly: funnelWeekly,
        },
    };
}

export function resetContactTelemetryForTests() {
    contactAbuseCounters.clear();
    funnelByRouteCounters.clear();
    funnelByCampaignCounters.clear();
    captchaErrorCodeCounters.clear();
    captchaOutcomeCounters.set("solve", 0);
    captchaOutcomeCounters.set("fail", 0);
    captchaOutcomeCounters.set("error", 0);
    for (const key of Array.from(contactFunnelCounters.keys())) {
        contactFunnelCounters.set(key, 0);
    }
    funnelEventHistory.splice(0, funnelEventHistory.length);
}
