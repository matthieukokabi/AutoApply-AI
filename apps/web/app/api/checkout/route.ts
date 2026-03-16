import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { stripe, PLANS } from "@/lib/stripe";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

const CHECKOUT_RATE_LIMIT_MAX_REQUESTS = 5;
const CHECKOUT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const checkoutRequestLog = new Map<string, number[]>();

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

        const clientIp = getClientIp(req);
        if (
            clientIp &&
            isRateLimited({
                store: checkoutRequestLog,
                key: `${clientIp}:${user.id}`,
                maxRequests: CHECKOUT_RATE_LIMIT_MAX_REQUESTS,
                windowMs: CHECKOUT_RATE_LIMIT_WINDOW_MS,
            })
        ) {
            return NextResponse.json(
                { error: "Too many checkout attempts. Please try again shortly." },
                { status: 429 }
            );
        }

        const body = await req.json();
        const plan = typeof body.plan === "string" ? body.plan : "";

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

        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (!appUrl) {
            console.error("NEXT_PUBLIC_APP_URL is required for checkout redirects");
            return NextResponse.json({ error: "Checkout handler misconfigured" }, { status: 503 });
        }

        let successUrl: URL;
        let cancelUrl: URL;
        try {
            successUrl = new URL("/dashboard", appUrl);
            successUrl.searchParams.set("checkout", "success");
            cancelUrl = new URL("/dashboard", appUrl);
            cancelUrl.searchParams.set("checkout", "cancelled");
        } catch {
            console.error("NEXT_PUBLIC_APP_URL is invalid:", appUrl);
            return NextResponse.json({ error: "Checkout handler misconfigured" }, { status: 503 });
        }

        const sessionParams: any = {
            mode,
            payment_method_types: ["card"],
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: successUrl.toString(),
            cancel_url: cancelUrl.toString(),
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
