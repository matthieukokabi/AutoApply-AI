"use client";

import React from "react";
import { parseCV } from "@/lib/cv-parser";
import { Mail, Phone, MapPin } from "lucide-react";

interface CVDisplayProps {
    markdown: string;
    photoBase64?: string;
}

export const CVDisplay = React.forwardRef<HTMLDivElement, CVDisplayProps>(
    function CVDisplay({ markdown, photoBase64 }, ref) {
        const cv = parseCV(markdown);

        // Parse contact line into parts
        const contactParts = cv.contactLine
            .split("|")
            .map((p) => p.trim())
            .filter(Boolean);

        // Try to identify email, phone, location from contact parts
        const email = contactParts.find((p) => p.includes("@")) || "";
        const phone =
            contactParts.find((p) => /[+\d]/.test(p) && p.includes(" ")) || "";
        const location =
            contactParts.find((p) => !p.includes("@") && !/^\+/.test(p)) || "";

        return (
            <div
                ref={ref}
                className="cv-print-target bg-white dark:bg-slate-900 shadow-lg rounded-lg max-w-[210mm] mx-auto print:shadow-none print:rounded-none print:max-w-none"
                style={{ fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif" }}
            >
                {/* Header */}
                <div className="px-8 pt-8 pb-6 border-b-2 border-slate-200 dark:border-slate-700 print:border-slate-300">
                    <div className="flex items-start gap-6">
                        {/* Photo */}
                        {photoBase64 && (
                            <div className="flex-shrink-0">
                                <img
                                    src={photoBase64}
                                    alt="Profile"
                                    className="w-24 h-24 rounded-full object-cover border-2 border-slate-200 dark:border-slate-600 print:border-slate-300"
                                />
                            </div>
                        )}

                        {/* Name & Contact */}
                        <div className="flex-1 min-w-0">
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 print:text-slate-900 tracking-tight">
                                {cv.name}
                            </h1>
                            {cv.subtitle && (
                                <p className="text-base text-blue-700 dark:text-blue-400 print:text-blue-700 font-medium mt-0.5">
                                    {cv.subtitle}
                                </p>
                            )}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-600 dark:text-slate-400 print:text-slate-600">
                                {location && (
                                    <span className="flex items-center gap-1">
                                        <MapPin className="w-3.5 h-3.5" />
                                        {location}
                                    </span>
                                )}
                                {email && (
                                    <span className="flex items-center gap-1">
                                        <Mail className="w-3.5 h-3.5" />
                                        {email}
                                    </span>
                                )}
                                {phone && (
                                    <span className="flex items-center gap-1">
                                        <Phone className="w-3.5 h-3.5" />
                                        {phone}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sections */}
                <div className="px-8 py-6 space-y-5">
                    {cv.sections.map((section, idx) => (
                        <div key={idx}>
                            {/* Section Header */}
                            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-700 dark:text-slate-300 print:text-slate-700 pb-1.5 mb-3 border-b-[1.5px] border-slate-300 dark:border-slate-600 print:border-slate-300">
                                {section.title}
                            </h2>

                            {/* Subsections (Experience, Education entries) */}
                            {section.subsections.length > 0 && (
                                <div className="space-y-4">
                                    {section.subsections.map((sub, subIdx) => (
                                        <div key={subIdx}>
                                            {/* Subsection heading + dates */}
                                            <div className="flex justify-between items-baseline gap-4">
                                                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 print:text-slate-900">
                                                    {sub.heading}
                                                </h3>
                                                {sub.meta && (
                                                    <span className="text-xs text-slate-500 dark:text-slate-400 print:text-slate-500 whitespace-nowrap flex-shrink-0">
                                                        {sub.meta}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Paragraphs (company/location text) */}
                                            {sub.paragraphs.map((p, pIdx) => (
                                                <p
                                                    key={pIdx}
                                                    className="text-xs text-slate-500 dark:text-slate-400 print:text-slate-500 italic"
                                                >
                                                    {p}
                                                </p>
                                            ))}

                                            {/* Bullets */}
                                            {sub.bullets.length > 0 && (
                                                <ul className="mt-1.5 space-y-0.5">
                                                    {sub.bullets.map(
                                                        (bullet, bIdx) => (
                                                            <li
                                                                key={bIdx}
                                                                className="text-xs text-slate-700 dark:text-slate-300 print:text-slate-700 pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-slate-400"
                                                            >
                                                                {bullet}
                                                            </li>
                                                        )
                                                    )}
                                                </ul>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Direct paragraphs (Summary, Skills as list) */}
                            {section.subsections.length === 0 &&
                                section.paragraphs.length > 0 && (
                                    <div>
                                        {/* Check if it looks like a skills section (short items) */}
                                        {isSkillsSection(section) ? (
                                            <div className="flex flex-wrap gap-1.5">
                                                {section.paragraphs.map(
                                                    (skill, sIdx) => (
                                                        <span
                                                            key={sIdx}
                                                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 print:bg-blue-50 print:text-blue-700 print:border-blue-200"
                                                        >
                                                            {skill}
                                                        </span>
                                                    )
                                                )}
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {section.paragraphs.map(
                                                    (p, pIdx) => (
                                                        <p
                                                            key={pIdx}
                                                            className="text-xs text-slate-700 dark:text-slate-300 print:text-slate-700 leading-relaxed"
                                                        >
                                                            {cleanMarkdownBold(
                                                                p
                                                            )}
                                                        </p>
                                                    )
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }
);

/** Check if a section is likely a skills section (short items, no subsections) */
function isSkillsSection(section: { title: string; paragraphs: string[] }): boolean {
    const title = section.title.toLowerCase();
    const skillKeywords = [
        "skills", "compétences", "kompetenzen", "fähigkeiten",
        "competencias", "habilidades", "competenze", "abilità",
        "technologies", "outils", "tools", "certifications",
    ];
    if (skillKeywords.some((k) => title.includes(k))) return true;
    // Heuristic: if most items are short (< 50 chars), treat as skills
    const avgLen =
        section.paragraphs.reduce((sum, p) => sum + p.length, 0) /
        (section.paragraphs.length || 1);
    return avgLen < 50 && section.paragraphs.length > 3;
}

/** Remove markdown bold markers for plain text rendering */
function cleanMarkdownBold(text: string): string {
    return text.replace(/\*\*(.*?)\*\*/g, "$1");
}
