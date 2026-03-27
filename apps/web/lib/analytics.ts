import type { CheckoutPlan } from "@/lib/checkout-intent";

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

type AnalyticsWindow = Window & {
    gtag?: (
        command: "event" | "config" | "js",
        name: string | Date,
        params?: AnalyticsParams
    ) => void;
    dataLayer?: Array<unknown>;
};

function getAnalyticsWindow() {
    if (typeof window === "undefined") {
        return null;
    }

    return window as AnalyticsWindow;
}

function hasAnalyticsConsent(win: AnalyticsWindow) {
    try {
        return win.localStorage.getItem("cookie-consent") === "accepted";
    } catch {
        return false;
    }
}

function ensureDataLayer(win: AnalyticsWindow) {
    if (!Array.isArray(win.dataLayer)) {
        win.dataLayer = [];
    }

    return win.dataLayer;
}

function ensureGtag(win: AnalyticsWindow) {
    if (typeof win.gtag === "function") {
        return win.gtag;
    }

    win.gtag = ((command, name, params) => {
        ensureDataLayer(win).push([command, name, params]);
    }) as AnalyticsWindow["gtag"];

    return win.gtag;
}

export function trackAnalyticsEvent(name: string, params: AnalyticsParams = {}) {
    const win = getAnalyticsWindow();
    if (!win || !hasAnalyticsConsent(win)) {
        return;
    }

    const gtag = ensureGtag(win);
    gtag?.("event", name, params);
}

export function trackBeginCheckout(plan: CheckoutPlan, source: string) {
    trackAnalyticsEvent("begin_checkout", {
        checkout_plan: plan,
        checkout_source: source,
    });
}

export function trackSignUpStarted(
    source: string,
    locale: string | undefined,
    requestedPlan: CheckoutPlan | null,
    fromPath: string | null,
    referralCode?: string | null
) {
    trackAnalyticsEvent("sign_up_started", {
        signup_source: source,
        locale,
        requested_plan: requestedPlan,
        requested_from: fromPath,
        referral_code: referralCode,
    });
}

export function trackOnboardingCompleted(source: string) {
    trackAnalyticsEvent("onboarding_completed", {
        onboarding_source: source,
    });
}

export function trackPurchase(plan: CheckoutPlan, source: string) {
    trackAnalyticsEvent("purchase", {
        checkout_plan: plan,
        checkout_source: source,
    });
}

export function trackCvUploaded(
    source: string,
    inputMethod: "file" | "text"
) {
    trackAnalyticsEvent("cv_uploaded", {
        cv_source: source,
        cv_input_method: inputMethod,
    });
}
