"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

export default function LocaleError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const t = useTranslations("localeError");
    const locale = useLocale();

    return (
        <div className="min-h-screen flex items-center justify-center p-8">
            <div className="text-center space-y-4 max-w-md">
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
                <h1 className="text-2xl font-bold">{t("title")}</h1>
                <p className="text-muted-foreground">
                    {t("description")}
                </p>
                <div className="flex gap-3 justify-center">
                    <Button onClick={reset}>{t("retry")}</Button>
                    <Button
                        variant="outline"
                        onClick={() => (window.location.href = `/${locale}`)}
                    >
                        {t("goHome")}
                    </Button>
                </div>
            </div>
        </div>
    );
}
