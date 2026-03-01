import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

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

            fileName = file.name;
            const ext = fileName.split(".").pop()?.toLowerCase();
            const buffer = Buffer.from(await file.arrayBuffer());

            if (ext === "pdf") {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const pdfParse = require("pdf-parse");
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
            rawText = body.rawText || "";
            fileName = body.fileName || "paste";
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
