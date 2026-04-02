"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Loader2, RotateCcw, Sparkles } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CVDisplay } from "@/components/cv-display";
import { CoverLetterDisplay } from "@/components/cover-letter-display";
import { useRouter } from "@/i18n/routing";

const DEFAULT_CV_TEMPLATE = `# Your Full Name
**Target Role**
City, Country | email@example.com | +41 00 000 00 00

## Summary
Profile summary in 3-5 lines focused on your strongest value proposition.

## Experience
### Current Role — Company Name
**2022 - Present**
- Quantified achievement with impact.
- Key project relevant to target jobs.

### Previous Role — Company Name
**2019 - 2022**
- Core responsibility linked to business results.
- Collaboration, leadership, or technical contribution.

## Education
### Degree — University Name
**2018**
- Distinction or relevant specialization.

## Skills
- Skill 1
- Skill 2
- Skill 3
`;

const DEFAULT_LETTER_TEMPLATE = `# Motivation Letter

Dear Hiring Manager,

I am writing to apply for the [Role] position at [Company]. My background in [Domain] and my experience delivering [Outcome] align strongly with your requirements.

In my recent role, I [specific achievement with metric/impact]. This directly relates to your need for [requirement from job description].

I am particularly interested in [company mission/team context], and I would be excited to contribute by [value you will bring].

Thank you for your time and consideration. I would welcome the opportunity to discuss how my experience can support your team.

Sincerely,
[Your Name]
`;

const POLL_MAX_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 3000;

type AlertState = {
    type: "success" | "error" | "info";
    text: string;
} | null;

function sleep(ms: number) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

