import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWeeklyDigestEmail } from "@/lib/email";

/**
 * POST /api/cron/weekly-digest
 * Sends weekly job search digest emails to all active users.
 * Protected by CRON_SECRET header (called by Vercel Cron or external scheduler).
 */
export async function POST(req: Request) {
    try {
        // Verify cron secret
        const authHeader = req.headers.get("authorization");
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        // Get all users who have automation enabled or have had activity this week
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { automationEnabled: true },
                    {
                        applications: {
                            some: { createdAt: { gte: oneWeekAgo } },
                        },
                    },
                ],
            },
            include: {
                applications: {
                    where: { createdAt: { gte: oneWeekAgo } },
                    include: { job: true },
                    orderBy: { compatibilityScore: "desc" },
                },
            },
        });

        let emailsSent = 0;

        for (const user of users) {
            // Skip users with no activity
            if (user.applications.length === 0) continue;

            const tailoredCount = user.applications.filter(
                (a) => a.status === "tailored" || a.status === "applied"
            ).length;
            const appliedCount = user.applications.filter(
                (a) => a.status === "applied"
            ).length;
            const avgScore =
                user.applications.length > 0
                    ? Math.round(
                          user.applications.reduce(
                              (sum, a) => sum + a.compatibilityScore,
                              0
                          ) / user.applications.length
                      )
                    : 0;

            const topJobs = user.applications
                .slice(0, 5)
                .map((a) => ({
                    title: a.job.title,
                    company: a.job.company,
                    score: a.compatibilityScore,
                    applicationId: a.id,
                }));

            try {
                await sendWeeklyDigestEmail(user.email, user.name, {
                    newJobsCount: user.applications.length,
                    tailoredCount,
                    appliedCount,
                    avgScore,
                    topJobs,
                });
                emailsSent++;
            } catch (emailError) {
                console.error(`Weekly digest failed for ${user.email}:`, emailError);
            }
        }

        return NextResponse.json({
            message: `Weekly digest sent to ${emailsSent} users`,
            totalUsers: users.length,
            emailsSent,
        });
    } catch (error) {
        console.error("Weekly digest cron error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
