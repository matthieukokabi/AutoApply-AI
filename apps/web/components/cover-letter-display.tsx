"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import { normalizeCoverLetterMarkdown } from "@/lib/document-model";

interface CoverLetterDisplayProps {
    markdown: string;
}

export const CoverLetterDisplay = React.forwardRef<
    HTMLDivElement,
    CoverLetterDisplayProps
>(function CoverLetterDisplay({ markdown }, ref) {
    const normalizedMarkdown = normalizeCoverLetterMarkdown(markdown);

    return (
        <div
            ref={ref}
            className="cover-letter-print-target bg-white dark:bg-slate-900 shadow-lg rounded-lg max-w-[210mm] mx-auto print:shadow-none print:rounded-none print:max-w-none"
            style={{ fontFamily: "'Aptos', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif" }}
        >
            <div className="px-10 py-10">
                <ReactMarkdown
                    components={{
                        h1: ({ children }) => (
                            <h1 className="text-[19px] font-bold tracking-tight text-slate-900 dark:text-slate-50 print:text-slate-900 mb-6 pb-3 border-b border-slate-200 dark:border-slate-700 print:border-slate-200">
                                {children}
                            </h1>
                        ),
                        h2: ({ children }) => (
                            <h2 className="text-[15px] font-semibold text-slate-800 dark:text-slate-100 print:text-slate-800 mt-6 mb-2">
                                {children}
                            </h2>
                        ),
                        p: ({ children }) => (
                            <p className="text-[14px] text-slate-700 dark:text-slate-300 print:text-slate-700 leading-7 mb-4">
                                {children}
                            </p>
                        ),
                        strong: ({ children }) => (
                            <strong className="font-semibold text-slate-900 dark:text-slate-100 print:text-slate-900">
                                {children}
                            </strong>
                        ),
                        em: ({ children }) => (
                            <em className="italic">{children}</em>
                        ),
                        ul: ({ children }) => (
                            <ul className="list-disc list-outside ml-5 mb-4 space-y-2">
                                {children}
                            </ul>
                        ),
                        li: ({ children }) => (
                            <li className="text-[14px] leading-7 text-slate-700 dark:text-slate-300 print:text-slate-700">
                                {children}
                            </li>
                        ),
                    }}
                >
                    {normalizedMarkdown}
                </ReactMarkdown>
            </div>
        </div>
    );
});
