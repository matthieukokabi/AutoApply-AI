import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/debug/auth — Debug endpoint to check auth + DB status
 * Public route (no auth required) to diagnose connection issues
 */
export async function GET() {
    const checks: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
    };

    // Check 1: Clerk auth
    try {
        const { userId } = auth();
        checks.clerkAuth = userId ? { status: "ok", userId } : { status: "not_signed_in" };
    } catch (error) {
        checks.clerkAuth = { status: "error", message: String(error) };
    }

    // Check 2: Clerk user details
    try {
        const user = await currentUser();
        if (user) {
            checks.clerkUser = {
                status: "ok",
                id: user.id,
                email: user.emailAddresses?.[0]?.emailAddress || "none",
                name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "none",
                provider: user.externalAccounts?.[0]?.provider || "email",
            };
        } else {
            checks.clerkUser = { status: "no_user" };
        }
    } catch (error) {
        checks.clerkUser = { status: "error", message: String(error) };
    }

    // Check 3: Database connection
    try {
        const count = await prisma.user.count();
        checks.database = { status: "ok", userCount: count };
    } catch (error) {
        checks.database = { status: "error", message: String(error) };
    }

    // Check 4: If signed in, check DB user
    const clerkId = (checks.clerkAuth as { userId?: string })?.userId;
    if (clerkId) {
        try {
            const dbUser = await prisma.user.findFirst({ where: { clerkId } });
            if (dbUser) {
                checks.dbUser = {
                    status: "found",
                    id: dbUser.id,
                    email: dbUser.email,
                    plan: dbUser.subscriptionStatus,
                };
                // Check profile
                const profile = await prisma.masterProfile.findUnique({
                    where: { userId: dbUser.id },
                });
                checks.profile = profile
                    ? { status: "found", hasText: !!profile.rawText, textLength: profile.rawText?.length || 0 }
                    : { status: "not_found" };
            } else {
                checks.dbUser = { status: "not_found_in_db" };
                checks.profile = { status: "skipped" };
            }
        } catch (error) {
            checks.dbUser = { status: "error", message: String(error) };
        }
    }

    // Check 5: Env vars present
    checks.envVars = {
        DATABASE_URL: !!process.env.DATABASE_URL,
        CLERK_SECRET_KEY: !!process.env.CLERK_SECRET_KEY,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "not_set",
        NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL || "not_set",
        NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL || "not_set",
        N8N_WEBHOOK_URL: !!process.env.N8N_WEBHOOK_URL,
    };

    return NextResponse.json(checks, { status: 200 });
}
