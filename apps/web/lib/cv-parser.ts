import type { ParsedCV, ParsedCVSection, ParsedCVSubsection } from "./types";

/**
 * Parses Claude's markdown CV output into structured sections.
 * Language-agnostic — works for FR, DE, EN, ES, IT.
 */
export function parseCV(markdown: string): ParsedCV {
    const lines = markdown.split("\n");

    let name = "";
    let subtitle = "";
    let contactLine = "";
    const sections: ParsedCVSection[] = [];

    let currentSection: ParsedCVSection | null = null;
    let currentSubsection: ParsedCVSubsection | null = null;
    let headerParsed = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip empty lines
        if (!trimmed) continue;

        // H1 — Name
        if (trimmed.startsWith("# ") && !name) {
            name = trimmed.replace(/^# /, "").trim();
            continue;
        }

        // Before first section header, parse the header block
        if (!headerParsed && !trimmed.startsWith("## ")) {
            // Bold text as subtitle (e.g., **Title | Role**)
            if (
                !subtitle &&
                trimmed.startsWith("**") &&
                trimmed.endsWith("**")
            ) {
                subtitle = trimmed.replace(/^\*\*/, "").replace(/\*\*$/, "");
                continue;
            }

            // Contact line — contains pipe separators or common contact patterns
            if (
                !contactLine &&
                (trimmed.includes("|") ||
                    trimmed.includes("@") ||
                    trimmed.includes("+"))
            ) {
                contactLine = trimmed;
                continue;
            }

            // Any other pre-section text, try as subtitle or contact
            if (!subtitle && !trimmed.startsWith("## ")) {
                subtitle = trimmed.replace(/^\*\*/, "").replace(/\*\*$/, "");
                continue;
            }
        }

        // H2 — New section
        if (trimmed.startsWith("## ")) {
            headerParsed = true;

            // Save previous subsection
            if (currentSubsection && currentSection) {
                currentSection.subsections.push(currentSubsection);
                currentSubsection = null;
            }

            // Save previous section
            if (currentSection) {
                sections.push(currentSection);
            }

            currentSection = {
                title: trimmed.replace(/^## /, "").trim(),
                content: "",
                subsections: [],
                paragraphs: [],
            };
            continue;
        }

        // H3 — New subsection within current section
        if (trimmed.startsWith("### ") && currentSection) {
            // Save previous subsection
            if (currentSubsection) {
                currentSection.subsections.push(currentSubsection);
            }

            currentSubsection = {
                heading: trimmed.replace(/^### /, "").trim(),
                bullets: [],
                paragraphs: [],
            };
            continue;
        }

        // Content within sections
        if (currentSection) {
            // Bold line within subsection = meta (dates)
            if (
                currentSubsection &&
                trimmed.startsWith("**") &&
                trimmed.endsWith("**")
            ) {
                currentSubsection.meta = trimmed
                    .replace(/^\*\*/, "")
                    .replace(/\*\*$/, "");
                continue;
            }

            // Bullet point
            if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
                const bullet = trimmed.replace(/^[-•] /, "");
                if (currentSubsection) {
                    currentSubsection.bullets.push(bullet);
                } else {
                    // Bullets directly in section (e.g., Skills section)
                    currentSection.paragraphs.push(bullet);
                }
                continue;
            }

            // Regular paragraph
            if (currentSubsection) {
                currentSubsection.paragraphs.push(trimmed);
            } else {
                currentSection.paragraphs.push(trimmed);
            }
        }
    }

    // Save last subsection and section
    if (currentSubsection && currentSection) {
        currentSection.subsections.push(currentSubsection);
    }
    if (currentSection) {
        sections.push(currentSection);
    }

    return { name, subtitle, contactLine, sections };
}
