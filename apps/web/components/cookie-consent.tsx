"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CookieConsent() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        try {
            const consent = localStorage.getItem("cookie-consent");
            if (!consent) {
                // Small delay so it doesn't flash on load
                const timer = setTimeout(() => setVisible(true), 1000);
                return () => clearTimeout(timer);
            }
        } catch {
            // localStorage may be blocked in private browsing or strict privacy mode
            // Silently skip — don't show banner if we can't store preference
        }
    }, []);

    function accept() {
        try { localStorage.setItem("cookie-consent", "accepted"); } catch { /* noop */ }
        window.dispatchEvent(new Event("cookie-consent-updated"));
        setVisible(false);
    }

    function decline() {
        try { localStorage.setItem("cookie-consent", "declined"); } catch { /* noop */ }
        window.dispatchEvent(new Event("cookie-consent-updated"));
        setVisible(false);
    }

    if (!visible) return null;

    return (
        <div className="fixed inset-x-0 bottom-0 z-50 overflow-x-clip border-t bg-background p-3 shadow-lg sm:p-4">
            <div className="mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-w-0 break-words text-center text-sm leading-relaxed text-muted-foreground sm:text-left">
                    We use essential cookies for authentication and session management.
                    Optional analytics tags are loaded only if you accept.{" "}
                    <Link href="/privacy" className="underline text-foreground">
                        Privacy Policy
                    </Link>
                </p>
                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0">
                    <Button variant="outline" size="sm" className="w-full" onClick={decline}>
                        Decline
                    </Button>
                    <Button size="sm" className="w-full" onClick={accept}>
                        Accept
                    </Button>
                </div>
            </div>
        </div>
    );
}