export default function GeneratorPage() {
    const t = useTranslations("dashboard.generatorPage");
    const router = useRouter();
    const [cvMarkdown, setCvMarkdown] = useState(DEFAULT_CV_TEMPLATE);
    const [letterMarkdown, setLetterMarkdown] = useState(DEFAULT_LETTER_TEMPLATE);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isDownloadingCv, setIsDownloadingCv] = useState(false);
    const [isDownloadingLetter, setIsDownloadingLetter] = useState(false);
    const [alert, setAlert] = useState<AlertState>(null);
    const [aiForm, setAiForm] = useState({
        jobTitle: "",
        company: "",
        jobUrl: "",
        additionalContext: "",
        jobDescription: "",
    });

    async function handleDownload(type: "cv" | "letter", markdown: string) {
        const setBusy = type === "cv" ? setIsDownloadingCv : setIsDownloadingLetter;
        setBusy(true);

        try {
            const response = await fetch("/api/export/pdf", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type,
                    markdown,
                    fileName: type === "cv" ? "AutoApply-CV.pdf" : "AutoApply-Motivation-Letter.pdf",
                }),
            });

            if (!response.ok) {
                throw new Error(`EXPORT_FAILED_${response.status}`);
            }

            const blob = await response.blob();
            const objectUrl = window.URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = objectUrl;
            anchor.download =
                type === "cv" ? "AutoApply-CV.pdf" : "AutoApply-Motivation-Letter.pdf";
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.URL.revokeObjectURL(objectUrl);
        } catch {
            setAlert({
                type: "error",
                text: t("messages.exportFailed"),
            });
        } finally {
            setBusy(false);
        }
    }

    async function waitForGeneratedDocument(jobId: string) {
        for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
            if (attempt > 0) {
                await sleep(POLL_INTERVAL_MS);
            }

            const response = await fetch(
                `/api/applications?jobId=${encodeURIComponent(jobId)}&limit=1`,
                {
                    cache: "no-store",
                }
            );
            if (!response.ok) {
                continue;
            }

            const payload = await response.json();
            const application = payload.applications?.[0];
            if (!application?.id) {
                continue;
            }

            if (application.status === "tailored") {
                setAlert({ type: "success", text: t("ai.messages.ready") });
                router.push(`/documents/${application.id}`);
                return;
            }
        }

        setAlert({ type: "info", text: t("ai.messages.pollTimeout") });
    }

    async function handleGenerateWithAi() {
        if (!aiForm.jobDescription.trim()) {
            setAlert({ type: "error", text: t("ai.messages.jobDescriptionRequired") });
            return;
        }

        setIsGenerating(true);
        setAlert({ type: "info", text: t("ai.messages.dispatching") });

        try {
            const response = await fetch("/api/tailor", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(aiForm),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                setAlert({
                    type: "error",
                    text: payload.error || t("ai.messages.dispatchFailed"),
                });
                return;
            }

            if (!payload.jobId) {
                setAlert({ type: "error", text: t("ai.messages.missingJobId") });
                return;
            }

            setAlert({ type: "info", text: t("ai.messages.waitingForDocs") });
            await waitForGeneratedDocument(payload.jobId);
        } catch {
            setAlert({ type: "error", text: t("ai.messages.networkError") });
        } finally {
            setIsGenerating(false);
        }
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
                <p className="text-muted-foreground mt-1">{t("description")}</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        {t("ai.title")}
                    </CardTitle>
                    <CardDescription>{t("ai.description")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <input
                            className="w-full rounded-md border px-3 py-2 text-sm"
                            placeholder={t("ai.fields.jobTitle")}
                            value={aiForm.jobTitle}
                            onChange={(event) =>
                                setAiForm((current) => ({
                                    ...current,
                                    jobTitle: event.target.value,
                                }))
                            }
                        />
                        <input
                            className="w-full rounded-md border px-3 py-2 text-sm"
                            placeholder={t("ai.fields.company")}
                            value={aiForm.company}
                            onChange={(event) =>
                                setAiForm((current) => ({
                                    ...current,
                                    company: event.target.value,
                                }))
                            }
                        />
                    </div>
                    <input
                        className="w-full rounded-md border px-3 py-2 text-sm"
                        placeholder={t("ai.fields.jobUrl")}
                        value={aiForm.jobUrl}
                        onChange={(event) =>
                            setAiForm((current) => ({
                                ...current,
                                jobUrl: event.target.value,
                            }))
                        }
                    />
                    <textarea
                        className="w-full min-h-[160px] rounded-md border p-3 text-sm"
                        placeholder={t("ai.fields.jobDescription")}
                        value={aiForm.jobDescription}
                        onChange={(event) =>
                            setAiForm((current) => ({
                                ...current,
                                jobDescription: event.target.value,
                            }))
                        }
                    />
                    <textarea
                        className="w-full min-h-[96px] rounded-md border p-3 text-sm"
                        placeholder={t("ai.fields.additionalContext")}
                        value={aiForm.additionalContext}
                        onChange={(event) =>
                            setAiForm((current) => ({
                                ...current,
                                additionalContext: event.target.value,
                            }))
                        }
                    />
                    {alert && (
                        <div
                            className={`rounded-md border px-3 py-2 text-sm ${
                                alert.type === "success"
                                    ? "border-green-300 bg-green-50 text-green-800"
                                    : alert.type === "error"
                                      ? "border-red-300 bg-red-50 text-red-800"
                                      : "border-blue-300 bg-blue-50 text-blue-800"
                            }`}
                        >
                            {alert.text}
                        </div>
                    )}
                    <Button
                        type="button"
                        onClick={handleGenerateWithAi}
                        disabled={isGenerating}
                    >
                        {isGenerating ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        {isGenerating
                            ? t("ai.actions.generating")
                            : t("ai.actions.generate")}
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t("cv.title")}</CardTitle>
                    <CardDescription>{t("cv.description")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setCvMarkdown(DEFAULT_CV_TEMPLATE)}
                        >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            {t("actions.resetCv")}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => handleDownload("cv", cvMarkdown)}
                            disabled={isDownloadingCv}
                        >
                            {isDownloadingCv ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Download className="h-4 w-4 mr-2" />
                            )}
                            {t("actions.downloadCv")}
                        </Button>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="space-y-2">
                            <p className="text-sm font-medium">{t("cv.editorLabel")}</p>
                            <textarea
                                className="w-full min-h-[520px] rounded-md border p-3 text-sm font-mono"
                                value={cvMarkdown}
                                onChange={(event) => setCvMarkdown(event.target.value)}
                                spellCheck={false}
                            />
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-medium">{t("cv.previewLabel")}</p>
                            <CVDisplay markdown={cvMarkdown} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t("letter.title")}</CardTitle>
                    <CardDescription>{t("letter.description")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setLetterMarkdown(DEFAULT_LETTER_TEMPLATE)}
                        >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            {t("actions.resetLetter")}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => handleDownload("letter", letterMarkdown)}
                            disabled={isDownloadingLetter}
                        >
                            {isDownloadingLetter ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Download className="h-4 w-4 mr-2" />
                            )}
                            {t("actions.downloadLetter")}
                        </Button>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="space-y-2">
                            <p className="text-sm font-medium">{t("letter.editorLabel")}</p>
                            <textarea
                                className="w-full min-h-[520px] rounded-md border p-3 text-sm font-mono"
                                value={letterMarkdown}
                                onChange={(event) => setLetterMarkdown(event.target.value)}
                                spellCheck={false}
                            />
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-medium">{t("letter.previewLabel")}</p>
                            <CoverLetterDisplay markdown={letterMarkdown} />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
