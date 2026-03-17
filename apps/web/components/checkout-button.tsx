"use client";

import { useState, type MouseEvent } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
    buildAuthIntentUrl,
    CHECKOUT_TIMEOUT_ERROR,
    CHECKOUT_TIMEOUT_MS,
    getCheckoutErrorMessage,
    getLocalizedPathForRoute,
    isAbortError,
    isUnauthorizedCheckoutError,
    type CheckoutPlan,
} from "@/lib/checkout-intent";
import { trackBeginCheckout } from "@/lib/analytics";

interface CheckoutButtonProps {
    plan: CheckoutPlan;
    children: React.ReactNode;
    variant?: "default" | "outline" | "ghost" | "secondary" | "destructive" | "link";
    className?: string;
    fallbackHref?: string;
}

export function CheckoutButton({
    plan,
    children,
    variant = "default",
    className,
    fallbackHref,
}: CheckoutButtonProps) {
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const { isLoaded, userId } = useAuth();

    function redirectToSignUpWithIntent() {
        const signUpPath = getLocalizedPathForRoute(
            window.location.pathname,
            "sign-up"
        );
        window.location.href = buildAuthIntentUrl(
            signUpPath,
            plan,
            window.location.pathname
        );
    }

    async function handleCheckout() {
        setLoading(true);
        setErrorMessage(null);
        trackBeginCheckout(plan, "landing_pricing");
        try {
            // Landing-page pricing should route anonymous visitors straight to sign-up,
            // avoiding unnecessary checkout API calls and 401 noise.
            if (!isLoaded || !userId) {
                redirectToSignUpWithIntent();
                return;
            }

            const controller = new AbortController();
            const timeoutId = window.setTimeout(
                () => controller.abort(),
                CHECKOUT_TIMEOUT_MS
            );
            let res: Response;
            try {
                res = await fetch("/api/checkout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ plan }),
                    signal: controller.signal,
                });
            } finally {
                window.clearTimeout(timeoutId);
            }
            const data = await res
                .json()
                .catch(() => ({})) as { url?: string; error?: string };

            if (isUnauthorizedCheckoutError(res.status, data.error)) {
                redirectToSignUpWithIntent();
                return;
            }

            if (data.url) {
                window.location.href = data.url;
            } else {
                setErrorMessage(getCheckoutErrorMessage(data.error));
            }
        } catch (error) {
            if (isAbortError(error)) {
                setErrorMessage(CHECKOUT_TIMEOUT_ERROR);
                return;
            }
            setErrorMessage("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    function handleAnchorCheckout(event: MouseEvent<HTMLAnchorElement>) {
        event.preventDefault();
        if (loading) {
            return;
        }

        void handleCheckout();
    }

    return (
        <div className="space-y-2">
            {fallbackHref ? (
                <Button variant={variant} className={className} asChild>
                    <a
                        href={fallbackHref}
                        onClick={handleAnchorCheckout}
                        aria-disabled={loading}
                        className={loading ? "pointer-events-none opacity-50" : undefined}
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        {children}
                    </a>
                </Button>
            ) : (
                <Button
                    variant={variant}
                    className={className}
                    onClick={handleCheckout}
                    disabled={loading}
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {children}
                </Button>
            )}
            {errorMessage ? (
                <p role="alert" className="text-center text-xs text-destructive">
                    {errorMessage}
                </p>
            ) : null}
        </div>
    );
}
