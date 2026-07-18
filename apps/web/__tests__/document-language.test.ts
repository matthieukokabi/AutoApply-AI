import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("localized document language", () => {
    it("renders the locale as the server-side html lang without dynamic request APIs", () => {
        const localeLayout = readFileSync(
            path.join(process.cwd(), "app/[locale]/layout.tsx"),
            "utf8"
        );

        expect(localeLayout).toContain("<html lang={locale}");
        expect(localeLayout).not.toContain("headers()");
        expect(localeLayout).not.toContain("cookies()");
    });

    it("keeps the locale layout as the root document owner", () => {
        expect(() =>
            readFileSync(path.join(process.cwd(), "app/layout.tsx"), "utf8")
        ).toThrow();
    });
});
