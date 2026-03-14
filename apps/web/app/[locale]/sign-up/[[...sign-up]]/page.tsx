"use client";

import { SignUp, useClerk } from "@clerk/nextjs";
import { useState, useEffect } from "react";

export default function SignUpPage() {
    const { loaded } = useClerk();
    const [showFallback, setShowFallback] = useState(false);

    // If Clerk hasn't loaded after 8 seconds, show a helpful message
    useEffect(() => {
        if (loaded) return;
        const timer = setTimeout(() => setShowFallback(true), 8000);
        return () => clearTimeout(timer);
    }, [loaded]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
            <div className="w-full max-w-md">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        Create your account
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                        Start tailoring your CV with AI in minutes
                    </p>
                </div>

                {/* Loading spinner while Clerk initializes */}
                {!loaded && (
                    <div className="flex flex-col items-center gap-4 py-8">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
                        <p className="text-sm text-slate-500">Loading sign-up...</p>
                        {showFallback && (
                            <div className="mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-center">
                                <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
                                    Sign-up is taking longer than expected.
                                </p>
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                    Try refreshing the page, disabling ad blockers, or using a different browser.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Clerk SignUp widget — renders once Clerk JS initializes */}
                <div style={{ display: loaded ? "block" : "none" }}>
                    <SignUp
                        afterSignUpUrl="/dashboard"
                        signInUrl="/sign-in"
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
            </div>
        </div>
    );
}
