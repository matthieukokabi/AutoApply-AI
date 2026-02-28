"use client";

import { useState, useEffect } from "react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

export function CookieConsent() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem("cookie-consent");
        if (!consent) {
            // Small delay so it doesn't flash on load
            const timer = setTimeout(() => setVisible(true), 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    function accept() {
        localStorage.setItem("cookie-consent", "accepted");
        setVisible(false);
    }

    function decline() {
        localStorage.setItem("cookie-consent", "declined");
        setVisible(false);
    }

    if (!visible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background border-t shadow-lg">
            <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 max-w-4xl">
                <p className="text-sm text-muted-foreground text-center sm:text-left">
                    We use essential cookies for authentication and session management.
                    No third-party tracking.{" "}
                    <Link href="/privacy" className="underline text-foreground">
                        Privacy Policy
                    </Link>
                </p>
                <div className="flex gap-2 shrink-0">
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
