import { auth, currentUser } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";

/**
 * Get the authenticated user from Clerk + Prisma.
 * Auto-creates user on first login.
 * Links to seeded admin account if email matches.
 */
export async function getAuthUser() {
    const { userId: clerkId } = auth();
    if (!clerkId) return null;

    // Try to find user by Clerk ID
    let user = await prisma.user.findFirst({
        where: { clerkId },
    });

    if (!user) {
        // First login — get Clerk profile info
        const clerkUser = await currentUser();
        const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? "";
        const name =
            [clerkUser?.firstName, clerkUser?.lastName]
                .filter(Boolean)
                .join(" ") || "User";

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
