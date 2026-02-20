import { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, FileText, TrendingUp, Clock } from "lucide-react";

export const metadata: Metadata = {
    title: "Dashboard — AutoApply AI",
    description: "Track your job applications and tailored documents",
};

const KANBAN_COLUMNS = [
    { id: "discovered", label: "Discovered", color: "bg-blue-500" },
    { id: "tailored", label: "Tailored", color: "bg-purple-500" },
    { id: "applied", label: "Applied", color: "bg-yellow-500" },
    { id: "interview", label: "Interview", color: "bg-emerald-500" },
    { id: "offer", label: "Offer", color: "bg-green-500" },
    { id: "rejected", label: "Rejected", color: "bg-red-500" },
];

export default function DashboardPage() {
    // TODO: Fetch real data from API
    const stats = {
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
                <div className="grid grid-cols-6 gap-4 min-h-[400px]">
                    {KANBAN_COLUMNS.map((column) => (
                        <div
                            key={column.id}
                            className="bg-muted/50 rounded-lg p-3 space-y-3"
                        >
                            <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${column.color}`} />
                                <h3 className="text-sm font-medium">{column.label}</h3>
                                <Badge variant="secondary" className="ml-auto text-xs">
                                    0
                                </Badge>
                            </div>
                            <div className="space-y-2 min-h-[300px]">
                                {/* Application cards will be rendered here */}
                                <p className="text-xs text-muted-foreground text-center py-8">
                                    No applications yet
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
