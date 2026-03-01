import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { stripe, PLANS } from "@/lib/stripe";

/**
 * POST /api/checkout
 * Creates a Stripe Checkout session for subscription or credit pack purchase.
 * Body: { plan: "pro_monthly" | "pro_yearly" | "unlimited" | "credit_pack" }
 */
export async function POST(req: Request) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { plan } = await req.json();

        let priceId: string | undefined;
        let mode: "subscription" | "payment" = "subscription";

        switch (plan) {
            case "pro_monthly":
                priceId = PLANS.pro.monthlyPriceId;
                break;
            case "pro_yearly":
                priceId = PLANS.pro.yearlyPriceId;
                break;
            case "unlimited":
                priceId = PLANS.unlimited.monthlyPriceId;
                break;
            case "unlimited_yearly":
                priceId = PLANS.unlimited.yearlyPriceId;
                break;
            case "credit_pack":
                priceId = PLANS.credit_pack.priceId;
                mode = "payment";
                break;
            default:
                return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
        }

        if (!priceId || priceId === "price_placeholder") {
            return NextResponse.json(
                { error: "Stripe is not configured yet. Please set up price IDs in your environment." },
                { status: 503 }
            );
        }

        const sessionParams: any = {
            mode,
            payment_method_types: ["card"],
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=cancelled`,
            metadata: { userId: user.id },
        };

        // Reuse existing Stripe customer if available
        if (user.stripeCustomerId) {
            sessionParams.customer = user.stripeCustomerId;
        } else {
            sessionParams.customer_email = user.email;
        }

        const session = await stripe.checkout.sessions.create(sessionParams);

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error("Checkout error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to create checkout session" },
            { status: 500 }
        );
    }
}
