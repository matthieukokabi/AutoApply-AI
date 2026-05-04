import { describe, expect, it } from "vitest";
import {
    canManageBillingInStripe,
    formatBillingPortalErrorMessage,
    getBillingAccessKind,
    normalizePlanStatus,
} from "@/lib/billing-access";

describe("billing access gating", () => {
    it("allows Stripe-backed monthly users to manage billing", () => {
        const user = {
            subscriptionStatus: "pro",
            billingPortalAvailable: true,
        };

        expect(normalizePlanStatus(user.subscriptionStatus)).toBe("pro");
        expect(getBillingAccessKind(user)).toBe("stripe_portal");
        expect(canManageBillingInStripe(user)).toBe(true);
    });

    it("hides misleading Manage Billing access for unlimited/admin/manual users", () => {
        const user = {
            subscriptionStatus: "unlimited",
            billingPortalAvailable: false,
        };

        expect(getBillingAccessKind(user)).toBe("manual");
        expect(canManageBillingInStripe(user)).toBe(false);
    });

    it("does not expose billing portal access to free or unknown plan users", () => {
        expect(getBillingAccessKind({
            subscriptionStatus: "free",
            billingPortalAvailable: true,
        })).toBe("free");
        expect(canManageBillingInStripe({
            subscriptionStatus: "admin",
            billingPortalAvailable: true,
        })).toBe(false);
    });

    it("formats billing portal failures with a supportable request ID", () => {
        expect(formatBillingPortalErrorMessage({
            error: "Billing portal is temporarily unavailable",
            fallback: "Unable to open billing portal right now.",
            requestId: "req_123",
        })).toBe("Billing portal is temporarily unavailable (req_123)");

        expect(formatBillingPortalErrorMessage({
            fallback: "Unable to open billing portal right now.",
        })).toBe("Unable to open billing portal right now.");
    });
});
