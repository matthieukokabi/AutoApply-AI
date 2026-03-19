import type { Metadata } from "next";
import { Link } from "@/i18n/routing";
import { Sparkles } from "lucide-react";
import { buildCanonicalOgParity } from "@/lib/seo";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({
        locale,
        namespace: "comingSoon.metadata",
    });
    const title = t("title");
    const description = t("description");
    const parity = buildCanonicalOgParity(locale, "/coming-soon");

    return {
        title,
        description,
        alternates: parity.alternates,
        openGraph: {
            ...parity.openGraph,
            title,
            description,
        },
        robots: {
            index: false,
            follow: false,
        },
    };
}

export default async function ComingSoonPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations({
        locale,
        namespace: "comingSoon",
    });

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b">
                <div className="container flex h-14 items-center">
                    <Link href="/" className="flex items-center space-x-2">
                        <Sparkles className="h-6 w-6 text-primary" />
                        <span className="font-bold text-xl">AutoApply AI</span>
                    </Link>
                </div>
            </header>

            <main className="container flex max-w-2xl flex-col items-center py-24 text-center">
                <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
                <p className="mt-4 text-muted-foreground">
                    {t("description")}
                </p>
                <Link
                    href="/"
                    className="mt-8 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
                >
                    {t("backToHome")}
                </Link>
            </main>
        </div>
    );
}
