import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/preferences — fetch the current user's job preferences
 */
export async function GET() {
    try {
        const { userId: clerkId } = auth();
        if (!clerkId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findFirst({
            where: { clerkId },
            include: { preferences: true },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({
            preferences: user.preferences || null,
        });
    } catch (error) {
        console.error("GET /api/preferences error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * PUT /api/preferences — create or update job preferences
 * Body: { targetTitles, locations, remotePreference, salaryMin, industries }
 */
export async function PUT(req: Request) {
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
        const {
            targetTitles = [],
            locations = [],
            remotePreference = "any",
            salaryMin,
            industries = [],
        } = body;

        const preferences = await prisma.jobPreferences.upsert({
            where: { userId: user.id },
            create: {
                userId: user.id,
                targetTitles,
                locations,
                remotePreference,
                salaryMin: salaryMin ? parseInt(salaryMin, 10) : null,
                industries,
            },
            update: {
                targetTitles,
                locations,
                remotePreference,
                salaryMin: salaryMin ? parseInt(salaryMin, 10) : null,
                industries,
            },
        });

        return NextResponse.json({ preferences });
    } catch (error) {
        console.error("PUT /api/preferences error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
