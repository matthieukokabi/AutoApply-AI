import { describe, it, expect } from "vitest";

/**
 * LLM Output Validation Tests
 *
 * These validate the JSON schemas expected from LLM responses.
 * Used to ensure the AI returns properly structured data and
 * to detect hallucination patterns.
 */

interface CompatibilityResult {
    compatibility_score: number;
    ats_keywords: string[];
    matching_strengths: string[];
    gaps: string[];
    recommendation: "apply" | "stretch" | "skip";
}

interface TailoredOutput {
    tailored_cv_markdown: string;
    motivation_letter_markdown: string;
}

function validateCompatibilityResult(data: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (typeof data.compatibility_score !== "number") {
        errors.push("compatibility_score must be a number");
    } else if (data.compatibility_score < 0 || data.compatibility_score > 100) {
        errors.push("compatibility_score must be between 0 and 100");
    }

    if (!Array.isArray(data.ats_keywords)) {
        errors.push("ats_keywords must be an array");
    }

    if (!Array.isArray(data.matching_strengths)) {
        errors.push("matching_strengths must be an array");
    }

    if (!Array.isArray(data.gaps)) {
        errors.push("gaps must be an array");
    }

    if (!["apply", "stretch", "skip"].includes(data.recommendation)) {
        errors.push("recommendation must be one of: apply, stretch, skip");
    }

    return { valid: errors.length === 0, errors };
}

function validateTailoredOutput(data: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (typeof data.tailored_cv_markdown !== "string") {
        errors.push("tailored_cv_markdown must be a string");
    } else if (data.tailored_cv_markdown.length < 100) {
        errors.push("tailored_cv_markdown seems too short (< 100 chars)");
    }

    if (typeof data.motivation_letter_markdown !== "string") {
        errors.push("motivation_letter_markdown must be a string");
    } else if (data.motivation_letter_markdown.length < 100) {
        errors.push("motivation_letter_markdown seems too short (< 100 chars)");
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Anti-hallucination check: Verify that the tailored CV only
 * contains skills/experience that exist in the original master CV.
 */
function checkHallucination(
    masterCvText: string,
    tailoredCvMarkdown: string
): { suspicious: string[] } {
    const suspicious: string[] = [];

    // Common hallucination patterns: fabricated certifications
    const certPatterns = [
        /certified\s+(.*?)\s+professional/gi,
        /PMP|CISSP|CFA|CISA|Six Sigma Black Belt/g,
    ];

    for (const pattern of certPatterns) {
        const matches = tailoredCvMarkdown.match(pattern) || [];
        for (const match of matches) {
            if (!masterCvText.toLowerCase().includes(match.toLowerCase())) {
                suspicious.push(`Possible fabricated certification: "${match}"`);
            }
        }
    }

    // Check for fabricated company names not in original
    const companyPattern = /(?:at|@)\s+([A-Z][a-zA-Z\s&]+(?:Inc|Corp|Ltd|LLC|Co))/g;
    const tailoredCompanies = tailoredCvMarkdown.match(companyPattern) || [];
    for (const company of tailoredCompanies) {
        const cleanCompany = company.replace(/^(?:at|@)\s+/, "").trim();
        if (!masterCvText.includes(cleanCompany)) {
            suspicious.push(`Company not found in master CV: "${cleanCompany}"`);
        }
    }

    return { suspicious };
}

describe("LLM Output Validation: Compatibility Result", () => {
    it("accepts valid compatibility result", () => {
        const result = validateCompatibilityResult({
            compatibility_score: 85,
            ats_keywords: ["React", "TypeScript", "Next.js"],
            matching_strengths: ["5 years React experience", "Strong TypeScript skills"],
            gaps: ["No Go experience"],
            recommendation: "apply",
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it("rejects score out of range", () => {
        const result = validateCompatibilityResult({
            compatibility_score: 150,
            ats_keywords: [],
            matching_strengths: [],
            gaps: [],
            recommendation: "apply",
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("compatibility_score must be between 0 and 100");
    });

    it("rejects invalid recommendation", () => {
        const result = validateCompatibilityResult({
            compatibility_score: 50,
            ats_keywords: [],
            matching_strengths: [],
            gaps: [],
            recommendation: "definitely_apply",
        });
        expect(result.valid).toBe(false);
    });

    it("rejects missing fields", () => {
        const result = validateCompatibilityResult({});
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });
});

describe("LLM Output Validation: Tailored Output", () => {
    it("accepts valid tailored output", () => {
        const result = validateTailoredOutput({
            tailored_cv_markdown:
                "# John Doe\n\nExperienced software engineer with 5+ years building modern web apps with React, TypeScript, and Node.js. Proven track record delivering scalable solutions.",
            motivation_letter_markdown:
                "Dear Hiring Manager,\n\nI am writing to express my interest in the Frontend Engineer position at Acme Corp. With 5 years of experience building React applications, I am confident in my ability to contribute to your team.",
        });
        expect(result.valid).toBe(true);
    });

    it("rejects empty CV", () => {
        const result = validateTailoredOutput({
            tailored_cv_markdown: "",
            motivation_letter_markdown: "Some letter content here that is long enough.",
        });
        expect(result.valid).toBe(false);
    });
});

describe("Anti-Hallucination Detection", () => {
    const masterCv = `
        John Doe
        Software Engineer at TechCorp Inc
        5 years experience with React, TypeScript, Node.js
        AWS Certified Developer
        BS Computer Science, MIT
    `;

    it("passes when tailored CV matches original", () => {
        const tailored = `
            # John Doe
            Software Engineer with expertise in React and TypeScript.
            AWS Certified Developer with 5 years of experience at TechCorp Inc.
        `;
        const { suspicious } = checkHallucination(masterCv, tailored);
        expect(suspicious).toHaveLength(0);
    });

    it("detects fabricated certifications", () => {
        const tailored = `
            # John Doe
            PMP certified professional with Six Sigma Black Belt.
            AWS Certified Developer.
        `;
        const { suspicious } = checkHallucination(masterCv, tailored);
        expect(suspicious.length).toBeGreaterThan(0);
        expect(suspicious.some((s) => s.includes("Six Sigma"))).toBe(true);
    });
});
