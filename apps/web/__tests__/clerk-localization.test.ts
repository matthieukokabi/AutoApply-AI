import { describe, expect, it } from "vitest";
import { getClerkLocalization } from "@/lib/clerk-localization";

describe("Clerk widget localization", () => {
    it.each([
        ["en", "en-GB"],
        ["fr", "fr-FR"],
        ["de", "de-DE"],
        ["es", "es-ES"],
        ["it", "it-IT"],
    ])("maps %s routes to %s", (routeLocale, clerkLocale) => {
        expect(getClerkLocalization(routeLocale).locale).toBe(clerkLocale);
    });

    it("falls back safely to British English for an unknown locale", () => {
        expect(getClerkLocalization("unknown").locale).toBe("en-GB");
    });
});
