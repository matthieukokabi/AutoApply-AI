import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/checkout/route";
import { stripe } from "@/lib/stripe";
import { getAuthUser } from "@/lib/auth";

const mockUser = {
    id: "user_1",
    clerkId: "clerk_test_user_123",
    email: "test@example.com",
    stripeCustomerId: null,
};

beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://autoapply.test";
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
});

describe("POST /api/checkout", () => {
    it("creates a checkout session for pro_monthly", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
            url: "https://checkout.stripe.com/test_session",
        } as any);

        const request = new Request("http://localhost/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: "pro_monthly" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.url).toBe("https://checkout.stripe.com/test_session");
        expect(response.headers.get("x-request-id")).toBeTruthy();
        expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: "subscription",
                metadata: { userId: "user_1" },
            })
        );
    });

    it("creates a payment session for credit_pack", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
            url: "https://checkout.stripe.com/credit_session",
        } as any);

        const request = new Request("http://localhost/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: "credit_pack" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
            expect.objectContaining({ mode: "payment" })
        );
    });

    it("uses a safe returnPath when provided", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
            url: "https://checkout.stripe.com/test_session",
        } as any);

        const request = new Request("http://localhost/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                plan: "pro_monthly",
                returnPath: "/fr/settings",
            }),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
            expect.objectContaining({
                success_url: "https://autoapply.test/fr/settings?checkout=success",
                cancel_url: "https://autoapply.test/fr/settings?checkout=cancelled",
            })
        );
    });

    it("falls back to dashboard when returnPath is unsafe", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
            url: "https://checkout.stripe.com/test_session",
        } as any);

        const request = new Request("http://localhost/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                plan: "pro_monthly",
                returnPath: "https://evil.example/phish",
            }),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
            expect.objectContaining({
                success_url: "https://autoapply.test/dashboard?checkout=success",
                cancel_url: "https://autoapply.test/dashboard?checkout=cancelled",
            })
        );
    });

    it("returns 400 for invalid plan", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);

        const request = new Request("http://localhost/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: "invalid_plan" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Invalid plan");
        expect(data.requestId).toBeTruthy();
        expect(response.headers.get("x-request-id")).toBe(data.requestId);
    });

    it("returns 400 when plan is not a string", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);

        const request = new Request("http://localhost/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: 123 }),
        });

        const response = await POST(request);
        expect(response.status).toBe(400);
    });

    it("returns 503 when NEXT_PUBLIC_APP_URL is missing", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        delete process.env.NEXT_PUBLIC_APP_URL;

        const request = new Request("http://localhost/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: "pro_monthly" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.error).toBe("Checkout handler misconfigured");
        expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it("returns 503 when NEXT_PUBLIC_APP_URL is invalid", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        process.env.NEXT_PUBLIC_APP_URL = "invalid-url";

        const request = new Request("http://localhost/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: "pro_monthly" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.error).toBe("Checkout handler misconfigured");
        expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it("returns 503 when STRIPE_SECRET_KEY is missing", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        delete process.env.STRIPE_SECRET_KEY;

        const request = new Request("http://localhost/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: "pro_monthly" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.error).toBe("Checkout handler misconfigured");
        expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it("returns 429 when one IP exceeds checkout attempt limits", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
            url: "https://checkout.stripe.com/test_session",
        } as any);

        const headers = {
            "Content-Type": "application/json",
            "x-forwarded-for": "198.51.100.35",
        };

        for (let i = 0; i < 5; i += 1) {
            const response = await POST(
                new Request("http://localhost/api/checkout", {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ plan: "pro_monthly" }),
                })
            );
            expect(response.status).toBe(200);
        }

        const limitedResponse = await POST(
            new Request("http://localhost/api/checkout", {
                method: "POST",
                headers,
                body: JSON.stringify({ plan: "pro_monthly" }),
            })
        );
        const data = await limitedResponse.json();

        expect(limitedResponse.status).toBe(429);
        expect(data.error).toContain("Too many checkout attempts");
        expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(5);
    });

    it("returns 401 for unauthenticated user", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(null);

        const request = new Request("http://localhost/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: "pro_monthly" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe("Unauthorized");
        expect(data.requestId).toBeTruthy();
        expect(response.headers.get("x-request-id")).toBe(data.requestId);
    });
});
