import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { CookieConsent } from "@/components/cookie-consent";
import { AnalyticsSessionEvents } from "@/components/analytics-session-events";
import { AnalyticsConsentGate } from "@/components/analytics-consent-gate";
import { getAppBaseUrl, toAbsoluteAppUrl } from "@/lib/site-url";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const appBaseUrl = getAppBaseUrl();
const defaultOgImage = toAbsoluteAppUrl("/opengraph-image");
const defaultTwitterImage = toAbsoluteAppUrl("/twitter-image");
const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
    title: {
        default: "AutoApply AI — Tailor Your Resume & Cover Letter to Every Job with AI",
        template: "%s | AutoApply AI",
    },
    description:
        "AI-powered job search platform. Auto-tailored ATS-optimized CVs, AI cover letters, job matching from 7+ sources, and application tracking. Free to start.",
    keywords: [
        "AI resume builder",
        "ai cover letter generator",
        "ATS optimization",
        "ats resume builder",
        "job search automation",
        "resume tailoring tool",
        "ai job matching",
        "automated job application",
        "job application tracker",
        "ai cv builder",
        "career assistant",
        "tailored cover letter",
        "resume optimization tool",
        "ai career tools",
    ],
    metadataBase: new URL(appBaseUrl),
    openGraph: {
        type: "website",
        siteName: "AutoApply AI",
        title: "AutoApply AI — Tailor Your Resume & Cover Letter to Every Job with AI",
        description:
            "AI-powered job search platform. Auto-tailored ATS-optimized CVs, AI cover letters, job matching from 7+ sources, and application tracking.",
        url: appBaseUrl,
        images: [
            {
                url: defaultOgImage,
                width: 1200,
                height: 630,
                alt: "AutoApply AI — Tailor Your Resume & Cover Letter to Every Job with AI",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        site: "@autoapplyai",
        creator: "@autoapplyai",
        title: "AutoApply AI — Tailor Your Resume & Cover Letter to Every Job with AI",
        description:
            "AI-powered job search platform. Auto-tailored ATS-optimized CVs, AI cover letters, job matching from 7+ sources, and application tracking.",
        images: [defaultTwitterImage],
    },
    robots: {
        index: true,
        follow: true,
    },
    ...(googleSiteVerification
        ? {
              verification: {
                  google: googleSiteVerification,
              },
          }
        : {}),
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ClerkProvider>
            <html lang="en" suppressHydrationWarning>
                <head />
                <body className={inter.className}>
                    <AnalyticsConsentGate />
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="system"
                        enableSystem
                        disableTransitionOnChange
                    >
                        <AnalyticsSessionEvents />
                        {children}
                        <CookieConsent />
                    </ThemeProvider>
                </body>
            </html>
        </ClerkProvider>
    );
}
