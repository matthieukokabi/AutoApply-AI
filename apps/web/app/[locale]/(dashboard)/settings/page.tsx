"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { SettingsSkeleton } from "@/components/loading-skeleton";
import {
    buildAuthIntentUrl,
    CHECKOUT_TIMEOUT_MS,
    getLocalizedPathForRoute,
    isCheckoutPlan,
    isAbortError,
    isUnauthorizedCheckoutError,
    resolveCheckoutIntentPlan,
    type CheckoutPlan,
} from "@/lib/checkout-intent";
import { trackBeginCheckout, trackPurchase } from "@/lib/analytics";

interface UserInfo {
    automationEnabled: boolean;
    subscriptionStatus: string;
    creditsRemaining: number;
}

interface Preferences {
    targetTitles: string[];
    locations: string[];
    remotePreference: string;
    salaryMin: number | null;
    salaryCurrency: string;
    industries: string[];
}

const CURRENCIES = [
    { code: "USD", symbol: "$", label: "US Dollar" },
    { code: "EUR", symbol: "€", label: "Euro" },
    { code: "GBP", symbol: "£", label: "British Pound" },
    { code: "CHF", symbol: "Fr.", label: "Swiss Franc" },
    { code: "CAD", symbol: "CA$", label: "Canadian Dollar" },
    { code: "AUD", symbol: "A$", label: "Australian Dollar" },
    { code: "SEK", symbol: "kr", label: "Swedish Krona" },
    { code: "NOK", symbol: "kr", label: "Norwegian Krone" },
    { code: "DKK", symbol: "kr", label: "Danish Krone" },
    { code: "PLN", symbol: "zł", label: "Polish Zloty" },
    { code: "CZK", symbol: "Kč", label: "Czech Koruna" },
    { code: "INR", symbol: "₹", label: "Indian Rupee" },
    { code: "JPY", symbol: "¥", label: "Japanese Yen" },
    { code: "BRL", symbol: "R$", label: "Brazilian Real" },
];

const SETTINGS_AUTH_RETRY_ATTEMPTS = 3;
const SETTINGS_AUTH_RETRY_DELAY_MS = 500;
const CHECKOUT_RETURN_SYNC_ATTEMPTS = 5;
const CHECKOUT_RETURN_SYNC_DELAY_MS = 2000;

function normalizePlanStatus(value: string | null | undefined) {
    if (value === "pro" || value === "unlimited" || value === "free") {
        return value;
    }

    return "free";
}

async function fetchUserWithAuthRetry() {
    let response: Response | null = null;

    for (let attempt = 0; attempt < SETTINGS_AUTH_RETRY_ATTEMPTS; attempt += 1) {
        response = await fetch("/api/user", { cache: "no-store" });
        if (response.ok) {
            return response;
        }

        if (response.status !== 401 && response.status !== 403) {
            return response;
        }

        if (attempt < SETTINGS_AUTH_RETRY_ATTEMPTS - 1) {
            await new Promise((resolve) =>
                window.setTimeout(resolve, SETTINGS_AUTH_RETRY_DELAY_MS)
            );
        }
    }

    return response;
}

