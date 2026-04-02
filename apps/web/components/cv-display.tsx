"use client";

import React from "react";
import NextImage from "next/image";
import { buildCanonicalCvDocument } from "@/lib/document-model";
import { Link2, Mail, MapPin, Phone } from "lucide-react";

interface CVDisplayProps {
    markdown: string;
    photoBase64?: string;
    showPhoto?: boolean;
    contactVisibility?: {
        email?: boolean;
        phone?: boolean;
        location?: boolean;
        linkedin?: boolean;
        website?: boolean;
    };
}

export const CVDisplay = React.forwardRef<HTMLDivElement, CVDisplayProps>(
    function CVDisplay(
        {
            markdown,
            photoBase64,
            showPhoto = true,
            contactVisibility,
        },
        ref
    ) {
        const cv = buildCanonicalCvDocument(markdown);

        return (
            <div
                ref={ref}
                className="cv-print-target bg-white dark:bg-slate-900 shadow-lg rounded-lg max-w-[210mm] mx-auto print:shadow-none print:rounded-none print:max-w-none"
                style={{ fontFamily: "'Aptos', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif" }}
            >
                {/* Header */}
                <div className="px-8 pt-8 pb-6 border-b border-slate-200 dark:border-slate-700 print:border-slate-300">
                    <div className="flex items-start gap-6">
                        {/* Photo */}
                        {photoBase64 && showPhoto && (
                            <div className="flex-shrink-0">
                                <NextImage
                                    src={photoBase64}
                                    alt="Profile"
                                    width={96}
                                    height={96}
                                    unoptimized
                                    className="w-24 h-24 rounded-full object-cover border-2 border-slate-200 dark:border-slate-600 print:border-slate-300"
                                />
                            </div>
                        )}

                        {/* Name & Contact */}
                        <div className="flex-1 min-w-0">
                            <h1 className="text-[30px] font-bold leading-tight text-slate-900 dark:text-slate-50 print:text-slate-900 tracking-tight">
                                {cv.fullName}
                            </h1>
                            {cv.headline && (
                                <p className="text-[15px] text-slate-700 dark:text-slate-300 print:text-slate-700 font-medium mt-1">
                                    {cv.headline}
                                </p>
                            )}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[13px] text-slate-600 dark:text-slate-400 print:text-slate-600">
                                {contactVisibility?.location !== false &&
                                    cv.contact.location && (
                                    <span className="flex items-center gap-1">
                                        <MapPin className="w-3.5 h-3.5" />
                                        {cv.contact.location}
                                    </span>
                                )}
                                {contactVisibility?.email !== false &&
                                    cv.contact.email && (
                                    <span className="flex items-center gap-1">
                                        <Mail className="w-3.5 h-3.5" />
                                        {cv.contact.email}
                                    </span>
                                )}
                                {contactVisibility?.phone !== false &&
                                    cv.contact.phone && (
                                    <span className="flex items-center gap-1">
                                        <Phone className="w-3.5 h-3.5" />
                                        {cv.contact.phone}
                                    </span>
                                )}
                                {contactVisibility?.linkedin !== false &&
                                    cv.contact.linkedin && (
                                    <span className="flex items-center gap-1">
                                        <Link2 className="w-3.5 h-3.5" />
                                        {cv.contact.linkedin}
                                    </span>
                                )}
                                {contactVisibility?.website !== false &&
                                    cv.contact.website && (
                                    <span className="flex items-center gap-1">
                                        <Link2 className="w-3.5 h-3.5" />
                                        {cv.contact.website}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sections */}
                <div className="px-8 py-6 space-y-6">
                    {cv.sections.map((section, idx) => (
                        <div key={idx}>
                            {/* Section Header */}
                            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300 print:text-slate-700 pb-1.5 mb-3 border-b border-slate-300 dark:border-slate-600 print:border-slate-300">
                                {section.title}
                            </h2>

                            {/* Subsections (Experience, Education entries) */}
                            {section.subsections.length > 0 && (
                                <div className="space-y-5">
                                    {section.subsections.map((sub, subIdx) => (
                                        <div key={subIdx}>
                                            {/* Subsection heading + dates */}
                                            <div className="flex justify-between items-baseline gap-4">
                                                <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100 print:text-slate-900">
                                                    {sub.heading}
                                                </h3>
                                                {sub.meta && (
                                                    <span className="text-[12px] text-slate-500 dark:text-slate-400 print:text-slate-500 whitespace-nowrap flex-shrink-0">
                                                        {sub.meta}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Paragraphs (company/location text) */}
                                            {sub.paragraphs.map((p, pIdx) => (
                                                <p
                                                    key={pIdx}
                                                    className="text-[13px] text-slate-600 dark:text-slate-400 print:text-slate-600 italic leading-relaxed"
                                                >
                                                    {p}
                                                </p>
                                            ))}

                                            {/* Bullets */}
                                            {sub.bullets.length > 0 && (
                                                <ul className="mt-2 space-y-1">
                                                    {sub.bullets.map(
                                                        (bullet, bIdx) => (
                                                            <li
                                                                key={bIdx}
                                                                className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-300 print:text-slate-700 pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-slate-400"
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
                                            <div className="flex flex-wrap gap-2">
                                                {section.paragraphs.map(
                                                    (skill, sIdx) => (
                                                        <span
                                                            key={sIdx}
                                                            className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 print:bg-blue-50 print:text-blue-700 print:border-blue-200"
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
                                                            className="text-[13px] text-slate-700 dark:text-slate-300 print:text-slate-700 leading-relaxed"
                                                        >
                                                            {p}
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
