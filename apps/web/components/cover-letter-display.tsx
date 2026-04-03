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
            className="cover-letter-print-target bg-white shadow-sm rounded-xl max-w-[210mm] mx-auto border border-slate-200/70 print:shadow-none print:rounded-none print:max-w-none print:border-none"
            style={{ fontFamily: "'Aptos', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif" }}
        >
            <div className="px-10 py-10 max-w-none">
                <ReactMarkdown
                    components={{
                        h1: ({ children }) => (
                            <h1 className="text-[21px] font-bold tracking-tight text-slate-900 print:text-slate-900 mb-8 pb-3 border-b border-slate-200 print:border-slate-200">
                                {children}
                            </h1>
                        ),
                        h2: ({ children }) => (
                            <h2 className="text-[15px] font-semibold text-slate-800 print:text-slate-800 mt-7 mb-2.5">
                                {children}
                            </h2>
                        ),
                        p: ({ children }) => (
                            <p className="text-[14px] text-slate-700 print:text-slate-700 leading-[1.85] mb-5">
                                {children}
                            </p>
                        ),
                        strong: ({ children }) => (
                            <strong className="font-semibold text-slate-900 print:text-slate-900">
                                {children}
                            </strong>
                        ),
                        em: ({ children }) => (
                            <em className="italic">{children}</em>
                        ),
                        ul: ({ children }) => (
                            <ul className="list-disc list-outside ml-5 mb-5 space-y-2.5">
                                {children}
                            </ul>
                        ),
                        li: ({ children }) => (
                            <li className="text-[14px] leading-[1.8] text-slate-700 print:text-slate-700">
                                {children}
                            </li>
                        ),
                        hr: () => (
                            <hr className="my-6 border-slate-200 print:border-slate-200" />
                        ),
                    }}
                >
                    {normalizedMarkdown}
                </ReactMarkdown>
            </div>
        </div>
    );
});
