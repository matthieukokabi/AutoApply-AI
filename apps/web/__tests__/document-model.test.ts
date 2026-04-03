import { describe, expect, it } from "vitest";
import {
    buildCanonicalCvDocument,
    normalizeCvMarkdown,
    normalizeCoverLetterMarkdown,
} from "@/lib/document-model";

describe("buildCanonicalCvDocument", () => {
    it("deduplicates contact tokens and merges duplicate sections", () => {
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

    it("strips internal metadata and canonicalizes section aliases", () => {
        const markdown = `# John Smith
**Backend Engineer**
john@example.com | +41 79 111 22 33
Document URL: https://autoapply.works/documents/doc_123
Generated at: 2026-04-03T10:22:11Z

## Work Experience
### Senior Engineer — Orbit
**2021 - Present**
- Built distributed systems

## Experience
### Senior Engineer — Orbit
**2021 - Present**
- Built distributed systems
- Mentored 4 engineers
`;

        const model = buildCanonicalCvDocument(markdown);
        expect(model.contact.email).toBe("john@example.com");
        expect(model.contact.phone).toBe("+41 79 111 22 33");

        const experience = model.sections.find((section) => section.title === "Experience");
        expect(experience).toBeDefined();
        expect(experience?.subsections).toHaveLength(1);
        expect(experience?.subsections[0].bullets).toEqual([
            "Built distributed systems",
            "Mentored 4 engineers",
        ]);

        const normalized = normalizeCvMarkdown(markdown);
        expect(normalized).not.toContain("autoapply.works");
        expect(normalized).not.toContain("Generated at");
    });

    it("collapses WORK EXPERIENCE aliases and duplicate bullets from messy pasted CV text", () => {
        const markdown = `# Alex Martin
**Senior Product Designer**
Email: alex.martin@example.com
Phone: +41 79 555 44 33
alex.martin@example.com | +41 79 555 44 33 | https://www.linkedin.com/in/alexmartin
Document URL: https://autoapply.works/documents/app_test_123
Generated at: 2026-04-03T12:22:00Z

## WORK EXPERIENCE
### Senior Product Designer — Northlight Systems
**2021 - Present**
- Improved activation by 24%.
- Improved activation by 24%.

## Experience
### Senior Product Designer — Northlight Systems
**2021 - Present**
- Improved activation by 24%.
- Built a scalable design system.
`;

        const normalized = normalizeCvMarkdown(markdown);
        expect(normalized).not.toContain("## WORK EXPERIENCE");
        expect(normalized).not.toContain("## Work Experience");
        expect(normalized.match(/## Experience/g)?.length).toBe(1);
        expect((normalized.match(/Improved activation by 24\./g) || []).length).toBeLessThanOrEqual(1);
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
    it("strips internal urls, metadata timestamps, and repeated paragraphs", () => {
        const markdown = `# Motivation Letter

Document URL: https://autoapply.works/documents/app_123
Generated at: 2026-04-03T09:11:22Z

Dear Hiring Manager,

I am excited to apply for this role.

I am excited to apply for this role.

Sincerely,
Jane Doe
`;

        const normalized = normalizeCoverLetterMarkdown(markdown);
        expect(normalized).toContain("Dear Hiring Manager,");
        expect(normalized).toContain("I am excited to apply for this role.");
        expect(normalized).toContain("Sincerely,");
        expect(normalized).not.toContain("autoapply.works");
        expect(normalized).not.toContain("Generated at");
        expect(normalized.match(/I am excited to apply for this role\./g)?.length).toBe(1);
    });

    it("removes stacked metadata labels and repeated body phrases", () => {
        const markdown = `# Motivation Letter

Document URL: Generated at: 2026-04-03T14:01:00Z
Source Link: https://autoapply.works/documents/demo_999

Dear Hiring Manager,

I can bring structured discovery, pragmatic execution, and a clear focus on measurable outcomes.

I can bring structured discovery, pragmatic execution, and a clear focus on measurable outcomes.

Sincerely,
Alex Martin`;

        const normalized = normalizeCoverLetterMarkdown(markdown);
        expect(normalized).toContain("Dear Hiring Manager,");
        expect(normalized).not.toMatch(/Document URL|Generated at|Source Link/i);
        expect(
            normalized.match(
                /I can bring structured discovery, pragmatic execution, and a clear focus on measurable outcomes\./g
            )?.length
        ).toBe(1);
    });
});
