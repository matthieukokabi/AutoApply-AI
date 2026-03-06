"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="flex items-center justify-center p-8 min-h-[60vh]">
            <div className="text-center space-y-4 max-w-md">
                <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
                <h2 className="text-xl font-semibold">Dashboard Error</h2>
                <p className="text-sm text-muted-foreground">
                    Something went wrong loading this section. Your data is safe.
                </p>
                <div className="flex gap-3 justify-center">
                    <Button onClick={reset} size="sm" className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Retry
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.location.href = "/dashboard"}>
                        Back to Dashboard
                    </Button>
                </div>
            </div>
        </div>
    );
}
