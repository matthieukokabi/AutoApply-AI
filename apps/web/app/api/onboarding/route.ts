import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/onboarding
 * Check if the user needs onboarding (no profile or preferences yet).
 * Also creates the User record if it doesn't exist (first login via Clerk).
 */
export async function GET() {
    try {
        const { userId: clerkId } = auth();
        if (!clerkId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Upsert user — creates on first login
        let user = await prisma.user.findFirst({ where: { clerkId } });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    clerkId,
                    email: "",
                    name: "",
                    subscriptionStatus: "free",
                    creditsRemaining: 3,
                },
            });
        }

        const [profile, preferences] = await Promise.all([
            prisma.masterProfile.findUnique({ where: { userId: user.id } }),
            prisma.jobPreferences.findUnique({ where: { userId: user.id } }),
        ]);

        return NextResponse.json({
            needsOnboarding: !profile || !profile.rawText,
            needsPreferences: !preferences || preferences.targetTitles.length === 0,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                subscriptionStatus: user.subscriptionStatus,
            },
        });
    } catch (error) {
        console.error("GET /api/onboarding error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
