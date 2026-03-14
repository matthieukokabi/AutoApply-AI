import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn("animate-pulse rounded-md bg-muted", className)}
            {...props}
        />
    );
}

export function DashboardSkeleton() {
    return (
        <div className="space-y-8">
            <div>
                <Skeleton className="h-9 w-48 mb-2" />
                <Skeleton className="h-5 w-80" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="border rounded-lg p-6">
                        <Skeleton className="h-4 w-32 mb-3" />
                        <Skeleton className="h-8 w-16" />
                    </div>
                ))}
            </div>
            <div>
                <Skeleton className="h-6 w-40 mb-4" />
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="border rounded-lg p-4 min-h-[200px]">
                            <Skeleton className="h-4 w-20 mb-4" />
                            <div className="space-y-2">
                                <Skeleton className="h-16 w-full" />
                                <Skeleton className="h-16 w-full" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function JobsSkeleton() {
    return (
        <div className="space-y-6">
            <div>
                <Skeleton className="h-9 w-36 mb-2" />
                <Skeleton className="h-5 w-72" />
            </div>
            <div className="flex gap-4">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
            </div>
            <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="border rounded-lg p-6">
                        <div className="flex justify-between mb-3">
                            <div>
                                <Skeleton className="h-5 w-48 mb-2" />
                                <Skeleton className="h-4 w-32" />
                            </div>
                            <Skeleton className="h-8 w-16 rounded-full" />
                        </div>
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-4 w-3/4" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function SettingsSkeleton() {
    return (
        <div className="space-y-8 max-w-3xl">
            <div>
                <Skeleton className="h-9 w-36 mb-2" />
                <Skeleton className="h-5 w-80" />
            </div>
            {/* Preferences card */}
            <div className="border rounded-lg p-6 space-y-4">
                <Skeleton className="h-6 w-40 mb-1" />
                <Skeleton className="h-4 w-64 mb-4" />
                <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-3/4" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </div>
            {/* Automation card */}
            <div className="border rounded-lg p-6">
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-56 mb-4" />
                <div className="flex justify-between items-center">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-9 w-24" />
                </div>
            </div>
            {/* Subscription card */}
            <div className="border rounded-lg p-6">
                <Skeleton className="h-6 w-36 mb-4" />
                <div className="flex justify-between items-center mb-3">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-9 w-24" />
                </div>
                <div className="flex justify-between items-center">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-9 w-28" />
                </div>
            </div>
        </div>
    );
}

export function ProfileSkeleton() {
    return (
        <div className="space-y-8">
            <div>
                <Skeleton className="h-9 w-48 mb-2" />
                <Skeleton className="h-5 w-96" />
            </div>
            <div className="grid gap-6 md:grid-cols-2">
                <div className="border rounded-lg p-6">
                    <Skeleton className="h-6 w-32 mb-4" />
                    <Skeleton className="h-40 w-full" />
                </div>
                <div className="border rounded-lg p-6">
                    <Skeleton className="h-6 w-32 mb-4" />
                    <Skeleton className="h-40 w-full" />
                </div>
            </div>
        </div>
    );
}
