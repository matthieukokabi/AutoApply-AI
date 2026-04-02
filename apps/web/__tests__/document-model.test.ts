import { describe, expect, it } from "vitest";
import {
    buildCanonicalCvDocument,
    normalizeCvMarkdown,
    normalizeCoverLetterMarkdown,
} from "@/lib/document-model";

describe("buildCanonicalCvDocument", () => {
    it("deduplicates contact tokens and merged duplicate sections", () => {
        const markdown = `# Jane Doe
**Senior Product Manager**
Zurich, Switzerland | jane@example.com | +41 79 123 45 67 | +41 79 123 45 67 | https://www.linkedin.com/in/janedoe

## Summary
Experienced leader building B2B SaaS products.

## Experience
### Product Manager — Acme
**2022 - Present**
- Led roadmap
- Led roadmap

## Experience
### Product Manager — Acme
**2022 - Present**
- Led roadmap
- Improved NPS
`;

        const model = buildCanonicalCvDocument(markdown);
        expect(model.contact.email).toBe("jane@example.com");
        expect(model.contact.phone).toBe("+41 79 123 45 67");
        expect(model.contact.location).toBe("Zurich, Switzerland");
        expect(model.sections.length).toBeGreaterThan(0);

        const experience = model.sections.find((section) =>
            section.title.toLowerCase().includes("experience")
        );
        expect(experience).toBeDefined();
        expect(experience?.subsections.length).toBe(1);
        expect(experience?.subsections[0].bullets).toEqual([
            "Led roadmap",
            "Improved NPS",
        ]);
    });
});

describe("normalizeCvMarkdown", () => {
    it("rebuilds markdown with deduplicated contact and bullet data", () => {
        const markdown = `# Jane Doe
**Senior Product Manager**
Zurich | jane@example.com | +41 79 123 45 67 | +41 79 123 45 67

## Skills
- Strategy
- Strategy
`;

        const normalized = normalizeCvMarkdown(markdown);
        expect(normalized).toContain("Zurich | jane@example.com | +41 79 123 45 67");
        expect(normalized.match(/\+41 79 123 45 67/g)?.length).toBe(1);
        expect(normalized.match(/Strategy/g)?.length).toBe(1);
    });
});

describe("normalizeCoverLetterMarkdown", () => {
    it("strips internal document urls, timestamps, and repeated lines", () => {
        const markdown = `# Motivation Letter

Dear Hiring Manager,
Dear Hiring Manager,

https://autoapply.works/documents/app_123
2026-04-02T15:10:22Z

I am excited to apply for this role.
I am excited to apply for this role.
`;

        const normalized = normalizeCoverLetterMarkdown(markdown);
        expect(normalized).toContain("Dear Hiring Manager");
        expect(normalized).toContain("I am excited to apply for this role.");
        expect(normalized).not.toContain("autoapply.works/documents");
        expect(normalized).not.toContain("2026-04-02T15:10:22Z");
        expect(normalized.match(/Dear Hiring Manager/g)?.length).toBe(1);
    });
});
