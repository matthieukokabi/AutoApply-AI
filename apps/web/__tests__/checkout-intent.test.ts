import { describe, it, expect } from "vitest";
import {
    buildAuthIntentUrl,
    buildPostAuthRedirectUrl,
    getAuthPathsForLocale,
    getLocalizedPathForRoute,
    isCheckoutPlan,
    isUnauthorizedCheckoutError,
    resolveCheckoutIntentPlan,
} from "@/lib/checkout-intent";

describe("checkout intent helpers", () => {
    it("validates supported checkout plans", () => {
        expect(isCheckoutPlan("pro_monthly")).toBe(true);
        expect(isCheckoutPlan("credit_pack")).toBe(true);
        expect(isCheckoutPlan("free")).toBe(false);
        expect(isCheckoutPlan(null)).toBe(false);
    });

    it("prefers upgrade over legacy plan when both are present", () => {
        const query = new URLSearchParams("upgrade=unlimited&plan=pro_monthly");
        expect(resolveCheckoutIntentPlan(query)).toBe("unlimited");
    });

    it("falls back to legacy plan when upgrade is invalid", () => {
        const query = new URLSearchParams("upgrade=invalid&plan=credit_pack");
        expect(resolveCheckoutIntentPlan(query)).toBe("credit_pack");
    });

    it("returns null when no valid checkout intent exists", () => {
        const query = new URLSearchParams("upgrade=invalid");
        expect(resolveCheckoutIntentPlan(query)).toBeNull();
    });

    it("builds auth intent URLs with upgrade and from params", () => {
        const url = buildAuthIntentUrl("/fr/sign-up", "pro_monthly", "/fr");
        expect(url).toBe("/fr/sign-up?upgrade=pro_monthly&from=%2Ffr");
    });

    it("returns base auth URL when no params are provided", () => {
        const url = buildAuthIntentUrl("/sign-up", null, null);
        expect(url).toBe("/sign-up");
    });

    it("builds post-auth redirect to settings when checkout intent exists", () => {
        const url = buildPostAuthRedirectUrl(
            "/fr/settings",
            "/fr/dashboard",
            "pro_yearly",
            "/fr"
        );
        expect(url).toBe("/fr/settings?upgrade=pro_yearly&from=%2Ffr");
    });

    it("falls back to dashboard when no checkout intent exists", () => {
        const url = buildPostAuthRedirectUrl(
            "/settings",
            "/dashboard",
            null,
            "/fr"
        );
        expect(url).toBe("/dashboard");
    });

    it("resolves localized route paths from pathname", () => {
        expect(getLocalizedPathForRoute("/fr/pricing", "sign-up")).toBe("/fr/sign-up");
        expect(getLocalizedPathForRoute("/pricing", "sign-up")).toBe("/sign-up");
    });

    it("builds auth paths from supported locale param", () => {
        expect(getAuthPathsForLocale("de")).toEqual({
            signInPath: "/de/sign-in",
            signUpPath: "/de/sign-up",
            settingsPath: "/de/settings",
            dashboardPath: "/de/dashboard",
        });
        expect(getAuthPathsForLocale("pt")).toEqual({
            signInPath: "/sign-in",
            signUpPath: "/sign-up",
            settingsPath: "/settings",
            dashboardPath: "/dashboard",
        });
    });

    it("detects unauthorized checkout responses across status/message variants", () => {
        expect(isUnauthorizedCheckoutError(401, "Anything")).toBe(true);
        expect(isUnauthorizedCheckoutError(500, "Unauthorized")).toBe(true);
        expect(isUnauthorizedCheckoutError(400, "User is not authenticated")).toBe(true);
        expect(isUnauthorizedCheckoutError(500, "Checkout handler misconfigured")).toBe(false);
    });
});
