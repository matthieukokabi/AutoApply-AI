import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/checkout/route";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

const mockUser = {
    id: "user_1",
    clerkId: "clerk_test_user_123",
    email: "test@example.com",
    stripeCustomerId: null,
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("POST /api/checkout", () => {
    it("creates a checkout session for pro_monthly", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
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
        expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: "subscription",
                metadata: { userId: "user_1" },
            })
        );
    });

    it("creates a payment session for credit_pack", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
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

    it("returns 400 for invalid plan", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);

        const request = new Request("http://localhost/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: "invalid_plan" }),
        });

        const response = await POST(request);
        expect(response.status).toBe(400);
    });

    it("returns 401 for unauthenticated user", async () => {
        const { auth } = await import("@clerk/nextjs");
        vi.mocked(auth).mockReturnValueOnce({ userId: null } as any);

        const request = new Request("http://localhost/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: "pro_monthly" }),
        });

        const response = await POST(request);
        expect(response.status).toBe(401);
    });
});
