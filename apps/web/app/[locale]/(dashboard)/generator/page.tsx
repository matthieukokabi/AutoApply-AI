"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useReactToPrint } from "react-to-print";
import { Download, RotateCcw } from "lucide-react";
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

export default function GeneratorPage() {
    const t = useTranslations("dashboard.generatorPage");
    const [cvMarkdown, setCvMarkdown] = useState(DEFAULT_CV_TEMPLATE);
    const [letterMarkdown, setLetterMarkdown] = useState(DEFAULT_LETTER_TEMPLATE);

    const cvRef = useRef<HTMLDivElement>(null);
    const letterRef = useRef<HTMLDivElement>(null);

    const handleDownloadCv = useReactToPrint({
        contentRef: cvRef,
        documentTitle: "AutoApply-CV",
    });

    const handleDownloadLetter = useReactToPrint({
        contentRef: letterRef,
        documentTitle: "AutoApply-Motivation-Letter",
    });

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
                <p className="text-muted-foreground mt-1">{t("description")}</p>
            </div>

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
                        <Button type="button" onClick={() => handleDownloadCv()}>
                            <Download className="h-4 w-4 mr-2" />
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
                            <CVDisplay ref={cvRef} markdown={cvMarkdown} />
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
                        <Button type="button" onClick={() => handleDownloadLetter()}>
                            <Download className="h-4 w-4 mr-2" />
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
                            <CoverLetterDisplay
                                ref={letterRef}
                                markdown={letterMarkdown}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
