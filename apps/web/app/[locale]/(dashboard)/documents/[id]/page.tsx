import { Metadata } from "next";
import { auth } from "@clerk/nextjs";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Eye } from "lucide-react";
import ReactMarkdown from "react-markdown";

export const metadata: Metadata = {
    title: "Document Viewer — AutoApply AI",
    description: "Compare your original CV with the AI-tailored version",
};

async function getApplication(clerkId: string, applicationId: string) {
    const user = await prisma.user.findFirst({
        where: { clerkId },
    });

    if (!user) return null;

    const application = await prisma.application.findFirst({
        where: { id: applicationId, userId: user.id },
        include: { job: true },
    });

    if (!application) return null;

    // Also fetch the user's master profile for the "original CV" view
    const masterProfile = await prisma.masterProfile.findFirst({
        where: { userId: user.id },
    });

    return { application, masterProfile };
}

export default async function DocumentViewerPage({
    params,
}: {
    params: { id: string };
}) {
    const { userId } = auth();
    if (!userId) redirect("/sign-in");

    const data = await getApplication(userId, params.id);

    if (!data) {
        notFound();
    }

    const { application, masterProfile } = data;
    const job = application.job;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            Document Viewer
                        </h1>
                        <p className="text-muted-foreground">
                            {job.title} at {job.company}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {application.tailoredCvUrl && (
                        <a href={application.tailoredCvUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" className="gap-2">
                                <Download className="h-4 w-4" />
                                Download CV
                            </Button>
                        </a>
                    )}
                    {application.coverLetterUrl && (
                        <a href={application.coverLetterUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" className="gap-2">
                                <Download className="h-4 w-4" />
                                Download Letter
                            </Button>
                        </a>
                    )}
                </div>
            </div>

            {/* Match Score Summary */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center gap-6">
                        <div className="text-center">
                            <div className="text-4xl font-bold text-primary">
                                {application.compatibilityScore}%
                            </div>
                            <p className="text-sm text-muted-foreground">Match Score</p>
                        </div>
                        <div className="flex-1 space-y-2">
                            <h3 className="font-semibold">
                                {job.title} — {job.company}
                            </h3>
                            <div className="flex gap-2 flex-wrap">
                                {application.atsKeywords.map((kw) => (
                                    <Badge key={kw} variant="outline">
                                        {kw}
                                    </Badge>
                                ))}
                            </div>
                            {application.matchingStrengths.length > 0 && (
                                <div className="mt-2">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">
                                        Strengths
                                    </p>
                                    <ul className="text-sm space-y-1">
                                        {application.matchingStrengths.map((s, i) => (
                                            <li key={i} className="text-green-700">
                                                + {s}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {application.gaps.length > 0 && (
                                <div className="mt-2">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">
                                        Gaps
                                    </p>
                                    <ul className="text-sm space-y-1">
                                        {application.gaps.map((g, i) => (
                                            <li key={i} className="text-amber-700">
                                                - {g}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                        <Badge className="capitalize">{application.status}</Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Side-by-side Document View */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <div className="p-4 border-b flex items-center justify-between">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            Original CV
                        </h3>
                    </div>
                    <CardContent className="p-6">
                        <div className="prose prose-sm max-w-none">
                            {masterProfile?.rawText ? (
                                <pre className="whitespace-pre-wrap text-sm font-sans">
                                    {masterProfile.rawText}
                                </pre>
                            ) : (
                                <p className="text-muted-foreground text-center py-12">
                                    Upload your CV in the Profile section to see it here.
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <div className="p-4 border-b flex items-center justify-between">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            Tailored CV
                        </h3>
                        <Badge variant="secondary">AI Generated</Badge>
                    </div>
                    <CardContent className="p-6">
                        <div className="prose prose-sm max-w-none">
                            {application.tailoredCvMarkdown ? (
                                <ReactMarkdown>
                                    {application.tailoredCvMarkdown}
                                </ReactMarkdown>
                            ) : (
                                <p className="text-muted-foreground text-center py-12">
                                    Tailored CV is being generated...
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Cover Letter */}
            <Card>
                <div className="p-4 border-b">
                    <h3 className="font-semibold">Cover Letter</h3>
                </div>
                <CardContent className="p-6">
                    <div className="prose prose-sm max-w-none">
                        {application.coverLetterMarkdown ? (
                            <ReactMarkdown>
                                {application.coverLetterMarkdown}
                            </ReactMarkdown>
                        ) : (
                            <p className="text-muted-foreground text-center py-8">
                                Cover letter is being generated...
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Disclaimer */}
            <p className="text-xs text-muted-foreground text-center">
                AI-tailored content is based solely on your provided CV. Always
                verify all information before submitting to employers.
            </p>
        </div>
    );
}
