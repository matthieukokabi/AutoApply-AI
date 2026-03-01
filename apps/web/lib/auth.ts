import { auth, currentUser } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";
import { verifyMobileToken } from "@/lib/mobile-auth";

/**
 * Get the authenticated user from Clerk + Prisma.
 * Auto-creates user on first login.
 * Links to seeded admin account if email matches.
 *
 * Supports both Clerk web sessions and mobile JWT tokens.
 * Pass the Request object to enable mobile JWT auth.
 */
export async function getAuthUser(req?: Request) {
    let clerkId: string | null = null;
    let mobileEmail: string | null = null;

    // 1. Try Clerk session auth (web)
    try {
        const result = auth();
        if (result.userId) {
            clerkId = result.userId;
        }
    } catch {
        // Clerk auth not available
    }

    // 2. Try mobile JWT from Authorization header
    if (!clerkId && req) {
        const authHeader = req.headers.get("authorization");
        if (authHeader?.startsWith("Bearer ")) {
            const token = authHeader.substring(7);
            const mobileResult = await verifyMobileToken(token);
            if (mobileResult) {
                clerkId = mobileResult.userId;
                mobileEmail = mobileResult.email;
            }
        }
    }

    if (!clerkId) return null;

    // Try to find user by Clerk ID
    let user = await prisma.user.findFirst({
        where: { clerkId },
    });

    if (!user) {
        // First login — get profile info from Clerk or mobile token
        let email = mobileEmail || "";
        let name = "User";

        if (!mobileEmail) {
            // Web login: get Clerk profile
            const clerkUser = await currentUser();
            email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? "";
            name =
                [clerkUser?.firstName, clerkUser?.lastName]
                    .filter(Boolean)
                    .join(" ") || "User";
        }

        // Check if there's a seeded user with this email (e.g. admin@autoapply.ai)
        const existingByEmail = await prisma.user.findFirst({
            where: { email },
        });

        if (existingByEmail) {
            // Link seeded account to this Clerk ID
            user = await prisma.user.update({
                where: { id: existingByEmail.id },
                data: { clerkId, name },
            });
        } else {
            // Create new user
            user = await prisma.user.create({
                data: {
                    clerkId,
                    email,
                    name,
                    subscriptionStatus: "free",
                    creditsRemaining: 3,
                },
            });
        }
    }

    return user;
}
