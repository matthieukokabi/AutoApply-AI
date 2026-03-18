import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCanonicalOgParity } from "@/lib/seo";

const INDEXABLE_METADATA_FILES = [
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

describe("canonical/og:url parity", () => {
    it("builds canonical and openGraph URL parity for localized routes", () => {
        const cases = [
            { locale: "en", path: "/" },
            { locale: "fr", path: "/blog" },
            { locale: "de", path: "/blog/ai-cover-letter-writing-guide" },
            { locale: "es", path: "/roadmap?utm_source=test" },
        ];

        for (const item of cases) {
            const parity = buildCanonicalOgParity(item.locale, item.path);
            const canonical = parity.alternates?.canonical;
            const ogUrl = parity.openGraph?.url;

            expect(canonical).toBeTypeOf("string");
            expect(ogUrl).toBe(canonical);
            expect(String(canonical)).not.toContain("?");
            expect(String(canonical)).not.toContain("#");
        }
    });

    it("keeps indexable metadata files on the shared parity helper", () => {
        for (const relativeFile of INDEXABLE_METADATA_FILES) {
            const absoluteFile = path.join(process.cwd(), relativeFile);
            const fileContent = readFileSync(absoluteFile, "utf-8");

            expect(fileContent).toContain("buildCanonicalOgParity");
        }
    });

    it("keeps /coming-soon metadata distinct from landing metadata", () => {
        const comingSoonFile = readFileSync(
            path.join(process.cwd(), "app/[locale]/coming-soon/page.tsx"),
            "utf-8"
        );
        const landingFile = readFileSync(
            path.join(process.cwd(), "app/[locale]/page.tsx"),
            "utf-8"
        );

        expect(comingSoonFile).toContain("Coming Soon — AutoApply AI");
        expect(landingFile).not.toContain("Coming Soon — AutoApply AI");
    });
});
