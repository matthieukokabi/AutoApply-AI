import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";

/**
 * Get the authenticated user from Clerk + Prisma.
 * Returns null if unauthenticated or user not found in DB.
 */
export async function getAuthUser() {
    const { userId: clerkId } = auth();
    if (!clerkId) return null;

    const user = await prisma.user.findFirst({
        where: { clerkId },
    });

    return user;
}
