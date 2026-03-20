import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

function resolvePlanFromPriceId(priceId?: string): "pro" | "unlimited" {
    if (!priceId) return "pro";

    const unlimitedPrices = new Set([
        process.env.STRIPE_PRICE_UNLIMITED_MONTHLY,
        process.env.STRIPE_PRICE_UNLIMITED_YEARLY,
    ].filter(Boolean));

    return unlimitedPrices.has(priceId) ? "unlimited" : "pro";
}

function resolveCheckoutSessionUserWhere(session: Stripe.Checkout.Session) {
    const metadataUserId = session.metadata?.userId?.trim();
    if (metadataUserId) {
        return { id: metadataUserId } as const;
    }

    const fallbackEmail =
        session.customer_details?.email?.trim().toLowerCase() ||
        session.customer_email?.trim().toLowerCase();

    if (fallbackEmail) {
        return { email: fallbackEmail } as const;
    }

    return null;
}

function isMissingWebhookTableError(error: unknown) {
    if (!error || typeof error !== "object") {
        return false;
    }

    const prismaCode = (error as { code?: string }).code;
    if (prismaCode === "P2021") {
        return true;
    }

    const message = (error as { message?: string }).message;
    return (
        typeof message === "string" &&
        message.includes("stripe_webhook_events")
    );
}

/**
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events for subscription management.
 */
export async function POST(req: Request) {
    if (!process.env.STRIPE_SECRET_KEY) {
        console.error("STRIPE_SECRET_KEY is not configured");
        return NextResponse.json({ error: "Webhook handler misconfigured" }, { status: 503 });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        console.error("STRIPE_WEBHOOK_SECRET is not configured");
        return NextResponse.json({ error: "Webhook handler misconfigured" }, { status: 503 });
    }

    const body = await req.text();
    const requestHeaders = await headers();
    const signature = requestHeaders.get("Stripe-Signature")!;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            webhookSecret
        );
    } catch (err: any) {
        console.error("Stripe webhook signature verification failed:", err.message);
        return NextResponse.json(
            { error: "Invalid signature" },
            { status: 400 }
        );
    }

    try {
        // Idempotency guard: skip duplicate/replayed webhook events.
        // We insert eventId before processing; on processing failure we delete it to allow retries.
        try {
            await prisma.stripeWebhookEvent.create({
                data: {
                    eventId: event.id,
                    eventType: event.type,
                },
            });
        } catch (error: any) {
            if (error?.code === "P2002") {
                return NextResponse.json({ received: true, duplicate: true });
            }
            if (isMissingWebhookTableError(error)) {
                console.warn(
                    "[stripe-webhook] stripe_webhook_events table missing; continuing without DB idempotency guard"
                );
            } else {
                throw error;
            }
        }

        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                const userWhere = resolveCheckoutSessionUserWhere(session);
                if (!userWhere) {
                    console.warn(
                        "[stripe-webhook] checkout.session.completed missing user mapping",
                        {
                            eventId: event.id,
                            sessionId: session.id,
                        }
                    );
                    break;
                }

                if (session.mode === "subscription") {
                    // Subscription purchase
                    const subscription = await stripe.subscriptions.retrieve(
                        session.subscription as string
                    );
                    const priceId = subscription.items.data[0]?.price.id;
                    const plan = resolvePlanFromPriceId(priceId);
                    const stripeCustomerId =
                        typeof session.customer === "string"
                            ? session.customer
                            : session.customer?.id;

                    await prisma.user.update({
                        where: userWhere,
                        data: {
                            subscriptionStatus: plan,
                            stripeCustomerId,
                            creditsRemaining: plan === "unlimited" ? 9999 : 50,
                            automationEnabled: true,
                        },
                    });
                } else if (session.mode === "payment") {
                    // One-time credit pack purchase
                    await prisma.user.update({
                        where: userWhere,
                        data: {
                            creditsRemaining: { increment: 10 },
                        },
                    });
                }
                break;
            }

            case "customer.subscription.created":
            case "customer.subscription.updated": {
                const subscription = event.data.object as Stripe.Subscription;
                const customer = subscription.customer as string;
                const priceId = subscription.items.data[0]?.price.id;
                const status = subscription.status;
                const plan = resolvePlanFromPriceId(priceId);

                // Only activate if subscription is active/trialing
                if (status === "active" || status === "trialing") {
                    await prisma.user.updateMany({
                        where: { stripeCustomerId: customer },
                        data: {
                            subscriptionStatus: plan,
                            creditsRemaining: plan === "unlimited" ? 9999 : 50,
                        },
                    });
                } else if (status === "past_due" || status === "unpaid") {
                    console.warn(`Subscription ${subscription.id} status: ${status} for customer: ${customer}`);
                }
                break;
            }

            case "customer.subscription.deleted": {
                const subscription = event.data.object as Stripe.Subscription;
                const customer = subscription.customer as string;

                await prisma.user.updateMany({
                    where: { stripeCustomerId: customer },
                    data: {
                        subscriptionStatus: "free",
                        creditsRemaining: 3,
                        automationEnabled: false,
                    },
                });
                break;
            }

            case "invoice.payment_succeeded": {
                const invoice = event.data.object as Stripe.Invoice;
                const customer = invoice.customer as string;
                console.log(`Payment succeeded for customer: ${customer}, amount: ${invoice.amount_paid / 100} ${invoice.currency?.toUpperCase()}`);
                break;
            }

            case "invoice.payment_failed": {
                const invoice = event.data.object as Stripe.Invoice;
                const customer = invoice.customer as string;
                console.error(`Payment failed for customer: ${customer}, amount: ${invoice.amount_due / 100} ${invoice.currency?.toUpperCase()}`);
                break;
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        try {
            await prisma.stripeWebhookEvent.delete({
                where: { eventId: event.id },
            });
        } catch (deleteError) {
            if (!isMissingWebhookTableError(deleteError)) {
                // no-op: event row may not exist if failure happened before insert
            }
        }
        console.error("Stripe webhook error:", error);
        return NextResponse.json(
            { error: "Webhook handler failed" },
            { status: 500 }
        );
    }
}
