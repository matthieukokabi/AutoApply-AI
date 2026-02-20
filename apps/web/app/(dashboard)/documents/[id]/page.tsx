import { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, Eye } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Document Viewer — AutoApply AI",
    description: "Compare your original CV with the AI-tailored version",
};

export default function DocumentViewerPage({
    params,
}: {
    params: { id: string };
}) {
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
                            Application ID: {params.id}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2">
                        <Download className="h-4 w-4" />
                        Download CV
                    </Button>
                    <Button variant="outline" className="gap-2">
                        <Download className="h-4 w-4" />
                        Download Letter
                    </Button>
                </div>
            </div>

            {/* Match Score Summary */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center gap-6">
                        <div className="text-center">
                            <div className="text-4xl font-bold text-primary">—</div>
                            <p className="text-sm text-muted-foreground">Match Score</p>
                        </div>
                        <div className="flex-1 space-y-2">
                            <h3 className="font-semibold">Job Title — Company</h3>
                            <div className="flex gap-2 flex-wrap">
                                <Badge variant="outline">ATS Keywords</Badge>
                            </div>
                        </div>
                        <Badge>Tailored</Badge>
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
                            <p className="text-muted-foreground text-center py-12">
                                Upload your CV in the Profile section to see it here.
                            </p>
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
                            <p className="text-muted-foreground text-center py-12">
                                No tailored document generated yet.
                            </p>
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
                        <p className="text-muted-foreground text-center py-8">
                            No cover letter generated yet.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Disclaimer */}
            <p className="text-xs text-muted-foreground text-center">
                ⚠️ AI-tailored content is based solely on your provided CV. Always
                verify all information before submitting to employers.
            </p>
        </div>
    );
}
