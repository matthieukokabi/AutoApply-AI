"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

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
                    setError("Failed to load diagnostics.");
                    return;
                }
                setData(payload);
            } catch {
                setError("Network error while loading diagnostics.");
            } finally {
                setLoading(false);
            }
        }

        void runDiagnostics();
    }, []);

    return (
        <div className="container max-w-3xl py-10">
            <h1 className="text-3xl font-bold tracking-tight">Auth Diagnostics</h1>
            <p className="mt-2 text-muted-foreground">
                Use this page when sign-in/sign-up is blocked. It returns safe diagnostics only.
            </p>

            <div className="mt-6 rounded-lg border bg-card p-4">
                <p className="text-sm">
                    Support code:{" "}
                    <span className="font-mono font-semibold">
                        {data?.supportCode || "AUTH_INIT_BLOCKED"}
                    </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                    Share this code and the diagnostics JSON with support.
                </p>
            </div>

            {loading ? (
                <div className="mt-6 rounded-lg border p-4 text-sm text-muted-foreground">
                    Running diagnostics...
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
                        <h2 className="font-semibold">Quick Status</h2>
                        <ul className="mt-2 space-y-1 text-sm">
                            <li>Auth state: {data.auth?.status || "unknown"}</li>
                            <li>Cookie header present: {String(data.request?.hasCookieHeader)}</li>
                            <li>Session cookie present: {String(data.request?.hasSessionCookie)}</li>
                            <li>Known auth cookie present: {String(data.request?.hasKnownAuthCookie)}</li>
                            <li>App URL configured: {String(data.configuration?.appUrl?.configured)}</li>
                            <li>App URL valid: {String(data.configuration?.appUrl?.valid)}</li>
                            <li>App URL host matches request host: {String(data.configuration?.appUrl?.matchesRequestHost)}</li>
                        </ul>
                    </div>

                    <div className="rounded-lg border p-4">
                        <h2 className="font-semibold">Recommendations</h2>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                            {(data.recommendations || []).map((item, index) => (
                                <li key={index}>{item}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="rounded-lg border p-4">
                        <h2 className="font-semibold">Raw Diagnostics JSON</h2>
                        <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">
                            {JSON.stringify(data, null, 2)}
                        </pre>
                    </div>
                </div>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-2">
                <Button onClick={() => window.location.reload()}>Run Again</Button>
                <Link href="/sign-in">
                    <Button variant="outline">Back to Sign In</Button>
                </Link>
                <Link href="/sign-up">
                    <Button variant="outline">Back to Sign Up</Button>
                </Link>
            </div>
        </div>
    );
}
