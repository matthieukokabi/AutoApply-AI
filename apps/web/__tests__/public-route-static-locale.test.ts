import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("public route static locale binding", () => {
    it("binds the route locale before loading messages without request APIs", () => {
        const layout = readFileSync(
            path.join(process.cwd(), "app/[locale]/layout.tsx"),
            "utf8"
        );
        const bindIndex = layout.indexOf("setRequestLocale(locale)");
        const messagesIndex = layout.indexOf("await getMessages()");

        expect(bindIndex).toBeGreaterThan(-1);
        expect(messagesIndex).toBeGreaterThan(bindIndex);
        expect(layout).not.toContain("headers()");
        expect(layout).not.toContain("cookies()");
    });
});
