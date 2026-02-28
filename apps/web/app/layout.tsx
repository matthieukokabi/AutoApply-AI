import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { CookieConsent } from "@/components/cookie-consent";
import { GoogleAnalytics } from "@/components/google-analytics";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

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
    openGraph: {
        type: "website",
        siteName: "AutoApply AI",
        title: "AutoApply AI — Tailor Your Resume & Cover Letter to Every Job with AI",
        description:
            "AI-powered job search platform. Auto-tailored ATS-optimized CVs, AI cover letters, job matching from 7+ sources, and application tracking.",
    },
    twitter: {
        card: "summary_large_image",
        title: "AutoApply AI — Tailor Your Resume & Cover Letter to Every Job with AI",
        description:
            "AI-powered job search platform. Auto-tailored ATS-optimized CVs, AI cover letters, job matching from 7+ sources, and application tracking.",
    },
    robots: {
        index: true,
        follow: true,
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ClerkProvider>
            <html lang="en" suppressHydrationWarning>
                <head>
                    <GoogleAnalytics />
                </head>
                <body className={inter.className}>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="system"
                        enableSystem
                        disableTransitionOnChange
                    >
                        {children}
                        <CookieConsent />
                    </ThemeProvider>
                </body>
            </html>
        </ClerkProvider>
    );
}
