import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(new Date(date));
}

export function absoluteUrl(path: string): string {
    return `${process.env.NEXT_PUBLIC_APP_URL}${path}`;
}

export const APPLICATION_STATUSES = [
    "discovered",
    "tailored",
    "applied",
    "interview",
    "offer",
    "rejected",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
    discovered: "Discovered",
    tailored: "Tailored",
    applied: "Applied",
    interview: "Interview",
    offer: "Offer",
    rejected: "Rejected",
};

export const STATUS_COLORS: Record<ApplicationStatus, string> = {
    discovered: "bg-blue-100 text-blue-800",
    tailored: "bg-purple-100 text-purple-800",
    applied: "bg-yellow-100 text-yellow-800",
    interview: "bg-emerald-100 text-emerald-800",
    offer: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
};
