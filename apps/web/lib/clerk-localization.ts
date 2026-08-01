import { deDE, enGB, esES, frFR, itIT } from "@clerk/localizations";
import type { Locale } from "@/i18n/config";

const clerkLocalizationByLocale = {
    en: enGB,
    fr: frFR,
    de: deDE,
    es: esES,
    it: itIT,
} satisfies Record<Locale, typeof enGB>;

export function getClerkLocalization(locale: string) {
    return clerkLocalizationByLocale[locale as Locale] ?? enGB;
}
