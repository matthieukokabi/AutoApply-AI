import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { APPLICATION_STATUSES } from "@/lib/utils";

type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

function isApplicationStatus(value: string): value is ApplicationStatus {
    return APPLICATION_STATUSES.includes(value as ApplicationStatus);
}

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
        const rawStatus = url.searchParams.get("status");
        const status = rawStatus ? rawStatus.trim() : "";
        const limitParam = url.searchParams.get("limit");
        const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 100;
        const limit = Number.isNaN(parsedLimit)
            ? 100
            : Math.min(Math.max(parsedLimit, 1), 200);

        if (status && !isApplicationStatus(status)) {
            return NextResponse.json(
                { error: `Invalid status. Must be one of: ${APPLICATION_STATUSES.join(", ")}` },
                { status: 400 }
            );
        }

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
