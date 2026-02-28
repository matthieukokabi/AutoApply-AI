"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { locales, localeNames, localeFlags, type Locale } from "@/i18n/config";

export function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();

    function switchLocale(newLocale: Locale) {
        router.replace(pathname, { locale: newLocale });
    }

    return (
        <select
            value={locale}
            onChange={(e) => switchLocale(e.target.value as Locale)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm cursor-pointer hover:bg-accent transition-colors"
            aria-label="Select language"
        >
            {locales.map((l) => (
                <option key={l} value={l}>
                    {localeFlags[l]} {localeNames[l]}
                </option>
            ))}
        </select>
    );
}
