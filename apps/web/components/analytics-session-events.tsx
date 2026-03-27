"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isCheckoutPlan } from "@/lib/checkout-intent";
import { trackAnalyticsEvent, trackPurchase } from "@/lib/analytics";

const SIGNUP_COMPLETED_PENDING_KEY = "aa_signup_completed_pending";
const PURCHASE_TRACKED_KEY_PREFIX = "aa_purchase_tracked_ref:";

type PendingSignUpCompletedPayload = {
    locale?: string;
    requestedPlan?: string | null;
    from?: string | null;
    referralCode?: string | null;
};

function parsePendingPayload(rawValue: string) {
    try {
        return JSON.parse(rawValue) as PendingSignUpCompletedPayload;
    } catch {
        return {};
    }
}

function localeFromPath(pathname: string | null) {
    const segment = pathname?.split("/").filter(Boolean)[0];
    return segment || undefined;
}

export function AnalyticsSessionEvents() {
    const pathname = usePathname();

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const hasSignUpCompletedParam = params.get("signup_completed") === "1";

        let pendingPayload: PendingSignUpCompletedPayload | null = null;
        try {
            const rawValue = window.sessionStorage.getItem(SIGNUP_COMPLETED_PENDING_KEY);
            if (rawValue) {
                pendingPayload = parsePendingPayload(rawValue);
                window.sessionStorage.removeItem(SIGNUP_COMPLETED_PENDING_KEY);
            }
        } catch {
            pendingPayload = null;
        }

        if (pendingPayload || hasSignUpCompletedParam) {
            trackAnalyticsEvent("sign_up_completed", {
                signup_source: "sign_up_page",
                completion_pathname: pathname,
                locale: pendingPayload?.locale ?? localeFromPath(pathname),
                requested_plan: pendingPayload?.requestedPlan ?? params.get("upgrade"),
                requested_from: pendingPayload?.from ?? params.get("from"),
                referral_code: pendingPayload?.referralCode ?? params.get("ref"),
            });
        }

        if (hasSignUpCompletedParam) {
            params.delete("signup_completed");
            const nextQuery = params.toString();
            const nextUrl = nextQuery
                ? `${window.location.pathname}?${nextQuery}`
                : window.location.pathname;
            window.history.replaceState(window.history.state, "", nextUrl);
        }

        const checkoutStatus = params.get("checkout");
        const checkoutPlan = params.get("checkout_plan");
        const currentPath = window.location.pathname;

        if (
            checkoutStatus === "success" &&
            isCheckoutPlan(checkoutPlan) &&
            !currentPath.endsWith("/settings")
        ) {
            const checkoutRef = params.get("checkout_ref") || `${checkoutPlan}:${currentPath}`;
            const trackingKey = `${PURCHASE_TRACKED_KEY_PREFIX}${checkoutRef}`;

            let alreadyTracked = false;
            try {
                alreadyTracked = window.sessionStorage.getItem(trackingKey) === "1";
            } catch {
                alreadyTracked = false;
            }

            if (!alreadyTracked) {
                trackPurchase(checkoutPlan, "checkout_return");
                try {
                    window.sessionStorage.setItem(trackingKey, "1");
                } catch {
                    // Ignore storage failures (privacy mode/storage restrictions).
                }
            }
        }
    }, [pathname]);

    return null;
}
