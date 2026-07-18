import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("auth diagnostics navigation", () => {
    const page = readFileSync(
        path.join(process.cwd(), "app/[locale]/auth-diagnostics/page.tsx"),
        "utf8"
    );

    it("routes recovery actions directly to localized Clerk pages", () => {
        expect(page).toContain("const locale = params.locale");
        expect(page).toContain('<Link href="/sign-in" locale={locale}>');
        expect(page).toContain('<Link href="/sign-up" locale={locale}>');
    });

    it("renders recovery links through Button asChild without nested controls", () => {
        expect(page).toContain('<Button asChild variant="outline">');
        expect(page).not.toMatch(/<Link[^>]*>\s*<Button/);
    });
});
