import { parseCV } from "@/lib/cv-parser";

export interface CanonicalCvContact {
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    website?: string;
    extras: string[];
}

export interface CanonicalCvSubsection {
    heading: string;
    meta?: string;
    paragraphs: string[];
    bullets: string[];
}

export interface CanonicalCvSection {
    title: string;
    paragraphs: string[];
    subsections: CanonicalCvSubsection[];
}

export interface CanonicalCvDocument {
    fullName: string;
    headline: string;
    contact: CanonicalCvContact;
    sections: CanonicalCvSection[];
}

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const URL_REGEX = /\bhttps?:\/\/[^\s)]+/i;
const PHONE_REGEX = /(?:\+\d[\d\s().-]{5,}\d|\b\d[\d\s().-]{7,}\d\b)/;
const INTERNAL_DOC_URL_REGEX = /\bhttps?:\/\/(?:www\.)?autoapply\.works\/documents\/[A-Za-z0-9_-]+\b/gi;
const TIMESTAMP_REGEX =
    /\b(?:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z|\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?)\b/g;

const SECTION_ORDER = [
    "summary",
    "professional summary",
    "profile",
    "experience",
    "work experience",
    "education",
    "skills",
    "languages",
    "projects",
    "certifications",
];

function normalizeText(value: string) {
    return value.replace(/\s+/g, " ").trim();
}

