import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("auth exit localization", () => {
    it("uses locale-aware navigation after Clerk sign-out", () => {
        const signOutButton = readFileSync(
            path.join(process.cwd(), "components/sign-out-button.tsx"),
            "utf8"
        );

        expect(signOutButton).toContain(
            'import { useRouter } from "@/i18n/routing"'
        );
        expect(signOutButton).not.toContain(
            'import { useRouter } from "next/navigation"'
        );
        expect(signOutButton).toContain('signOut(() => router.push("/"))');
    });

    it("returns users to their active locale after account deletion", () => {
        const settingsPage = readFileSync(
            path.join(
                process.cwd(),
                "app/[locale]/(dashboard)/settings/page.tsx"
            ),
            "utf8"
        );

        expect(settingsPage).toContain(
            'import { useLocale, useTranslations } from "next-intl"'
        );
        expect(settingsPage).toContain("const locale = useLocale()");
        expect(settingsPage).toContain(
            "window.location.href = `/${locale}`"
        );
        expect(settingsPage).not.toContain('window.location.href = "/"');
    });
});
