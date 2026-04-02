import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { renderCoverLetterPdf, renderCvPdf } from "@/lib/pdf-export";

const MAX_MARKDOWN_LENGTH = 120000;
const SAFE_FILE_NAME_REGEX = /[^a-zA-Z0-9._-]/g;

function sanitizeFileName(value: string, fallback: string) {
    const normalized = String(value || "").trim().replace(SAFE_FILE_NAME_REGEX, "_");
    if (!normalized) {
        return fallback;
    }
    if (normalized.toLowerCase().endsWith(".pdf")) {
        return normalized;
    }
    return `${normalized}.pdf`;
}

/**
 * POST /api/export/pdf
 * Body: { type: "cv" | "letter", markdown: string, fileName?: string }
 */
export async function POST(req: Request) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await req.json()) as Record<string, unknown>;
        const type = typeof body.type === "string" ? body.type : "";
        const markdown = typeof body.markdown === "string" ? body.markdown : "";
        const fileName = typeof body.fileName === "string" ? body.fileName : "";

        if (type !== "cv" && type !== "letter") {
            return NextResponse.json(
                { error: "Invalid export type. Must be cv or letter." },
                { status: 400 }
            );
        }

        if (!markdown.trim()) {
            return NextResponse.json(
                { error: "Document content is required." },
                { status: 400 }
            );
        }

        if (markdown.length > MAX_MARKDOWN_LENGTH) {
            return NextResponse.json(
                { error: "Document is too large to export." },
                { status: 400 }
            );
        }

        const pdfBytes =
            type === "cv"
                ? await renderCvPdf(markdown)
                : await renderCoverLetterPdf(markdown);

        const downloadName = sanitizeFileName(
            fileName,
            type === "cv" ? "tailored-cv.pdf" : "cover-letter.pdf"
        );

        return new Response(Buffer.from(pdfBytes), {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${downloadName}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        console.error("POST /api/export/pdf error:", error);
        return NextResponse.json({ error: "Export failed." }, { status: 500 });
    }
}
