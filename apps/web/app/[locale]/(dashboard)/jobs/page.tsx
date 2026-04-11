"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Search,
    MapPin,
    DollarSign,
    ExternalLink,
    Loader2,
    Plus,
    X,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { Skeleton } from "@/components/loading-skeleton";

interface JobWithApplication {
    id: string;
    title: string;
    company: string;
    location: string;
    description: string;
    source: string;
    url: string;
    salary: string | null;
    fetchedAt: string;
    application: {
        id: string;
        compatibilityScore: number;
        atsKeywords: string[];
        status: string;
        recommendation: string | null;
    } | null;
}

export default function JobsPage() {
    const t = useTranslations("dashboard.jobsPage");
    const [jobs, setJobs] = useState<JobWithApplication[]>([]);
    const [hasAnyJobs, setHasAnyJobs] = useState(false);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [source, setSource] = useState("");
    const [minScore, setMinScore] = useState("");
    const [sort, setSort] = useState("newest");
    const [showPasteDialog, setShowPasteDialog] = useState(false);
    const [pasteForm, setPasteForm] = useState({
        jobDescription: "",
        jobTitle: "",
        company: "",
        jobUrl: "",
    });
    const [tailorError, setTailorError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [tailoringJobId, setTailoringJobId] = useState<string | null>(null);

    // Use refs to avoid unstable closure dependencies in the debounced effect
    const searchRef = useRef(search);
    const sourceRef = useRef(source);
    const minScoreRef = useRef(minScore);
    const sortRef = useRef(sort);
    searchRef.current = search;
    sourceRef.current = source;
    minScoreRef.current = minScore;
    sortRef.current = sort;

    const fetchJobs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchRef.current) params.set("search", searchRef.current);
            if (sourceRef.current) params.set("source", sourceRef.current);
            if (minScoreRef.current) params.set("minScore", minScoreRef.current);
            if (sortRef.current) params.set("sort", sortRef.current);

            const res = await fetch(`/api/jobs?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setJobs(Array.isArray(data.jobs) ? data.jobs : []);
                setHasAnyJobs(Boolean(data.hasAnyJobs));
            }
        } catch (err) {
            console.error("Failed to fetch jobs:", err);
        } finally {
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Debounced fetch: 300ms delay on filter changes, immediate on mount
    useEffect(() => {
        const timeout = setTimeout(fetchJobs, 300);
        return () => clearTimeout(timeout);
    }, [search, source, minScore, sort, fetchJobs]);

    async function handlePasteSubmit() {
        if (!pasteForm.jobDescription.trim()) return;
        setSubmitting(true);
        setTailorError(null);
        try {
            const res = await fetch("/api/tailor", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(pasteForm),
            });

            const payload = await res.json().catch(() => ({}));
            if (res.ok) {
                setShowPasteDialog(false);
                setTailorError(null);
                setPasteForm({ jobDescription: "", jobTitle: "", company: "", jobUrl: "" });
                setTimeout(fetchJobs, 2000);
                return;
            }

            setTailorError(
                typeof payload?.error === "string" && payload.error.trim()
                    ? payload.error.trim()
                    : "Tailoring dispatch failed. Please try again."
            );
        } catch (err) {
            console.error("Failed to submit tailoring:", err);
            setTailorError("Network error while sending tailoring request. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    async function handleTailorCV(job: JobWithApplication) {
        setTailoringJobId(job.id);
        try {
            await fetch("/api/tailor", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jobDescription: job.description,
                    jobTitle: job.title,
                    company: job.company,
                    jobUrl: job.url,
                }),
            });
            setTimeout(fetchJobs, 2000);
        } catch (err) {
            console.error("Failed to tailor:", err);
        } finally {
            setTailoringJobId(null);
        }
    }

    function getScoreBadgeVariant(score: number): "default" | "secondary" | "outline" {
        if (score >= 80) return "default";
        if (score >= 60) return "secondary";
        return "outline";
    }

    function clearFilters() {
        setSearch("");
        setSource("");
        setMinScore("");
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
                    <p className="text-muted-foreground">
                        {t("description")}
                    </p>
                </div>
                <Button className="gap-2" onClick={() => setShowPasteDialog(true)}>
                    <Plus className="h-4 w-4" />
                    {t("actions.pasteJob")}
                </Button>
            </div>

            {/* Paste Job Dialog */}
            {showPasteDialog && (
                <Card className="border-primary">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>{t("pasteDialog.title")}</CardTitle>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowPasteDialog(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <CardDescription>
                            {t("pasteDialog.description")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <input
                                className="px-3 py-2 border rounded-md text-sm"
                                placeholder={t("pasteDialog.jobTitle")}
                                value={pasteForm.jobTitle}
                                onChange={(e) =>
                                    setPasteForm((f) => ({ ...f, jobTitle: e.target.value }))
                                }
                            />
                            <input
                                className="px-3 py-2 border rounded-md text-sm"
                                placeholder={t("pasteDialog.company")}
                                value={pasteForm.company}
                                onChange={(e) =>
                                    setPasteForm((f) => ({ ...f, company: e.target.value }))
                                }
                            />
                        </div>
                        <input
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            placeholder={t("pasteDialog.jobUrl")}
                            value={pasteForm.jobUrl}
                            onChange={(e) =>
                                setPasteForm((f) => ({ ...f, jobUrl: e.target.value }))
                            }
                        />
                        <textarea
                            className="w-full h-48 p-3 border rounded-md text-sm resize-none"
                            placeholder={t("pasteDialog.jobDescription")}
                            value={pasteForm.jobDescription}
                            onChange={(e) =>
                                setPasteForm((f) => ({
                                    ...f,
                                    jobDescription: e.target.value,
                                }))
                            }
                        />
                        <Button
                            onClick={handlePasteSubmit}
                            disabled={submitting || !pasteForm.jobDescription.trim()}
                            className="w-full"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    {t("pasteDialog.submitting")}
                                </>
                            ) : (
                                t("pasteDialog.tailorMyCv")
                            )}
                        </Button>
                        {tailorError && (
                            <p className="text-sm text-red-600">{tailorError}</p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Filters */}
            <div className="flex gap-4 flex-wrap">
                <input
                    className="px-3 py-2 border rounded-md text-sm w-64"
                    placeholder={t("filters.searchPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <select
                    className="px-3 py-2 border rounded-md text-sm"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                >
                    <option value="">{t("filters.allSources")}</option>
                    <option value="adzuna">Adzuna</option>
                    <option value="themuse">The Muse</option>
                    <option value="remotive">Remotive</option>
                    <option value="arbeitnow">Arbeitnow</option>
                    <option value="jsearch">JSearch</option>
                    <option value="jooble">Jooble</option>
                    <option value="reed">Reed</option>
                    <option value="linkedin">{t("filters.linkedinManualImport")}</option>
                    <option value="manual">{t("filters.manual")}</option>
                </select>
                <select
                    className="px-3 py-2 border rounded-md text-sm"
                    aria-label={t("filters.sortBy")}
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                >
                    <option value="newest">{t("filters.sortNewest")}</option>
                    <option value="highest_match">{t("filters.sortHighestMatch")}</option>
                </select>
                <select
                    className="px-3 py-2 border rounded-md text-sm"
                    value={minScore}
                    onChange={(e) => setMinScore(e.target.value)}
                >
                    <option value="">{t("filters.minScoreAny")}</option>
                    <option value="60">60%+</option>
                    <option value="75">75%+</option>
                    <option value="90">90%+</option>
                </select>
            </div>

            {/* Jobs List */}
            <div className="space-y-4">
                {loading ? (
                    <>
                        {[...Array(4)].map((_, i) => (
                            <Card key={i}>
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-2 flex-1">
                                            <Skeleton className="h-5 w-48" />
                                            <Skeleton className="h-4 w-32" />
                                            <div className="flex gap-3">
                                                <Skeleton className="h-4 w-24" />
                                                <Skeleton className="h-4 w-20" />
                                                <Skeleton className="h-5 w-16 rounded-full" />
                                            </div>
                                        </div>
                                        <div className="flex gap-2 ml-4">
                                            <Skeleton className="h-8 w-16" />
                                            <Skeleton className="h-8 w-20" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </>
                ) : jobs.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">
                                {hasAnyJobs ? t("empty.filteredTitle") : t("empty.title")}
                            </h3>
                            <p className="text-muted-foreground mb-4">
                                {hasAnyJobs
                                    ? t("empty.filteredDescription")
                                    : t("empty.description")}
                            </p>
                            {hasAnyJobs ? (
                                <Button variant="outline" onClick={clearFilters}>
                                    {t("empty.clearFilters")}
                                </Button>
                            ) : (
                                <div className="flex gap-3 justify-center">
                                    <Link href="/settings">
                                        <Button variant="outline">
                                            {t("empty.configurePreferences")}
                                        </Button>
                                    </Link>
                                    <Button onClick={() => setShowPasteDialog(true)}>
                                        {t("actions.pasteJob")}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    jobs.map((job) => (
                        <Card
                            key={job.id}
                            className="hover:shadow-md transition-shadow"
                        >
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1 flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-lg">
                                                {job.title}
                                            </h3>
                                            {job.application && (
                                                <Badge
                                                    variant={getScoreBadgeVariant(
                                                        job.application.compatibilityScore
                                                    )}
                                                >
                                                    {job.application.compatibilityScore}%
                                                    {t("labels.match")}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {job.company}
                                        </p>
                                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <MapPin className="h-3 w-3" /> {job.location}
                                            </span>
                                            {job.salary && (
                                                <span className="flex items-center gap-1">
                                                    <DollarSign className="h-3 w-3" />{" "}
                                                    {job.salary}
                                                </span>
                                            )}
                                            <Badge variant="outline" className="text-xs">
                                                {job.source}
                                            </Badge>
                                        </div>
                                        {job.application?.atsKeywords &&
                                            job.application.atsKeywords.length > 0 && (
                                                <div className="flex gap-1 mt-2 flex-wrap">
                                                    {job.application.atsKeywords
                                                        .slice(0, 5)
                                                        .map((kw) => (
                                                            <Badge
                                                                key={kw}
                                                                variant="outline"
                                                                className="text-xs"
                                                            >
                                                                {kw}
                                                            </Badge>
                                                        ))}
                                                </div>
                                            )}
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        {job.url && job.url.trim().length > 0 && (
                                            <a
                                                href={job.url.trim()}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <Button variant="outline" size="sm">
                                                    <ExternalLink className="h-3 w-3 mr-1" />{" "}
                                                    {t("actions.viewOriginalJobPost")}
                                                </Button>
                                            </a>
                                        )}
                                        {job.application ? (
                                            <Link
                                                href={`/documents/${job.application.id}`}
                                            >
                                                <Button size="sm" variant="secondary">
                                                    {t("actions.viewDocs")}
                                                </Button>
                                            </Link>
                                        ) : (
                                            <Button
                                                size="sm"
                                                onClick={() => handleTailorCV(job)}
                                                disabled={tailoringJobId === job.id}
                                            >
                                                {tailoringJobId === job.id ? (
                                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                ) : null}
                                                {t("actions.tailorCv")}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
