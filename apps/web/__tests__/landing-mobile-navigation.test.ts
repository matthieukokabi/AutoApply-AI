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
});
