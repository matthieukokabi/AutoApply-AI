"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/routing";
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
            setError("Please complete the verification challenge before submitting.");
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
                throw new Error(data.error || "Failed to send message");
            }

            setSubmitted(true);
        } catch (err: any) {
            setError(err.message || "Something went wrong. Please try again.");
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
                <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
                <p className="text-muted-foreground mb-8">
                    Have questions, feedback, or need support? We&apos;d love to hear from you.
                </p>
                <p className="mb-8 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                    Support usually replies within one business day. Messages are used only for support and product follow-up.
                </p>

                {submitted ? (
                    <Card>
                        <CardContent className="flex flex-col items-center py-12 text-center">
                            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
                                <Check className="h-6 w-6 text-green-600" />
                            </div>
                            <h2 className="text-xl font-semibold mb-2">Message Sent</h2>
                            <p className="text-muted-foreground">
                                Thank you for reaching out. We&apos;ll get back to you within 24-48 hours.
                            </p>
                            <Link href="/" className="mt-6">
                                <Button variant="outline">Back to Home</Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Mail className="h-5 w-5" />
                                Send us a message
                            </CardTitle>
                            <CardDescription>
                                Fill out the form below and we&apos;ll respond as soon as possible.
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
                                        <label className="text-sm font-medium block mb-1">Name</label>
                                        <input
                                            required
                                            className="w-full px-3 py-2 border rounded-md text-sm"
                                            placeholder="Your name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium block mb-1">Email</label>
                                        <input
                                            required
                                            type="email"
                                            className="w-full px-3 py-2 border rounded-md text-sm"
                                            placeholder="you@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium block mb-1">Subject</label>
                                    <select
                                        className="w-full px-3 py-2 border rounded-md text-sm"
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                    >
                                        <option value="">Select a topic</option>
                                        <option value="general">General Inquiry</option>
                                        <option value="support">Technical Support</option>
                                        <option value="billing">Billing Question</option>
                                        <option value="privacy">Privacy / Data Request</option>
                                        <option value="feedback">Feedback</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium block mb-1">Message</label>
                                    <textarea
                                        required
                                        className="w-full h-32 px-3 py-2 border rounded-md text-sm resize-none"
                                        placeholder="How can we help?"
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
                                    {loading ? "Sending..." : "Send Message"}
                                </Button>
                                <p className="text-center text-xs text-muted-foreground">
                                    No marketing spam. You can request deletion of this conversation at any time.
                                </p>
                            </form>
                        </CardContent>
                    </Card>
                )}
            </main>
        </div>
    );
}
