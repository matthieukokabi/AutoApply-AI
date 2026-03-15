"use client";

import { useState, useRef } from "react";
import { useReactToPrint } from "react-to-print";
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
} from "lucide-react";
import Link from "next/link";

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
    job: {
        title: string;
        company: string;
        location: string;
    };
    photoBase64?: string;
    originalCvText?: string;
}

type Tab = "cv" | "letter" | "original";

export function DocumentViewer({
    application,
    job,
    photoBase64,
    originalCvText,
}: DocumentViewerProps) {
    const [activeTab, setActiveTab] = useState<Tab>("cv");
    const cvRef = useRef<HTMLDivElement>(null);
    const letterRef = useRef<HTMLDivElement>(null);

    const handlePrintCV = useReactToPrint({
        contentRef: cvRef,
        documentTitle: `CV - ${job.title} - ${job.company}`,
        pageStyle: `
            @page { size: A4; margin: 12mm; }
            @media print {
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .cv-print-target { box-shadow: none !important; border-radius: 0 !important; background: white !important; color: #1e293b !important; }
            }
        `,
    });

    const handlePrintLetter = useReactToPrint({
        contentRef: letterRef,
        documentTitle: `Cover Letter - ${job.title} - ${job.company}`,
        pageStyle: `
            @page { size: A4; margin: 15mm; }
            @media print {
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .cover-letter-print-target { box-shadow: none !important; border-radius: 0 !important; background: white !important; color: #1e293b !important; }
            }
        `,
    });

    const scoreColor =
        application.compatibilityScore >= 80
            ? "text-green-600 dark:text-green-400"
            : application.compatibilityScore >= 60
              ? "text-amber-600 dark:text-amber-400"
              : "text-red-600 dark:text-red-400";

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        {
            id: "cv",
            label: "Tailored CV",
            icon: <FileText className="w-4 h-4" />,
        },
        {
            id: "letter",
            label: "Cover Letter",
            icon: <Mail className="w-4 h-4" />,
        },
        {
            id: "original",
            label: "Original CV",
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
                        {application.compatibilityScore}% match
                    </Badge>
                    {activeTab === "cv" && application.tailoredCvMarkdown && (
                        <Button
                            onClick={() => handlePrintCV()}
                            variant="default"
                            className="gap-2"
                        >
                            <FileDown className="w-4 h-4" />
                            Download CV
                        </Button>
                    )}
                    {activeTab === "letter" &&
                        application.coverLetterMarkdown && (
                            <Button
                                onClick={() => handlePrintLetter()}
                                variant="default"
                                className="gap-2"
                            >
                                <FileDown className="w-4 h-4" />
                                Download Letter
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
                    {activeTab === "cv" && (
                        <>
                            {application.tailoredCvMarkdown ? (
                                <CVDisplay
                                    ref={cvRef}
                                    markdown={application.tailoredCvMarkdown}
                                    photoBase64={photoBase64}
                                />
                            ) : (
                                <EmptyState message="No tailored CV available yet." />
                            )}
                        </>
                    )}

                    {activeTab === "letter" && (
                        <>
                            {application.coverLetterMarkdown ? (
                                <CoverLetterDisplay
                                    ref={letterRef}
                                    markdown={application.coverLetterMarkdown}
                                />
                            ) : (
                                <EmptyState message="No cover letter available yet." />
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
                                    <EmptyState message="Original CV not available." />
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
                                    ATS Keywords
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
                                    Strengths
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

                    {/* Gaps */}
                    {application.gaps.length > 0 && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                                    Gaps to Address
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2">
                                    {application.gaps.map((gap, i) => (
                                        <li
                                            key={i}
                                            className="text-xs text-muted-foreground flex items-start gap-2"
                                        >
                                            <span className="text-amber-500 mt-0.5">
                                                !
                                            </span>
                                            {gap}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}

                    {/* Recommendation */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-center">
                                <p className="text-xs text-muted-foreground mb-1">
                                    Recommendation
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
                                        ? "✅ Apply"
                                        : application.recommendation ===
                                            "stretch"
                                          ? "🔄 Stretch"
                                          : "⏭️ Skip"}
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
