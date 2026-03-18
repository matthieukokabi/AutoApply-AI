import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildTrustPageJsonLd } from "@/lib/structured-data";

const TRUST_PAGE_FILES = [
    "app/[locale]/contact/page.tsx",
    "app/[locale]/privacy/page.tsx",
    "app/[locale]/terms/page.tsx",
];

describe("trust page structured data", () => {
    it("builds Organization + ContactPoint graph for trust pages", () => {
        const structuredData = buildTrustPageJsonLd(
            "en",
            "/contact",
            "Contact Us — AutoApply AI"
        );

        const graph = structuredData["@graph"];
        const organization = graph.find(
            (item) => item["@type"] === "Organization"
        ) as Record<string, any> | undefined;

        expect(structuredData["@context"]).toBe("https://schema.org");
        expect(Array.isArray(graph)).toBe(true);
        expect(organization).toBeDefined();
        expect(organization?.name).toBe("AutoApply AI");
        expect(organization?.contactPoint?.[0]?.["@type"]).toBe("ContactPoint");
        expect(organization?.contactPoint?.[0]?.email).toBe(
            "support@autoapply.works"
        );
    });

    it("keeps trust pages on shared JSON-LD helper", () => {
        for (const relativeFile of TRUST_PAGE_FILES) {
            const absoluteFile = path.join(process.cwd(), relativeFile);
            const fileContent = readFileSync(absoluteFile, "utf-8");

            expect(fileContent).toContain("buildTrustPageJsonLd");
            expect(fileContent).toContain("application/ld+json");
        }
    });
});
