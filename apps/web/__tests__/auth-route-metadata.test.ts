import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routeLayouts = [
    {
        file: "app/[locale]/sign-in/[[...sign-in]]/layout.tsx",
        namespace: "auth.signIn",
    },
    {
        file: "app/[locale]/sign-up/[[...sign-up]]/layout.tsx",
        namespace: "auth.signUp",
    },
];

describe("localized Clerk route metadata", () => {
    it("uses localized auth copy and prevents indexing on both Clerk routes", () => {
        for (const route of routeLayouts) {
            const content = readFileSync(path.join(process.cwd(), route.file), "utf8");

            expect(content).toContain(`namespace: "${route.namespace}"`);
            expect(content).toContain('title: t("title")');
            expect(content).toContain('description: t("description")');
            expect(content).toContain("index: false");
            expect(content).toContain("follow: false");
        }
    });
});
