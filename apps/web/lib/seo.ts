import type { Metadata } from "next";
import { defaultLocale, locales, type Locale } from "@/i18n/config";
import { getAppBaseUrl, toAbsoluteAppUrl } from "@/lib/site-url";

type MetadataAlternates = NonNullable<Metadata["alternates"]>;
type MetadataLanguages = NonNullable<MetadataAlternates["languages"]>;
type MetadataOpenGraph = NonNullable<Metadata["openGraph"]>;

function normalizeLocale(locale: string): Locale {
    if (locales.includes(locale as Locale)) {
        return locale as Locale;
    }

    return defaultLocale;
}

function normalizePath(path: string): string {
    if (!path || path === "/") {
        return "/";
    }

    const pathWithoutSearchOrHash = path.split("?")[0]?.split("#")[0] ?? "/";
    const trimmedPath = pathWithoutSearchOrHash.trim();

    if (!trimmedPath || trimmedPath === "/") {
        return "/";
    }

    const withLeadingSlash = trimmedPath.startsWith("/")
        ? trimmedPath
        : `/${trimmedPath}`;
    return withLeadingSlash.endsWith("/")
        ? withLeadingSlash.slice(0, -1)
        : withLeadingSlash;
}

function localePath(locale: Locale, path: string): string {
    const normalizedPath = normalizePath(path);
    if (normalizedPath === "/") {
        return `/${locale}`;
    }

    return `/${locale}${normalizedPath}`;
}

export function getLocalizedPath(locale: string, path = "/"): string {
    return localePath(normalizeLocale(locale), path);
}

export function getLocalizedAbsoluteUrl(locale: string, path = "/"): string {
    return toAbsoluteAppUrl(getLocalizedPath(locale, path));
}

export function buildDynamicOgImageUrl(
    title: string,
    subtitle?: string
): string {
    const url = new URL("/api/og", getAppBaseUrl());
    url.searchParams.set("title", title);
    if (subtitle) {
        url.searchParams.set("subtitle", subtitle);
    }
    return url.toString();
}

export function buildLocaleAlternates(
    locale: string,
    path = "/"
): MetadataAlternates {
    const currentLocale = normalizeLocale(locale);
    const languages: Record<string, string> = {};

    for (const localeCode of locales) {
        languages[localeCode] = toAbsoluteAppUrl(localePath(localeCode, path));
    }

    languages["x-default"] = toAbsoluteAppUrl(
        localePath(defaultLocale, path)
    );

    return {
        canonical: toAbsoluteAppUrl(localePath(currentLocale, path)),
        languages: languages as MetadataLanguages,
    };
}

export function buildCanonicalOgParity(
    locale: string,
    path = "/"
): Pick<Metadata, "alternates" | "openGraph"> {
    return {
        alternates: buildLocaleAlternates(locale, path),
        openGraph: {
            url: getLocalizedAbsoluteUrl(locale, path),
        } as MetadataOpenGraph,
    };
}
