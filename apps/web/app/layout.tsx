import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { CookieConsent } from "@/components/cookie-consent";
import { GoogleAnalytics } from "@/components/google-analytics";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "AutoApply AI — Your Autonomous Career Assistant",
    description:
        "AI-powered career assistant that finds jobs, scores compatibility, and generates ATS-optimized resumes and cover letters tailored to each role.",
    keywords: [
        "AI resume builder",
        "ATS optimization",
        "job search automation",
        "career assistant",
        "tailored cover letter",
    ],
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
