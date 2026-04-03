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
const EMAIL_GLOBAL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL_REGEX = /\bhttps?:\/\/[^\s)]+/i;
const URL_GLOBAL_REGEX = /\bhttps?:\/\/[^\s)]+/gi;
const PHONE_REGEX = /(?:\+\d[\d\s().-]{5,}\d|\b\d[\d\s().-]{7,}\d\b)/;
const PHONE_GLOBAL_REGEX = /(?:\+\d[\d\s().-]{5,}\d|\b\d[\d\s().-]{7,}\d\b)/g;
const INTERNAL_AUTOAPPLY_URL_REGEX =
    /\bhttps?:\/\/(?:[\w-]+\.)?autoapply(?:\.works|\.ai)?[^\s)]*\b/gi;
const METADATA_LINE_REGEX =
    /^(?:document\s*(?:url|link)|source\s*(?:url|link)|generated(?:\s*(?:at|on))?|timestamp|created\s*at|updated\s*at|exported\s*at|autoapply\s*document)\b/i;
const TIMESTAMP_ONLY_REGEX =
    /^(?:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z|\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?)$/;
const CONTACT_LABEL_PREFIX_REGEX =
    /^(?:email|e-mail|mail|phone|mobile|tel|telephone|linkedin|website|portfolio|location|address)\s*:\s*/i;
const METADATA_FRAGMENT_REGEXES = [
    /\bdocument\s*(?:url|link)\s*:\s*/gi,
    /\bsource\s*(?:url|link)\s*:\s*/gi,
    /\bgenerated(?:\s*(?:at|on))?\s*:\s*/gi,
    /\btimestamp\s*:\s*/gi,
    /\bcreated\s*at\s*:\s*/gi,
    /\bupdated\s*at\s*:\s*/gi,
    /\bexported\s*at\s*:\s*/gi,
    /\bautoapply\s*document\s*:\s*/gi,
];

const SECTION_ORDER = [
    "summary",
    "experience",
    "education",
    "skills",
    "languages",
    "projects",
    "certifications",
];

function stripMarkdownInline(value: string) {
    return value
        .replace(/\[(.*?)\]\((.*?)\)/g, "$1 $2")
        .replace(/`(.*?)`/g, "$1")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .trim();
}

function normalizeText(value: string) {
    return value.replace(/\s+/g, " ").trim();
}

