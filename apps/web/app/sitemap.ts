import { MetadataRoute } from "next";
import { locales, defaultLocale } from "@/i18n/config";
import { getAllPosts } from "@/lib/blog";
import { getAppBaseUrl } from "@/lib/site-url";

const staticPages = [
    "",
    "/blog",
    "/roadmap",
    "/terms",
    "/privacy",
    "/contact",
    "/campaign/feature-led",
    "/campaign/pain-led",
    "/campaign/proof-led",
] as const;

function localizedUrl(baseUrl: string, locale: string, path: string): string {
    return `${baseUrl}/${locale}${path}`;
}

function languageAlternates(baseUrl: string, path: string): Record<string, string> {
    return {
        ...Object.fromEntries(
            locales.map((locale) => [locale, localizedUrl(baseUrl, locale, path)])
        ),
        "x-default": localizedUrl(baseUrl, defaultLocale, path),
    };
}

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = getAppBaseUrl();

    const entries: MetadataRoute.Sitemap = [];

    // Static pages for each locale
    for (const page of staticPages) {
        for (const locale of locales) {
            entries.push({
                url: localizedUrl(baseUrl, locale, page),
                lastModified: new Date(),
                changeFrequency: page === "" ? "weekly" : "monthly",
                priority: page === "" ? 1.0 : page === "/blog" ? 0.8 : page === "/roadmap" ? 0.7 : 0.5,
                alternates: {
                    languages: languageAlternates(baseUrl, page),
                },
            });
        }
    }

    // Blog posts for each locale
    for (const locale of locales) {
        const posts = getAllPosts(locale);
        for (const post of posts) {
            const postPath = `/blog/${post.slug}`;
            entries.push({
                url: localizedUrl(baseUrl, locale, postPath),
                lastModified: new Date(post.date),
                changeFrequency: "monthly",
                priority: 0.7,
                alternates: {
                    languages: languageAlternates(baseUrl, postPath),
                },
            });
        }
    }

    return entries;
}
