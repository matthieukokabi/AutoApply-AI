import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("contact form accessibility", () => {
    const contactForm = readFileSync(
        join(process.cwd(), "app", "[locale]", "contact", "contact-page-client.tsx"),
        "utf8",
    );

    it.each(["name", "email", "subject", "message"])(
        "associates the %s label with its form control",
        (field) => {
            expect(contactForm).toContain(`htmlFor="contact-${field}"`);
            expect(contactForm).toContain(`id="contact-${field}"`);
            expect(contactForm).toContain(`name="${field}"`);
        },
    );

    it("provides browser autofill hints for identity fields", () => {
        expect(contactForm).toContain('autoComplete="name"');
        expect(contactForm).toContain('autoComplete="email"');
    });
});
