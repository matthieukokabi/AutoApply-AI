import type { Metadata } from "next";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import {
    LayoutDashboard,
    User,
    Briefcase,
    Settings,
    Sparkles,
    ExternalLink,
    FileText,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import {
    OFFICIAL_LINKEDIN_URL,
    OFFICIAL_X_URL,
} from "@/lib/brand-identity";

export const metadata: Metadata = {
    robots: {
        index: false,
        follow: false,
    },
};

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const t = await getTranslations("dashboard");
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const user = await currentUser();

    // Auto-create or link DB user on first dashboard visit
    let dbUser;
    try {
        dbUser = await getAuthUser();
    } catch (error) {
        console.error("Failed to get/create DB user:", error);
        // Don't redirect to sign-in (causes loop) — show error instead
        return (
            <div className="min-h-screen flex items-center justify-center p-8">
                <div className="text-center space-y-4">
                    <h1 className="text-2xl font-bold">{t("error.title")}</h1>
                    <p className="text-muted-foreground">{t("error.description")}</p>
                    <Link href="/dashboard" className="inline-block px-4 py-2 bg-primary text-white rounded-md">
                        {t("error.retry")}
                    </Link>
                </div>
            </div>
        );
    }
    if (!dbUser) redirect("/sign-in");

    // Redirect to onboarding if no CV uploaded yet
    let profile;
    try {
        profile = await prisma.masterProfile.findUnique({
            where: { userId: dbUser.id },
        });
    } catch (error) {
        console.error("Failed to check profile:", error);
    }
    if (!profile || !profile.rawText) {
        redirect("/onboarding");
    }

    // Note: Link and redirect from @/i18n/routing are locale-aware

    const sidebarItems = [
        {
            href: "/dashboard" as const,
            label: t("sidebar.dashboard"),
            icon: LayoutDashboard,
        },
        {
            href: "/profile" as const,
            label: t("sidebar.profileCv"),
            icon: User,
        },
        {
            href: "/generator" as const,
            label: t("sidebar.cvStudio"),
            icon: FileText,
        },
        { href: "/jobs" as const, label: t("sidebar.jobFeed"), icon: Briefcase },
        { href: "/settings" as const, label: t("sidebar.settings"), icon: Settings },
    ];

    const dashboardSocialLinks = [
        {
            href: OFFICIAL_X_URL,
            label: t("social.x"),
        },
        {
            href: OFFICIAL_LINKEDIN_URL,
            label: t("social.linkedin"),
        },
        {
            href: "https://www.producthunt.com/posts/autoapply-ai",
            label: t("social.productHunt"),
        },
    ];

    return (
        <div className="flex h-dvh min-h-0">
            {/* Sidebar */}
            <aside className="w-64 border-r bg-card flex flex-col min-h-0 overflow-hidden">
                <div className="p-6 border-b">
                    <Link href="/" className="flex items-center space-x-2">
                        <Sparkles className="h-6 w-6 text-primary" />
                        <span className="font-bold text-lg">AutoApply AI</span>
                    </Link>
                </div>

                <nav className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1">
                    {sidebarItems.map((item) => (
                        <Link key={item.href} href={item.href}>
                            <Button
                                variant="ghost"
                                className="w-full justify-start gap-3"
                            >
                                <item.icon className="h-4 w-4" />
                                {item.label}
                            </Button>
                        </Link>
                    ))}
                </nav>

                <div className="p-4 border-t space-y-2 shrink-0 bg-card">
                    <div className="rounded-lg border p-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {t("social.followUpdates")}
                        </p>
                        <div className="space-y-1">
                            {dashboardSocialLinks.map((social) => (
                                <a
                                    key={social.href}
                                    href={social.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                                >
                                    <span>{social.label}</span>
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 px-3 py-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                            {user?.firstName?.[0] || t("userFallbackInitial")}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                                {user?.firstName} {user?.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                                {user?.emailAddresses[0]?.emailAddress}
                            </p>
                        </div>
                        <ThemeToggle />
                    </div>
                    <SignOutButton label={t("signOut")} />
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-auto">
                <div className="p-8">{children}</div>
            </main>
        </div>
    );
}
