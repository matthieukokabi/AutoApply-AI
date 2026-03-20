import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { canAccessRecruiterBeta } from "@/lib/recruiter-beta";

export const metadata: Metadata = {
    title: "Recruiter Labs Beta | AutoApply AI",
    description: "Private recruiter beta workspace for AutoApply AI.",
    robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: {
            index: false,
            follow: false,
            noarchive: true,
            nosnippet: true,
            noimageindex: true,
        },
    },
};

export default async function RecruiterLabsPage() {
    const { userId } = await auth();

    if (!userId) {
        redirect("/sign-in");
    }

    if (!canAccessRecruiterBeta(userId)) {
        notFound();
    }

    return (
        <main className="mx-auto max-w-3xl px-6 py-16">
            <div className="space-y-6 rounded-xl border bg-card p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Labs beta
                </p>
                <h1 className="text-3xl font-semibold tracking-tight">
                    Recruiter track foundation
                </h1>
                <p className="text-base text-muted-foreground">
                    This private route is reserved for the isolated recruiter
                    beta build-out and is intentionally hidden from search
                    indexing.
                </p>
            </div>
        </main>
    );
}
