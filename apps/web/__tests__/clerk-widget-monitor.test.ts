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

    it("returns true when Clerk root box contains auth controls", () => {
        const root = document.createElement("div");
        root.innerHTML = '<div class="cl-rootBox"><form><input type="email" /></form></div>';

        expect(hasMountedClerkWidget(root)).toBe(true);
    });

    it("returns false when only a placeholder data-clerk-component node is present", () => {
        const root = document.createElement("div");
        root.innerHTML = '<div data-clerk-component="SignIn"></div>';

        expect(hasMountedClerkWidget(root)).toBe(false);
    });

    it("returns true when data-clerk-component contains interactive content", () => {
        const root = document.createElement("div");
        root.innerHTML = '<div data-clerk-component="SignIn"><button type="submit">Continue</button></div>';

        expect(hasMountedClerkWidget(root)).toBe(true);
    });
});
