import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * TEMPORARY migration endpoint — add salaryCurrency column to job_preferences.
 * DELETE THIS FILE after running the migration once.
 *
 * GET /api/migrate?secret=run-migration-2026
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get("secret");

    // Simple protection to prevent unauthorized access
    if (secret !== "run-migration-2026") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        // Add salaryCurrency column if it doesn't exist
        await prisma.$executeRawUnsafe(`
            ALTER TABLE job_preferences
            ADD COLUMN IF NOT EXISTS "salaryCurrency" VARCHAR(10) NOT NULL DEFAULT 'USD';
        `);

        return NextResponse.json({
            success: true,
            message: "salaryCurrency column added successfully",
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Migration error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
