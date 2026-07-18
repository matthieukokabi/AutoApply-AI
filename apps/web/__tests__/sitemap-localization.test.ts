import { describe, expect, it } from "vitest";

import sitemap from "@/app/sitemap";
import { defaultLocale, locales } from "@/i18n/config";

const baseUrl = "https://autoapply.works";
const staticPaths = [
    "",
    "/blog",
    "/roadmap",
    "/terms",
    "/privacy",
    "/contact",
    "/campaign/feature-led",
    "/campaign/pain-led",
    "/campaign/proof-led",
];

describe("localized sitemap", () => {
    it("matches canonical locale paths and exposes reciprocal language alternates", () => {
        const entries = sitemap();
        const urls = entries.map((entry) => entry.url);

        expect(new Set(urls).size).toBe(urls.length);

        for (const path of staticPaths) {
            for (const locale of locales) {
                const expectedUrl = `${baseUrl}/${locale}${path}`;
                const entry = entries.find((candidate) => candidate.url === expectedUrl);

                expect(entry, expectedUrl).toBeDefined();
                expect(entry?.alternates?.languages?.[locale]).toBe(expectedUrl);
                expect(entry?.alternates?.languages?.["x-default"]).toBe(
                    `${baseUrl}/${defaultLocale}${path}`
                );

                for (const peerLocale of locales) {
                    expect(entry?.alternates?.languages?.[peerLocale]).toBe(
                        `${baseUrl}/${peerLocale}${path}`
                    );
                }
            }
        }

        expect(urls.some((url) => url === `${baseUrl}/`)).toBe(false);
        expect(urls.some((url) => url.startsWith(`${baseUrl}/blog/`))).toBe(false);
    });
});
