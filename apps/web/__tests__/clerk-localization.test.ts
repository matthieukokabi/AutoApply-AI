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

    it.each([
        ["en", "Create a password"],
        ["fr", "Créez un mot de passe"],
        ["de", "Erstellen Sie ein Passwort"],
        ["es", "Cree una contraseña"],
        ["it", "Crea una password"],
    ])("fills Clerk's missing sign-up password placeholder for %s", (locale, placeholder) => {
        expect(getClerkLocalization(locale).formFieldInputPlaceholder__signUpPassword).toBe(placeholder);
    });
});
