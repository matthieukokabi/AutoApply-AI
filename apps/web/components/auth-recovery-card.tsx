"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

interface AuthRecoveryCardProps {
    mode: "sign-in" | "sign-up";
    alternateUrl: string;
    diagnosticsUrl?: string;
}

type AuthBlockerHint =
    | "cookies_disabled"
    | "storage_blocked"
    | "brave_shields"
    | "privacy_blocking";

function detectAuthBlockerHint() {
    if (typeof window === "undefined") {
        return null;
    }

    try {
        if (!navigator.cookieEnabled) {
            return "cookies_disabled" as const;
        }

        const probeName = "__autoapply_auth_probe";
        document.cookie = `${probeName}=1; Max-Age=60; Path=/; SameSite=Lax`;
        const canReadCookie = document.cookie.includes(`${probeName}=`);
        document.cookie = `${probeName}=; Max-Age=0; Path=/; SameSite=Lax`;

        if (!canReadCookie) {
            return "storage_blocked" as const;
        }

        if ("brave" in navigator) {
            return "brave_shields" as const;
        }
    } catch {
        return "privacy_blocking" as const;
    }

    return null;
}

export function AuthRecoveryCard({
    mode,
    alternateUrl,
    diagnosticsUrl,
}: AuthRecoveryCardProps) {
    const t = useTranslations("auth.recovery");
    const [detectedHint, setDetectedHint] = useState<AuthBlockerHint | null>(null);

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
                    ? t("secureSignInBlocked")
                    : t("secureSignUpBlocked")}
            </h2>
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
                {t("description")}
            </p>

            {detectedHint ? (
                <p className="mt-3 rounded-md border border-amber-300 bg-amber-100/80 px-3 py-2 text-left text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
                    {t("detectedOnDevice")} {t(`hints.${detectedHint}`)}
                </p>
            ) : null}

            <div className="mt-4 rounded-md border border-amber-200 bg-white/70 p-3 text-left text-xs text-slate-700 dark:border-amber-800 dark:bg-slate-900/60 dark:text-slate-200">
                <p>1. {t("steps.enableCookies")}</p>
                <p>2. {t("steps.allowClerkHost")}</p>
                <p>3. {t("steps.disableStrictTracking")}</p>
                <p>4. {t("steps.tryAnotherBrowser")}</p>
                <p className="mt-2 font-medium">{t("errorCode")}: AUTH_INIT_BLOCKED</p>
            </div>

            <div className="mt-4 flex flex-col gap-2">
                <Button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="w-full"
                >
                    {t("retry")}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                        window.location.href = alternateUrl;
                    }}
                >
                    {isSignInMode ? t("goToSignUp") : t("goToSignIn")}
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
                        {t("runAuthDiagnostics")}
                    </Button>
                ) : null}
            </div>
        </div>
    );
}
