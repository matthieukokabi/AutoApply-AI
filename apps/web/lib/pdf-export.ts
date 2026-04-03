import { PDFDocument, StandardFonts, type PDFFont, rgb } from "pdf-lib";
import {
    buildCanonicalCvDocument,
    normalizeCoverLetterMarkdown,
} from "@/lib/document-model";

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 48;
const CONTENT_WIDTH = A4_WIDTH - PAGE_MARGIN * 2;
const COVER_LETTER_TITLE_PATTERNS = [/cover letter/i, /motivation letter/i, /lettre/i];

type PdfContext = {
    pdfDoc: PDFDocument;
    regularFont: PDFFont;
    boldFont: PDFFont;
    italicFont: PDFFont;
    page: ReturnType<PDFDocument["addPage"]>;
    y: number;
};

function markdownToPlainText(value: string) {
    return value
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/`(.*?)`/g, "$1")
        .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
        .replace(/^\s*[-•]\s+/gm, "• ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function normalizePlain(value: string) {
    return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function dedupePlainStrings(values: string[]) {
    const seen = new Set<string>();
    const deduped: string[] = [];

    for (const value of values) {
        const normalized = normalizePlain(value);
        if (!normalized || seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        deduped.push(value.trim());
    }

    return deduped;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
    const words = text.trim().split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
        const nextLine = currentLine ? `${currentLine} ${word}` : word;
        const nextLineWidth = font.widthOfTextAtSize(nextLine, size);
        if (nextLineWidth <= maxWidth) {
            currentLine = nextLine;
            continue;
        }

        if (currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            lines.push(word);
        }
    }

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [""];
}

function createPdfContext(
    pdfDoc: PDFDocument,
    regularFont: PDFFont,
    boldFont: PDFFont,
    italicFont: PDFFont
): PdfContext {
    return {
        pdfDoc,
        regularFont,
        boldFont,
        italicFont,
        page: pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]),
        y: A4_HEIGHT - PAGE_MARGIN,
    };
}

function ensureSpace(ctx: PdfContext, requiredHeight: number) {
    if (ctx.y - requiredHeight >= PAGE_MARGIN) {
        return;
    }

    ctx.page = ctx.pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    ctx.y = A4_HEIGHT - PAGE_MARGIN;
}

function drawParagraph(
    ctx: PdfContext,
    text: string,
    options: {
        font?: PDFFont;
        size?: number;
        lineHeight?: number;
        indent?: number;
        color?: ReturnType<typeof rgb>;
        spacingAfter?: number;
    } = {}
) {
    if (!normalizeTextForPdf(text)) {
        return;
    }

    const font = options.font || ctx.regularFont;
    const size = options.size || 11;
    const lineHeight = options.lineHeight || size * 1.4;
    const indent = options.indent || 0;
    const color = options.color || rgb(0.11, 0.14, 0.18);
    const spacingAfter = options.spacingAfter ?? 4;
    const lines = wrapText(text, font, size, CONTENT_WIDTH - indent);

    ensureSpace(ctx, lines.length * lineHeight + spacingAfter);
    for (const line of lines) {
        ctx.page.drawText(line, {
            x: PAGE_MARGIN + indent,
            y: ctx.y,
            size,
            font,
            color,
        });
        ctx.y -= lineHeight;
    }
    ctx.y -= spacingAfter;
}

function normalizeTextForPdf(value: string) {
    return value.replace(/\s+/g, " ").trim();
}

function drawSectionHeader(ctx: PdfContext, title: string, minBodyHeight = 22) {
    ensureSpace(ctx, 26 + minBodyHeight);
    ctx.page.drawText(title.toUpperCase(), {
        x: PAGE_MARGIN,
        y: ctx.y,
        size: 10.5,
        font: ctx.boldFont,
        color: rgb(0.18, 0.22, 0.28),
    });
    ctx.y -= 8;
    ctx.page.drawLine({
        start: { x: PAGE_MARGIN, y: ctx.y },
        end: { x: A4_WIDTH - PAGE_MARGIN, y: ctx.y },
        thickness: 0.8,
        color: rgb(0.82, 0.85, 0.89),
    });
    ctx.y -= 10;
}

