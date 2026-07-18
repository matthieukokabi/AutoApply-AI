import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const publicEntryFiles = [
    "app/[locale]/roadmap/page.tsx",
    "app/[locale]/blog/page.tsx",
    "app/[locale]/blog/[slug]/page.tsx",
];

describe("public auth link localization", () => {
    it("binds public Clerk entry links to the active locale", () => {
        for (const relativeFile of publicEntryFiles) {
            const content = readFileSync(path.join(process.cwd(), relativeFile), "utf8");
            const authLinks = content.match(/<Link[^>]*href="\/(?:sign-in|sign-up)"[^>]*>/g) ?? [];

            expect(authLinks.length, relativeFile).toBeGreaterThan(0);
            for (const authLink of authLinks) {
                expect(authLink, relativeFile).toContain("locale={locale}");
            }
        }
    });
});
