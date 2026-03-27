/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackAnalyticsEvent, trackPurchase } from "@/lib/analytics";

describe("lib/analytics business events", () => {
    let originalGtag: unknown;
    let originalDataLayer: unknown;

    beforeEach(() => {
        originalGtag = (window as Window & { gtag?: unknown }).gtag;
        originalDataLayer = (window as Window & { dataLayer?: unknown }).dataLayer;

        delete (window as Window & { gtag?: unknown }).gtag;
        delete (window as Window & { dataLayer?: unknown }).dataLayer;
        window.localStorage.clear();
    });

    afterEach(() => {
        if (originalGtag === undefined) {
            delete (window as Window & { gtag?: unknown }).gtag;
        } else {
            (window as Window & { gtag?: unknown }).gtag = originalGtag;
        }

        if (originalDataLayer === undefined) {
            delete (window as Window & { dataLayer?: unknown }).dataLayer;
        } else {
            (window as Window & { dataLayer?: unknown }).dataLayer = originalDataLayer;
        }

        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    it("does not emit when consent is not accepted", () => {
        const gtagSpy = vi.fn();
        (window as Window & { gtag?: unknown }).gtag = gtagSpy;
        window.localStorage.setItem("cookie-consent", "declined");

        trackAnalyticsEvent("sign_up_completed", {
            signup_source: "sign_up_page",
        });

        expect(gtagSpy).not.toHaveBeenCalled();
    });

    it("emits sign_up_completed via gtag when consent is accepted", () => {
        const gtagSpy = vi.fn();
        (window as Window & { gtag?: unknown }).gtag = gtagSpy;
        window.localStorage.setItem("cookie-consent", "accepted");

        trackAnalyticsEvent("sign_up_completed", {
            signup_source: "sign_up_page",
        });

        expect(gtagSpy).toHaveBeenCalledWith("event", "sign_up_completed", {
            signup_source: "sign_up_page",
        });
    });

    it("queues purchase when consent is accepted and gtag is not initialized yet", () => {
        window.localStorage.setItem("cookie-consent", "accepted");

        trackPurchase("pro_monthly", "checkout_return");

        const dataLayer = (window as Window & { dataLayer?: unknown[] }).dataLayer;
        expect(Array.isArray(dataLayer)).toBe(true);
        expect(dataLayer).toHaveLength(1);
        expect(dataLayer?.[0]).toEqual([
            "event",
            "purchase",
            {
                checkout_plan: "pro_monthly",
                checkout_source: "checkout_return",
            },
        ]);
    });
});
