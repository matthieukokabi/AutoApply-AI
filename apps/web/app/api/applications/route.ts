import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/**
 * GET /api/applications — list current user's applications
 * Query params:
 *   ?status=tailored   — filter by status
 *   ?limit=50          — max results (default 100)
 */
export async function GET(req: Request) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(req.url);
        const status = url.searchParams.get("status");
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 200);

        const where: any = { userId: user.id };
        if (status) {
            where.status = status;
        }

        const applications = await prisma.application.findMany({
            where,
            include: {
                job: true,
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        });

        return NextResponse.json({ applications });
    } catch (error) {
        console.error("GET /api/applications error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
