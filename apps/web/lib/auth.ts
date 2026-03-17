import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { sendWelcomeEmail } from "@/lib/email";

const KNOWN_WEB_AUTH_COOKIE_PATTERN = /(?:^|;\s*)(?:__session|__client_uat|__clerk_[^=]*)=/;

function shouldShortCircuitAnonymousRequest(req?: Request) {
    if (!req) {
        return false;
    }

    const authHeader = req.headers.get("authorization");
    const hasBearerToken =
        typeof authHeader === "string" && authHeader.startsWith("Bearer ");
    if (hasBearerToken) {
        return false;
    }

    const cookieHeader = req.headers.get("cookie") ?? "";
    const hasPotentialAuthCookie = KNOWN_WEB_AUTH_COOKIE_PATTERN.test(cookieHeader);
    return !hasPotentialAuthCookie;
}

/**
 * Get the authenticated user from Clerk + Prisma.
 * Auto-creates user on first login.
 * Links to seeded admin account if email matches.
 *
 * Supports both Clerk web sessions and mobile JWT tokens.
 * Pass the Request object to enable mobile JWT auth.
 */
export async function getAuthUser(req?: Request) {
    if (shouldShortCircuitAnonymousRequest(req)) {
        return null;
    }

    let clerkId: string | null = null;
    let mobileEmail: string | null = null;

    // 1. Try Clerk session auth (web)
    try {
        const result = await auth();
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

            // Send welcome email (non-blocking)
            sendWelcomeEmail(email, name).catch((err) =>
                console.error("Welcome email failed:", err)
            );
        }
    }

    return user;
}
