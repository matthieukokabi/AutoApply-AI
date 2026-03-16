/* @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { hasMountedClerkWidget } from "@/lib/clerk-widget-monitor";

describe("hasMountedClerkWidget", () => {
    it("returns false for null roots", () => {
        expect(hasMountedClerkWidget(null)).toBe(false);
    });

    it("returns false when no Clerk widget selectors are present", () => {
        const root = document.createElement("div");
        root.innerHTML = '<div class="not-clerk"><p>hello</p></div>';

        expect(hasMountedClerkWidget(root)).toBe(false);
    });

    it("returns true when Clerk root box is present", () => {
        const root = document.createElement("div");
        root.innerHTML = '<div class="cl-rootBox"><form></form></div>';

        expect(hasMountedClerkWidget(root)).toBe(true);
    });

    it("returns true when data-clerk-component selector is present", () => {
        const root = document.createElement("div");
        root.innerHTML = '<div data-clerk-component="SignIn"></div>';

        expect(hasMountedClerkWidget(root)).toBe(true);
    });
});
