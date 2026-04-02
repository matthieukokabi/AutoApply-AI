import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

const PROFILE_UPLOAD_RATE_LIMIT_MAX_REQUESTS = 6;
const PROFILE_UPLOAD_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_UPLOAD_FILE_BYTES = 5 * 1024 * 1024;
const MAX_RAW_TEXT_LENGTH = 200000;
const MAX_FILE_NAME_LENGTH = 255;
const profileUploadRequestLog = new Map<string, number[]>();

function buildSafeErrorLog(error: unknown) {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
        };
    }

    return { message: String(error) };
}

function inferExtensionFromMimeType(mimeType: string) {
    switch (mimeType) {
        case "application/pdf":
            return "pdf";
        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            return "docx";
        case "text/plain":
            return "txt";
        default:
            return "";
    }
}

async function extractTextFromPdf(buffer: Buffer) {
    const pdfParseModule = await import("pdf-parse");
    if (typeof pdfParseModule.PDFParse !== "function") {
        throw new Error("PDF_PARSE_MODULE_INVALID");
    }

    const parser = new pdfParseModule.PDFParse({ data: new Uint8Array(buffer) });
    try {
        const result = await parser.getText();
        return typeof result?.text === "string" ? result.text : "";
    } finally {
        await parser.destroy().catch(() => undefined);
    }
}

/**
 * POST /api/profile/upload — handle CV file upload
 * Accepts PDF, DOCX, or TXT files as multipart/form-data.
 * Extracts text server-side using pdf-parse (PDF) or mammoth (DOCX).
 */
export async function POST(req: Request) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const clientIp = getClientIp(req);
        if (
            clientIp &&
            isRateLimited({
                store: profileUploadRequestLog,
                key: clientIp,
                maxRequests: PROFILE_UPLOAD_RATE_LIMIT_MAX_REQUESTS,
                windowMs: PROFILE_UPLOAD_RATE_LIMIT_WINDOW_MS,
            })
        ) {
            return NextResponse.json(
                { error: "Too many upload attempts. Please try again shortly." },
                { status: 429 }
            );
        }

        const contentType = (req.headers.get("content-type") || "").toLowerCase();

        let rawText = "";
        let fileName = "upload";

        if (contentType.includes("multipart/form-data")) {
            // Handle binary file upload
            let formData: FormData;
            try {
                formData = await req.formData();
            } catch (formDataError) {
                console.error("POST /api/profile/upload multipart parse error:", {
                    stage: "multipart_parse",
                    ...buildSafeErrorLog(formDataError),
                });
                return NextResponse.json(
                    {
                        error: "Could not process this upload payload. Please re-select the file and try again.",
                    },
                    { status: 400 }
                );
            }

            const fileEntry = formData.get("file");
            if (!(fileEntry instanceof File)) {
                return NextResponse.json({ error: "No file provided" }, { status: 400 });
            }
            const file = fileEntry;

            if (file.size > MAX_UPLOAD_FILE_BYTES) {
                return NextResponse.json(
                    { error: "File is too large. Maximum size is 5MB." },
                    { status: 413 }
                );
            }

            fileName = file.name;
            if (fileName.length > MAX_FILE_NAME_LENGTH) {
                fileName = fileName.slice(0, MAX_FILE_NAME_LENGTH);
            }
            const extFromName = fileName.split(".").pop()?.toLowerCase() || "";
            const ext = extFromName || inferExtensionFromMimeType((file.type || "").toLowerCase());

            let buffer: Buffer;
            try {
                buffer = Buffer.from(await file.arrayBuffer());
            } catch (fileReadError) {
                console.error("POST /api/profile/upload file read error:", {
                    stage: "file_read",
                    fileType: file.type || "unknown",
                    fileSize: file.size,
                    ...buildSafeErrorLog(fileReadError),
                });
                return NextResponse.json(
                    { error: "Could not read this file. Please try another PDF, DOCX, or TXT file." },
                    { status: 400 }
                );
            }

            if (ext === "pdf") {
                // Fast fail for invalid payloads before invoking PDF parser.
                // Helps avoid long parser hangs on non-PDF byte streams.
                const pdfSignature = buffer.subarray(0, 5).toString("utf-8");
                if (pdfSignature !== "%PDF-") {
                    return NextResponse.json(
                        { error: "Invalid PDF file. Please upload a valid PDF document." },
                        { status: 400 }
                    );
                }

                try {
                    rawText = await extractTextFromPdf(buffer);
                } catch (parseError) {
                    console.error("POST /api/profile/upload PDF parse error:", parseError);
                    return NextResponse.json(
                        {
                            error: "Unable to read this PDF. Please upload a standard PDF, DOCX, or paste your CV text.",
                        },
                        { status: 400 }
                    );
                }
            } else if (ext === "docx") {
                try {
                    const mammoth = await import("mammoth");
                    const result = await mammoth.extractRawText({ buffer });
                    rawText = result.value;
                } catch (parseError) {
                    console.error("POST /api/profile/upload DOCX parse error:", parseError);
                    return NextResponse.json(
                        {
                            error: "Unable to read this DOCX file. Please upload another DOCX, TXT, or paste your CV text.",
                        },
                        { status: 400 }
                    );
                }
            } else if (ext === "txt") {
                rawText = buffer.toString("utf-8");
            } else {
                return NextResponse.json(
                    { error: "Unsupported file type. Please upload PDF, DOCX, or TXT." },
                    { status: 400 }
                );
            }
        } else {
            // Fallback: JSON body with rawText (for paste or client-side extraction)
            let body: Record<string, unknown>;
            try {
                body = (await req.json()) as Record<string, unknown>;
            } catch (jsonParseError) {
                console.error("POST /api/profile/upload JSON parse error:", {
                    stage: "json_parse",
                    ...buildSafeErrorLog(jsonParseError),
                });
                return NextResponse.json(
                    {
                        error: "Invalid upload payload. Please paste your CV text again or upload a file.",
                    },
                    { status: 400 }
                );
            }
            rawText = typeof body.rawText === "string" ? body.rawText : "";
            fileName = typeof body.fileName === "string" ? body.fileName : "paste";
            if (fileName.length > MAX_FILE_NAME_LENGTH) {
                fileName = fileName.slice(0, MAX_FILE_NAME_LENGTH);
            }
        }

        if (rawText.length > MAX_RAW_TEXT_LENGTH) {
            return NextResponse.json(
                { error: "CV text is too long. Please upload a smaller file." },
                { status: 400 }
            );
        }

        if (!rawText || rawText.trim().length < 50) {
            return NextResponse.json(
                { error: "CV text is too short. Please upload a valid CV file." },
                { status: 400 }
            );
        }

        const defaultStructuredJson = {
            contact: { name: "", email: "", phone: "", location: "" },
            summary: "",
            experience: [],
            education: [],
            skills: [],
        };

        const profile = await prisma.masterProfile.upsert({
            where: { userId: user.id },
            create: {
                userId: user.id,
                rawText,
                structuredJson: defaultStructuredJson,
            },
            update: {
                rawText,
            },
        });

        return NextResponse.json({
            profile,
            fileName,
            message: "CV uploaded successfully. Edit the structured profile to fine-tune.",
        });
    } catch (error) {
        console.error("POST /api/profile/upload error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
