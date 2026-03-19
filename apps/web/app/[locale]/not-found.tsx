import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function LocaleNotFoundPage() {
    const t = await getTranslations("notFoundPage");

    return (
        <div className="min-h-screen flex items-center justify-center p-8">
            <div className="text-center space-y-4 max-w-md">
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
                <h1 className="text-3xl font-bold">{t("title")}</h1>
                <p className="text-muted-foreground">{t("description")}</p>
                <div className="flex gap-3 justify-center">
                    <Link href="/">
                        <Button>{t("goHome")}</Button>
                    </Link>
                    <Link href="/dashboard">
                        <Button variant="outline">{t("goDashboard")}</Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
