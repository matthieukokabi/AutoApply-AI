import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/billing-portal/route";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

    it("maps customer by email when stripeCustomerId is missing", async () => {
        vi.mocked(getAuthUser).mockResolvedValue({
            ...mockUser,
            stripeCustomerId: null,
        } as any);
        vi.mocked(stripe.customers.list).mockResolvedValue({
            data: [{ id: "cus_from_email" }],
        } as any);
        vi.mocked(stripe.billingPortal.sessions.create).mockResolvedValue({
            url: "https://billing.stripe.com/session_789",
        } as any);

        const request = new Request("http://localhost/api/billing-portal", {
            method: "POST",
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.url).toBe("https://billing.stripe.com/session_789");
        expect(stripe.customers.list).toHaveBeenCalledWith({
            email: "test@example.com",
            limit: 1,
        });
        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: "user_1" },
            data: { stripeCustomerId: "cus_from_email" },
        });
    });

    it("returns 409 when no paid customer can be resolved", async () => {
        vi.mocked(getAuthUser).mockResolvedValue({
            ...mockUser,
            stripeCustomerId: null,
        } as any);
        vi.mocked(stripe.customers.list).mockResolvedValue({
            data: [],
        } as any);

        const request = new Request("http://localhost/api/billing-portal", {
            method: "POST",
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(409);
        expect(data.error).toContain("No active paid subscription");
        expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled();
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
