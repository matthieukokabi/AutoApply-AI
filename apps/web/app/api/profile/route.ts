import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const MAX_RAW_TEXT_LENGTH = 150_000;
const MAX_STRUCTURED_JSON_LENGTH = 500_000;

/**
 * GET /api/profile — fetch the current user's master profile
 */
export async function GET(req: Request) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const profile = await prisma.masterProfile.findUnique({
            where: { userId: user.id },
        });

        const response = NextResponse.json({
            profile: profile || null,
        });
        response.headers.set("Cache-Control", "private, max-age=60, stale-while-revalidate=120");
        return response;
    } catch (error) {
        console.error("GET /api/profile error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * POST /api/profile — create or update the master profile
 * Body: { rawText: string, structuredJson: object }
 */
export async function POST(req: Request) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { rawText, structuredJson } = body;

        const safeRawText = typeof rawText === "string" ? rawText.trim() : "";
        const hasStructuredJson =
            structuredJson !== null &&
            typeof structuredJson === "object" &&
            !Array.isArray(structuredJson);

        if (!safeRawText || !hasStructuredJson) {
            return NextResponse.json(
                { error: "rawText and structuredJson are required" },
                { status: 400 }
            );
        }

        if (safeRawText.length > MAX_RAW_TEXT_LENGTH) {
            return NextResponse.json(
                { error: `rawText exceeds maximum length of ${MAX_RAW_TEXT_LENGTH} characters` },
                { status: 400 }
            );
        }

        const structuredJsonLength = JSON.stringify(structuredJson).length;
        if (structuredJsonLength > MAX_STRUCTURED_JSON_LENGTH) {
            return NextResponse.json(
                { error: "structuredJson payload is too large" },
                { status: 400 }
            );
        }

        const profile = await prisma.masterProfile.upsert({
            where: { userId: user.id },
            create: {
                userId: user.id,
                rawText: safeRawText,
                structuredJson,
            },
            update: {
                rawText: safeRawText,
                structuredJson,
            },
        });

        return NextResponse.json({ profile });
    } catch (error) {
        console.error("POST /api/profile error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