function dedupeStrings(values: string[]) {
    const seen = new Set<string>();
    const deduped: string[] = [];

    for (const value of values) {
        const normalized = normalizeText(value).toLowerCase();
        if (!normalized || seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        deduped.push(normalizeText(value));
    }

    return deduped;
}

function splitContactTokens(line: string) {
    return line
        .split(/[|·]/g)
        .map((token) => normalizeText(token))
        .filter(Boolean);
}

function classifyContactToken(
    token: string,
    contact: CanonicalCvContact
) {
    const cleaned = token.replace(/\*\*/g, "");

    if (!contact.email) {
        const emailMatch = cleaned.match(EMAIL_REGEX);
        if (emailMatch) {
            contact.email = emailMatch[0];
            return;
        }
    }

    const lower = cleaned.toLowerCase();
    if (lower.includes("linkedin.com")) {
        if (!contact.linkedin) {
            contact.linkedin = cleaned;
        } else {
            contact.extras.push(cleaned);
        }
        return;
    }

    if (URL_REGEX.test(cleaned)) {
        if (!contact.website) {
            contact.website = cleaned;
        } else {
            contact.extras.push(cleaned);
        }
        return;
    }

    if (PHONE_REGEX.test(cleaned)) {
        if (!contact.phone) {
            contact.phone = cleaned;
        } else if (normalizeText(contact.phone).toLowerCase() !== cleaned.toLowerCase()) {
            contact.extras.push(cleaned);
        }
        return;
    }

    if (!contact.location) {
        contact.location = cleaned;
        return;
    }

    contact.extras.push(cleaned);
}

function sectionOrderWeight(title: string) {
    const normalized = normalizeText(title).toLowerCase();
    const idx = SECTION_ORDER.findIndex((item) => normalized === item || normalized.includes(item));
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

function mergeSections(sections: CanonicalCvSection[]) {
    const mergedMap = new Map<string, CanonicalCvSection>();
    const order: string[] = [];

    for (const section of sections) {
        const key = normalizeText(section.title).toLowerCase();
        if (!key) {
            continue;
        }

        if (!mergedMap.has(key)) {
            mergedMap.set(key, {
                title: normalizeText(section.title),
                paragraphs: [],
                subsections: [],
            });
            order.push(key);
        }

        const target = mergedMap.get(key)!;
        target.paragraphs.push(...section.paragraphs);
        target.subsections.push(...section.subsections);
    }

    const merged = order.map((key) => {
        const section = mergedMap.get(key)!;
        const subsectionMap = new Map<string, CanonicalCvSubsection>();
        const subsectionOrder: string[] = [];

        for (const subsection of section.subsections) {
            const heading = normalizeText(subsection.heading);
            const normalizedHeading = heading.toLowerCase();
            if (!normalizedHeading) {
                continue;
            }

            if (!subsectionMap.has(normalizedHeading)) {
                subsectionMap.set(normalizedHeading, {
                    heading,
                    meta: subsection.meta ? normalizeText(subsection.meta) : undefined,
                    paragraphs: [],
                    bullets: [],
                });
                subsectionOrder.push(normalizedHeading);
            }

            const targetSubsection = subsectionMap.get(normalizedHeading)!;
            if (!targetSubsection.meta && subsection.meta) {
                targetSubsection.meta = normalizeText(subsection.meta);
            }
            targetSubsection.paragraphs.push(...subsection.paragraphs);
            targetSubsection.bullets.push(...subsection.bullets);
        }

        return {
            title: section.title,
            paragraphs: dedupeStrings(section.paragraphs),
            subsections: subsectionOrder
                .map((item) => subsectionMap.get(item)!)
                .map((subsection) => ({
                    ...subsection,
                    paragraphs: dedupeStrings(subsection.paragraphs),
                    bullets: dedupeStrings(subsection.bullets),
                }))
                .filter(
                    (subsection) =>
                        subsection.heading ||
                        subsection.paragraphs.length > 0 ||
                        subsection.bullets.length > 0
                ),
        };
    });

    merged.sort((a, b) => {
        const diff = sectionOrderWeight(a.title) - sectionOrderWeight(b.title);
        if (diff !== 0) return diff;
        return a.title.localeCompare(b.title);
    });

    return merged.filter(
        (section) =>
            section.paragraphs.length > 0 || section.subsections.length > 0
    );
}

function sanitizeGeneratedText(text: string) {
    return text
        .replace(INTERNAL_DOC_URL_REGEX, "")
        .replace(TIMESTAMP_REGEX, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

export function normalizeCoverLetterMarkdown(markdown: string) {
    const sanitized = sanitizeGeneratedText(markdown);
    const lines = sanitized.split("\n");
    const dedupedLines: string[] = [];
    let previousNormalized = "";

    for (const rawLine of lines) {
        const line = rawLine.replace(/\s+$/, "");
        const normalized = normalizeText(line).toLowerCase();

        if (!normalized) {
            if (dedupedLines.length > 0 && dedupedLines[dedupedLines.length - 1] !== "") {
                dedupedLines.push("");
            }
            previousNormalized = "";
            continue;
        }

        if (normalized === previousNormalized) {
            continue;
        }

        dedupedLines.push(line);
        previousNormalized = normalized;
    }

    return dedupedLines.join("\n").trim();
}

export function buildCanonicalCvDocument(markdown: string): CanonicalCvDocument {
    const sanitizedMarkdown = sanitizeGeneratedText(markdown);
    const parsed = parseCV(sanitizedMarkdown);
    const contact: CanonicalCvContact = { extras: [] };

    for (const token of splitContactTokens(parsed.contactLine || "")) {
        classifyContactToken(token, contact);
    }

    contact.extras = dedupeStrings(contact.extras);

    const sections = mergeSections(
        parsed.sections.map((section) => ({
            title: section.title,
            paragraphs: section.paragraphs.map((paragraph) =>
                normalizeText(paragraph.replace(/\*\*(.*?)\*\*/g, "$1"))
            ),
            subsections: section.subsections.map((subsection) => ({
                heading: normalizeText(subsection.heading),
                meta: subsection.meta ? normalizeText(subsection.meta) : undefined,
                paragraphs: subsection.paragraphs.map((paragraph) =>
                    normalizeText(paragraph.replace(/\*\*(.*?)\*\*/g, "$1"))
                ),
                bullets: subsection.bullets.map((bullet) =>
                    normalizeText(bullet.replace(/\*\*(.*?)\*\*/g, "$1"))
                ),
            })),
        }))
    );

    return {
        fullName: normalizeText(parsed.name || "Candidate"),
        headline: normalizeText(parsed.subtitle || ""),
        contact,
        sections,
    };
}

export function normalizeCvMarkdown(markdown: string) {
    const model = buildCanonicalCvDocument(markdown);
    const lines: string[] = [];

    lines.push(`# ${model.fullName}`);
    if (model.headline) {
        lines.push(`**${model.headline}**`);
    }

    const contactTokens = [
        model.contact.location,
        model.contact.email,
        model.contact.phone,
        model.contact.linkedin,
        model.contact.website,
        ...model.contact.extras,
    ].filter(Boolean) as string[];

    if (contactTokens.length > 0) {
        lines.push(contactTokens.join(" | "));
    }

    for (const section of model.sections) {
        lines.push("", `## ${section.title}`);

        if (section.subsections.length > 0) {
            for (const subsection of section.subsections) {
                lines.push(`### ${subsection.heading}`);
                if (subsection.meta) {
                    lines.push(`**${subsection.meta}**`);
                }
                for (const paragraph of subsection.paragraphs) {
                    lines.push(paragraph);
                }
                for (const bullet of subsection.bullets) {
                    lines.push(`- ${bullet}`);
                }
                lines.push("");
            }
        } else {
            for (const paragraph of section.paragraphs) {
                lines.push(paragraph);
            }
        }
    }

    return lines
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
