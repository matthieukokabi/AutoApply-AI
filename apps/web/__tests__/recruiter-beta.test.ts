import { afterEach, describe, expect, it } from "vitest";
import {
    canAccessRecruiterBeta,
    isRecruiterBetaEnabled,
} from "@/lib/recruiter-beta";

const originalEnabled = process.env.RECRUITER_BETA_ENABLED;
const originalAllowlist = process.env.RECRUITER_BETA_ALLOWED_USER_IDS;

afterEach(() => {
    if (typeof originalEnabled === "undefined") {
        delete process.env.RECRUITER_BETA_ENABLED;
    } else {
        process.env.RECRUITER_BETA_ENABLED = originalEnabled;
    }

    if (typeof originalAllowlist === "undefined") {
        delete process.env.RECRUITER_BETA_ALLOWED_USER_IDS;
    } else {
        process.env.RECRUITER_BETA_ALLOWED_USER_IDS = originalAllowlist;
    }
});

describe("recruiter beta access guard", () => {
    it("stays disabled by default", () => {
        delete process.env.RECRUITER_BETA_ENABLED;
        delete process.env.RECRUITER_BETA_ALLOWED_USER_IDS;

        expect(isRecruiterBetaEnabled()).toBe(false);
        expect(canAccessRecruiterBeta("clerk_user_1")).toBe(false);
    });

    it("allows authenticated users when enabled and no allowlist is set", () => {
        process.env.RECRUITER_BETA_ENABLED = "true";
        delete process.env.RECRUITER_BETA_ALLOWED_USER_IDS;

        expect(canAccessRecruiterBeta("clerk_user_1")).toBe(true);
    });

    it("restricts access to allowlisted users when allowlist is configured", () => {
        process.env.RECRUITER_BETA_ENABLED = "true";
        process.env.RECRUITER_BETA_ALLOWED_USER_IDS =
            "clerk_user_1,clerk_user_2";

        expect(canAccessRecruiterBeta("clerk_user_1")).toBe(true);
        expect(canAccessRecruiterBeta("clerk_user_3")).toBe(false);
    });

    it("denies access when userId is missing", () => {
        process.env.RECRUITER_BETA_ENABLED = "true";
        delete process.env.RECRUITER_BETA_ALLOWED_USER_IDS;

        expect(canAccessRecruiterBeta(null)).toBe(false);
        expect(canAccessRecruiterBeta(undefined)).toBe(false);
    });
});
