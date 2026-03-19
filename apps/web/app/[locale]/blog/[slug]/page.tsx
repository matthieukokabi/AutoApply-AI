import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { getPostBySlug, getAllPosts, getAllSlugs } from "@/lib/blog";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Clock, User, Sparkles } from "lucide-react";
import { LanguageSwitcher } from "@/components/language-switcher";
import ReactMarkdown from "react-markdown";
import {
    buildCanonicalOgParity,
    buildDynamicOgImageUrl,
} from "@/lib/seo";
/**
 * Pre-render all blog post slugs at build time.
 * Combined with parent layout's locale params, this generates all locale × slug pages.
 * Eliminates Function Invocations for blog traffic.
 */
export function generateStaticParams() {
    const slugs = getAllSlugs();
    return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
    const { locale, slug } = await params;
    const t = await getTranslations({ locale, namespace: "blog" });
    const post = getPostBySlug(locale, slug);
    if (!post) {
        return { title: t("postNotFoundTitle") };
    }
    const socialTitle = `${post.title} — AutoApply AI Blog`;
    const socialImage = buildDynamicOgImageUrl(post.title, post.description);
    const parity = buildCanonicalOgParity(locale, `/blog/${slug}`);

    return {
        title: socialTitle,
        description: post.description,
        authors: [{ name: post.author }],
        alternates: parity.alternates,
        openGraph: {
            ...parity.openGraph,
            title: post.title,
            description: post.description,
            type: "article",
            publishedTime: post.date,
            authors: [post.author],
            tags: post.tags,
            images: [
                {
                    url: socialImage,
                    width: 1200,
                    height: 630,
                    alt: socialTitle,
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: socialTitle,
            description: post.description,
            images: [socialImage],
        },
    };
}

export default async function BlogPostPage({
    params,
}: {
    params: Promise<{ locale: string; slug: string }>;
}) {
    const { locale, slug } = await params;
    setRequestLocale(locale);
    const t = await getTranslations("blog");
    const post = getPostBySlug(locale, slug);

    if (!post) {
        notFound();
    }

    // Get other posts for "Read more" section
    const allPosts = getAllPosts(locale).filter((p) => p.slug !== slug);
    const relatedPosts = allPosts.slice(0, 3);

    const articleJsonLd = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: post.title,
        description: post.description,
        author: { "@type": "Person", name: post.author },
        datePublished: post.date,
        publisher: {
            "@type": "Organization",
            name: "AutoApply AI",
            url: "https://autoapply.works",
        },
        mainEntityOfPage: `https://autoapply.works/${locale}/blog/${slug}`,
        keywords: post.tags.join(", "),
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
            />
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

            {/* Article */}
            <article className="container max-w-3xl py-12">
                {/* Back to Blog */}
                <Link href="/blog" className="inline-block mb-8">
                    <Button variant="ghost" size="sm" className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        {t("backToBlog")}
                    </Button>
                </Link>

                {/* Article Header */}
                <header className="mb-8">
                    <div className="flex flex-wrap gap-2 mb-4">
                        {post.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                        {post.title}
                    </h1>
                    <p className="text-lg text-muted-foreground mb-6">
                        {post.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground border-t pt-4">
                        <span className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {post.author}
                        </span>
                        <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(post.date).toLocaleDateString(locale, {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                            })}
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {post.readingTime}
                        </span>
                    </div>
                </header>

                {/* Article Content */}
                <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg">
                    <ReactMarkdown>{post.content}</ReactMarkdown>
                </div>

                {/* CTA */}
                <div className="mt-12 p-8 rounded-2xl bg-primary/5 border text-center">
                    <h3 className="text-xl font-semibold mb-2">
                        {t("ctaTitle")}
                    </h3>
                    <p className="text-muted-foreground mb-4">
                        {t("ctaDescription")}
                    </p>
                    <Link href="/sign-up">
                        <Button size="lg">{t("ctaButton")}</Button>
                    </Link>
                </div>

                {/* Related Posts */}
                {relatedPosts.length > 0 && (
                    <div className="mt-16">
                        <h2 className="text-2xl font-semibold mb-6">
                            {t("readMore")}
                        </h2>
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {relatedPosts.map((related) => (
                                <Link
                                    key={related.slug}
                                    href={`/blog/${related.slug}` as any}
                                    className="group"
                                >
                                    <div className="p-4 rounded-lg border hover:shadow-md transition-all">
                                        <h3 className="font-medium mb-1 group-hover:text-primary transition-colors">
                                            {related.title}
                                        </h3>
                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                            {related.description}
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </article>

            {/* Footer */}
            <footer className="border-t bg-white/50 dark:bg-slate-900/50 py-8">
                <div className="container text-center text-sm text-muted-foreground">
                    <p>{t("footerRights", { year: new Date().getFullYear() })}</p>
                </div>
            </footer>
        </div>
    );
}
