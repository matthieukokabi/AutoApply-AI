import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import {
    getFactualGuardByApplicationId,
    summarizeApplicationStates,
} from "@/lib/factual-guard-visibility";

/**
 * GET /api/stats — return dashboard stats for the current user
 */
export async function GET(req: Request) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Count total applications
        const totalApplications = await prisma.application.count({
            where: { userId: user.id },
        });

        // Count by status
        const statusCounts = await prisma.application.groupBy({
            by: ["status"],
            where: { userId: user.id },
            _count: { id: true },
        });

        const byStatus: Record<string, number> = {};
        statusCounts.forEach((s) => {
            byStatus[s.status] = s._count.id;
        });

        const discoveredApplications = await prisma.application.findMany({
            where: {
                userId: user.id,
                status: "discovered",
            },
            select: {
                id: true,
                status: true,
                jobId: true,
                tailoredCvMarkdown: true,
                coverLetterMarkdown: true,
                job: {
                    select: {
                        externalId: true,
                    },
                },
            },
        });
        const factualGuardByApplicationId = await getFactualGuardByApplicationId({
            userId: user.id,
            applications: discoveredApplications,
        });
        const discoveredSummary = summarizeApplicationStates({
            applications: discoveredApplications,
            factualGuardByApplicationId,
        });
        const guardBlockedCount = discoveredSummary.guardBlockedCount;
        const discoveredCount = byStatus.discovered || 0;
        const plainDiscoveredCount = Math.max(discoveredCount - guardBlockedCount, 0);
        const tailoredCount = byStatus.tailored || 0;

        // Average compatibility score
        const avgResult = await prisma.application.aggregate({
            where: { userId: user.id },
            _avg: { compatibilityScore: true },
        });

        // This month's usage (documents generated)
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const monthlyUsage = await prisma.application.count({
            where: {
                userId: user.id,
                createdAt: { gte: startOfMonth },
                status: "tailored",
            },
        });

        // Pending review = tailored but not yet applied
        const pendingReview = tailoredCount;

        const response = NextResponse.json({
            totalApplications,
            tailoredDocs: tailoredCount,
            avgScore: Math.round(avgResult._avg.compatibilityScore || 0),
            pendingReview,
            monthlyUsage,
            creditsRemaining: user.creditsRemaining,
            subscriptionStatus: user.subscriptionStatus,
            byStatus,
            discoveredCount,
            plainDiscoveredCount,
            guardBlockedCount,
        });
        // Cache: browser may reuse for 30s, revalidate in background
        response.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
        return response;
    } catch (error) {
        console.error("GET /api/stats error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
