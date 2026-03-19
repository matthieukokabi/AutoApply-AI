"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Mail, Check } from "lucide-react";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
type ContactFunnelClientEvent = "page_view" | "cta_click" | "form_start";
type ContactTelemetryContext = {
    routePath: string | undefined;
    campaign: string | undefined;
};

function getCampaignFromLocation(search: string) {
    const params = new URLSearchParams(search);
    const campaign =
        params.get("utm_campaign") ||
        params.get("campaign") ||
        params.get("ref");
    return campaign?.trim() || undefined;
}

declare global {
    interface Window {
        turnstile?: {
            render: (
                container: HTMLElement,
                options: {
                    sitekey: string;
                    callback?: (token: string) => void;
                    "expired-callback"?: () => void;
                    "error-callback"?: () => void;
                }
            ) => string;
            remove?: (widgetId: string) => void;
        };
    }
}

export default function ContactPageClient() {
    const t = useTranslations("contactPage");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [subject, setSubject] = useState("");
    const [messageBody, setMessageBody] = useState("");
    const [website, setWebsite] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [turnstileToken, setTurnstileToken] = useState("");
    const [isTurnstileScriptLoaded, setIsTurnstileScriptLoaded] = useState(false);
    const formStartedAtRef = useRef(Date.now());
    const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
    const turnstileWidgetIdRef = useRef<string | null>(null);
    const pageViewTrackedRef = useRef(false);
    const formStartTrackedRef = useRef(false);
    const formSessionIdRef = useRef(
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID().replace(/-/g, "")
            : `${Date.now()}_${Math.random().toString(36).slice(2, 18)}`
    );

    const getTelemetryContext = useCallback((): ContactTelemetryContext => {
        if (typeof window === "undefined") {
            return {
                routePath: undefined,
                campaign: undefined,
            };
        }

        return {
            routePath: window.location.pathname || undefined,
            campaign: getCampaignFromLocation(window.location.search),
        };
    }, []);

    const trackContactFunnelEvent = useCallback((event: ContactFunnelClientEvent) => {
        const payload = JSON.stringify({
            event,
            ...getTelemetryContext(),
        });

        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
            const blob = new Blob([payload], { type: "application/json" });
            navigator.sendBeacon("/api/contact/telemetry", blob);
            return;
        }

        void fetch("/api/contact/telemetry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
        }).catch(() => {});
    }, [getTelemetryContext]);

    function handleFormFocusCapture() {
        if (formStartTrackedRef.current) {
            return;
        }
        formStartTrackedRef.current = true;
        trackContactFunnelEvent("form_start");
    }

    useEffect(() => {
        if (!TURNSTILE_SITE_KEY || !isTurnstileScriptLoaded) {
            return;
        }

        if (!turnstileContainerRef.current || !window.turnstile) {
            return;
        }

        if (turnstileWidgetIdRef.current) {
            return;
        }

        turnstileWidgetIdRef.current = window.turnstile.render(
            turnstileContainerRef.current,
            {
                sitekey: TURNSTILE_SITE_KEY,
                callback: (token: string) => {
                    setTurnstileToken(token);
                },
                "expired-callback": () => {
                    setTurnstileToken("");
                },
                "error-callback": () => {
                    setTurnstileToken("");
                },
            }
        );

        return () => {
            if (turnstileWidgetIdRef.current && window.turnstile?.remove) {
                window.turnstile.remove(turnstileWidgetIdRef.current);
            }
            turnstileWidgetIdRef.current = null;
        };
    }, [isTurnstileScriptLoaded]);

    useEffect(() => {
        if (pageViewTrackedRef.current) {
            return;
        }
        pageViewTrackedRef.current = true;
        trackContactFunnelEvent("page_view");
    }, [trackContactFunnelEvent]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (TURNSTILE_SITE_KEY && !turnstileToken) {
            setError(t("errors.completeVerification"));
            return;
        }

        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    email,
                    subject,
                    message: messageBody,
                    website,
                    formStartedAt: formStartedAtRef.current,
                    formSessionId: formSessionIdRef.current,
                    turnstileToken,
                    ...getTelemetryContext(),
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || t("errors.failedToSend"));
            }

            setSubmitted(true);
        } catch (err: any) {
            setError(err.message || t("errors.generic"));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b">
                <div className="container flex h-14 items-center">
                    <Link href="/" className="flex items-center space-x-2">
                        <Sparkles className="h-6 w-6 text-primary" />
                        <span className="font-bold text-xl">AutoApply AI</span>
                    </Link>
                </div>
            </header>

            <main className="container max-w-2xl py-12">
                <h1 className="text-3xl font-bold mb-2">{t("header.title")}</h1>
                <p className="text-muted-foreground mb-8">
                    {t("header.subtitle")}
                </p>
                <p className="mb-8 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                    {t("header.sla")}
                </p>

                {submitted ? (
                    <Card>
                        <CardContent className="flex flex-col items-center py-12 text-center">
                            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
                                <Check className="h-6 w-6 text-green-600" />
                            </div>
                            <h2 className="text-xl font-semibold mb-2">{t("success.title")}</h2>
                            <p className="text-muted-foreground">
                                {t("success.description")}
                            </p>
                            <Link href="/" className="mt-6">
                                <Button variant="outline">{t("success.backHome")}</Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Mail className="h-5 w-5" />
                                {t("form.title")}
                            </CardTitle>
                            <CardDescription>
                                {t("form.description")}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form
                                onSubmit={handleSubmit}
                                onFocusCapture={handleFormFocusCapture}
                                className="space-y-4"
                            >
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="text-sm font-medium block mb-1">
                                            {t("form.nameLabel")}
                                        </label>
                                        <input
                                            required
                                            className="w-full px-3 py-2 border rounded-md text-sm"
                                            placeholder={t("form.namePlaceholder")}
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium block mb-1">
                                            {t("form.emailLabel")}
                                        </label>
                                        <input
                                            required
                                            type="email"
                                            className="w-full px-3 py-2 border rounded-md text-sm"
                                            placeholder={t("form.emailPlaceholder")}
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium block mb-1">
                                        {t("form.subjectLabel")}
                                    </label>
                                    <select
                                        className="w-full px-3 py-2 border rounded-md text-sm"
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                    >
                                        <option value="">{t("form.subjectPlaceholder")}</option>
                                        <option value="general">{t("form.topics.general")}</option>
                                        <option value="support">{t("form.topics.support")}</option>
                                        <option value="billing">{t("form.topics.billing")}</option>
                                        <option value="privacy">{t("form.topics.privacy")}</option>
                                        <option value="feedback">{t("form.topics.feedback")}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium block mb-1">
                                        {t("form.messageLabel")}
                                    </label>
                                    <textarea
                                        required
                                        className="w-full h-32 px-3 py-2 border rounded-md text-sm resize-none"
                                        placeholder={t("form.messagePlaceholder")}
                                        value={messageBody}
                                        onChange={(e) => setMessageBody(e.target.value)}
                                    />
                                </div>
                                <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
                                    <label htmlFor="contact-website">Website</label>
                                    <input
                                        id="contact-website"
                                        name="website"
                                        autoComplete="off"
                                        tabIndex={-1}
                                        value={website}
                                        onChange={(e) => setWebsite(e.target.value)}
                                    />
                                </div>
                                {TURNSTILE_SITE_KEY ? (
                                    <>
                                        <Script
                                            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
                                            strategy="afterInteractive"
                                            onLoad={() => setIsTurnstileScriptLoaded(true)}
                                        />
                                        <div
                                            ref={turnstileContainerRef}
                                            className="flex justify-center"
                                        />
                                    </>
                                ) : null}
                                {error && (
                                    <p className="text-sm text-red-500">{error}</p>
                                )}
                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={loading}
                                    onClick={() => trackContactFunnelEvent("cta_click")}
                                >
                                    {loading ? t("form.submitLoading") : t("form.submitIdle")}
                                </Button>
                                <p className="text-center text-xs text-muted-foreground">
                                    {t("form.privacyNote")}
                                </p>
                            </form>
                        </CardContent>
                    </Card>
                )}
            </main>
        </div>
    );
}
