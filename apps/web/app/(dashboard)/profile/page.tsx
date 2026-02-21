"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Upload, FileText, Loader2, Check, AlertCircle } from "lucide-react";

interface StructuredCV {
    contact: {
        name: string;
        email: string;
        phone: string;
        location: string;
        linkedin?: string;
        website?: string;
    };
    summary: string;
    experience: Array<{
        title: string;
        company: string;
        location?: string;
        startDate: string;
        endDate?: string;
        bullets: string[];
    }>;
    education: Array<{
        degree: string;
        institution: string;
        location?: string;
        graduationDate?: string;
    }>;
    skills: string[];
}

const emptyStructured: StructuredCV = {
    contact: { name: "", email: "", phone: "", location: "" },
    summary: "",
    experience: [],
    education: [],
    skills: [],
};

export default function ProfilePage() {
    const [rawText, setRawText] = useState("");
    const [structured, setStructured] = useState<StructuredCV>(emptyStructured);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchProfile();
    }, []);

    async function fetchProfile() {
        try {
            const res = await fetch("/api/profile");
            if (res.ok) {
                const data = await res.json();
                if (data.profile) {
                    setRawText(data.profile.rawText || "");
                    setStructured(data.profile.structuredJson || emptyStructured);
                }
            }
        } catch (err) {
            console.error("Failed to fetch profile:", err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveRawText() {
        if (!rawText.trim()) return;
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch("/api/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rawText, structuredJson: structured }),
            });
            if (res.ok) {
                setMessage({ type: "success", text: "CV text saved successfully." });
            } else {
                const data = await res.json();
                setMessage({ type: "error", text: data.error || "Failed to save." });
            }
        } catch {
            setMessage({ type: "error", text: "Network error. Please try again." });
        } finally {
            setSaving(false);
        }
    }

    async function handleSaveStructured() {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch("/api/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rawText, structuredJson: structured }),
            });
            if (res.ok) {
                setMessage({ type: "success", text: "Profile saved successfully." });
            } else {
                const data = await res.json();
                setMessage({ type: "error", text: data.error || "Failed to save." });
            }
        } catch {
            setMessage({ type: "error", text: "Network error. Please try again." });
        } finally {
            setSaving(false);
        }
    }

    async function handleFileUpload(file: File) {
        if (!file) return;

        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            setMessage({ type: "error", text: "File too large. Maximum 5MB." });
            return;
        }

        setUploading(true);
        setMessage(null);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/profile/upload", {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                setRawText(data.profile.rawText);
                if (data.profile.structuredJson) {
                    setStructured(data.profile.structuredJson);
                }
                setMessage({ type: "success", text: data.message || "CV uploaded." });
            } else {
                const data = await res.json();
                setMessage({ type: "error", text: data.error || "Upload failed." });
            }
        } catch {
            setMessage({ type: "error", text: "Upload failed. Please try again." });
        } finally {
            setUploading(false);
        }
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFileUpload(file);
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Profile & CV</h1>
                <p className="text-muted-foreground">
                    Upload your master CV and manage your structured profile. This is the
                    source of truth for all AI-generated documents.
                </p>
            </div>

            {message && (
                <div
                    className={`flex items-center gap-2 p-3 rounded-md text-sm ${
                        message.type === "success"
                            ? "bg-green-50 text-green-800 border border-green-200"
                            : "bg-red-50 text-red-800 border border-red-200"
                    }`}
                >
                    {message.type === "success" ? (
                        <Check className="h-4 w-4" />
                    ) : (
                        <AlertCircle className="h-4 w-4" />
                    )}
                    {message.text}
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
                {/* CV Upload */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5" />
                            Upload CV
                        </CardTitle>
                        <CardDescription>
                            Upload your master CV as a text file or paste as text. AI will
                            parse it into structured sections.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div
                            className="border-2 border-dashed rounded-lg p-8 text-center space-y-4 cursor-pointer hover:border-primary/50 transition-colors"
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {uploading ? (
                                <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
                            ) : (
                                <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
                            )}
                            <div>
                                <p className="font-medium">
                                    {uploading
                                        ? "Uploading..."
                                        : "Drop your CV here or click to upload"}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    PDF, DOCX, or TXT file (max 5MB)
                                </p>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.docx,.txt,.text"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileUpload(file);
                                }}
                            />
                            <Button type="button" disabled={uploading}>
                                Choose File
                            </Button>
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
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                        />
                        <Button
                            className="mt-4 w-full"
                            onClick={handleSaveRawText}
                            disabled={saving || !rawText.trim()}
                        >
                            {saving ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : null}
                            Save & Parse
                        </Button>
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
                                    value={structured.contact.name}
                                    onChange={(e) =>
                                        setStructured((s) => ({
                                            ...s,
                                            contact: { ...s.contact, name: e.target.value },
                                        }))
                                    }
                                />
                                <input
                                    className="px-3 py-2 border rounded-md text-sm"
                                    placeholder="Email"
                                    value={structured.contact.email}
                                    onChange={(e) =>
                                        setStructured((s) => ({
                                            ...s,
                                            contact: { ...s.contact, email: e.target.value },
                                        }))
                                    }
                                />
                                <input
                                    className="px-3 py-2 border rounded-md text-sm"
                                    placeholder="Phone"
                                    value={structured.contact.phone}
                                    onChange={(e) =>
                                        setStructured((s) => ({
                                            ...s,
                                            contact: { ...s.contact, phone: e.target.value },
                                        }))
                                    }
                                />
                                <input
                                    className="px-3 py-2 border rounded-md text-sm"
                                    placeholder="Location"
                                    value={structured.contact.location}
                                    onChange={(e) =>
                                        setStructured((s) => ({
                                            ...s,
                                            contact: { ...s.contact, location: e.target.value },
                                        }))
                                    }
                                />
                            </div>
                        </div>

                        {/* Summary */}
                        <div>
                            <h3 className="font-semibold mb-2">Professional Summary</h3>
                            <textarea
                                className="w-full h-24 p-3 border rounded-md text-sm resize-none"
                                placeholder="Brief professional summary..."
                                value={structured.summary}
                                onChange={(e) =>
                                    setStructured((s) => ({ ...s, summary: e.target.value }))
                                }
                            />
                        </div>

                        {/* Skills */}
                        <div>
                            <h3 className="font-semibold mb-2">Skills</h3>
                            <textarea
                                className="w-full h-20 p-3 border rounded-md text-sm resize-none"
                                placeholder="Comma-separated skills..."
                                value={structured.skills.join(", ")}
                                onChange={(e) =>
                                    setStructured((s) => ({
                                        ...s,
                                        skills: e.target.value
                                            .split(",")
                                            .map((sk) => sk.trim())
                                            .filter(Boolean),
                                    }))
                                }
                            />
                        </div>

                        <Button onClick={handleSaveStructured} disabled={saving}>
                            {saving ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : null}
                            Save Profile
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
