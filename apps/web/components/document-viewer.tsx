"use client";

import { useState } from "react";
import { CVDisplay } from "@/components/cv-display";
import { CoverLetterDisplay } from "@/components/cover-letter-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    FileText,
    Mail,
    FileDown,
    ArrowLeft,
    CheckCircle,
    AlertTriangle,
    Sparkles,
    RefreshCw,
    Plus,
    X,
    Loader2,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { normalizeCoverLetterMarkdown, normalizeCvMarkdown } from "@/lib/document-model";

interface DocumentViewerProps {
    application: {
        id: string;
        tailoredCvMarkdown: string | null;
        coverLetterMarkdown: string | null;
        compatibilityScore: number;
        atsKeywords: string[];
        matchingStrengths: string[];
        gaps: string[];
        recommendation: string;
        status: string;
    };
    jobId: string;
    job: {
        title: string;
        company: string;
        location: string;
    };
    jobDescription?: string;
    photoBase64?: string;
    originalCvText?: string;
}

type Tab = "cv" | "letter" | "original";

function safeNormalizeCvForEditor(markdown: string | null) {
    if (!markdown) return "";
    const trimmed = markdown.trim();
    if (!trimmed) return "";

    try {
        return normalizeCvMarkdown(trimmed);
    } catch {
        return trimmed;
    }
}

function safeNormalizeLetterForEditor(markdown: string | null) {
    if (!markdown) return "";
    const trimmed = markdown.trim();
    if (!trimmed) return "";

    try {
        return normalizeCoverLetterMarkdown(trimmed);
    } catch {
        return trimmed;
    }
}

