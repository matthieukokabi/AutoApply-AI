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
        const limitParam = url.searchParams.get("limit");
        const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 50;
        const limit = Number.isNaN(parsedLimit)
            ? 50
            : Math.min(Math.max(parsedLimit, 1), 200);

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

        if (minScore !== null) {
            const parsedMinScore = Number.parseInt(minScore, 10);
            if (Number.isNaN(parsedMinScore) || parsedMinScore < 0 || parsedMinScore > 100) {
                return NextResponse.json(
                    { error: "Invalid minScore query parameter. Expected an integer between 0 and 100." },
                    { status: 400 }
                );
            }

            where.applications.some.compatibilityScore = {
                gte: parsedMinScore,
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

        const response = NextResponse.json({ jobs: result });
        // Cache: browser may reuse for 30s, revalidate in background
        response.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
        return response;
    } catch (error) {
        console.error("GET /api/jobs error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
