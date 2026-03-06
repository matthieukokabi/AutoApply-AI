"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
    size?: "sm" | "md" | "lg";
    showText?: boolean;
    className?: string;
}

const sizes = {
    sm: { icon: "w-6 h-6", text: "text-sm", letter: "text-xs" },
    md: { icon: "w-8 h-8", text: "text-base", letter: "text-sm" },
    lg: { icon: "w-12 h-12", text: "text-xl", letter: "text-lg" },
};

export function Logo({ size = "md", showText = true, className }: LogoProps) {
    const s = sizes[size];

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <div
                className={cn(
                    s.icon,
                    "rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0"
                )}
            >
                <span className={cn(s.letter, "font-extrabold text-white leading-none")}>
                    A
                </span>
            </div>
            {showText && (
                <span className={cn(s.text, "font-semibold")}>
                    AutoApply <span className="text-muted-foreground font-normal">AI</span>
                </span>
            )}
        </div>
    );
}
