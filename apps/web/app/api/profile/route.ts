import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

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

        return NextResponse.json({
            profile: profile || null,
        });
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

        if (!rawText || !structuredJson) {
            return NextResponse.json(
                { error: "rawText and structuredJson are required" },
                { status: 400 }
            );
        }

        const profile = await prisma.masterProfile.upsert({
            where: { userId: user.id },
            create: {
                userId: user.id,
                rawText,
                structuredJson,
            },
            update: {
                rawText,
                structuredJson,
            },
        });

        return NextResponse.json({ profile });
    } catch (error) {
        console.error("POST /api/profile error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
