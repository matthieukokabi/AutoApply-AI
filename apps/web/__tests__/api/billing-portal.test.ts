import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/billing-portal/route";
import { getAuthUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

const mockUser = {
    id: "user_1",
    clerkId: "clerk_test_user_123",
    email: "test@example.com",
    subscriptionStatus: "pro",
    stripeCustomerId: "cus_existing",
};

beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://autoapply.test";
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("POST /api/billing-portal", () => {
    it("creates a billing portal session for authenticated paid users", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(stripe.billingPortal.sessions.create).mockResolvedValue({
            url: "https://billing.stripe.com/session_123",
        } as any);

        const request = new Request("http://localhost/api/billing-portal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ returnPath: "/fr/settings" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.url).toBe("https://billing.stripe.com/session_123");
        expect(response.headers.get("x-request-id")).toBeTruthy();
        expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
            customer: "cus_existing",
            return_url: "https://autoapply.test/fr/settings",
        });
    });

    it("falls back to safe return path when returnPath is unsafe", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(stripe.billingPortal.sessions.create).mockResolvedValue({
            url: "https://billing.stripe.com/session_456",
        } as any);

        const request = new Request("http://localhost/api/billing-portal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ returnPath: "https://evil.example/phish" }),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
            customer: "cus_existing",
            return_url: "https://autoapply.test/settings",
        });
    });

    it("returns 409 for paid users that are not already Stripe-backed", async () => {
        vi.mocked(getAuthUser).mockResolvedValue({
            ...mockUser,
            stripeCustomerId: null,
        } as any);

        const request = new Request("http://localhost/api/billing-portal", {
            method: "POST",
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.error).toContain("not managed through Stripe Billing Portal");
        expect(data.requestId).toBeTruthy();
        expect(stripe.customers.list).not.toHaveBeenCalled();
        expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith(
            "[billing-portal] stripe_customer_missing",
            expect.objectContaining({
                userId: "user_1",
                subscriptionStatus: "pro",
                hasStripeCustomerId: false,
            })
        );
    });

    it("returns 409 for free users even if a stale Stripe customer ID exists", async () => {
        vi.mocked(getAuthUser).mockResolvedValue({
            ...mockUser,
            subscriptionStatus: "free",
        } as any);

        const request = new Request("http://localhost/api/billing-portal", {
            method: "POST",
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.error).toContain("not managed through Stripe Billing Portal");
        expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled();
    });

    it("returns a clear error when Stripe does not return a portal URL", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(stripe.billingPortal.sessions.create).mockResolvedValue({} as any);

        const request = new Request("http://localhost/api/billing-portal", {
            method: "POST",
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe("Billing portal session could not be created.");
        expect(data.requestId).toBeTruthy();
        expect(console.error).toHaveBeenCalledWith(
            "[billing-portal] session_url_missing",
            expect.objectContaining({
                userId: "user_1",
            })
        );
    });

    it("returns 401 when user is not authenticated", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(null);

        const request = new Request("http://localhost/api/billing-portal", {
            method: "POST",
        });

        const response = await POST(request);
        expect(response.status).toBe(401);
    });

    it("returns 503 when Stripe config is missing", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        delete process.env.STRIPE_SECRET_KEY;

        const request = new Request("http://localhost/api/billing-portal", {
            method: "POST",
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.error).toBe("Billing portal is temporarily unavailable");
        expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled();
    });
});
