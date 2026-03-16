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

        const contentType = req.headers.get("content-type") || "";

        let rawText = "";
        let fileName = "upload";

        if (contentType.includes("multipart/form-data")) {
            // Handle binary file upload
            const formData = await req.formData();
            const file = formData.get("file") as File | null;

            if (!file) {
                return NextResponse.json({ error: "No file provided" }, { status: 400 });
            }

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
            const ext = fileName.split(".").pop()?.toLowerCase();
            const buffer = Buffer.from(await file.arrayBuffer());

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

                const pdfParseModule = await import("pdf-parse");
                const pdfParse = (pdfParseModule as any).default || (pdfParseModule as any);
                const result = await pdfParse(buffer);
                rawText = result.text;
            } else if (ext === "docx") {
                const mammoth = await import("mammoth");
                const result = await mammoth.extractRawText({ buffer });
                rawText = result.value;
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
            const body = await req.json();
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
