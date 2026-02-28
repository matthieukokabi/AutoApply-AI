"use client";

import { useState, useEffect, useCallback } from "react";
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
    const [jobs, setJobs] = useState<JobWithApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [source, setSource] = useState("");
    const [minScore, setMinScore] = useState("");
    const [showPasteDialog, setShowPasteDialog] = useState(false);
    const [pasteForm, setPasteForm] = useState({
        jobDescription: "",
        jobTitle: "",
        company: "",
        jobUrl: "",
    });
    const [submitting, setSubmitting] = useState(false);
    const [tailoringJobId, setTailoringJobId] = useState<string | null>(null);

    const fetchJobs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            if (source) params.set("source", source);
            if (minScore) params.set("minScore", minScore);

            const res = await fetch(`/api/jobs?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setJobs(data.jobs);
            }
        } catch (err) {
            console.error("Failed to fetch jobs:", err);
        } finally {
            setLoading(false);
        }
    }, [search, source, minScore]);

    useEffect(() => {
        const timeout = setTimeout(fetchJobs, 300);
        return () => clearTimeout(timeout);
    }, [fetchJobs]);

    async function handlePasteSubmit() {
        if (!pasteForm.jobDescription.trim()) return;
        setSubmitting(true);
        try {
            const res = await fetch("/api/tailor", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(pasteForm),
            });
            if (res.ok) {
                setShowPasteDialog(false);
                setPasteForm({ jobDescription: "", jobTitle: "", company: "", jobUrl: "" });
                setTimeout(fetchJobs, 2000);
            }
        } catch (err) {
            console.error("Failed to submit tailoring:", err);
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

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Job Feed</h1>
                    <p className="text-muted-foreground">
                        Browse discovered jobs sorted by compatibility score.
                    </p>
                </div>
                <Button className="gap-2" onClick={() => setShowPasteDialog(true)}>
                    <Plus className="h-4 w-4" />
                    Paste Job
                </Button>
            </div>

            {/* Paste Job Dialog */}
            {showPasteDialog && (
                <Card className="border-primary">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Paste Job Description</CardTitle>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowPasteDialog(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <CardDescription>
                            Paste a job description and we&apos;ll tailor your CV to it.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <input
                                className="px-3 py-2 border rounded-md text-sm"
                                placeholder="Job Title"
                                value={pasteForm.jobTitle}
                                onChange={(e) =>
                                    setPasteForm((f) => ({ ...f, jobTitle: e.target.value }))
                                }
                            />
                            <input
                                className="px-3 py-2 border rounded-md text-sm"
                                placeholder="Company"
                                value={pasteForm.company}
                                onChange={(e) =>
                                    setPasteForm((f) => ({ ...f, company: e.target.value }))
                                }
                            />
                        </div>
                        <input
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            placeholder="Job URL (optional)"
                            value={pasteForm.jobUrl}
                            onChange={(e) =>
                                setPasteForm((f) => ({ ...f, jobUrl: e.target.value }))
                            }
                        />
                        <textarea
                            className="w-full h-48 p-3 border rounded-md text-sm resize-none"
                            placeholder="Paste the full job description here..."
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
                                    Submitting...
                                </>
                            ) : (
                                "Tailor My CV"
                            )}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Filters */}
            <div className="flex gap-4 flex-wrap">
                <input
                    className="px-3 py-2 border rounded-md text-sm w-64"
                    placeholder="Search by title or company..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <select
                    className="px-3 py-2 border rounded-md text-sm"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                >
                    <option value="">All Sources</option>
                    <option value="adzuna">Adzuna</option>
                    <option value="themuse">The Muse</option>
                    <option value="remotive">Remotive</option>
                    <option value="arbeitnow">Arbeitnow</option>
                    <option value="manual">Manual</option>
                </select>
                <select
                    className="px-3 py-2 border rounded-md text-sm"
                    value={minScore}
                    onChange={(e) => setMinScore(e.target.value)}
                >
                    <option value="">Min Score: Any</option>
                    <option value="60">60+</option>
                    <option value="75">75+</option>
                    <option value="90">90+</option>
                </select>
            </div>

            {/* Jobs List */}
            <div className="space-y-4">
                {loading ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">Loading jobs...</p>
                        </CardContent>
                    </Card>
                ) : jobs.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">
                                No jobs discovered yet
                            </h3>
                            <p className="text-muted-foreground mb-4">
                                Set up your preferences in Settings, or paste a job to get
                                started.
                            </p>
                            <div className="flex gap-3 justify-center">
                                <Link href="/settings">
                                    <Button variant="outline">Configure Preferences</Button>
                                </Link>
                                <Button onClick={() => setShowPasteDialog(true)}>
                                    Paste Job
                                </Button>
                            </div>
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
                                                    Match
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
                                        {job.url && (
                                            <a
                                                href={job.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                <Button variant="outline" size="sm">
                                                    <ExternalLink className="h-3 w-3 mr-1" />{" "}
                                                    View
                                                </Button>
                                            </a>
                                        )}
                                        {job.application ? (
                                            <Link
                                                href={`/documents/${job.application.id}`}
                                            >
                                                <Button size="sm" variant="secondary">
                                                    View Docs
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
                                                Tailor CV
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
