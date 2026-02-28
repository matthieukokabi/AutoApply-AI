"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Sparkles,
    Upload,
    FileText,
    Briefcase,
    ChevronRight,
    ChevronLeft,
    Loader2,
    Check,
    AlertCircle,
} from "lucide-react";

type Step = "welcome" | "cv" | "preferences" | "done";

export default function OnboardingPage() {
    const router = useRouter();
    const { isSignedIn, isLoaded } = useAuth();
    const [step, setStep] = useState<Step>("welcome");
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [rawText, setRawText] = useState("");
    const [cvUploaded, setCvUploaded] = useState(false);
    const [error, setError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Preferences
    const [titles, setTitles] = useState("");
    const [locations, setLocations] = useState("");
    const [remote, setRemote] = useState("any");
    const [salary, setSalary] = useState("");

    // Redirect to sign-in if not authenticated
    if (isLoaded && !isSignedIn) {
        router.push("/sign-in");
        return null;
    }

    async function handleFileUpload(file: File) {
        setUploading(true);
        setError("");
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/profile/upload", {
                method: "POST",
                body: formData,
            });
            if (res.ok) {
                const data = await res.json();
                setRawText(data.profile.rawText);
                setCvUploaded(true);
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.error || `Upload failed (${res.status}). Please try again or paste your CV text instead.`);
            }
        } catch (err) {
            console.error("Upload failed:", err);
            setError("Network error — please check your connection and try again.");
        } finally {
            setUploading(false);
        }
    }

    async function handleSaveText() {
        if (!rawText.trim() || rawText.trim().length < 50) return;
        setUploading(true);
        setError("");
        try {
            const res = await fetch("/api/profile/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rawText, fileName: "paste" }),
            });
            if (res.ok) {
                setCvUploaded(true);
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.error || "Failed to save CV text. Please try again.");
            }
        } catch (err) {
            console.error("Save failed:", err);
            setError("Network error — please check your connection and try again.");
        } finally {
            setUploading(false);
        }
    }

    async function handleSavePreferences() {
        setSaving(true);
        setError("");
        try {
            const res = await fetch("/api/preferences", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetTitles: titles.split(",").map((s) => s.trim()).filter(Boolean),
                    locations: locations.split(",").map((s) => s.trim()).filter(Boolean),
                    remotePreference: remote,
                    salaryMin: salary || null,
                    industries: [],
                }),
            });
            if (res.ok) {
                setStep("done");
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.error || "Failed to save preferences. Please try again.");
            }
        } catch (err) {
            console.error("Save preferences failed:", err);
            setError("Network error — please check your connection and try again.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
            <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur">
                <div className="container flex h-14 items-center">
                    <Link href="/" className="flex items-center space-x-2">
                        <Sparkles className="h-6 w-6 text-primary" />
                        <span className="font-bold text-xl">AutoApply AI</span>
                    </Link>
                </div>
            </header>

            <main className="flex-1 flex items-center justify-center p-4">
                <div className="w-full max-w-lg">
                    {/* Progress */}
                    <div className="flex items-center justify-center gap-2 mb-8">
                        {(["welcome", "cv", "preferences", "done"] as Step[]).map((s, i) => (
                            <div
                                key={s}
                                className={`h-2 rounded-full transition-all ${
                                    i <= ["welcome", "cv", "preferences", "done"].indexOf(step)
                                        ? "bg-primary w-8"
                                        : "bg-muted w-4"
                                }`}
                            />
                        ))}
                    </div>

                    {step === "welcome" && (
                        <Card>
                            <CardHeader className="text-center">
                                <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                    <Sparkles className="h-8 w-8 text-primary" />
                                </div>
                                <CardTitle className="text-2xl">Welcome to AutoApply AI</CardTitle>
                                <CardDescription className="text-base">
                                    Let&apos;s set up your profile in 2 quick steps so the AI can start
                                    matching and tailoring documents for you.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex justify-center">
                                <Button size="lg" onClick={() => setStep("cv")} className="gap-2">
                                    Get Started <ChevronRight className="h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {step === "cv" && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Upload className="h-5 w-5" />
                                    Step 1: Upload Your CV
                                </CardTitle>
                                <CardDescription>
                                    Upload your master CV. The AI will use it as the source of truth — it
                                    never fabricates information.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {error && (
                                    <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                                        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
                                        <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                            {error}
                                        </p>
                                    </div>
                                )}
                                {cvUploaded ? (
                                    <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                                        <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                                        <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                            CV uploaded successfully!
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div
                                            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                                            onClick={() => fileInputRef.current?.click()}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                const file = e.dataTransfer.files[0];
                                                if (file) handleFileUpload(file);
                                            }}
                                            onDragOver={(e) => e.preventDefault()}
                                        >
                                            {uploading ? (
                                                <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
                                            ) : (
                                                <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
                                            )}
                                            <p className="mt-2 text-sm font-medium">
                                                Drop your CV here or click to upload
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                PDF, DOCX, or TXT (max 5MB)
                                            </p>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".pdf,.docx,.txt"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleFileUpload(file);
                                                }}
                                            />
                                        </div>

                                        <div className="relative">
                                            <div className="absolute inset-0 flex items-center">
                                                <div className="w-full border-t" />
                                            </div>
                                            <div className="relative flex justify-center text-xs uppercase">
                                                <span className="bg-card px-2 text-muted-foreground">
                                                    or paste text
                                                </span>
                                            </div>
                                        </div>

                                        <textarea
                                            className="w-full h-32 p-3 border rounded-md text-sm resize-none"
                                            placeholder="Paste your CV text here..."
                                            value={rawText}
                                            onChange={(e) => setRawText(e.target.value)}
                                        />
                                        {rawText.length > 50 && (
                                            <Button
                                                variant="outline"
                                                className="w-full"
                                                onClick={handleSaveText}
                                                disabled={uploading}
                                            >
                                                Save Text
                                            </Button>
                                        )}
                                    </>
                                )}

                                <div className="flex justify-between pt-2">
                                    <Button variant="ghost" onClick={() => setStep("welcome")}>
                                        <ChevronLeft className="h-4 w-4 mr-1" /> Back
                                    </Button>
                                    <Button
                                        onClick={() => setStep("preferences")}
                                        disabled={!cvUploaded}
                                        className="gap-1"
                                    >
                                        Next <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {step === "preferences" && (
                        <Card>
                            {error && (
                                <div className="mx-6 mt-6 flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
                                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                        {error}
                                    </p>
                                </div>
                            )}
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Briefcase className="h-5 w-5" />
                                    Step 2: Job Preferences
                                </CardTitle>
                                <CardDescription>
                                    Tell us what you&apos;re looking for so we can find the best matches.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium block mb-1">
                                        Target Job Titles
                                    </label>
                                    <input
                                        className="w-full px-3 py-2 border rounded-md text-sm"
                                        placeholder="e.g. Frontend Engineer, React Developer"
                                        value={titles}
                                        onChange={(e) => setTitles(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium block mb-1">Locations</label>
                                    <input
                                        className="w-full px-3 py-2 border rounded-md text-sm"
                                        placeholder="e.g. London, Berlin, Remote"
                                        value={locations}
                                        onChange={(e) => setLocations(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium block mb-1">
                                        Remote Preference
                                    </label>
                                    <select
                                        className="w-full px-3 py-2 border rounded-md text-sm"
                                        value={remote}
                                        onChange={(e) => setRemote(e.target.value)}
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
                                        value={salary}
                                        onChange={(e) => setSalary(e.target.value)}
                                    />
                                </div>

                                <div className="flex justify-between pt-2">
                                    <Button variant="ghost" onClick={() => setStep("cv")}>
                                        <ChevronLeft className="h-4 w-4 mr-1" /> Back
                                    </Button>
                                    <Button
                                        onClick={handleSavePreferences}
                                        disabled={saving || !titles.trim()}
                                        className="gap-1"
                                    >
                                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                        Complete Setup <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {step === "done" && (
                        <Card>
                            <CardHeader className="text-center">
                                <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                                    <Check className="h-8 w-8 text-green-600" />
                                </div>
                                <CardTitle className="text-2xl">You&apos;re All Set!</CardTitle>
                                <CardDescription className="text-base">
                                    Your profile is ready. The AI will now match jobs to your
                                    background and generate tailored documents.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex justify-center">
                                <Button size="lg" onClick={() => router.push("/dashboard")}>
                                    Go to Dashboard
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </main>
        </div>
    );
}