export default function SettingsPage() {
    const t = useTranslations("dashboard.settings");
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const autoUpgradePlan = resolveCheckoutIntentPlan(searchParams);
    const autoCheckoutTriggeredRef = useRef(false);
    const checkoutReturnHandledKeyRef = useRef<string | null>(null);

    const [user, setUser] = useState<UserInfo | null>(null);
    const [prefs, setPrefs] = useState<Preferences>({
        targetTitles: [],
        locations: [],
        remotePreference: "any",
        salaryMin: null,
        salaryCurrency: "USD",
        industries: [],
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [togglingAutomation, setTogglingAutomation] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [message, setMessage] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);

    // Form state as strings for editing convenience
    const [titlesStr, setTitlesStr] = useState("");
    const [locationsStr, setLocationsStr] = useState("");
    const [industriesStr, setIndustriesStr] = useState("");
    const [salaryStr, setSalaryStr] = useState("");
    const [currencyCode, setCurrencyCode] = useState("USD");
    const [remotePref, setRemotePref] = useState("any");

    useEffect(() => {
        async function load() {
            try {
                const prefsPromise = fetch("/api/preferences", {
                    cache: "no-store",
                });
                const userRes = await fetchUserWithAuthRetry();
                const prefsRes = await prefsPromise;

                if (userRes?.ok) {
                    const data = await userRes.json();
                    setUser(data.user);
                }

                if (prefsRes.ok) {
                    const data = await prefsRes.json();
                    if (data.preferences) {
                        const p = data.preferences;
                        setPrefs(p);
                        setTitlesStr(p.targetTitles?.join(", ") || "");
                        setLocationsStr(p.locations?.join(", ") || "");
                        setIndustriesStr(p.industries?.join(", ") || "");
                        setSalaryStr(p.salaryMin?.toString() || "");
                        setCurrencyCode(p.salaryCurrency || "USD");
                        setRemotePref(p.remotePreference || "any");
                    }
                }
            } catch (err) {
                console.error("Failed to load settings:", err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    async function handleSavePreferences() {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch("/api/preferences", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetTitles: titlesStr
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    locations: locationsStr
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    remotePreference: remotePref,
                    salaryMin: salaryStr || null,
                    salaryCurrency: currencyCode,
                    industries: industriesStr
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                }),
            });

            if (res.ok) {
                setMessage({ type: "success", text: t("messages.preferencesSaved") });
            } else {
                const data = await res.json();
                setMessage({
                    type: "error",
                    text: data.error || t("messages.preferencesSaveFailed"),
                });
            }
        } catch {
            setMessage({ type: "error", text: t("messages.networkError") });
        } finally {
            setSaving(false);
        }
    }

    async function handleToggleAutomation() {
        if (!user) return;
        setTogglingAutomation(true);
        setMessage(null);
        try {
            const res = await fetch("/api/user", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    automationEnabled: !user.automationEnabled,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setUser((u) =>
                    u ? { ...u, automationEnabled: data.user.automationEnabled } : u
                );
            } else {
                const data = await res.json();
                setMessage({ type: "error", text: data.error });
            }
        } catch {
            setMessage({ type: "error", text: t("messages.networkError") });
        } finally {
            setTogglingAutomation(false);
        }
    }

    async function handleExportData() {
        setExporting(true);
        try {
            const res = await fetch("/api/account");
            if (res.ok) {
                const data = await res.json();
                const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `autoapply-export-${new Date().toISOString().split("T")[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch {
            setMessage({ type: "error", text: t("messages.exportFailed") });
        } finally {
            setExporting(false);
        }
    }

    const handleCheckout = useCallback(async (plan: CheckoutPlan) => {
        trackBeginCheckout(plan, "settings_subscription");
        try {
            const controller = new AbortController();
            const timeoutId = window.setTimeout(
                () => controller.abort(),
                CHECKOUT_TIMEOUT_MS
            );
            let res: Response;
            try {
                res = await fetch("/api/checkout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        plan,
                        returnPath: window.location.pathname,
                    }),
                    signal: controller.signal,
                });
            } finally {
                window.clearTimeout(timeoutId);
            }
            const data = await res
                .json()
                .catch(() => ({})) as { url?: string; error?: string };

            if (isUnauthorizedCheckoutError(res.status, data.error)) {
                const signInPath = getLocalizedPathForRoute(
                    window.location.pathname,
                    "sign-in"
                );
                window.location.href = buildAuthIntentUrl(
                    signInPath,
                    plan,
                    window.location.pathname
                );
                return;
            }

            if (data.url) {
                window.location.href = data.url;
            } else {
                setMessage({
                    type: "error",
                    text: data.error || t("messages.checkoutFailed"),
                });
            }
        } catch (error) {
            if (isAbortError(error)) {
                setMessage({
                    type: "error",
                    text: t("messages.checkoutTimeout"),
                });
                return;
            }
            setMessage({ type: "error", text: t("messages.networkError") });
        }
    }, [t]);

    useEffect(() => {
        if (!autoUpgradePlan || loading || !user || autoCheckoutTriggeredRef.current) {
            return;
        }

        autoCheckoutTriggeredRef.current = true;
        setMessage({ type: "success", text: t("messages.startingSecureCheckout") });

        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.delete("upgrade");
        const nextQuery = nextParams.toString();
        router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });

        void handleCheckout(autoUpgradePlan);
    }, [autoUpgradePlan, loading, user, pathname, router, searchParams, handleCheckout, t]);

    useEffect(() => {
        if (loading) {
            return;
        }

        const checkoutStatus = searchParams.get("checkout");
        if (!checkoutStatus) {
            return;
        }

        const checkoutPlanParam = searchParams.get("checkout_plan");
        const checkoutRefParam = searchParams.get("checkout_ref");
        const checkoutHandledKey = [
            checkoutStatus,
            checkoutPlanParam || "",
            checkoutRefParam || "",
        ].join(":");

        if (checkoutReturnHandledKeyRef.current === checkoutHandledKey) {
            return;
        }
        checkoutReturnHandledKeyRef.current = checkoutHandledKey;

        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.delete("checkout");
        nextParams.delete("checkout_plan");
        nextParams.delete("checkout_ref");
        const nextQuery = nextParams.toString();
        router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
            scroll: false,
        });

        if (checkoutStatus === "cancelled") {
            setMessage({
                type: "success",
                text: t("messages.checkoutCancelled"),
            });
            return;
        }

        if (checkoutStatus !== "success") {
            return;
        }

        if (isCheckoutPlan(checkoutPlanParam)) {
            trackPurchase(checkoutPlanParam, "settings_checkout_return");
        }

        const baselineSubscriptionStatus = user?.subscriptionStatus || null;
        const baselineCreditsRemaining =
            typeof user?.creditsRemaining === "number" ? user.creditsRemaining : null;

        setMessage({
            type: "success",
            text: t("messages.paymentSyncing"),
        });

        void (async () => {
            for (let attempt = 0; attempt < CHECKOUT_RETURN_SYNC_ATTEMPTS; attempt += 1) {
                try {
                    const refreshedUserRes = await fetchUserWithAuthRetry();
                    if (!refreshedUserRes?.ok) {
                        if (attempt < CHECKOUT_RETURN_SYNC_ATTEMPTS - 1) {
                            await new Promise((resolve) =>
                                window.setTimeout(resolve, CHECKOUT_RETURN_SYNC_DELAY_MS)
                            );
                        }
                        continue;
                    }

                    const data = await refreshedUserRes.json();
                    const refreshedUser = data.user as UserInfo;
                    setUser(refreshedUser);

                    const subscriptionChanged =
                        baselineSubscriptionStatus !== null &&
                        refreshedUser.subscriptionStatus !== baselineSubscriptionStatus;
                    const creditsChanged =
                        baselineCreditsRemaining !== null &&
                        refreshedUser.creditsRemaining !== baselineCreditsRemaining;

                    if (!subscriptionChanged && !creditsChanged) {
                        if (attempt < CHECKOUT_RETURN_SYNC_ATTEMPTS - 1) {
                            await new Promise((resolve) =>
                                window.setTimeout(resolve, CHECKOUT_RETURN_SYNC_DELAY_MS)
                            );
                            continue;
                        }
                    }

                    setMessage({
                        type: "success",
                        text: t("messages.paymentSynced"),
                    });
                    return;
                } catch (err) {
                    console.error("Failed to refresh user after checkout return:", err);
                }
            }

            setMessage({
                type: "success",
                text: t("messages.paymentSyncInProgress"),
            });
        })();
    }, [loading, pathname, router, searchParams, t, user]);

    async function handleDeleteAccount() {
        if (!confirmDelete) {
            setConfirmDelete(true);
            return;
        }
        setDeleting(true);
        try {
            const res = await fetch("/api/account", { method: "DELETE" });
            if (res.ok) {
                window.location.href = "/";
            } else {
                const data = await res.json();
                setMessage({
                    type: "error",
                    text: data.error || t("messages.deleteFailed"),
                });
            }
        } catch {
            setMessage({ type: "error", text: t("messages.networkError") });
        } finally {
            setDeleting(false);
            setConfirmDelete(false);
        }
    }

    if (loading) {
        return <SettingsSkeleton />;
    }

    const normalizedPlanStatus = normalizePlanStatus(user?.subscriptionStatus);
    const automationStatusText =
        normalizedPlanStatus === "free"
            ? t("automation.status.requiresPaidPlan")
            : user?.automationEnabled
              ? t("automation.status.active")
              : t("automation.status.disabled");

    return (
        <div className="space-y-8 max-w-3xl">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
                <p className="text-muted-foreground">
                    {t("description")}
                </p>
            </div>

            {message && (
                <div
                    className={`flex items-center gap-2 p-3 rounded-md text-sm ${
                        message.type === "success"
                            ? "bg-green-50 text-green-800 border border-green-200"
                            : "bg-red-50 text-red-800 border border-red-200"
                    }`}
                >
                    {message.type === "success" ? (
                        <Check className="h-4 w-4" />
                    ) : (
                        <AlertCircle className="h-4 w-4" />
                    )}
                    {message.text}
                </div>
            )}

            {/* Job Preferences */}
            <Card>
                <CardHeader>
                    <CardTitle>{t("jobPreferences.title")}</CardTitle>
                    <CardDescription>
                        {t("jobPreferences.description")}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="text-sm font-medium block mb-1">
                            {t("jobPreferences.targetJobTitles.label")}
                        </label>
                        <input
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            placeholder={t("jobPreferences.targetJobTitles.placeholder")}
                            value={titlesStr}
                            onChange={(e) => setTitlesStr(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {t("jobPreferences.targetJobTitles.hint")}
                        </p>
                    </div>

                    <div>
                        <label className="text-sm font-medium block mb-1">
                            {t("jobPreferences.locations.label")}
                        </label>
                        <input
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            placeholder={t("jobPreferences.locations.placeholder")}
                            value={locationsStr}
                            onChange={(e) => setLocationsStr(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium block mb-1">
                            {t("jobPreferences.remotePreference.label")}
                        </label>
                        <select
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            value={remotePref}
                            onChange={(e) => setRemotePref(e.target.value)}
                        >
                            <option value="any">
                                {t("jobPreferences.remotePreference.options.any")}
                            </option>
                            <option value="remote">
                                {t("jobPreferences.remotePreference.options.remoteOnly")}
                            </option>
                            <option value="hybrid">
                                {t("jobPreferences.remotePreference.options.hybrid")}
                            </option>
                            <option value="onsite">
                                {t("jobPreferences.remotePreference.options.onsite")}
                            </option>
                        </select>
                    </div>

                    <div>
                        <label className="text-sm font-medium block mb-1">
                            {t("jobPreferences.minimumSalary.label")}
                        </label>
                        <div className="flex gap-2">
                            <select
                                className="w-32 px-3 py-2 border rounded-md text-sm shrink-0"
                                value={currencyCode}
                                onChange={(e) => setCurrencyCode(e.target.value)}
                            >
                                {CURRENCIES.map((c) => (
                                    <option key={c.code} value={c.code}>
                                        {c.symbol} {c.code}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="number"
                                className="flex-1 px-3 py-2 border rounded-md text-sm"
                                placeholder={t("jobPreferences.minimumSalary.placeholder", {
                                    amount: currencyCode === "JPY" ? "8000000" : "80000",
                                })}
                                value={salaryStr}
                                onChange={(e) => setSalaryStr(e.target.value)}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {t("jobPreferences.minimumSalary.hint")}
                        </p>
                    </div>

                    <div>
                        <label className="text-sm font-medium block mb-1">
                            {t("jobPreferences.industries.label")}
                        </label>
                        <input
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            placeholder={t("jobPreferences.industries.placeholder")}
                            value={industriesStr}
                            onChange={(e) => setIndustriesStr(e.target.value)}
                        />
                    </div>

                    <Button onClick={handleSavePreferences} disabled={saving}>
                        {saving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        {t("jobPreferences.saveButton")}
                    </Button>
                </CardContent>
            </Card>

            {/* Automation */}
            <Card>
                <CardHeader>
                    <CardTitle>{t("automation.title")}</CardTitle>
                    <CardDescription>
                        {t("automation.description")}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">{t("automation.toggleLabel")}</p>
                            <p className="text-sm text-muted-foreground">{automationStatusText}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {t("automation.linkedinModeNote")}
                            </p>
                        </div>
                        <Button
                            variant={user?.automationEnabled ? "default" : "outline"}
                            onClick={handleToggleAutomation}
                            disabled={
                                togglingAutomation ||
                                user?.subscriptionStatus === "free"
                            }
                        >
                            {togglingAutomation ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : user?.automationEnabled ? (
                                t("automation.state.enabled")
                            ) : (
                                t("automation.state.disabled")
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Subscription */}
            <Card>
                <CardHeader>
                    <CardTitle>{t("subscription.title")}</CardTitle>
                    <CardDescription>{t("subscription.description")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">{t("subscription.currentPlan")}</p>
                            <Badge variant="secondary" className="capitalize">
                                {t(`subscription.planLabels.${normalizedPlanStatus}`)}
                            </Badge>
                        </div>
                        <Button onClick={() => handleCheckout("pro_monthly")}>
                            {t("subscription.upgrade")}
                        </Button>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">{t("subscription.creditsRemaining")}</p>
                            <p className="text-sm text-muted-foreground">
                                {t("subscription.creditsCount", {
                                    count: user?.creditsRemaining ?? 0,
                                })}
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => handleCheckout("credit_pack")}
                        >
                            {t("subscription.buyCredits")}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Data Management (GDPR) */}
            <Card>
                <CardHeader>
                    <CardTitle>{t("dataManagement.title")}</CardTitle>
                    <CardDescription>
                        {t("dataManagement.description")}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">{t("dataManagement.export.title")}</p>
                            <p className="text-sm text-muted-foreground">
                                {t("dataManagement.export.description")}
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={handleExportData}
                            disabled={exporting}
                        >
                            {exporting ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : null}
                            {t("dataManagement.export.button")}
                        </Button>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-destructive">
                                {t("dataManagement.delete.title")}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {confirmDelete
                                    ? t("dataManagement.delete.confirmHint")
                                    : t("dataManagement.delete.description")}
                            </p>
                        </div>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteAccount}
                            disabled={deleting}
                        >
                            {deleting ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : null}
                            {confirmDelete
                                ? t("dataManagement.delete.confirmButton")
                                : t("dataManagement.delete.button")}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
