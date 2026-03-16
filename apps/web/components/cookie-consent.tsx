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
        setVisible(false);
    }

    function decline() {
        try { localStorage.setItem("cookie-consent", "declined"); } catch { /* noop */ }
        setVisible(false);
    }

    if (!visible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 overflow-x-hidden border-t bg-background p-4 shadow-lg">
            <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-between gap-4 px-1 sm:flex-row sm:px-0">
                <p className="break-words text-center text-sm text-muted-foreground sm:text-left">
                    We use essential cookies for authentication and session management.
                    No third-party tracking.{" "}
                    <Link href="/privacy" className="underline text-foreground">
                        Privacy Policy
                    </Link>
                </p>
                <div className="flex w-full shrink-0 justify-center gap-2 sm:w-auto">
                    <Button variant="outline" size="sm" onClick={decline}>
                        Decline
                    </Button>
                    <Button size="sm" onClick={accept}>
                        Accept
                    </Button>
                </div>
            </div>
        </div>
    );
}
