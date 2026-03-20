import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as checkoutPOST } from "@/app/api/checkout/route";
import { POST as stripeWebhookPOST } from "@/app/api/webhooks/stripe/route";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { getAuthUser } from "@/lib/auth";

/**
 * Integration tests for the Stripe billing workflow:
 * checkout → payment → webhook → subscription update
 */

const mockFreeUser = {
    id: "user_1",
    clerkId: "clerk_test_user_123",
    email: "test@example.com",
    name: "Test User",
    subscriptionStatus: "free",
    creditsRemaining: 3,
    stripeCustomerId: null,
};

beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
    process.env.STRIPE_PRICE_UNLIMITED_MONTHLY = "price_unlimited";
    process.env.NEXT_PUBLIC_APP_URL = "https://autoapply.test";
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
});

describe("Stripe Checkout → Webhook Workflow", () => {
    it("free user → checkout pro → webhook → becomes pro with 50 credits", async () => {
        // Step 1: User initiates checkout
        vi.mocked(getAuthUser).mockResolvedValue(mockFreeUser as any);
        vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
            url: "https://checkout.stripe.com/session_pro",
        } as any);

        const checkoutRequest = new Request("http://localhost/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: "pro_monthly" }),
        });

        const checkoutResponse = await checkoutPOST(checkoutRequest);
        const checkoutData = await checkoutResponse.json();

        expect(checkoutResponse.status).toBe(200);
        expect(checkoutData.url).toContain("checkout.stripe.com");

        // Verify checkout session was created with correct params
        expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: "subscription",
                metadata: { userId: "user_1" },
            })
        );

        // Step 2: Stripe sends webhook after payment
        vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
            type: "checkout.session.completed",
            data: {
                object: {
                    mode: "subscription",
                    subscription: "sub_new_pro",
                    customer: "cus_new",
                    metadata: { userId: "user_1" },
                },
            },
        } as any);

        vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
            items: { data: [{ price: { id: "price_pro_monthly" } }] },
        } as any);

        vi.mocked(prisma.user.update).mockResolvedValue({
            ...mockFreeUser,
            subscriptionStatus: "pro",
            creditsRemaining: 50,
            stripeCustomerId: "cus_new",
        } as any);

        const webhookRequest = new Request("http://localhost/api/webhooks/stripe", {
            method: "POST",
            body: JSON.stringify({}),
        });

        const webhookResponse = await stripeWebhookPOST(webhookRequest);
        expect(webhookResponse.status).toBe(200);

        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: "user_1" },
            data: {
                subscriptionStatus: "pro",
                stripeCustomerId: "cus_new",
                creditsRemaining: 50,
                automationEnabled: true,
            },
        });
    });

    it("credit pack purchase → webhook → credits increment by 10", async () => {
        // Step 1: Checkout for credit pack
        vi.mocked(getAuthUser).mockResolvedValue(mockFreeUser as any);
        vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
            url: "https://checkout.stripe.com/session_credits",
        } as any);

        const checkoutRequest = new Request("http://localhost/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: "credit_pack" }),
        });

        const checkoutResponse = await checkoutPOST(checkoutRequest);
        expect(checkoutResponse.status).toBe(200);

        // Verify it's a one-time payment, not subscription
        expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
            expect.objectContaining({ mode: "payment" })
        );

        // Step 2: Stripe webhook for completed payment
        vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
            type: "checkout.session.completed",
            data: {
                object: {
                    mode: "payment",
                    customer: "cus_123",
                    metadata: { userId: "user_1" },
                },
            },
        } as any);

        vi.mocked(prisma.user.update).mockResolvedValue({
            ...mockFreeUser,
            creditsRemaining: 13, // 3 + 10
        } as any);

        const webhookRequest = new Request("http://localhost/api/webhooks/stripe", {
            method: "POST",
            body: JSON.stringify({}),
        });

        const webhookResponse = await stripeWebhookPOST(webhookRequest);
        expect(webhookResponse.status).toBe(200);

        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: "user_1" },
            data: { creditsRemaining: { increment: 10 } },
        });
    });

    it("subscription cancelled → webhook → downgrade to free", async () => {
        vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
            type: "customer.subscription.deleted",
            data: {
                object: { customer: "cus_pro_user" },
            },
        } as any);

        vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as any);

        const webhookRequest = new Request("http://localhost/api/webhooks/stripe", {
            method: "POST",
            body: JSON.stringify({}),
        });

        const webhookResponse = await stripeWebhookPOST(webhookRequest);
        expect(webhookResponse.status).toBe(200);

        expect(prisma.user.updateMany).toHaveBeenCalledWith({
            where: { stripeCustomerId: "cus_pro_user" },
            data: {
                subscriptionStatus: "free",
                creditsRemaining: 3,
                automationEnabled: false,
            },
        });
    });

    it("rejects checkout for invalid plan name", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockFreeUser as any);

        const request = new Request("http://localhost/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: "enterprise_mega_plan" }),
        });

        const response = await checkoutPOST(request);
        expect(response.status).toBe(400);
    });
});
