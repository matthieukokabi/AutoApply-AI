import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/profile/upload — handle CV file upload
 * Accepts PDF or DOCX, extracts text, stores as master profile.
 *
 * For now, accepts the extracted text from the client side.
 * Client-side extraction avoids heavy server deps (pdf-parse, mammoth)
 * that cause issues in edge/serverless. The client reads the file
 * and sends the text content.
 *
 * Body: { rawText: string, fileName: string }
 */
export async function POST(req: Request) {
    try {
        const { userId: clerkId } = auth();
        if (!clerkId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findFirst({
            where: { clerkId },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const body = await req.json();
        const { rawText, fileName } = body;

        if (!rawText || rawText.trim().length < 50) {
            return NextResponse.json(
                { error: "CV text is too short. Please upload a valid CV file." },
                { status: 400 }
            );
        }

        // Build a basic structured JSON from the raw text.
        // In production, this would call an LLM to parse the CV.
        // For now, store a minimal structure that the user can edit.
        const defaultStructuredJson = {
            contact: {
                name: "",
                email: "",
                phone: "",
                location: "",
            },
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
                // Only update structured JSON if there isn't one yet
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
