import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Upload, FileText } from "lucide-react";

export const metadata: Metadata = {
    title: "Profile & CV — AutoApply AI",
    description: "Upload and manage your master CV profile",
};

export default function ProfilePage() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Profile & CV</h1>
                <p className="text-muted-foreground">
                    Upload your master CV and manage your structured profile. This is the
                    source of truth for all AI-generated documents.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* CV Upload */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5" />
                            Upload CV
                        </CardTitle>
                        <CardDescription>
                            Upload your master CV as PDF or paste as text. AI will parse it
                            into structured sections.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
                            <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
                            <div>
                                <p className="font-medium">Drop your CV here or click to upload</p>
                                <p className="text-sm text-muted-foreground">
                                    PDF, DOC, or plain text (max 5MB)
                                </p>
                            </div>
                            <Button>Choose File</Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Raw Text */}
                <Card>
                    <CardHeader>
                        <CardTitle>Paste CV Text</CardTitle>
                        <CardDescription>
                            Alternatively, paste your CV content directly as plain text.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <textarea
                            className="w-full h-64 p-4 border rounded-lg resize-none text-sm font-mono bg-muted/50"
                            placeholder="Paste your complete CV text here..."
                        />
                        <Button className="mt-4 w-full">Save & Parse</Button>
                    </CardContent>
                </Card>
            </div>

            {/* Structured Profile Editor */}
            <Card>
                <CardHeader>
                    <CardTitle>Structured Profile</CardTitle>
                    <CardDescription>
                        Review and edit the AI-parsed sections of your CV. This structured
                        data powers compatibility scoring and tailoring.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {/* Contact */}
                        <div>
                            <h3 className="font-semibold mb-2">Contact Information</h3>
                            <div className="grid gap-4 md:grid-cols-2">
                                <input
                                    className="px-3 py-2 border rounded-md text-sm"
                                    placeholder="Full Name"
                                />
                                <input
                                    className="px-3 py-2 border rounded-md text-sm"
                                    placeholder="Email"
                                />
                                <input
                                    className="px-3 py-2 border rounded-md text-sm"
                                    placeholder="Phone"
                                />
                                <input
                                    className="px-3 py-2 border rounded-md text-sm"
                                    placeholder="Location"
                                />
                            </div>
                        </div>

                        {/* Summary */}
                        <div>
                            <h3 className="font-semibold mb-2">Professional Summary</h3>
                            <textarea
                                className="w-full h-24 p-3 border rounded-md text-sm resize-none"
                                placeholder="Brief professional summary..."
                            />
                        </div>

                        {/* Skills */}
                        <div>
                            <h3 className="font-semibold mb-2">Skills</h3>
                            <textarea
                                className="w-full h-20 p-3 border rounded-md text-sm resize-none"
                                placeholder="Comma-separated skills..."
                            />
                        </div>

                        <Button>Save Profile</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
