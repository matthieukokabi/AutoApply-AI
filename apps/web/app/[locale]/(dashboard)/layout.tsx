import { auth, currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
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
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const sidebarItems = [
    { href: "/dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    { href: "/profile" as const, label: "Profile & CV", icon: User },
    { href: "/jobs" as const, label: "Job Feed", icon: Briefcase },
    { href: "/settings" as const, label: "Settings", icon: Settings },
];

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { userId } = auth();
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
                    <h1 className="text-2xl font-bold">Something went wrong</h1>
                    <p className="text-muted-foreground">We couldn&apos;t load your account. Please try again.</p>
                    <a href="/dashboard" className="inline-block px-4 py-2 bg-primary text-white rounded-md">
                        Retry
                    </a>
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

    return (
        <div className="flex h-screen">
            {/* Sidebar */}
            <aside className="w-64 border-r bg-card flex flex-col">
                <div className="p-6 border-b">
                    <Link href="/" className="flex items-center space-x-2">
                        <Sparkles className="h-6 w-6 text-primary" />
                        <span className="font-bold text-lg">AutoApply AI</span>
                    </Link>
                </div>

                <nav className="flex-1 p-4 space-y-1">
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

                <div className="p-4 border-t space-y-2">
                    <div className="flex items-center gap-3 px-3 py-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                            {user?.firstName?.[0] || "U"}
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
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-auto">
                <div className="p-8">{children}</div>
            </main>
        </div>
    );
}
