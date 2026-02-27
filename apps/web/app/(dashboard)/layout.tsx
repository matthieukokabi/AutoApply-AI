import { auth, currentUser } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import Link from "next/link";
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
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/profile", label: "Profile & CV", icon: User },
    { href: "/jobs", label: "Job Feed", icon: Briefcase },
    { href: "/settings", label: "Settings", icon: Settings },
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
    const dbUser = await getAuthUser();
    if (!dbUser) redirect("/sign-in");

    // Redirect to onboarding if no CV uploaded yet
    const profile = await prisma.masterProfile.findUnique({
        where: { userId: dbUser.id },
    });
    if (!profile || !profile.rawText) {
        redirect("/onboarding");
    }

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
