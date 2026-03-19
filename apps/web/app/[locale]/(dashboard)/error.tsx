"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const t = useTranslations("dashboardError");
    const locale = useLocale();

    return (
        <div className="flex items-center justify-center p-8 min-h-[60vh]">
            <div className="text-center space-y-4 max-w-md">
                <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
                <h2 className="text-xl font-semibold">{t("title")}</h2>
                <p className="text-sm text-muted-foreground">
                    {t("description")}
                </p>
                <div className="flex gap-3 justify-center">
                    <Button onClick={reset} size="sm" className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        {t("retry")}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => (window.location.href = `/${locale}/dashboard`)}
                    >
                        {t("backToDashboard")}
                    </Button>
                </div>
            </div>
        </div>
    );
}