export function DocumentViewer({
    application,
    jobId,
    job,
    jobDescription,
    photoBase64,
    originalCvText,
}: DocumentViewerProps) {
    const t = useTranslations("documentViewer");
    const initialCvMarkdown = safeNormalizeCvForEditor(application.tailoredCvMarkdown);
    const initialCoverLetterMarkdown = safeNormalizeLetterForEditor(
        application.coverLetterMarkdown
    );
    const [activeTab, setActiveTab] = useState<Tab>("cv");
    const [downloadingCv, setDownloadingCv] = useState(false);
    const [downloadingLetter, setDownloadingLetter] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    const [editorMessage, setEditorMessage] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);
    const [cvMarkdown, setCvMarkdown] = useState(initialCvMarkdown);
    const [coverLetterMarkdown, setCoverLetterMarkdown] = useState(
        initialCoverLetterMarkdown
    );
    const [savedCvMarkdown, setSavedCvMarkdown] = useState(initialCvMarkdown);
    const [savedCoverLetterMarkdown, setSavedCoverLetterMarkdown] = useState(
        initialCoverLetterMarkdown
    );
    const [cvDisplayOptions, setCvDisplayOptions] = useState({
        showPhoto: true,
        showEmail: true,
        showPhone: true,
        showLocation: true,
        showLinkedin: true,
        showWebsite: true,
    });

    // Gap-filling state
    const [gapResponses, setGapResponses] = useState<Record<number, string>>(
        {}
    );
    const [activeGapIndex, setActiveGapIndex] = useState<number | null>(null);
    const [retailoring, setRetailoring] = useState(false);
    const [retailorMessage, setRetailorMessage] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);

    async function downloadPdf(
        type: "cv" | "letter",
        markdown: string,
        fileName: string
    ) {
        const setBusy = type === "cv" ? setDownloadingCv : setDownloadingLetter;
        setBusy(true);

        try {
            const response = await fetch("/api/export/pdf", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type,
                    markdown,
                    fileName,
                }),
            });

            if (!response.ok) {
                throw new Error(`EXPORT_FAILED_${response.status}`);
            }

            const blob = await response.blob();
            const objectUrl = window.URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = objectUrl;
            anchor.download = fileName;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.URL.revokeObjectURL(objectUrl);
        } catch (error) {
            console.error("PDF export failed:", error);
        } finally {
            setBusy(false);
        }
    }

    const handleRetailor = async () => {
        // Build additional context from gap responses
        const filledGaps = Object.entries(gapResponses)
            .filter(([, response]) => response.trim())
            .map(([idx, response]) => {
                const gap = application.gaps[Number(idx)];
                return `Regarding "${gap}": ${response}`;
            });

        if (filledGaps.length === 0) {
            setRetailorMessage({
                type: "error",
                text: t("gaps.fillAtLeastOne"),
            });
            return;
        }

        setRetailoring(true);
        setRetailorMessage(null);

        try {
            const res = await fetch("/api/tailor", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jobId,
                    jobTitle: job.title,
                    company: job.company,
                    jobDescription: jobDescription || "",
                    additionalContext: filledGaps.join("\n"),
                }),
            });

            if (res.ok) {
                setRetailorMessage({
                    type: "success",
                    text: t("gaps.retailorStarted"),
                });
                setGapResponses({});
                setActiveGapIndex(null);

                // Auto-refresh the page after a delay to show updated results
                setTimeout(() => {
                    window.location.reload();
                }, 30000);
            } else {
                const data = await res.json();
                setRetailorMessage({
                    type: "error",
                    text: data.error || t("gaps.retailorFailed"),
                });
            }
        } catch {
            setRetailorMessage({
                type: "error",
                text: t("gaps.networkError"),
            });
        } finally {
            setRetailoring(false);
        }
    };

    async function handleSaveEdits() {
        const payload: Record<string, string | null> = {};
        if (activeTab === "cv") {
            payload.tailoredCvMarkdown = cvMarkdown;
        }
        if (activeTab === "letter") {
            payload.coverLetterMarkdown = coverLetterMarkdown;
        }
        if (!Object.keys(payload).length) {
            return;
        }

        setSavingDraft(true);
        setEditorMessage(null);
        try {
            const response = await fetch(`/api/applications/${application.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                setEditorMessage({
                    type: "error",
                    text: data.error || "Failed to save document edits.",
                });
                return;
            }

            if (activeTab === "cv") {
                setSavedCvMarkdown(cvMarkdown);
            } else if (activeTab === "letter") {
                setSavedCoverLetterMarkdown(coverLetterMarkdown);
            }

            setEditorMessage({
                type: "success",
                text: "Document edits saved.",
            });
        } catch {
            setEditorMessage({
                type: "error",
                text: "Network error while saving edits.",
            });
        } finally {
            setSavingDraft(false);
        }
    }

    const filledCount = Object.values(gapResponses).filter(
        (r) => r.trim()
    ).length;
    const hasCvChanges = cvMarkdown !== savedCvMarkdown;
    const hasCoverLetterChanges = coverLetterMarkdown !== savedCoverLetterMarkdown;

    const scoreColor =
        application.compatibilityScore >= 80
            ? "text-green-600 dark:text-green-400"
            : application.compatibilityScore >= 60
              ? "text-amber-600 dark:text-amber-400"
              : "text-red-600 dark:text-red-400";

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        {
            id: "cv",
            label: t("tabs.tailoredCv"),
            icon: <FileText className="w-4 h-4" />,
        },
        {
            id: "letter",
            label: t("tabs.coverLetter"),
            icon: <Mail className="w-4 h-4" />,
        },
        {
            id: "original",
            label: t("tabs.originalCv"),
            icon: <FileText className="w-4 h-4" />,
        },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold">{job.title}</h1>
                        <p className="text-sm text-muted-foreground">
                            {job.company} · {job.location}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Badge
                        variant="outline"
                        className={`text-base px-3 py-1 ${scoreColor}`}
                    >
                        <Sparkles className="w-4 h-4 mr-1" />
                        {application.compatibilityScore}% {t("match")}
                    </Badge>
                    {activeTab === "cv" && cvMarkdown && (
                        <Button
                            onClick={() =>
                                downloadPdf(
                                    "cv",
                                    cvMarkdown,
                                    t("print.cvTitle", {
                                        jobTitle: job.title,
                                        company: job.company,
                                    }) + ".pdf"
                                )
                            }
                            variant="default"
                            className="gap-2"
                            disabled={downloadingCv}
                        >
                            {downloadingCv ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <FileDown className="w-4 h-4" />
                            )}
                            {t("actions.downloadCv")}
                        </Button>
                    )}
                    {activeTab === "letter" &&
                        coverLetterMarkdown && (
                            <Button
                                onClick={() =>
                                    downloadPdf(
                                        "letter",
                                        coverLetterMarkdown,
                                        t("print.letterTitle", {
                                            jobTitle: job.title,
                                            company: job.company,
                                        }) + ".pdf"
                                    )
                                }
                                variant="default"
                                className="gap-2"
                                disabled={downloadingLetter}
                            >
                                {downloadingLetter ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <FileDown className="w-4 h-4" />
                                )}
                                {t("actions.downloadLetter")}
                            </Button>
                        )}
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === tab.id
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Document display - 2/3 width */}
                <div className="lg:col-span-2">
                    {(activeTab === "cv" || activeTab === "letter") && (
                        <Card className="mb-4">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold">
                                    {activeTab === "cv"
                                        ? "Edit Tailored CV"
                                        : "Edit Cover Letter"}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {activeTab === "cv" ? (
                                    <>
                                        <textarea
                                            className="w-full min-h-[220px] rounded-md border p-3 text-xs font-mono"
                                            value={cvMarkdown}
                                            onChange={(event) => {
                                                setCvMarkdown(event.target.value);
                                                setEditorMessage(null);
                                            }}
                                            spellCheck={false}
                                        />
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            <label className="text-xs flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={cvDisplayOptions.showPhoto}
                                                    onChange={(event) =>
                                                        setCvDisplayOptions((prev) => ({
                                                            ...prev,
                                                            showPhoto: event.target.checked,
                                                        }))
                                                    }
                                                />
                                                Show photo
                                            </label>
                                            <label className="text-xs flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={cvDisplayOptions.showLocation}
                                                    onChange={(event) =>
                                                        setCvDisplayOptions((prev) => ({
                                                            ...prev,
                                                            showLocation: event.target.checked,
                                                        }))
                                                    }
                                                />
                                                Show location
                                            </label>
                                            <label className="text-xs flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={cvDisplayOptions.showEmail}
                                                    onChange={(event) =>
                                                        setCvDisplayOptions((prev) => ({
                                                            ...prev,
                                                            showEmail: event.target.checked,
                                                        }))
                                                    }
                                                />
                                                Show email
                                            </label>
                                            <label className="text-xs flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={cvDisplayOptions.showPhone}
                                                    onChange={(event) =>
                                                        setCvDisplayOptions((prev) => ({
                                                            ...prev,
                                                            showPhone: event.target.checked,
                                                        }))
                                                    }
                                                />
                                                Show phone
                                            </label>
                                            <label className="text-xs flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={cvDisplayOptions.showLinkedin}
                                                    onChange={(event) =>
                                                        setCvDisplayOptions((prev) => ({
                                                            ...prev,
                                                            showLinkedin: event.target.checked,
                                                        }))
                                                    }
                                                />
                                                Show LinkedIn
                                            </label>
                                            <label className="text-xs flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={cvDisplayOptions.showWebsite}
                                                    onChange={(event) =>
                                                        setCvDisplayOptions((prev) => ({
                                                            ...prev,
                                                            showWebsite: event.target.checked,
                                                        }))
                                                    }
                                                />
                                                Show website
                                            </label>
                                        </div>
                                    </>
                                ) : (
                                    <textarea
                                        className="w-full min-h-[220px] rounded-md border p-3 text-xs font-mono"
                                        value={coverLetterMarkdown}
                                        onChange={(event) => {
                                            setCoverLetterMarkdown(event.target.value);
                                            setEditorMessage(null);
                                        }}
                                        spellCheck={false}
                                    />
                                )}
                                <div className="flex items-center justify-between">
                                    <p className="text-[11px] text-muted-foreground">
                                        {activeTab === "cv"
                                            ? "Edit headline, summary, experience, education, and skills directly before export."
                                            : "Edit salutation, body paragraphs, and closing before export."}
                                    </p>
                                    <Button
                                        size="sm"
                                        onClick={handleSaveEdits}
                                        disabled={
                                            savingDraft ||
                                            (activeTab === "cv"
                                                ? !hasCvChanges
                                                : !hasCoverLetterChanges)
                                        }
                                    >
                                        {savingDraft ? (
                                            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                        ) : null}
                                        Save edits
                                    </Button>
                                </div>
                                {editorMessage && (
                                    <div
                                        className={`text-xs rounded border px-2 py-1.5 ${
                                            editorMessage.type === "success"
                                                ? "border-green-300 bg-green-50 text-green-700"
                                                : "border-red-300 bg-red-50 text-red-700"
                                        }`}
                                    >
                                        {editorMessage.text}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === "cv" && (
                        <>
                            {cvMarkdown ? (
                                <CVDisplay
                                    markdown={cvMarkdown}
                                    photoBase64={photoBase64}
                                    showPhoto={cvDisplayOptions.showPhoto}
                                    contactVisibility={{
                                        location: cvDisplayOptions.showLocation,
                                        email: cvDisplayOptions.showEmail,
                                        phone: cvDisplayOptions.showPhone,
                                        linkedin: cvDisplayOptions.showLinkedin,
                                        website: cvDisplayOptions.showWebsite,
                                    }}
                                />
                            ) : (
                                <EmptyState message={t("empty.noTailoredCv")} />
                            )}
                        </>
                    )}

                    {activeTab === "letter" && (
                        <>
                            {coverLetterMarkdown ? (
                                <CoverLetterDisplay markdown={coverLetterMarkdown} />
                            ) : (
                                <EmptyState message={t("empty.noCoverLetter")} />
                            )}
                        </>
                    )}

                    {activeTab === "original" && (
                        <Card>
                            <CardContent className="p-6">
                                {originalCvText ? (
                                    <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                                        {originalCvText}
                                    </pre>
                                ) : (
                                    <EmptyState message={t("empty.noOriginalCv")} />
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Analysis panel - 1/3 width */}
                <div className="space-y-4">
                    {/* ATS Keywords */}
                    {application.atsKeywords.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold">
                                    {t("atsKeywords")}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-1.5">
                                    {application.atsKeywords.map(
                                        (keyword, i) => (
                                            <Badge
                                                key={i}
                                                variant="secondary"
                                                className="text-xs"
                                            >
                                                {keyword}
                                            </Badge>
                                        )
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Strengths */}
                    {application.matchingStrengths.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                    {t("strengths")}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2">
                                    {application.matchingStrengths.map(
                                        (strength, i) => (
                                            <li
                                                key={i}
                                                className="text-xs text-muted-foreground flex items-start gap-2"
                                            >
                                                <span className="text-green-500 mt-0.5">
                                                    ✓
                                                </span>
                                                {strength}
                                            </li>
                                        )
                                    )}
                                </ul>
                            </CardContent>
                        </Card>
                    )}

                    {/* Gaps — with "I have this" feature */}
                    {application.gaps.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                                    {t("gaps.title")}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-3">
                                    {application.gaps.map((gap, i) => (
                                        <li key={i} className="space-y-1.5">
                                            <div className="flex items-start gap-2">
                                                <span className="text-amber-500 mt-0.5 text-xs">
                                                    !
                                                </span>
                                                <span className="text-xs text-muted-foreground flex-1">
                                                    {gap}
                                                </span>
                                                {!gapResponses[i] &&
                                                    activeGapIndex !== i && (
                                                        <button
                                                            onClick={() =>
                                                                setActiveGapIndex(
                                                                    i
                                                                )
                                                            }
                                                            className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap flex-shrink-0"
                                                        >
                                                            <Plus className="w-3 h-3 inline mr-0.5" />
                                                            {t("gaps.iHaveThis")}
                                                        </button>
                                                    )}
                                            </div>

                                            {/* Gap response input */}
                                            {activeGapIndex === i && (
                                                <div className="ml-4 space-y-1.5">
                                                    <textarea
                                                        className="w-full p-2 text-xs border rounded-md resize-none bg-muted/50 focus:outline-none focus:ring-1 focus:ring-primary"
                                                        rows={2}
                                                        placeholder={t("gaps.describeExperience")}
                                                        value={
                                                            gapResponses[i] ||
                                                            ""
                                                        }
                                                        onChange={(e) =>
                                                            setGapResponses(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [i]: e
                                                                        .target
                                                                        .value,
                                                                })
                                                            )
                                                        }
                                                        autoFocus
                                                    />
                                                    <div className="flex gap-1">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-6 text-[10px] px-2"
                                                            onClick={() => {
                                                                setActiveGapIndex(
                                                                    null
                                                                );
                                                                if (
                                                                    !gapResponses[
                                                                        i
                                                                    ]?.trim()
                                                                ) {
                                                                    setGapResponses(
                                                                        (
                                                                            prev
                                                                        ) => {
                                                                            const next =
                                                                                {
                                                                                    ...prev,
                                                                                };
                                                                            delete next[
                                                                                i
                                                                            ];
                                                                            return next;
                                                                        }
                                                                    );
                                                                }
                                                            }}
                                                        >
                                                            {t("gaps.done")}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Filled response badge */}
                                            {gapResponses[i]?.trim() &&
                                                activeGapIndex !== i && (
                                                    <div className="ml-4 flex items-start gap-1.5 p-1.5 bg-green-50 dark:bg-green-950/30 rounded text-[10px] text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                                                        <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                                        <span className="flex-1">
                                                            {gapResponses[i]}
                                                        </span>
                                                        <button
                                                            onClick={() => {
                                                                setGapResponses(
                                                                    (prev) => {
                                                                        const next =
                                                                            {
                                                                                ...prev,
                                                                            };
                                                                        delete next[
                                                                            i
                                                                        ];
                                                                        return next;
                                                                    }
                                                                );
                                                            }}
                                                            className="text-green-500 hover:text-red-500"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                )}
                                        </li>
                                    ))}
                                </ul>

                                {/* Re-tailor button */}
                                {filledCount > 0 && (
                                    <div className="mt-4 pt-3 border-t">
                                        <Button
                                            onClick={handleRetailor}
                                            disabled={retailoring}
                                            size="sm"
                                            className="w-full gap-2"
                                        >
                                            {retailoring ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <RefreshCw className="w-3.5 h-3.5" />
                                            )}
                                            {retailoring
                                                ? t("gaps.retailoring")
                                                : filledCount > 1
                                                  ? t("gaps.retailorWithMultiple", {
                                                      count: filledCount,
                                                  })
                                                  : t("gaps.retailorWithSingle", {
                                                      count: filledCount,
                                                  })}
                                        </Button>
                                    </div>
                                )}

                                {/* Re-tailor status message */}
                                {retailorMessage && (
                                    <div
                                        className={`mt-3 p-2 rounded text-[10px] ${
                                            retailorMessage.type === "success"
                                                ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border border-green-200 dark:border-green-800"
                                                : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-800"
                                        }`}
                                    >
                                        {retailorMessage.text}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Recommendation */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-center">
                                <p className="text-xs text-muted-foreground mb-1">
                                    {t("recommendation.label")}
                                </p>
                                <Badge
                                    variant={
                                        application.recommendation === "apply"
                                            ? "default"
                                            : "secondary"
                                    }
                                    className={`text-sm px-4 py-1 ${
                                        application.recommendation === "apply"
                                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                            : application.recommendation ===
                                                "stretch"
                                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                    }`}
                                >
                                    {application.recommendation === "apply"
                                        ? t("recommendation.apply")
                                        : application.recommendation ===
                                            "stretch"
                                          ? t("recommendation.stretch")
                                          : t("recommendation.skip")}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <Card>
            <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">{message}</p>
            </CardContent>
        </Card>
    );
}
