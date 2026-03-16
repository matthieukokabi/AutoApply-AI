"use client";

import {
    ClerkDegraded,
    ClerkFailed,
    ClerkLoaded,
    SignIn,
    useAuth,
} from "@clerk/nextjs";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthRecoveryCard } from "@/components/auth-recovery-card";
import {
    buildAuthIntentUrl,
    buildPostAuthRedirectUrl,
    getAuthPathsForLocale,
    getLocalizedPathForRoute,
    resolveCheckoutIntentPlan,
} from "@/lib/checkout-intent";
import { getAuthWidgetState } from "@/lib/auth-widget-state";
import { hasMountedClerkWidget } from "@/lib/clerk-widget-monitor";

const CLERK_LOAD_TIMEOUT_MS = 8000;
const CLERK_WIDGET_MOUNT_TIMEOUT_MS = 5000;

export default function SignInPage() {
    const params = useParams<{ locale?: string }>();
    const searchParams = useSearchParams();
    const localeParam = typeof params?.locale === "string" ? params.locale : undefined;
    const { signInPath, signUpPath, settingsPath, dashboardPath } =
        getAuthPathsForLocale(localeParam);
    const requestedPlan = resolveCheckoutIntentPlan(searchParams);
    const fromParam = searchParams.get("from");
    const signUpUrl = buildAuthIntentUrl(signUpPath, requestedPlan, fromParam);
    const diagnosticsUrl = getLocalizedPathForRoute(signInPath, "auth-diagnostics");
    const postAuthRedirectUrl = buildPostAuthRedirectUrl(
        settingsPath,
        dashboardPath,
        requestedPlan,
        fromParam
    );
    const { isLoaded } = useAuth();
    const [showTimeoutFallback, setShowTimeoutFallback] = useState(false);
    const [showWidgetFallback, setShowWidgetFallback] = useState(false);
    const [hasWidgetMounted, setHasWidgetMounted] = useState(false);
    const widgetHostRef = useRef<HTMLDivElement | null>(null);

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

    useEffect(() => {
        if (!isLoaded) {
            setShowWidgetFallback(false);
            setHasWidgetMounted(false);
            return;
        }

        const hasWidget = () => hasMountedClerkWidget(widgetHostRef.current);
        const markMountedIfDetected = () => {
            if (!hasWidget()) {
                return false;
            }

            setHasWidgetMounted(true);
            setShowWidgetFallback(false);
            return true;
        };

        if (markMountedIfDetected()) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            if (!markMountedIfDetected()) {
                setShowWidgetFallback(true);
            }
        }, CLERK_WIDGET_MOUNT_TIMEOUT_MS);

        const pollId = window.setInterval(() => {
            markMountedIfDetected();
        }, 250);

        const observer = new MutationObserver(() => {
            markMountedIfDetected();
        });

        observer.observe(widgetHostRef.current ?? document.body, {
            childList: true,
            subtree: true,
        });

        return () => {
            window.clearTimeout(timeoutId);
            window.clearInterval(pollId);
            observer.disconnect();
        };
    }, [isLoaded]);

    const { shouldShowRecoveryCard, shouldShowLoadingCard, shouldHideWidget } = getAuthWidgetState({
        isLoaded,
        hasWidgetMounted,
        showTimeoutFallback,
        showWidgetFallback,
    });

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

                {shouldShowRecoveryCard ? (
                    <AuthRecoveryCard
                        mode="sign-in"
                        alternateUrl={signUpUrl}
                        diagnosticsUrl={diagnosticsUrl}
                    />
                ) : null}

                {shouldShowLoadingCard ? (
                    <div className="rounded-xl border border-slate-200 bg-white/80 p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Loading secure sign-in...
                        </p>
                        <div className="mt-3 flex items-center justify-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                            <a href={diagnosticsUrl} className="underline-offset-2 hover:underline">
                                Open diagnostics
                            </a>
                            <a href={signUpUrl} className="underline-offset-2 hover:underline">
                                Go to sign-up
                            </a>
                        </div>
                    </div>
                ) : null}

                <ClerkLoaded>
                    <div
                        ref={widgetHostRef}
                        aria-hidden={shouldHideWidget ? true : undefined}
                        className={shouldHideWidget ? "hidden" : undefined}
                    >
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
                    </div>
                </ClerkLoaded>

                <ClerkDegraded>
                    <AuthRecoveryCard
                        mode="sign-in"
                        alternateUrl={signUpUrl}
                        diagnosticsUrl={diagnosticsUrl}
                    />
                </ClerkDegraded>

                <ClerkFailed>
                    <AuthRecoveryCard
                        mode="sign-in"
                        alternateUrl={signUpUrl}
                        diagnosticsUrl={diagnosticsUrl}
                    />
                </ClerkFailed>
            </div>
        </div>
    );
}
