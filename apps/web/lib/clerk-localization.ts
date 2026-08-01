import { deDE, enGB, esES, frFR, itIT } from "@clerk/localizations";
import type { Locale } from "@/i18n/config";

const clerkLocalizationByLocale = {
    en: { ...enGB, formFieldInputPlaceholder__signUpPassword: "Create a password" },
    fr: { ...frFR, formFieldInputPlaceholder__signUpPassword: "Créez un mot de passe" },
    de: { ...deDE, formFieldInputPlaceholder__signUpPassword: "Erstellen Sie ein Passwort" },
    es: { ...esES, formFieldInputPlaceholder__signUpPassword: "Cree una contraseña" },
    it: { ...itIT, formFieldInputPlaceholder__signUpPassword: "Crea una password" },
} satisfies Record<Locale, typeof enGB>;

export function getClerkLocalization(locale: string) {
    return clerkLocalizationByLocale[locale as Locale] ?? enGB;
}
