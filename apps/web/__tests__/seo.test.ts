import { describe, expect, it } from "vitest";
import { buildLocaleAlternates } from "@/lib/seo";

describe("buildLocaleAlternates", () => {
    it("strips query params from canonical and language alternates", () => {
        const alternates = buildLocaleAlternates("en", "/blog?utm_source=test");

        expect(alternates.canonical).toBe("https://apply.zuerifix.tech/en/blog");
        expect(alternates.languages?.en).toBe("https://apply.zuerifix.tech/en/blog");
        expect(alternates.languages?.fr).toBe("https://apply.zuerifix.tech/fr/blog");
    });

    it("strips hash fragments and trailing slash variants", () => {
        const alternates = buildLocaleAlternates("fr", "/roadmap/#section");

        expect(alternates.canonical).toBe("https://apply.zuerifix.tech/fr/roadmap");
        expect(alternates.languages?.["x-default"]).toBe(
            "https://apply.zuerifix.tech/en/roadmap"
        );
    });

    it("falls back to default locale for unsupported locale codes", () => {
        const alternates = buildLocaleAlternates("pt", "/contact?foo=bar");

        expect(alternates.canonical).toBe("https://apply.zuerifix.tech/en/contact");
    });
});
