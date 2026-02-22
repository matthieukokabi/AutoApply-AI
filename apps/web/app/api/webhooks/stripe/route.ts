import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

/**
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events for subscription management.
 */
export async function POST(req: Request) {
    const body = await req.text();
    const signature = headers().get("Stripe-Signature")!;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (err: any) {
        console.error("Stripe webhook signature verification failed:", err.message);
        return NextResponse.json(
            { error: "Invalid signature" },
            { status: 400 }
        );
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                const userId = session.metadata?.userId;
                if (!userId) break;

                if (session.mode === "subscription") {
                    // Subscription purchase
                    const subscription = await stripe.subscriptions.retrieve(
                        session.subscription as string
                    );
                    const priceId = subscription.items.data[0]?.price.id;

                    let plan = "pro";
                    if (priceId === process.env.STRIPE_PRICE_UNLIMITED_MONTHLY) {
                        plan = "unlimited";
                    }

                    await prisma.user.update({
                        where: { id: userId },
                        data: {
                            subscriptionStatus: plan,
                            stripeCustomerId: session.customer as string,
                            creditsRemaining: plan === "unlimited" ? 9999 : 50,
                        },
                    });
                } else if (session.mode === "payment") {
                    // One-time credit pack purchase
                    await prisma.user.update({
                        where: { id: userId },
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

                let plan = "pro";
                if (priceId === process.env.STRIPE_PRICE_UNLIMITED_MONTHLY) {
                    plan = "unlimited";
                }

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
        console.error("Stripe webhook error:", error);
        return NextResponse.json(
            { error: "Webhook handler failed" },
            { status: 500 }
        );
    }
}
