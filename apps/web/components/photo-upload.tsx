"use client";

import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, User } from "lucide-react";

interface PhotoUploadProps {
    value?: string;
    onChange: (base64: string | undefined) => void;
}

/**
 * Photo upload component with client-side resize and JPEG compression.
 * Outputs base64 data URL, typically 20-40KB for a 200x200 headshot.
 */
export function PhotoUpload({ value, onChange }: PhotoUploadProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [processing, setProcessing] = useState(false);

    const handleFileChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            // Validate file type
            if (!file.type.startsWith("image/")) {
                alert("Please select an image file.");
                return;
            }

            // Validate file size (max 5MB input)
            if (file.size > 5 * 1024 * 1024) {
                alert("Image must be under 5MB.");
                return;
            }

            setProcessing(true);

            try {
                const base64 = await compressImage(file);
                onChange(base64);
            } catch (err) {
                console.error("Photo processing failed:", err);
                alert("Failed to process image. Please try a different file.");
            } finally {
                setProcessing(false);
                // Reset input so same file can be re-selected
                if (inputRef.current) inputRef.current.value = "";
            }
        },
        [onChange]
    );

    return (
        <div className="flex items-center gap-4">
            {/* Preview */}
            <div
                className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => inputRef.current?.click()}
            >
                {value ? (
                    <img
                        src={value}
                        alt="CV Photo"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <User className="w-8 h-8 text-muted-foreground/50" />
                )}

                {/* Overlay */}
                <div className="absolute inset-0 bg-black/0 hover:bg-black/30 flex items-center justify-center transition-colors group">
                    <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            </div>

            {/* Controls */}
            <div className="space-y-1">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => inputRef.current?.click()}
                    disabled={processing}
                >
                    {processing
                        ? "Processing..."
                        : value
                          ? "Change photo"
                          : "Upload photo"}
                </Button>
                {value && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onChange(undefined)}
                    >
                        <X className="w-3 h-3 mr-1" />
                        Remove
                    </Button>
                )}
                <p className="text-xs text-muted-foreground">
                    Recommended for Swiss CVs. Max 5MB.
                </p>
            </div>

            {/* Hidden file input */}
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
            />
        </div>
    );
}

/**
 * Compress and resize an image to 200x200 JPEG at 80% quality.
 * Returns a base64 data URL.
 */
function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement("canvas");
                    const size = 200;
                    canvas.width = size;
                    canvas.height = size;

                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        reject(new Error("Canvas context not available"));
                        return;
                    }

                    // Calculate crop dimensions (center crop to square)
                    const minDim = Math.min(img.width, img.height);
                    const sx = (img.width - minDim) / 2;
                    const sy = (img.height - minDim) / 2;

                    // Draw cropped + resized
                    ctx.drawImage(
                        img,
                        sx,
                        sy,
                        minDim,
                        minDim,
                        0,
                        0,
                        size,
                        size
                    );

                    // Export as JPEG at 80% quality
                    const base64 = canvas.toDataURL("image/jpeg", 0.8);
                    resolve(base64);
                } catch (err) {
                    reject(err);
                }
            };
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });
}
