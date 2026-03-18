import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultLocale, locales } from "@/i18n/config";
import { buildLocaleAlternates } from "@/lib/seo";

const INDEXABLE_PATHS = [
    "/",
    "/blog",
    "/blog/ai-cover-letter-writing-guide",
    "/contact",
    "/privacy",
    "/terms",
    "/roadmap",
    "/campaign/feature-led",
    "/campaign/pain-led",
    "/campaign/proof-led",
];

const INDEXABLE_METADATA_FILES = [
    "app/[locale]/layout.tsx",
    "app/[locale]/page.tsx",
    "app/[locale]/blog/page.tsx",
    "app/[locale]/blog/[slug]/page.tsx",
    "app/[locale]/contact/page.tsx",
    "app/[locale]/privacy/page.tsx",
    "app/[locale]/terms/page.tsx",
    "app/[locale]/roadmap/page.tsx",
    "app/[locale]/campaign/feature-led/page.tsx",
    "app/[locale]/campaign/pain-led/page.tsx",
    "app/[locale]/campaign/proof-led/page.tsx",
];

function toLocalizedPath(locale: string, routePath: string): string {
    return routePath === "/" ? `/${locale}` : `/${locale}${routePath}`;
}

describe("hreflang reciprocity", () => {
    it("returns full locale alternates for every indexable route", () => {
        for (const routePath of INDEXABLE_PATHS) {
            for (const locale of locales) {
                const alternates = buildLocaleAlternates(locale, routePath);
                const languages = alternates.languages;

                expect(alternates.canonical).toBe(
                    `https://autoapply.works${toLocalizedPath(locale, routePath)}`
                );
                expect(languages?.[locale]).toBe(alternates.canonical);
                expect(languages?.["x-default"]).toBe(
                    `https://autoapply.works${toLocalizedPath(defaultLocale, routePath)}`
                );

                for (const peerLocale of locales) {
                    expect(languages?.[peerLocale]).toBe(
                        `https://autoapply.works${toLocalizedPath(
                            peerLocale,
                            routePath
                        )}`
                    );
                }
            }
        }
    });

    it("keeps localized indexable metadata pages on shared canonical parity builder", () => {
        for (const relativeFile of INDEXABLE_METADATA_FILES) {
            const absoluteFile = path.join(process.cwd(), relativeFile);
            const fileContent = readFileSync(absoluteFile, "utf-8");

            expect(fileContent).toContain("buildCanonicalOgParity");
        }
    });
});
