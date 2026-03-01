import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/**
 * GET /api/onboarding
 * Check if the user needs onboarding (no profile or preferences yet).
 * Auto-creates or links the User record on first login via getAuthUser().
 */
export async function GET(req: Request) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
