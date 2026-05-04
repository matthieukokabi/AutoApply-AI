import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

const BILLING_PORTAL_DEFAULT_RETURN_PATH = "/settings";
const NON_STRIPE_BILLING_PORTAL_MESSAGE =
    "This plan is not managed through Stripe Billing Portal. Contact support for billing or refund questions.";

function resolveSafeReturnPath(candidate: unknown): string {
    if (typeof candidate !== "string") {
        return BILLING_PORTAL_DEFAULT_RETURN_PATH;
    }

    const trimmed = candidate.trim();
    if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
        return BILLING_PORTAL_DEFAULT_RETURN_PATH;
    }

    try {
        const parsed = new URL(trimmed, "https://autoapply.local");
        return `${parsed.pathname}${parsed.search}`;
    } catch {
        return BILLING_PORTAL_DEFAULT_RETURN_PATH;
    }
}

function withRequestId<T extends Record<string, unknown>>(
    payload: T,
    status: number,
    requestId: string
) {
    const response = NextResponse.json({ ...payload, requestId }, { status });
    response.headers.set("x-request-id", requestId);
    response.headers.set("Cache-Control", "no-store");
    return response;
}

export async function POST(req: Request) {
    const requestId = crypto.randomUUID();

    try {
        const user = await getAuthUser(req);
        if (!user) {
            return withRequestId({ error: "Unauthorized" }, 401, requestId);
        }

        if (!process.env.STRIPE_SECRET_KEY) {
            console.error("[billing-portal] STRIPE_SECRET_KEY is required", {
                requestId,
            });
            return withRequestId(
                { error: "Billing portal is temporarily unavailable" },
                503,
                requestId
            );
        }

        if (!process.env.NEXT_PUBLIC_APP_URL) {
            console.error("[billing-portal] NEXT_PUBLIC_APP_URL is required", {
                requestId,
            });
            return withRequestId(
                { error: "Billing portal is temporarily unavailable" },
                503,
                requestId
            );
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        const body = await req
            .json()
            .catch(() => ({})) as { returnPath?: unknown };
        const returnPath = resolveSafeReturnPath(body.returnPath);
        const returnUrl = new URL(returnPath, appUrl).toString();

        const stripeCustomerId = user.stripeCustomerId;
        if (user.subscriptionStatus === "free" || !stripeCustomerId) {
            console.warn("[billing-portal] stripe_customer_missing", {
                requestId,
                userId: user.id,
                subscriptionStatus: user.subscriptionStatus,
                hasStripeCustomerId: Boolean(stripeCustomerId),
            });
            return withRequestId(
                { error: NON_STRIPE_BILLING_PORTAL_MESSAGE },
                409,
                requestId
            );
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: returnUrl,
        });

        if (!session.url) {
            console.error("[billing-portal] session_url_missing", {
                requestId,
                userId: user.id,
            });
            return withRequestId(
                { error: "Billing portal session could not be created." },
                500,
                requestId
            );
        }

        return withRequestId({ url: session.url }, 200, requestId);
    } catch (error) {
        console.error("[billing-portal] session error", {
            requestId,
            error,
        });
        return withRequestId(
            { error: "Billing portal is temporarily unavailable" },
            500,
            requestId
        );
    }
}
