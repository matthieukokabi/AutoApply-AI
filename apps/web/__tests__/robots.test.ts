import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

describe("robots policy", () => {
    it("disallows labs recruiter beta routes from crawling", () => {
        const config = robots();
        const rootRule = Array.isArray(config.rules)
            ? config.rules.find((rule) => rule.userAgent === "*")
            : config.rules;

        const disallow = rootRule?.disallow ?? [];

        expect(disallow).toContain("/labs");
        expect(disallow).toContain("/labs/recruiter");
        expect(disallow).toContain("/labs/recruiter/");
    });
});
