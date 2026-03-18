"use client";

import Script from "next/script";
import {
    buildGaBootstrapScript,
    buildGtmBootstrapScript,
} from "@/lib/analytics-inline-scripts";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

export function GoogleAnalytics() {
    if (!GTM_ID && !GA_MEASUREMENT_ID) {
        return null;
    }

    if (GTM_ID) {
        return (
            <Script id="google-tag-manager" strategy="afterInteractive">
                {buildGtmBootstrapScript(GTM_ID)}
            </Script>
        );
    }

    if (!GA_MEASUREMENT_ID) {
        return null;
    }

    const measurementId = GA_MEASUREMENT_ID;

    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
                strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
                {buildGaBootstrapScript(measurementId)}
            </Script>
        </>
    );
}

export function GoogleTagManagerNoScript() {
    if (!GTM_ID) {
        return null;
    }

    return (
        <noscript>
            <iframe
                src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
                height="0"
                width="0"
                style={{ display: "none", visibility: "hidden" }}
                title="gtm"
            />
        </noscript>
    );
}
