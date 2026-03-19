"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

type DiagnosticsPayload = {
    generatedAt: string;
    supportCode: string;
    auth?: { status?: string };
    request?: {
        hasCookieHeader?: boolean;
        hasSessionCookie?: boolean;
        hasKnownAuthCookie?: boolean;
        host?: string;
        protocol?: string;
    };
    configuration?: {
        appUrl?: {
            configured?: boolean;
            valid?: boolean;
            matchesRequestHost?: boolean | null;
        };
        clerkPublishableKeyConfigured?: boolean;
        clerkSecretKeyConfigured?: boolean;
        expectedAuthHost?: string;
    };
    recommendations?: string[];
};

export default function AuthDiagnosticsPage() {
    const t = useTranslations("authDiagnostics");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<DiagnosticsPayload | null>(null);

    useEffect(() => {
        async function runDiagnostics() {
            try {
                const res = await fetch("/api/auth/diagnostics", {
                    cache: "no-store",
                });
                const payload = (await res.json()) as DiagnosticsPayload;
                if (!res.ok) {
                    setError(t("errors.loadFailed"));
                    return;
                }
                setData(payload);
            } catch {
                setError(t("errors.network"));
            } finally {
                setLoading(false);
            }
        }

        void runDiagnostics();
    }, [t]);

    return (
        <div className="container max-w-3xl py-10">
            <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
            <p className="mt-2 text-muted-foreground">
                {t("subtitle")}
            </p>

            <div className="mt-6 rounded-lg border bg-card p-4">
                <p className="text-sm">
                    {t("supportCodeLabel")}{" "}
                    <span className="font-mono font-semibold">
                        {data?.supportCode || t("defaultSupportCode")}
                    </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                    {t("shareHint")}
                </p>
            </div>

            {loading ? (
                <div className="mt-6 rounded-lg border p-4 text-sm text-muted-foreground">
                    {t("loading")}
                </div>
            ) : null}

            {error ? (
                <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
                    {error}
                </div>
            ) : null}

            {data ? (
                <div className="mt-6 space-y-4">
                    <div className="rounded-lg border p-4">
                        <h2 className="font-semibold">{t("quickStatus.title")}</h2>
                        <ul className="mt-2 space-y-1 text-sm">
                            <li>
                                {t("quickStatus.authState")}{" "}
                                {data.auth?.status || t("unknown")}
                            </li>
                            <li>
                                {t("quickStatus.cookieHeaderPresent")}{" "}
                                {String(data.request?.hasCookieHeader)}
                            </li>
                            <li>
                                {t("quickStatus.sessionCookiePresent")}{" "}
                                {String(data.request?.hasSessionCookie)}
                            </li>
                            <li>
                                {t("quickStatus.knownAuthCookiePresent")}{" "}
                                {String(data.request?.hasKnownAuthCookie)}
                            </li>
                            <li>
                                {t("quickStatus.appUrlConfigured")}{" "}
                                {String(data.configuration?.appUrl?.configured)}
                            </li>
                            <li>
                                {t("quickStatus.appUrlValid")}{" "}
                                {String(data.configuration?.appUrl?.valid)}
                            </li>
                            <li>
                                {t("quickStatus.appUrlHostMatches")}{" "}
                                {String(data.configuration?.appUrl?.matchesRequestHost)}
                            </li>
                        </ul>
                    </div>

                    <div className="rounded-lg border p-4">
                        <h2 className="font-semibold">{t("recommendationsTitle")}</h2>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                            {(data.recommendations || []).map((item, index) => (
                                <li key={index}>{item}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="rounded-lg border p-4">
                        <h2 className="font-semibold">{t("rawJsonTitle")}</h2>
                        <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">
                            {JSON.stringify(data, null, 2)}
                        </pre>
                    </div>
                </div>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-2">
                <Button onClick={() => window.location.reload()}>{t("actions.runAgain")}</Button>
                <Link href="/sign-in">
                    <Button variant="outline">{t("actions.backToSignIn")}</Button>
                </Link>
                <Link href="/sign-up">
                    <Button variant="outline">{t("actions.backToSignUp")}</Button>
                </Link>
            </div>
        </div>
    );
}
