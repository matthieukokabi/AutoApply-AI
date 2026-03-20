import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/webhooks/stripe/route";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
    process.env.STRIPE_PRICE_UNLIMITED_MONTHLY = "price_unlimited_monthly";
    process.env.STRIPE_PRICE_UNLIMITED_YEARLY = "price_unlimited_yearly";
    vi.mocked(prisma.stripeWebhookEvent.create).mockResolvedValue({ id: "evt_row" } as any);
});

function createStripeEvent(type: string, data: any, id = "evt_test") {
    return {
        id,
        type,
        data: { object: data },
    };
}

describe("POST /api/webhooks/stripe", () => {
    it("ignores duplicate webhook events", async () => {
        vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
            createStripeEvent(
                "checkout.session.completed",
                {
                    mode: "payment",
                    customer: "cus_123",
                    metadata: { userId: "user_1" },
                },
                "evt_duplicate"
            ) as any
        );

        vi.mocked(prisma.stripeWebhookEvent.create).mockRejectedValue({
            code: "P2002",
        } as any);

        const request = new Request("http://localhost/api/webhooks/stripe", {
            method: "POST",
            body: JSON.stringify({}),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.duplicate).toBe(true);
        expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("continues processing when webhook idempotency table is unavailable", async () => {
        vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
            createStripeEvent("checkout.session.completed", {
                mode: "subscription",
                subscription: "sub_123",
                customer: "cus_123",
                metadata: { userId: "user_1" },
            }) as any
        );

        vi.mocked(prisma.stripeWebhookEvent.create).mockRejectedValue({
            code: "P2021",
            message: "The table `public.stripe_webhook_events` does not exist in the current database.",
        } as any);
        vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
            items: { data: [{ price: { id: "price_pro_monthly" } }] },
        } as any);
        vi.mocked(prisma.user.update).mockResolvedValue({} as any);

        const response = await POST(
            new Request("http://localhost/api/webhooks/stripe", {
                method: "POST",
                body: JSON.stringify({}),
            })
        );

        expect(response.status).toBe(200);
        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: "user_1" },
            data: {
                subscriptionStatus: "pro",
                stripeCustomerId: "cus_123",
                creditsRemaining: 50,
                automationEnabled: true,
            },
        });
    });

    it("returns 400 for invalid signature", async () => {
        vi.mocked(stripe.webhooks.constructEvent).mockImplementation(() => {
            throw new Error("Invalid signature");
        });

        const request = new Request("http://localhost/api/webhooks/stripe", {
            method: "POST",
            body: "{}",
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Invalid signature");
    });

    it("returns 503 when stripe secret key is not configured", async () => {
        delete process.env.STRIPE_SECRET_KEY;

        const request = new Request("http://localhost/api/webhooks/stripe", {
            method: "POST",
            body: "{}",
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.error).toBe("Webhook handler misconfigured");
        expect(stripe.webhooks.constructEvent).not.toHaveBeenCalled();
    });

    it("returns 503 when webhook secret is not configured", async () => {
        delete process.env.STRIPE_WEBHOOK_SECRET;

        const request = new Request("http://localhost/api/webhooks/stripe", {
            method: "POST",
            body: "{}",
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.error).toBe("Webhook handler misconfigured");
        expect(stripe.webhooks.constructEvent).not.toHaveBeenCalled();
    });

    describe("checkout.session.completed", () => {
        it("handles subscription purchase (pro)", async () => {
            vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
                createStripeEvent("checkout.session.completed", {
                    mode: "subscription",
                    subscription: "sub_123",
                    customer: "cus_123",
                    metadata: { userId: "user_1" },
                }) as any
            );

            vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
                items: { data: [{ price: { id: "price_pro_monthly" } }] },
            } as any);

            vi.mocked(prisma.user.update).mockResolvedValue({} as any);

            const request = new Request("http://localhost/api/webhooks/stripe", {
                method: "POST",
                body: JSON.stringify({}),
            });

            const response = await POST(request);
            expect(response.status).toBe(200);

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: "user_1" },
                data: {
                    subscriptionStatus: "pro",
                    stripeCustomerId: "cus_123",
                    creditsRemaining: 50,
                    automationEnabled: true,
                },
            });
        });

        it("handles subscription purchase (unlimited)", async () => {
            vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
                createStripeEvent("checkout.session.completed", {
                    mode: "subscription",
                    subscription: "sub_456",
                    customer: "cus_456",
                    metadata: { userId: "user_2" },
                }) as any
            );

            vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
                items: { data: [{ price: { id: "price_unlimited_monthly" } }] },
            } as any);

            vi.mocked(prisma.user.update).mockResolvedValue({} as any);

            const request = new Request("http://localhost/api/webhooks/stripe", {
                method: "POST",
                body: JSON.stringify({}),
            });

            const response = await POST(request);
            expect(response.status).toBe(200);

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: "user_2" },
                data: {
                    subscriptionStatus: "unlimited",
                    stripeCustomerId: "cus_456",
                    creditsRemaining: 9999,
                    automationEnabled: true,
                },
            });
        });

        it("handles subscription purchase (unlimited yearly)", async () => {
            vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
                createStripeEvent("checkout.session.completed", {
                    mode: "subscription",
                    subscription: "sub_999",
                    customer: "cus_999",
                    metadata: { userId: "user_9" },
                }) as any
            );

            vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
                items: { data: [{ price: { id: "price_unlimited_yearly" } }] },
            } as any);

            vi.mocked(prisma.user.update).mockResolvedValue({} as any);

            const request = new Request("http://localhost/api/webhooks/stripe", {
                method: "POST",
                body: JSON.stringify({}),
            });

            const response = await POST(request);
            expect(response.status).toBe(200);

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: "user_9" },
                data: {
                    subscriptionStatus: "unlimited",
                    stripeCustomerId: "cus_999",
                    creditsRemaining: 9999,
                    automationEnabled: true,
                },
            });
        });

        it("falls back to customer email when metadata.userId is missing", async () => {
            vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
                createStripeEvent("checkout.session.completed", {
                    mode: "subscription",
                    subscription: "sub_fallback",
                    customer: "cus_fallback",
                    customer_email: "FallbackUser@example.com",
                    metadata: {},
                }) as any
            );

            vi.mocked(stripe.subscriptions.retrieve).mockResolvedValue({
                items: { data: [{ price: { id: "price_pro_monthly" } }] },
            } as any);
            vi.mocked(prisma.user.update).mockResolvedValue({} as any);

            const request = new Request("http://localhost/api/webhooks/stripe", {
                method: "POST",
                body: JSON.stringify({}),
            });

            const response = await POST(request);
            expect(response.status).toBe(200);

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { email: "fallbackuser@example.com" },
                data: {
                    subscriptionStatus: "pro",
                    stripeCustomerId: "cus_fallback",
                    creditsRemaining: 50,
                    automationEnabled: true,
                },
            });
        });

        it("handles credit pack purchase", async () => {
            vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
                createStripeEvent("checkout.session.completed", {
                    mode: "payment",
                    customer: "cus_789",
                    metadata: { userId: "user_3" },
                }) as any
            );

            vi.mocked(prisma.user.update).mockResolvedValue({} as any);

            const request = new Request("http://localhost/api/webhooks/stripe", {
                method: "POST",
                body: JSON.stringify({}),
            });

            const response = await POST(request);
            expect(response.status).toBe(200);

            expect(prisma.user.update).toHaveBeenCalledWith({
                where: { id: "user_3" },
                data: { creditsRemaining: { increment: 10 } },
            });
        });

        it("ignores event when user mapping is missing", async () => {
            vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
                createStripeEvent("checkout.session.completed", {
                    mode: "subscription",
                    metadata: {},
                }) as any
            );

            const request = new Request("http://localhost/api/webhooks/stripe", {
                method: "POST",
                body: JSON.stringify({}),
            });

            const response = await POST(request);
            expect(response.status).toBe(200);
            expect(prisma.user.update).not.toHaveBeenCalled();
        });
    });

    describe("customer.subscription.created/updated", () => {
        it("activates pro subscription when status is active", async () => {
            vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
                createStripeEvent("customer.subscription.created", {
                    customer: "cus_123",
                    status: "active",
                    items: { data: [{ price: { id: "price_pro_monthly" } }] },
                }) as any
            );

            vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as any);

            const request = new Request("http://localhost/api/webhooks/stripe", {
                method: "POST",
                body: JSON.stringify({}),
            });

            const response = await POST(request);
            expect(response.status).toBe(200);

            expect(prisma.user.updateMany).toHaveBeenCalledWith({
                where: { stripeCustomerId: "cus_123" },
                data: {
                    subscriptionStatus: "pro",
                    creditsRemaining: 50,
                },
            });
        });

        it("handles trialing status", async () => {
            vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
                createStripeEvent("customer.subscription.updated", {
                    customer: "cus_trial",
                    status: "trialing",
                    items: { data: [{ price: { id: "price_pro_monthly" } }] },
                }) as any
            );

            vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as any);

            const request = new Request("http://localhost/api/webhooks/stripe", {
                method: "POST",
                body: JSON.stringify({}),
            });

            const response = await POST(request);
            expect(response.status).toBe(200);
            expect(prisma.user.updateMany).toHaveBeenCalled();
        });

        it("maps unlimited yearly price to unlimited plan", async () => {
            vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
                createStripeEvent("customer.subscription.updated", {
                    customer: "cus_unlimited_yearly",
                    status: "active",
                    items: { data: [{ price: { id: "price_unlimited_yearly" } }] },
                }) as any
            );

            vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as any);

            const request = new Request("http://localhost/api/webhooks/stripe", {
                method: "POST",
                body: JSON.stringify({}),
            });

            const response = await POST(request);
            expect(response.status).toBe(200);
            expect(prisma.user.updateMany).toHaveBeenCalledWith({
                where: { stripeCustomerId: "cus_unlimited_yearly" },
                data: {
                    subscriptionStatus: "unlimited",
                    creditsRemaining: 9999,
                },
            });
        });

        it("does not update DB for past_due status", async () => {
            vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
                createStripeEvent("customer.subscription.updated", {
                    id: "sub_789",
                    customer: "cus_pastdue",
                    status: "past_due",
                    items: { data: [{ price: { id: "price_pro_monthly" } }] },
                }) as any
            );

            const request = new Request("http://localhost/api/webhooks/stripe", {
                method: "POST",
                body: JSON.stringify({}),
            });

            const response = await POST(request);
            expect(response.status).toBe(200);
            expect(prisma.user.updateMany).not.toHaveBeenCalled();
        });

        it("falls back to email mapping when stripeCustomerId is not linked yet", async () => {
            vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
                createStripeEvent("customer.subscription.created", {
                    customer: "cus_email_fallback",
                    status: "active",
                    items: { data: [{ price: { id: "price_pro_monthly" } }] },
                }) as any
            );

            vi.mocked(prisma.user.updateMany)
                .mockResolvedValueOnce({ count: 0 } as any)
                .mockResolvedValueOnce({ count: 1 } as any);
            vi.mocked(stripe.customers.retrieve).mockResolvedValue({
                id: "cus_email_fallback",
                email: "fallback-sub@example.com",
            } as any);

            const request = new Request("http://localhost/api/webhooks/stripe", {
                method: "POST",
                body: JSON.stringify({}),
            });

            const response = await POST(request);
            expect(response.status).toBe(200);

            expect(prisma.user.updateMany).toHaveBeenNthCalledWith(1, {
                where: { stripeCustomerId: "cus_email_fallback" },
                data: {
                    subscriptionStatus: "pro",
                    creditsRemaining: 50,
                },
            });
            expect(prisma.user.updateMany).toHaveBeenNthCalledWith(2, {
                where: { email: "fallback-sub@example.com" },
                data: {
                    subscriptionStatus: "pro",
                    stripeCustomerId: "cus_email_fallback",
                    creditsRemaining: 50,
                    automationEnabled: true,
                },
            });
        });
    });

    describe("customer.subscription.deleted", () => {
        it("downgrades to free plan and disables automation", async () => {
            vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
                createStripeEvent("customer.subscription.deleted", {
                    customer: "cus_cancelled",
                }) as any
            );

            vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as any);

            const request = new Request("http://localhost/api/webhooks/stripe", {
                method: "POST",
                body: JSON.stringify({}),
            });

            const response = await POST(request);
            expect(response.status).toBe(200);

            expect(prisma.user.updateMany).toHaveBeenCalledWith({
                where: { stripeCustomerId: "cus_cancelled" },
                data: {
                    subscriptionStatus: "free",
                    creditsRemaining: 3,
                    automationEnabled: false,
                },
            });
        });
    });

    describe("invoice events", () => {
        it("handles invoice.payment_succeeded", async () => {
            vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
                createStripeEvent("invoice.payment_succeeded", {
                    customer: "cus_123",
                    amount_paid: 2900,
                    currency: "usd",
                }) as any
            );

            const request = new Request("http://localhost/api/webhooks/stripe", {
                method: "POST",
                body: JSON.stringify({}),
            });

            const response = await POST(request);
            expect(response.status).toBe(200);
        });

        it("handles invoice.payment_failed", async () => {
            vi.mocked(stripe.webhooks.constructEvent).mockReturnValue(
                createStripeEvent("invoice.payment_failed", {
                    customer: "cus_123",
                    amount_due: 2900,
                    currency: "usd",
                }) as any
            );

            const request = new Request("http://localhost/api/webhooks/stripe", {
                method: "POST",
                body: JSON.stringify({}),
            });

            const response = await POST(request);
            expect(response.status).toBe(200);
        });
    });
});
