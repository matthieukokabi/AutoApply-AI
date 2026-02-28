import { Metadata } from "next";
import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, FileText, TrendingUp, Clock } from "lucide-react";
import { KanbanBoard } from "@/components/kanban-board";

export const metadata: Metadata = {
    title: "Dashboard — AutoApply AI",
    description: "Track your job applications and tailored documents",
};

async function getDashboardData(clerkId: string) {
    const user = await prisma.user.findFirst({
        where: { clerkId },
    });

    if (!user) return null;

    const [applications, totalApplications, tailoredDocs, avgResult, statusCounts] =
        await Promise.all([
            prisma.application.findMany({
                where: { userId: user.id },
                include: { job: true },
                orderBy: { createdAt: "desc" },
            }),
            prisma.application.count({ where: { userId: user.id } }),
            prisma.application.count({
                where: { userId: user.id, tailoredCvUrl: { not: null } },
            }),
            prisma.application.aggregate({
                where: { userId: user.id },
                _avg: { compatibilityScore: true },
            }),
            prisma.application.groupBy({
                by: ["status"],
                where: { userId: user.id },
                _count: { id: true },
            }),
        ]);

    const byStatus: Record<string, number> = {};
    statusCounts.forEach((s) => {
        byStatus[s.status] = s._count.id;
    });

    return {
        applications: applications.map((a) => ({
            id: a.id,
            compatibilityScore: a.compatibilityScore,
            status: a.status,
            atsKeywords: a.atsKeywords,
            recommendation: a.recommendation,
            createdAt: a.createdAt.toISOString(),
            job: {
                id: a.job.id,
                title: a.job.title,
                company: a.job.company,
                location: a.job.location,
            },
        })),
        stats: {
            totalApplications,
            tailoredDocs,
            avgScore: Math.round(avgResult._avg.compatibilityScore || 0),
            pendingReview: byStatus["tailored"] || 0,
        },
    };
}

export default async function DashboardPage() {
    const { userId } = auth();
    if (!userId) redirect("/sign-in");

    const data = await getDashboardData(userId);

    const stats = data?.stats ?? {
        totalApplications: 0,
        tailoredDocs: 0,
        avgScore: 0,
        pendingReview: 0,
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">
                    Track your applications and manage tailored documents.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Applications
                        </CardTitle>
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalApplications}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Tailored Documents
                        </CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.tailoredDocs}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Avg. Match Score
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.avgScore}%</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Pending Review
                        </CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.pendingReview}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Kanban Board */}
            <div>
                <h2 className="text-xl font-semibold mb-4">Application Pipeline</h2>
                <KanbanBoard initialApplications={data?.applications ?? []} />
            </div>
        </div>
    );
}
