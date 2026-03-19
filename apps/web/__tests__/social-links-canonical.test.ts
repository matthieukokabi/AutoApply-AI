import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
    OFFICIAL_LINKEDIN_URL,
    OFFICIAL_X_URL,
} from "@/lib/brand-identity";

const SOCIAL_SOURCE_FILES = [
    "app/[locale]/page.tsx",
    "app/[locale]/(dashboard)/layout.tsx",
];

const LEGACY_SOCIAL_LINKS = [
    "https://x.com/autoapplyai",
    "https://twitter.com/autoapplyai",
    "https://www.linkedin.com/company/autoapply-ai/",
];

describe("canonical social links", () => {
    it("keeps official social URLs in shared brand identity constants", () => {
        expect(OFFICIAL_X_URL).toBe("https://x.com/AutoApplyWorks");
        expect(OFFICIAL_LINKEDIN_URL).toBe(
            "https://www.linkedin.com/company/autoapply-works/"
        );
    });

    it("uses canonical social constants in key UI surfaces", () => {
        for (const relativeFile of SOCIAL_SOURCE_FILES) {
            const absoluteFile = path.join(process.cwd(), relativeFile);
            const fileContent = readFileSync(absoluteFile, "utf-8");

            expect(fileContent).toContain("OFFICIAL_X_URL");
            expect(fileContent).toContain("OFFICIAL_LINKEDIN_URL");
            for (const legacyLink of LEGACY_SOCIAL_LINKS) {
                expect(fileContent).not.toContain(legacyLink);
            }
        }
    });
});
