"use client";

import { useState, useEffect } from "react";
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
    industries: string[];
}

export default function SettingsPage() {
    const [user, setUser] = useState<UserInfo | null>(null);
    const [prefs, setPrefs] = useState<Preferences>({
        targetTitles: [],
        locations: [],
        remotePreference: "any",
        salaryMin: null,
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
    const [remotePref, setRemotePref] = useState("any");

    useEffect(() => {
        async function load() {
            try {
                const [userRes, prefsRes] = await Promise.all([
                    fetch("/api/user"),
                    fetch("/api/preferences"),
                ]);

                if (userRes.ok) {
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
                    industries: industriesStr
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                }),
            });

            if (res.ok) {
                setMessage({ type: "success", text: "Preferences saved." });
            } else {
                const data = await res.json();
                setMessage({ type: "error", text: data.error || "Failed to save." });
            }
        } catch {
            setMessage({ type: "error", text: "Network error." });
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
            setMessage({ type: "error", text: "Network error." });
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
            setMessage({ type: "error", text: "Export failed." });
        } finally {
            setExporting(false);
        }
    }

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
                setMessage({ type: "error", text: data.error || "Delete failed." });
            }
        } catch {
            setMessage({ type: "error", text: "Network error." });
        } finally {
            setDeleting(false);
            setConfirmDelete(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-3xl">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">
                    Configure your job preferences and automation settings.
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
                    <CardTitle>Job Preferences</CardTitle>
                    <CardDescription>
                        Define what jobs you&apos;re looking for. The AI will use these to
                        filter and score job listings.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="text-sm font-medium block mb-1">
                            Target Job Titles
                        </label>
                        <input
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            placeholder="e.g. Frontend Engineer, Full Stack Developer, React Developer"
                            value={titlesStr}
                            onChange={(e) => setTitlesStr(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Comma-separated list of desired job titles
                        </p>
                    </div>

                    <div>
                        <label className="text-sm font-medium block mb-1">Locations</label>
                        <input
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            placeholder="e.g. London, Berlin, New York"
                            value={locationsStr}
                            onChange={(e) => setLocationsStr(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium block mb-1">
                            Remote Preference
                        </label>
                        <select
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            value={remotePref}
                            onChange={(e) => setRemotePref(e.target.value)}
                        >
                            <option value="any">Any</option>
                            <option value="remote">Remote Only</option>
                            <option value="hybrid">Hybrid</option>
                            <option value="onsite">On-site</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-sm font-medium block mb-1">
                            Minimum Salary (Annual, USD)
                        </label>
                        <input
                            type="number"
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            placeholder="e.g. 80000"
                            value={salaryStr}
                            onChange={(e) => setSalaryStr(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium block mb-1">Industries</label>
                        <input
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            placeholder="e.g. Technology, Finance, Healthcare"
                            value={industriesStr}
                            onChange={(e) => setIndustriesStr(e.target.value)}
                        />
                    </div>

                    <Button onClick={handleSavePreferences} disabled={saving}>
                        {saving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        Save Preferences
                    </Button>
                </CardContent>
            </Card>

            {/* Automation */}
            <Card>
                <CardHeader>
                    <CardTitle>Automation</CardTitle>
                    <CardDescription>
                        Enable automated job discovery. When on, the system checks for new
                        matching jobs every 4 hours.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Automated Job Discovery</p>
                            <p className="text-sm text-muted-foreground">
                                {user?.subscriptionStatus === "free"
                                    ? "Requires Pro or Unlimited subscription"
                                    : user?.automationEnabled
                                      ? "Active - checking every 4 hours"
                                      : "Disabled"}
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
                                "Enabled"
                            ) : (
                                "Disabled"
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Subscription */}
            <Card>
                <CardHeader>
                    <CardTitle>Subscription</CardTitle>
                    <CardDescription>Manage your plan and billing.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Current Plan</p>
                            <Badge variant="secondary" className="capitalize">
                                {user?.subscriptionStatus || "free"}
                            </Badge>
                        </div>
                        <Button>Upgrade</Button>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Credits Remaining</p>
                            <p className="text-sm text-muted-foreground">
                                {user?.creditsRemaining ?? 0} credits
                            </p>
                        </div>
                        <Button variant="outline">Buy Credits</Button>
                    </div>
                </CardContent>
            </Card>

            {/* Data Management (GDPR) */}
            <Card>
                <CardHeader>
                    <CardTitle>Data Management</CardTitle>
                    <CardDescription>
                        GDPR-compliant data controls. You have full control over your data.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Export My Data</p>
                            <p className="text-sm text-muted-foreground">
                                Download all your data in JSON format
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
                            Export
                        </Button>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-destructive">Delete Account</p>
                            <p className="text-sm text-muted-foreground">
                                {confirmDelete
                                    ? "Click again to confirm permanent deletion"
                                    : "Permanently delete your account and all associated data"}
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
                            {confirmDelete ? "Confirm Delete" : "Delete Account"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
