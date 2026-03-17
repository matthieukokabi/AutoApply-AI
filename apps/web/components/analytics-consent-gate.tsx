"use client";

import { useEffect, useState } from "react";
import { GoogleAnalytics, GoogleTagManagerNoScript } from "@/components/google-analytics";

type ConsentStatus = "accepted" | "declined" | null;

function readConsent(): ConsentStatus {
    try {
        const value = localStorage.getItem("cookie-consent");
        if (value === "accepted" || value === "declined") {
            return value;
        }
    } catch {
        return null;
    }

    return null;
}

export function AnalyticsConsentGate() {
    const [consentStatus, setConsentStatus] = useState<ConsentStatus>(null);

    useEffect(() => {
        setConsentStatus(readConsent());

        function handleStorage(event: StorageEvent) {
            if (event.key !== "cookie-consent") {
                return;
            }

            setConsentStatus(readConsent());
        }

        function handleConsentUpdate() {
            setConsentStatus(readConsent());
        }

        window.addEventListener("storage", handleStorage);
        window.addEventListener("cookie-consent-updated", handleConsentUpdate);

        return () => {
            window.removeEventListener("storage", handleStorage);
            window.removeEventListener("cookie-consent-updated", handleConsentUpdate);
        };
    }, []);

    if (consentStatus !== "accepted") {
        return null;
    }

    return (
        <>
            <GoogleAnalytics />
            <GoogleTagManagerNoScript />
        </>
    );
}
