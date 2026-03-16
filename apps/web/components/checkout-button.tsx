"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
    buildAuthIntentUrl,
    getLocalizedPathForRoute,
    isUnauthorizedCheckoutError,
    shouldRedirectToAuthBeforeCheckout,
    type CheckoutPlan,
} from "@/lib/checkout-intent";

interface CheckoutButtonProps {
    plan: CheckoutPlan;
    children: React.ReactNode;
    variant?: "default" | "outline" | "ghost" | "secondary" | "destructive" | "link";
    className?: string;
}

export function CheckoutButton({ plan, children, variant = "default", className }: CheckoutButtonProps) {
    const [loading, setLoading] = useState(false);
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
        try {
            if (shouldRedirectToAuthBeforeCheckout(isLoaded, userId)) {
                redirectToSignUpWithIntent();
                return;
            }

            const res = await fetch("/api/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan }),
            });
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
                alert(data.error || "Failed to start checkout");
            }
        } catch {
            alert("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Button
            variant={variant}
            className={className}
            onClick={handleCheckout}
            disabled={loading}
        >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {children}
        </Button>
    );
}
