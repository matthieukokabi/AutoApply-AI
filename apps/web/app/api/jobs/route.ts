import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

/**
 * GET /api/jobs — list discovered jobs for the current user
 * Query params:
 *   ?search=react       — search in title/company
 *   ?source=adzuna      — filter by source
 *   ?minScore=75        — minimum compatibility score (filters via applications)
 *   ?limit=50           — max results (default 50)
 */
export async function GET(req: Request) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(req.url);
        const search = url.searchParams.get("search");
        const source = url.searchParams.get("source");
        const minScore = url.searchParams.get("minScore");
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);

        // Get jobs that have applications for this user (i.e., discovered/scored for them)
        const where: any = {
            applications: {
                some: { userId: user.id },
            },
        };

        if (search) {
            where.OR = [
                { title: { contains: search, mode: "insensitive" } },
                { company: { contains: search, mode: "insensitive" } },
            ];
        }

        if (source) {
            where.source = source;
        }

        if (minScore) {
            where.applications.some.compatibilityScore = {
                gte: parseInt(minScore, 10),
            };
        }

        const jobs = await prisma.job.findMany({
            where,
            include: {
                applications: {
                    where: { userId: user.id },
                    select: {
                        id: true,
                        compatibilityScore: true,
                        atsKeywords: true,
                        status: true,
                        recommendation: true,
                    },
                },
            },
            orderBy: { fetchedAt: "desc" },
            take: limit,
        });

        // Flatten: attach the user's application data to each job
        const result = jobs.map((job) => ({
            ...job,
            application: job.applications[0] || null,
            applications: undefined,
        }));

        return NextResponse.json({ jobs: result });
    } catch (error) {
        console.error("GET /api/jobs error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
