import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";
import { locales, defaultLocale } from "./config";

export const routing = defineRouting({
    locales,
    defaultLocale,
    localePrefix: "as-needed", // No prefix for default locale (en)
});

// Create navigation helpers that respect locale routing
export const { Link, redirect, usePathname, useRouter } =
    createNavigation(routing);
