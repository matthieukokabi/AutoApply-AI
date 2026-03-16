import { describe, expect, it } from "vitest";
import { buildOnboardingHealthSnapshot } from "@/lib/onboarding-health";

describe("buildOnboardingHealthSnapshot", () => {
    it("marks all checks ready when diagnostics and profile/preferences are healthy", () => {
        const snapshot = buildOnboardingHealthSnapshot({
            isSignedIn: true,
            diagnosticsPayload: {
                auth: { status: "signed_in" },
                configuration: {
                    appUrl: { valid: true, matchesRequestHost: true },
                },
            },
            profilePayload: {
                profile: { rawText: "Senior engineer with 8 years of experience" },
            },
            preferencesPayload: {
                preferences: { targetTitles: ["Frontend Engineer"] },
            },
        });

        expect(snapshot.authReady).toBe(true);
        expect(snapshot.profileReady).toBe(true);
        expect(snapshot.preferencesReady).toBe(true);
        expect(snapshot.checkoutReady).toBe(true);
        expect(snapshot.checkoutDetail).toBeNull();
    });

    it("flags checkout as not ready when app url is invalid", () => {
        const snapshot = buildOnboardingHealthSnapshot({
            isSignedIn: true,
            diagnosticsPayload: {
                auth: { status: "signed_in" },
                configuration: {
                    appUrl: { valid: false, matchesRequestHost: null },
                },
            },
            profilePayload: { profile: null },
            preferencesPayload: { preferences: null },
        });

        expect(snapshot.checkoutReady).toBe(false);
        expect(snapshot.checkoutDetail).toContain("incomplete");
    });

    it("flags checkout host mismatch distinctly", () => {
        const snapshot = buildOnboardingHealthSnapshot({
            isSignedIn: true,
            diagnosticsPayload: {
                auth: { status: "signed_in" },
                configuration: {
                    appUrl: { valid: true, matchesRequestHost: false },
                },
            },
            profilePayload: { profile: null },
            preferencesPayload: { preferences: null },
        });

        expect(snapshot.checkoutReady).toBe(false);
        expect(snapshot.checkoutDetail).toContain("does not match");
    });
});
