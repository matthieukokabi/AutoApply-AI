import { Metadata } from "next";
import { Link } from "@/i18n/routing";
import { getAllPosts } from "@/lib/blog";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Calendar, Clock, Sparkles } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";

export async function generateMetadata({
    params: { locale },
}: {
    params: { locale: string };
}): Promise<Metadata> {
    const t = await getTranslations({ locale, namespace: "blog" });
    return {
        title: `${t("title")} — AutoApply AI`,
        description: t("description"),
        alternates: {
            languages: {
                en: "/blog",
                fr: "/fr/blog",
                de: "/de/blog",
                es: "/es/blog",
                it: "/it/blog",
            },
        },
    };
}

export default async function BlogPage({
    params: { locale },
}: {
    params: { locale: string };
}) {
    setRequestLocale(locale);
    const t = await getTranslations("blog");
    const posts = getAllPosts(locale);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
            {/* Navigation */}
            <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-50">
                <div className="container flex h-16 items-center justify-between">
                    <Link href="/" className="flex items-center space-x-2">
                        <Sparkles className="h-6 w-6 text-primary" />
                        <span className="font-bold text-xl">AutoApply AI</span>
                    </Link>
                    <div className="flex items-center gap-4">
                        <LanguageSwitcher />
                        <Link
                            href="/sign-in"
                            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {t("signIn")}
                        </Link>
                    </div>
                </div>
            </header>

            {/* Blog Header */}
            <section className="container py-16 text-center">
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
                    {t("title")}
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                    {t("description")}
                </p>
            </section>

            {/* Blog Posts Grid */}
            <section className="container pb-24">
                {posts.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-muted-foreground">{t("noPosts")}</p>
                    </div>
                ) : (
                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {posts.map((post) => (
                            <Link
                                key={post.slug}
                                href={`/blog/${post.slug}` as any}
                            >
                                <Card className="h-full hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer group">
                                    <CardContent className="p-6 flex flex-col h-full">
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {post.tags.slice(0, 3).map((tag) => (
                                                <Badge
                                                    key={tag}
                                                    variant="secondary"
                                                    className="text-xs"
                                                >
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>
                                        <h2 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                                            {post.title}
                                        </h2>
                                        <p className="text-muted-foreground text-sm flex-1 mb-4">
                                            {post.description}
                                        </p>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <div className="flex items-center gap-3">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {new Date(
                                                        post.date
                                                    ).toLocaleDateString(
                                                        locale,
                                                        {
                                                            year: "numeric",
                                                            month: "short",
                                                            day: "numeric",
                                                        }
                                                    )}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {post.readingTime}
                                                </span>
                                            </div>
                                            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            {/* Footer */}
            <footer className="border-t bg-white/50 dark:bg-slate-900/50 py-8">
                <div className="container text-center text-sm text-muted-foreground">
                    <p>&copy; {new Date().getFullYear()} AutoApply AI. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
