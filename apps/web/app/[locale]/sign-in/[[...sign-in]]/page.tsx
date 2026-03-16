"use client";

import {
    ClerkDegraded,
    ClerkFailed,
    ClerkLoaded,
    ClerkLoading,
    SignIn,
    useAuth,
} from "@clerk/nextjs";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const SUPPORTED_LOCALES = new Set(["en", "fr", "de", "es", "it"]);
const CHECKOUT_PLANS = new Set([
    "pro_monthly",
    "pro_yearly",
    "unlimited",
    "unlimited_yearly",
    "credit_pack",
]);
const CLERK_LOAD_TIMEOUT_MS = 8000;

type SearchParamsLike = { get(name: string): string | null };

function getAuthPaths(localeParam: string | undefined) {
    const locale = localeParam && SUPPORTED_LOCALES.has(localeParam) ? localeParam : null;
    return {
        signInPath: locale ? `/${locale}/sign-in` : "/sign-in",
        signUpPath: locale ? `/${locale}/sign-up` : "/sign-up",
        settingsPath: locale ? `/${locale}/settings` : "/settings",
        dashboardPath: locale ? `/${locale}/dashboard` : "/dashboard",
    };
}

function getRequestedUpgradePlan(searchParams: SearchParamsLike) {
    const plan = searchParams.get("upgrade") ?? searchParams.get("plan");
    return plan && CHECKOUT_PLANS.has(plan) ? plan : null;
}

function buildAuthIntentUrl(basePath: string, plan: string | null, from: string | null) {
    if (!plan && !from) return basePath;
    const params = new URLSearchParams();
    if (plan) params.set("upgrade", plan);
    if (from) params.set("from", from);
    return `${basePath}?${params.toString()}`;
}

function buildPostAuthRedirectUrl(
    settingsPath: string,
    dashboardPath: string,
    plan: string | null,
    from: string | null
) {
    if (!plan) return dashboardPath;
    const params = new URLSearchParams({ upgrade: plan });
    if (from) params.set("from", from);
    return `${settingsPath}?${params.toString()}`;
}

function SignInFallback({ signUpUrl }: { signUpUrl: string }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white/80 p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Secure sign-in is temporarily unavailable
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Please refresh this page or try another network/browser. If you do not have an account yet, you can retry the sign-up flow.
            </p>
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
                        window.location.href = signUpUrl;
                    }}
                >
                    Go to sign up
                </Button>
            </div>
        </div>
    );
}

export default function SignInPage() {
    const params = useParams<{ locale?: string }>();
    const searchParams = useSearchParams();
    const localeParam = typeof params?.locale === "string" ? params.locale : undefined;
    const { signInPath, signUpPath, settingsPath, dashboardPath } = getAuthPaths(localeParam);
    const requestedPlan = getRequestedUpgradePlan(searchParams);
    const fromParam = searchParams.get("from");
    const signUpUrl = buildAuthIntentUrl(signUpPath, requestedPlan, fromParam);
    const postAuthRedirectUrl = buildPostAuthRedirectUrl(
        settingsPath,
        dashboardPath,
        requestedPlan,
        fromParam
    );
    const { isLoaded } = useAuth();
    const [showTimeoutFallback, setShowTimeoutFallback] = useState(false);

    useEffect(() => {
        if (isLoaded) {
            setShowTimeoutFallback(false);
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setShowTimeoutFallback(true);
        }, CLERK_LOAD_TIMEOUT_MS);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [isLoaded]);

    return (
        <div className="min-h-screen overflow-x-hidden px-4 py-8 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
            <div className="w-full max-w-md">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        Welcome back
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                        Sign in to your AutoApply AI account
                    </p>
                </div>

                {showTimeoutFallback && !isLoaded ? (
                    <SignInFallback signUpUrl={signUpUrl} />
                ) : (
                    <ClerkLoading>
                        <div className="rounded-xl border border-slate-200 bg-white/80 p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Loading secure sign-in...
                            </p>
                        </div>
                    </ClerkLoading>
                )}

                <ClerkLoaded>
                    <SignIn
                        path={signInPath}
                        routing="path"
                        signUpUrl={signUpUrl}
                        forceRedirectUrl={postAuthRedirectUrl}
                        fallbackRedirectUrl={postAuthRedirectUrl}
                        appearance={{
                            elements: {
                                rootBox: "mx-auto w-full",
                                card: "shadow-xl rounded-xl",
                                socialButtonsBlockButton:
                                    "border border-slate-200 hover:bg-slate-50",
                                formButtonPrimary:
                                    "bg-blue-600 hover:bg-blue-700 text-sm",
                                footerActionLink:
                                    "text-blue-600 hover:text-blue-700",
                            },
                        }}
                    />
                </ClerkLoaded>

                <ClerkDegraded>
                    <SignInFallback signUpUrl={signUpUrl} />
                </ClerkDegraded>

                <ClerkFailed>
                    <SignInFallback signUpUrl={signUpUrl} />
                </ClerkFailed>
            </div>
        </div>
    );
}
