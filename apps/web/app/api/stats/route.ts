import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/stats — return dashboard stats for the current user
 */
export async function GET() {
    try {
        const { userId: clerkId } = auth();
        if (!clerkId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findFirst({
            where: { clerkId },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
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

        // Count tailored documents (applications with tailored CV URL)
        const tailoredDocs = await prisma.application.count({
            where: {
                userId: user.id,
                tailoredCvUrl: { not: null },
            },
        });

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
                tailoredCvUrl: { not: null },
            },
        });

        // Pending review = tailored but not yet applied
        const pendingReview = byStatus["tailored"] || 0;

        return NextResponse.json({
            totalApplications,
            tailoredDocs,
            avgScore: Math.round(avgResult._avg.compatibilityScore || 0),
            pendingReview,
            monthlyUsage,
            creditsRemaining: user.creditsRemaining,
            subscriptionStatus: user.subscriptionStatus,
            byStatus,
        });
    } catch (error) {
        console.error("GET /api/stats error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
