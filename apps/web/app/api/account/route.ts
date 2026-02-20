import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/account — export all user data (GDPR data export)
 */
export async function GET() {
    try {
        const { userId: clerkId } = auth();
        if (!clerkId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findFirst({
            where: { clerkId },
            include: {
                masterProfile: true,
                preferences: true,
                applications: {
                    include: { job: true },
                },
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({
            exportedAt: new Date().toISOString(),
            user: {
                email: user.email,
                name: user.name,
                subscriptionStatus: user.subscriptionStatus,
                creditsRemaining: user.creditsRemaining,
                automationEnabled: user.automationEnabled,
                createdAt: user.createdAt,
            },
            masterProfile: user.masterProfile,
            preferences: user.preferences,
            applications: user.applications,
        });
    } catch (error) {
        console.error("GET /api/account error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * DELETE /api/account — GDPR data deletion endpoint
 * Permanently deletes all user data (cascading via Prisma relations).
 */
export async function DELETE() {
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

        // Prisma cascade delete handles masterProfile, preferences, applications
        await prisma.user.delete({
            where: { id: user.id },
        });

        return NextResponse.json({
            message: "Account and all associated data deleted successfully",
        });
    } catch (error) {
        console.error("DELETE /api/account error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
