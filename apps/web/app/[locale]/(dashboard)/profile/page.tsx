"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Upload, FileText, Loader2, Check, AlertCircle } from "lucide-react";
import { ProfileSkeleton } from "@/components/loading-skeleton";
import { PhotoUpload } from "@/components/photo-upload";
import { trackCvUploaded } from "@/lib/analytics";

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
    photoBase64?: string;
}

const emptyStructured: StructuredCV = {
    contact: { name: "", email: "", phone: "", location: "" },
    summary: "",
    experience: [],
    education: [],
    skills: [],
};

export default function ProfilePage() {
    const t = useTranslations("dashboard.profilePage");
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
                setMessage({ type: "success", text: t("messages.cvTextSaved") });
                trackCvUploaded("profile", "text");
            } else {
                const data = await res.json();
                setMessage({ type: "error", text: data.error || t("messages.saveFailed") });
            }
        } catch {
            setMessage({ type: "error", text: t("messages.networkError") });
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
                setMessage({ type: "success", text: t("messages.profileSaved") });
            } else {
                const data = await res.json();
                setMessage({ type: "error", text: data.error || t("messages.saveFailed") });
            }
        } catch {
            setMessage({ type: "error", text: t("messages.networkError") });
        } finally {
            setSaving(false);
        }
    }

    async function handleFileUpload(file: File) {
        if (!file) return;

        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            setMessage({ type: "error", text: t("messages.fileTooLarge") });
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
                setMessage({ type: "success", text: data.message || t("messages.cvUploaded") });
                trackCvUploaded("profile", "file");
            } else {
                const data = await res.json();
                setMessage({ type: "error", text: data.error || t("messages.uploadFailed") });
            }
        } catch {
            setMessage({ type: "error", text: t("messages.uploadRetryFailed") });
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
        return <ProfileSkeleton />;
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
                <p className="text-muted-foreground">
                    {t("description")}
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
                            {t("uploadCard.title")}
                        </CardTitle>
                        <CardDescription>
                            {t("uploadCard.description")}
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
                                        ? t("uploadCard.uploading")
                                        : t("uploadCard.dropzoneTitle")}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {t("uploadCard.dropzoneSubtitle")}
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
                                {t("uploadCard.chooseFile")}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Raw Text */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t("pasteCard.title")}</CardTitle>
                        <CardDescription>
                            {t("pasteCard.description")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <textarea
                            className="w-full h-64 p-4 border rounded-lg resize-none text-sm font-mono bg-muted/50"
                            placeholder={t("pasteCard.placeholder")}
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
                            {t("pasteCard.saveAndParse")}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Structured Profile Editor */}
            <Card>
                <CardHeader>
                    <CardTitle>{t("structuredCard.title")}</CardTitle>
                    <CardDescription>
                        {t("structuredCard.description")}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {/* CV Photo */}
                        <div>
                            <h3 className="font-semibold mb-2">{t("structuredCard.cvPhoto.title")}</h3>
                            <p className="text-sm text-muted-foreground mb-3">
                                {t("structuredCard.cvPhoto.description")}
                            </p>
                            <PhotoUpload
                                value={structured.photoBase64}
                                onChange={(base64) =>
                                    setStructured((s) => ({ ...s, photoBase64: base64 }))
                                }
                            />
                        </div>

                        {/* Contact */}
                        <div>
                            <h3 className="font-semibold mb-2">{t("structuredCard.contact.title")}</h3>
                            <div className="grid gap-4 md:grid-cols-2">
                                <input
                                    className="px-3 py-2 border rounded-md text-sm"
                                    placeholder={t("structuredCard.contact.fullName")}
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
                                    placeholder={t("structuredCard.contact.email")}
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
                                    placeholder={t("structuredCard.contact.phone")}
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
                                    placeholder={t("structuredCard.contact.location")}
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
                            <h3 className="font-semibold mb-2">{t("structuredCard.summary.title")}</h3>
                            <textarea
                                className="w-full h-24 p-3 border rounded-md text-sm resize-none"
                                placeholder={t("structuredCard.summary.placeholder")}
                                value={structured.summary}
                                onChange={(e) =>
                                    setStructured((s) => ({ ...s, summary: e.target.value }))
                                }
                            />
                        </div>

                        {/* Skills */}
                        <div>
                            <h3 className="font-semibold mb-2">{t("structuredCard.skills.title")}</h3>
                            <textarea
                                className="w-full h-20 p-3 border rounded-md text-sm resize-none"
                                placeholder={t("structuredCard.skills.placeholder")}
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
                            {t("structuredCard.saveProfile")}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
