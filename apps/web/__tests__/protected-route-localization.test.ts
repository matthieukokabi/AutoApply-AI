import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dashboardLayout = readFileSync(
    path.join(process.cwd(), "app/[locale]/(dashboard)/layout.tsx"),
    "utf8"
);
const dashboardPage = readFileSync(
    path.join(process.cwd(), "app/[locale]/(dashboard)/dashboard/page.tsx"),
    "utf8"
);

describe("protected route localization", () => {
    it("keeps Clerk sign-in fallbacks in the requested locale", () => {
        expect(dashboardLayout).toContain("const { locale } = await params");
        expect(dashboardLayout).not.toContain('redirect("/sign-in")');
        expect(dashboardPage).not.toContain('redirect("/sign-in")');
        expect(dashboardLayout.match(/redirect\(`\/\$\{locale\}\/sign-in`\)/g)).toHaveLength(2);
        expect(dashboardPage).toContain("redirect(`/${locale}/sign-in`)");
    });

    it("keeps first-login onboarding in the requested locale", () => {
        expect(dashboardLayout).toContain("redirect(`/${locale}/onboarding`)");
        expect(dashboardLayout).not.toContain('redirect("/onboarding")');
    });
});
