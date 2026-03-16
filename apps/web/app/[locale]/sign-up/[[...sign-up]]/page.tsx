"use client";

import {
    ClerkDegraded,
    ClerkFailed,
    ClerkLoaded,
    ClerkLoading,
    SignUp,
} from "@clerk/nextjs";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const SUPPORTED_LOCALES = new Set(["en", "fr", "de", "es", "it"]);

function getAuthPaths(localeParam: string | undefined) {
    const locale = localeParam && SUPPORTED_LOCALES.has(localeParam) ? localeParam : null;
    return {
        signInPath: locale ? `/${locale}/sign-in` : "/sign-in",
        signUpPath: locale ? `/${locale}/sign-up` : "/sign-up",
        dashboardPath: locale ? `/${locale}/dashboard` : "/dashboard",
    };
}

function SignUpFallback({ signInPath }: { signInPath: string }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white/80 p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Secure sign-up is temporarily unavailable
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Please refresh this page or try another network/browser. If you already have an account, you can sign in directly.
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
                        window.location.href = signInPath;
                    }}
                >
                    Go to sign in
                </Button>
            </div>
        </div>
    );
}

export default function SignUpPage() {
    const params = useParams<{ locale?: string }>();
    const localeParam = typeof params?.locale === "string" ? params.locale : undefined;
    const { signInPath, signUpPath, dashboardPath } = getAuthPaths(localeParam);

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

                <ClerkLoading>
                    <div className="rounded-xl border border-slate-200 bg-white/80 p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Loading secure sign-up...
                        </p>
                    </div>
                </ClerkLoading>

                <ClerkLoaded>
                    <SignUp
                        path={signUpPath}
                        routing="path"
                        signInUrl={signInPath}
                        forceRedirectUrl={dashboardPath}
                        fallbackRedirectUrl={dashboardPath}
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
                    <SignUpFallback signInPath={signInPath} />
                </ClerkDegraded>

                <ClerkFailed>
                    <SignUpFallback signInPath={signInPath} />
                </ClerkFailed>
            </div>
        </div>
    );
}