function comparableKey(value: string) {
    const normalized = normalizeText(stripMarkdownInline(value))
        .replace(/^[-•]\s*/, "")
        .replace(/\bmailto:/gi, "")
        .replace(CONTACT_LABEL_PREFIX_REGEX, "")
        .replace(/\s*[|·•]\s*/g, " ")
        .replace(/[“”"']/g, "")
        .replace(/[.,;:!?]+$/g, "")
        .toLowerCase();

    if (!normalized) {
        return "";
    }

    return normalized.replace(/\/$/, "");
}

function dedupeStrings(values: string[]) {
    const seen = new Set<string>();
    const deduped: string[] = [];

    for (const value of values) {
        const normalizedDisplay = normalizeText(stripMarkdownInline(value));
        const normalizedKey = comparableKey(normalizedDisplay);
        if (!normalizedDisplay || !normalizedKey || seen.has(normalizedKey)) {
            continue;
        }
        seen.add(normalizedKey);
        deduped.push(normalizedDisplay);
    }

    return deduped;
}

function isMetadataLine(line: string) {
    const cleaned = normalizeText(stripMarkdownInline(line));
    if (!cleaned) {
        return false;
    }

    if (METADATA_LINE_REGEX.test(cleaned)) {
        return true;
    }

    if (TIMESTAMP_ONLY_REGEX.test(cleaned)) {
        return true;
    }

    if (/^(?:https?:\/\/)?(?:[\w-]+\.)?autoapply(?:\.works|\.ai)\b/i.test(cleaned)) {
        return true;
    }

    return false;
}

function stripMetadataFragments(line: string) {
    let next = line;
    for (const regex of METADATA_FRAGMENT_REGEXES) {
        next = next.replace(regex, "");
    }
    return normalizeText(next);
}

function sanitizeGeneratedText(text: string) {
    const stripped = text.replace(INTERNAL_AUTOAPPLY_URL_REGEX, "");
    const lines = stripped.split("\n");
    const cleanedLines: string[] = [];

    for (const rawLine of lines) {
        const line = rawLine.replace(/[ \t]+$/g, "");
        const withoutMetadataFragments = stripMetadataFragments(line);
        const trimmed = normalizeText(withoutMetadataFragments);

        if (!trimmed) {
            if (
                cleanedLines.length > 0 &&
                cleanedLines[cleanedLines.length - 1] !== ""
            ) {
                cleanedLines.push("");
            }
            continue;
        }

        if (isMetadataLine(trimmed)) {
            continue;
        }

        cleanedLines.push(trimmed);
    }

    return cleanedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function splitContactTokens(line: string) {
    const lineWithoutLabels = normalizeText(
        stripMarkdownInline(line).replace(CONTACT_LABEL_PREFIX_REGEX, "")
    );

    return lineWithoutLabels
        .split(/[|·•]/g)
        .map((token) => normalizeText(token))
        .filter(Boolean);
}

function extractHeaderLines(markdown: string) {
    const lines = markdown.split("\n");
    const headerLines: string[] = [];
    let seenName = false;

    for (const raw of lines) {
        const line = raw.trim();
        if (!line) {
            continue;
        }

        if (!seenName && line.startsWith("# ")) {
            seenName = true;
            continue;
        }

        if (line.startsWith("## ")) {
            break;
        }

        headerLines.push(line);
    }

    return headerLines;
}

function looksLikeContactLine(line: string) {
    const cleaned = stripMarkdownInline(line);
    return (
        cleaned.includes("@") ||
        cleaned.includes("linkedin.com") ||
        cleaned.includes("http://") ||
        cleaned.includes("https://") ||
        cleaned.includes("|") ||
        cleaned.includes("·") ||
        PHONE_REGEX.test(cleaned)
    );
}

function classifyContactToken(token: string, contact: CanonicalCvContact) {
    const cleaned = normalizeText(
        stripMarkdownInline(token)
            .replace(CONTACT_LABEL_PREFIX_REGEX, "")
            .replace(/\bmailto:/gi, "")
    );

    if (!cleaned) {
        return;
    }

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
        } else if (comparableKey(contact.linkedin) !== comparableKey(cleaned)) {
            contact.extras.push(cleaned);
        }
        return;
    }

    if (URL_REGEX.test(cleaned)) {
        if (!contact.website) {
            contact.website = cleaned;
        } else if (comparableKey(contact.website) !== comparableKey(cleaned)) {
            contact.extras.push(cleaned);
        }
        return;
    }

    if (PHONE_REGEX.test(cleaned)) {
        if (!contact.phone) {
            contact.phone = cleaned;
        } else if (comparableKey(contact.phone) !== comparableKey(cleaned)) {
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

function parseContactFromLine(line: string, contact: CanonicalCvContact) {
    const cleanedLine = normalizeText(stripMarkdownInline(line));
    if (!cleanedLine) {
        return;
    }

    const directTokens = splitContactTokens(cleanedLine);
    if (directTokens.length > 1) {
        for (const token of directTokens) {
            classifyContactToken(token, contact);
        }
        return;
    }

    const emails = cleanedLine.match(EMAIL_GLOBAL_REGEX) || [];
    const phones = cleanedLine.match(PHONE_GLOBAL_REGEX) || [];
    const urls = cleanedLine.match(URL_GLOBAL_REGEX) || [];

    for (const email of emails) {
        classifyContactToken(email, contact);
    }
    for (const phone of phones) {
        classifyContactToken(phone, contact);
    }
    for (const url of urls) {
        classifyContactToken(url, contact);
    }

    let residual = cleanedLine;
    for (const token of [...emails, ...phones, ...urls]) {
        residual = residual.replace(token, " ");
    }

    const residualTokens = residual
        .split(/[|·•]/g)
        .map((token) => normalizeText(token))
        .filter(Boolean);
    for (const token of residualTokens) {
        classifyContactToken(token, contact);
    }
}

function canonicalSectionTitle(title: string) {
    const normalizedKey = comparableKey(title);

    if (
        /\bsummary\b|\bprofile\b|\babout\b/.test(normalizedKey)
    ) {
        return "Summary";
    }
    if (
        /\bexperience\b/.test(normalizedKey) ||
        /\bemployment\b/.test(normalizedKey) ||
        /\bwork history\b/.test(normalizedKey) ||
        /\bcareer\b/.test(normalizedKey)
    ) {
        return "Experience";
    }
    if (/\beducation\b|\bformation\b/.test(normalizedKey)) {
        return "Education";
    }
    if (/\bskill\b|\bcompeten\b|\btechnology\b/.test(normalizedKey)) {
        return "Skills";
    }
    if (/\blanguage\b|\blangue\b/.test(normalizedKey)) {
        return "Languages";
    }
    if (/\bproject\b/.test(normalizedKey)) {
        return "Projects";
    }
    if (/\bcertification\b|\bcertificate\b|\blicen\b/.test(normalizedKey)) {
        return "Certifications";
    }

    return normalizeText(title) || "Additional Information";
}

function sectionOrderWeight(title: string) {
    const normalized = normalizeText(title).toLowerCase();
    const idx = SECTION_ORDER.findIndex((item) => normalized === item || normalized.includes(item));
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

function buildContactComparableSet(contact: CanonicalCvContact) {
    const set = new Set<string>();
    for (const token of [
        contact.location,
        contact.email,
        contact.phone,
        contact.linkedin,
        contact.website,
        ...contact.extras,
    ]) {
        if (!token) {
            continue;
        }
        const key = comparableKey(token);
        if (key) {
            set.add(key);
        }
    }
    return set;
}

function shouldDropContentLine(value: string, contactComparableSet: Set<string>) {
    const cleaned = normalizeText(stripMarkdownInline(value));
    if (!cleaned) {
        return true;
    }

    if (isMetadataLine(cleaned)) {
        return true;
    }

    const key = comparableKey(cleaned);
    if (key && contactComparableSet.has(key)) {
        return true;
    }

    return false;
}

function mergeSections(sections: CanonicalCvSection[]) {
    const mergedMap = new Map<string, CanonicalCvSection>();
    const order: string[] = [];

    for (const section of sections) {
        const title = canonicalSectionTitle(section.title);
        const key = normalizeText(title).toLowerCase();
        if (!key) {
            continue;
        }

        if (!mergedMap.has(key)) {
            mergedMap.set(key, {
                title,
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
            const normalizedHeading = comparableKey(heading);
            const subsectionKey = normalizedHeading || comparableKey(subsection.meta || "");
            if (!subsectionKey) {
                continue;
            }

            if (!subsectionMap.has(subsectionKey)) {
                subsectionMap.set(subsectionKey, {
                    heading,
                    meta: subsection.meta ? normalizeText(subsection.meta) : undefined,
                    paragraphs: [],
                    bullets: [],
                });
                subsectionOrder.push(subsectionKey);
            }

            const targetSubsection = subsectionMap.get(subsectionKey)!;
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

export function normalizeCoverLetterMarkdown(markdown: string) {
    const sanitized = sanitizeGeneratedText(markdown);
    if (!sanitized) {
        return "";
    }

    const rawBlocks = sanitized
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter(Boolean);

    const seenBlocks = new Set<string>();
    const seenLineKeys = new Set<string>();
    const dedupedBlocks: string[] = [];

    for (const rawBlock of rawBlocks) {
        const lines = rawBlock
            .split("\n")
            .map((line) => normalizeText(line))
            .filter(Boolean);

        if (lines.length === 0) {
            continue;
        }

        const dedupedLines: string[] = [];

        for (const line of lines) {
            if (isMetadataLine(line)) {
                continue;
            }
            const lineKey = comparableKey(line);
            if (!lineKey || seenLineKeys.has(lineKey)) {
                continue;
            }
            dedupedLines.push(line);
            seenLineKeys.add(lineKey);
        }

        if (dedupedLines.length === 0) {
            continue;
        }

        const blockText = dedupedLines.join("\n");
        const blockKey = comparableKey(blockText);
        if (!blockKey || seenBlocks.has(blockKey)) {
            continue;
        }

        seenBlocks.add(blockKey);
        dedupedBlocks.push(blockText);
    }

    return dedupedBlocks.join("\n\n").trim();
}

export function buildCanonicalCvDocument(markdown: string): CanonicalCvDocument {
    const sanitizedMarkdown = sanitizeGeneratedText(markdown);
    const parsed = parseCV(sanitizedMarkdown);
    const contact: CanonicalCvContact = { extras: [] };

    const headerLines = extractHeaderLines(sanitizedMarkdown);
    for (const line of headerLines) {
        if (looksLikeContactLine(line)) {
            parseContactFromLine(line, contact);
        }
    }

    for (const token of splitContactTokens(parsed.contactLine || "")) {
        classifyContactToken(token, contact);
    }

    contact.extras = dedupeStrings(contact.extras);
    const contactComparableSet = buildContactComparableSet(contact);

    const sections = mergeSections(
        parsed.sections.map((section) => ({
            title: canonicalSectionTitle(section.title),
            paragraphs: section.paragraphs
                .map((paragraph) =>
                    normalizeText(stripMarkdownInline(paragraph))
                )
                .filter((paragraph) => !shouldDropContentLine(paragraph, contactComparableSet)),
            subsections: section.subsections.map((subsection) => ({
                heading: normalizeText(stripMarkdownInline(subsection.heading)),
                meta: subsection.meta
                    ? normalizeText(stripMarkdownInline(subsection.meta))
                    : undefined,
                paragraphs: subsection.paragraphs
                    .map((paragraph) =>
                        normalizeText(stripMarkdownInline(paragraph))
                    )
                    .filter((paragraph) => !shouldDropContentLine(paragraph, contactComparableSet)),
                bullets: subsection.bullets
                    .map((bullet) =>
                        normalizeText(stripMarkdownInline(bullet))
                    )
                    .filter((bullet) => !shouldDropContentLine(bullet, contactComparableSet)),
            })),
        }))
    );

    return {
        fullName: normalizeText(parsed.name || "Candidate"),
        headline: normalizeText(stripMarkdownInline(parsed.subtitle || "")),
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
        lines.push(dedupeStrings(contactTokens).join(" | "));
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
