import type { CheckoutPlan } from "@/lib/checkout-intent";

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

type AnalyticsWindow = Window & {
    gtag?: (
        command: "event" | "config" | "js",
        name: string | Date,
        params?: AnalyticsParams
    ) => void;
    dataLayer?: Array<Record<string, unknown>>;
};

function getAnalyticsWindow() {
    if (typeof window === "undefined") {
        return null;
    }

    return window as AnalyticsWindow;
}

export function trackAnalyticsEvent(name: string, params: AnalyticsParams = {}) {
    const win = getAnalyticsWindow();
    if (!win) {
        return;
    }

    if (typeof win.gtag === "function") {
        win.gtag("event", name, params);
    }

    if (Array.isArray(win.dataLayer)) {
        win.dataLayer.push({ event: name, ...params });
    }
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
    fromPath: string | null
) {
    trackAnalyticsEvent("sign_up_started", {
        signup_source: source,
        locale,
        requested_plan: requestedPlan,
        requested_from: fromPath,
    });
}

export function trackOnboardingCompleted(source: string) {
    trackAnalyticsEvent("onboarding_completed", {
        onboarding_source: source,
    });
}
