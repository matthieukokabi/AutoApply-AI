"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function LocaleError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="min-h-screen flex items-center justify-center p-8">
            <div className="text-center space-y-4 max-w-md">
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
                <h1 className="text-2xl font-bold">Something went wrong</h1>
                <p className="text-muted-foreground">
                    An error occurred while loading this page. Please try again.
                </p>
                <div className="flex gap-3 justify-center">
                    <Button onClick={reset}>Try Again</Button>
                    <Button variant="outline" onClick={() => window.location.href = "/"}>
                        Go Home
                    </Button>
                </div>
            </div>
        </div>
    );
}
