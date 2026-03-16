"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AuthRecoveryCardProps {
    mode: "sign-in" | "sign-up";
    alternateUrl: string;
    diagnosticsUrl?: string;
}

function detectAuthBlockerHint() {
    if (typeof window === "undefined") {
        return null;
    }

    try {
        if (!navigator.cookieEnabled) {
            return "Cookies are disabled in this browser.";
        }

        const probeName = "__autoapply_auth_probe";
        document.cookie = `${probeName}=1; Max-Age=60; Path=/; SameSite=Lax`;
        const canReadCookie = document.cookie.includes(`${probeName}=`);
        document.cookie = `${probeName}=; Max-Age=0; Path=/; SameSite=Lax`;

        if (!canReadCookie) {
            return "This browser is blocking local storage/cookies required for secure auth.";
        }

        if ("brave" in navigator) {
            return "Brave Shields may block required secure authentication requests.";
        }
    } catch {
        return "Browser privacy settings are blocking required authentication storage.";
    }

    return null;
}

export function AuthRecoveryCard({
    mode,
    alternateUrl,
    diagnosticsUrl,
}: AuthRecoveryCardProps) {
    const [detectedHint, setDetectedHint] = useState<string | null>(null);

    useEffect(() => {
        setDetectedHint(detectAuthBlockerHint());
    }, []);

    const isSignInMode = mode === "sign-in";

    return (
        <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-6 text-center shadow-sm dark:border-amber-800 dark:bg-amber-950/30">
            <div className="mb-3 flex justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-base font-semibold text-amber-900 dark:text-amber-100">
                {isSignInMode
                    ? "Secure sign-in is currently blocked"
                    : "Secure sign-up is currently blocked"}
            </h2>
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
                Authentication could not initialize. This is usually caused by blocked cookies,
                strict privacy settings, ad blockers, or VPN/DNS filters blocking secure auth requests.
            </p>

            {detectedHint ? (
                <p className="mt-3 rounded-md border border-amber-300 bg-amber-100/80 px-3 py-2 text-left text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
                    Detected on this device: {detectedHint}
                </p>
            ) : null}

            <div className="mt-4 rounded-md border border-amber-200 bg-white/70 p-3 text-left text-xs text-slate-700 dark:border-amber-800 dark:bg-slate-900/60 dark:text-slate-200">
                <p>1. Enable cookies for `autoapply.works`.</p>
                <p>2. Allow `clerk.autoapply.works` in blocker/VPN/private DNS settings.</p>
                <p>3. Disable strict tracking protection for this site and retry.</p>
                <p>4. If still blocked, try another browser or non-private tab.</p>
                <p className="mt-2 font-medium">Error code: AUTH_INIT_BLOCKED</p>
            </div>

            <div className="mt-4 flex flex-col gap-2">
                <Button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="w-full"
                >
                    Retry
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                        window.location.href = alternateUrl;
                    }}
                >
                    {isSignInMode ? "Go to sign up" : "Go to sign in"}
                </Button>
                {diagnosticsUrl ? (
                    <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                        onClick={() => {
                            window.location.href = diagnosticsUrl;
                        }}
                    >
                        Run auth diagnostics
                    </Button>
                ) : null}
            </div>
        </div>
    );
}
