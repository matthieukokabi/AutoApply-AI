import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("landing mobile navigation", () => {
    const landingPage = readFileSync(
        join(process.cwd(), "app", "[locale]", "page.tsx"),
        "utf8",
    );
    const languageSwitcher = readFileSync(
        join(process.cwd(), "components", "language-switcher.tsx"),
        "utf8",
    );
    const themeToggle = readFileSync(
        join(process.cwd(), "components", "theme-toggle.tsx"),
        "utf8",
    );
    const englishMessages = JSON.parse(
        readFileSync(join(process.cwd(), "messages", "en.json"), "utf8"),
    ) as { features: { privacyFirstDesc: string } };

    it("exposes the complete product and authentication navigation on mobile", () => {
        expect(landingPage).toContain('aria-label="Mobile navigation"');
        expect(landingPage).toContain('href="#features"');
        expect(landingPage).toContain('href="#pricing"');
        expect(landingPage).toContain('href="#how-it-works"');
        expect(landingPage).toContain('href="/blog"');
        expect(landingPage).toContain('href="/roadmap"');
        expect(landingPage).toContain("href={signInPath}");
        expect(landingPage).toContain("href={signUpPath}");
    });

    it("provides an accessible menu trigger with mobile-only visibility", () => {
        expect(landingPage).toContain("Open navigation menu");
        expect(landingPage).toContain('className="group relative sm:hidden"');
    });

    it("keeps an accessible home name when the mobile wordmark is hidden", () => {
        expect(landingPage).toContain('aria-label="AutoApply AI home"');
        expect(landingPage).toContain('<Sparkles className="h-6 w-6 text-primary" aria-hidden="true" />');
    });

    it("renders CTA links without nesting interactive buttons inside anchors", () => {
        expect(landingPage).not.toMatch(/<(?:Next)?Link[^>]*>\s*<Button/);
        expect(landingPage).toContain("<Button asChild");
    });

    it("gives compact header and social controls 44px touch targets", () => {
        expect(landingPage).toContain("flex min-h-11 min-w-11 items-center");
        expect(landingPage).toContain("flex h-11 w-11 cursor-pointer");
        expect(landingPage).toContain("flex h-11 w-11 items-center justify-center rounded-md");
        expect(languageSwitcher).toContain('className="h-11');
        expect(themeToggle).toContain('className="h-11 w-11"');
    });

    it("shows an accessible real-product dashboard immediately after the hero", () => {
        expect(landingPage).toContain('aria-labelledby="product-proof-title"');
        expect(landingPage).toContain('src="/images/dashboard-autoapply.webp"');
        expect(landingPage).toContain('alt={t("productProof.imageAlt")}');
        expect(landingPage).toContain("<figcaption");
    });

    it("supports trust claims with inspectable evidence and localized policy links", () => {
        expect(landingPage).toContain('aria-labelledby="trust-evidence-title"');
        expect(landingPage).toContain('descKey: "trustEvidence.controlDescription"');
        expect(landingPage).toContain('<Link href="/privacy" locale={locale}>');
        expect(landingPage).toContain('<Link href="/terms" locale={locale}>');
        expect(englishMessages.features.privacyFirstDesc).not.toContain("GDPR-compliant");
    });

    it("binds every cross-page landing link to the active locale", () => {
        const crossPageLinks = landingPage.match(/<Link href="\/(?:blog|roadmap|terms|privacy|contact)"[^>]*>/g) ?? [];

        expect(crossPageLinks.length).toBeGreaterThan(0);
        for (const link of crossPageLinks) {
            expect(link).toContain("locale={locale}");
        }
        expect(landingPage).toContain('<Link href="/" locale={locale}');
    });
});
