import { MetadataRoute } from "next";
import { locales, defaultLocale } from "@/i18n/config";
import { getAllPosts } from "@/lib/blog";

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://autoapply-ai.com";

    const staticPages = ["", "/blog", "/terms", "/privacy", "/contact"];

    const entries: MetadataRoute.Sitemap = [];

    // Static pages for each locale
    for (const page of staticPages) {
        for (const locale of locales) {
            const prefix = locale === defaultLocale ? "" : `/${locale}`;
            entries.push({
                url: `${baseUrl}${prefix}${page}`,
                lastModified: new Date(),
                changeFrequency: page === "" ? "weekly" : "monthly",
                priority: page === "" ? 1.0 : page === "/blog" ? 0.8 : 0.5,
            });
        }
    }

    // Blog posts for each locale
    for (const locale of locales) {
        const posts = getAllPosts(locale);
        for (const post of posts) {
            const prefix = locale === defaultLocale ? "" : `/${locale}`;
            entries.push({
                url: `${baseUrl}${prefix}/blog/${post.slug}`,
                lastModified: new Date(post.date),
                changeFrequency: "monthly",
                priority: 0.7,
            });
        }
    }

    return entries;
}