export async function renderCvPdf(markdown: string) {
    const model = buildCanonicalCvDocument(markdown);
    const pdfDoc = await PDFDocument.create();
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const ctx = createPdfContext(pdfDoc, regularFont, boldFont, italicFont);

    drawParagraph(ctx, model.fullName, {
        font: boldFont,
        size: 25,
        lineHeight: 30,
        spacingAfter: 5,
    });

    if (model.headline) {
        drawParagraph(ctx, model.headline, {
            font: regularFont,
            size: 12.5,
            lineHeight: 17,
            color: rgb(0.24, 0.31, 0.42),
            spacingAfter: 8,
        });
    }

    const contactTokens = dedupePlainStrings([
        model.contact.location,
        model.contact.email,
        model.contact.phone,
        model.contact.linkedin,
        model.contact.website,
    ].filter(Boolean) as string[]);

    if (contactTokens.length > 0) {
        drawParagraph(ctx, contactTokens.join("  |  "), {
            font: regularFont,
            size: 10.25,
            lineHeight: 14,
            color: rgb(0.34, 0.41, 0.5),
            spacingAfter: 14,
        });
    }

    for (const section of model.sections) {
        const subsection = section.subsections[0];
        const estimatedBodyHeight =
            subsection && subsection.bullets.length > 0 ? 42 : 28;
        drawSectionHeader(ctx, section.title, estimatedBodyHeight);

        if (section.subsections.length > 0) {
            for (const subsection of section.subsections) {
                ensureSpace(ctx, 30);
                drawParagraph(ctx, subsection.heading, {
                    font: boldFont,
                    size: 11.2,
                    lineHeight: 14.5,
                    spacingAfter: 2.5,
                });

                if (subsection.meta) {
                    drawParagraph(ctx, subsection.meta, {
                        font: italicFont,
                        size: 10,
                        lineHeight: 13,
                        color: rgb(0.45, 0.5, 0.58),
                        spacingAfter: 4.5,
                    });
                }

                for (const paragraph of subsection.paragraphs) {
                    drawParagraph(ctx, paragraph, {
                        size: 10.6,
                        lineHeight: 14.3,
                        spacingAfter: 3.5,
                    });
                }

                for (const bullet of subsection.bullets) {
                    drawParagraph(ctx, `• ${bullet}`, {
                        size: 10.6,
                        lineHeight: 14.3,
                        indent: 9,
                        spacingAfter: 2.5,
                    });
                }

                ctx.y -= 4.5;
            }
        } else {
            for (const paragraph of section.paragraphs) {
                drawParagraph(ctx, paragraph, {
                    size: 10.6,
                    lineHeight: 14.4,
                    spacingAfter: 4.5,
                });
            }
        }
    }

    return pdfDoc.save();
}

export async function renderCoverLetterPdf(markdown: string) {
    const normalized = normalizeCoverLetterMarkdown(markdown);
    const plain = markdownToPlainText(normalized);
    const blocks = plain
        .split(/\n{2,}/)
        .map((paragraph) => normalizeTextForPdf(paragraph))
        .filter(Boolean);
    const paragraphs = dedupePlainStrings(blocks);

    const pdfDoc = await PDFDocument.create();
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const ctx = createPdfContext(pdfDoc, regularFont, boldFont, italicFont);

    const firstParagraph = paragraphs[0];
    const hasExplicitTitle =
        typeof firstParagraph === "string" &&
        COVER_LETTER_TITLE_PATTERNS.some((pattern) => pattern.test(firstParagraph));
    const title = hasExplicitTitle ? firstParagraph : "Motivation Letter";
    const bodyParagraphs = hasExplicitTitle ? paragraphs.slice(1) : paragraphs;

    drawParagraph(ctx, title, {
        font: boldFont,
        size: 18,
        lineHeight: 24,
        spacingAfter: 14,
    });

    for (const paragraph of bodyParagraphs) {
        const isClosingBlock = /^(sincerely|kind regards|best regards|cordially|salutations|yours truly)/i.test(
            paragraph
        );
        drawParagraph(ctx, paragraph, {
            font: isClosingBlock ? italicFont : regularFont,
            size: 11.1,
            lineHeight: 17.4,
            spacingAfter: isClosingBlock ? 10 : 8.5,
        });
    }

    return pdfDoc.save();
}
