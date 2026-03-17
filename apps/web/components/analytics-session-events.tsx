"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackAnalyticsEvent } from "@/lib/analytics";

const SIGNUP_COMPLETED_PENDING_KEY = "aa_signup_completed_pending";

type PendingSignUpCompletedPayload = {
    locale?: string;
    requestedPlan?: string | null;
    from?: string | null;
};

function parsePendingPayload(rawValue: string) {
    try {
        return JSON.parse(rawValue) as PendingSignUpCompletedPayload;
    } catch {
        return {};
    }
}

export function AnalyticsSessionEvents() {
    const pathname = usePathname();

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        let rawValue: string | null = null;
        try {
            rawValue = window.sessionStorage.getItem(SIGNUP_COMPLETED_PENDING_KEY);
            if (!rawValue) {
                return;
            }
            window.sessionStorage.removeItem(SIGNUP_COMPLETED_PENDING_KEY);
        } catch {
            return;
        }

        const payload = parsePendingPayload(rawValue);

        trackAnalyticsEvent("sign_up_completed", {
            signup_source: "sign_up_page",
            completion_pathname: pathname,
            locale: payload.locale,
            requested_plan: payload.requestedPlan,
            requested_from: payload.from,
        });
    }, [pathname]);

    return null;
}
