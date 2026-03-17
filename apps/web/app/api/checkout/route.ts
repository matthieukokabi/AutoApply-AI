import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { stripe, PLANS } from "@/lib/stripe";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

const CHECKOUT_RATE_LIMIT_MAX_REQUESTS = 5;
const CHECKOUT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const checkoutRequestLog = new Map<string, number[]>();
const KNOWN_AUTH_COOKIE_PATTERN = /__session|__client_uat|__clerk_/;
const CHECKOUT_DEFAULT_RETURN_PATH = "/dashboard";

function resolveSafeReturnPath(candidate: unknown): string {
    if (typeof candidate !== "string") {
        return CHECKOUT_DEFAULT_RETURN_PATH;
    }

    const trimmed = candidate.trim();
    if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
        return CHECKOUT_DEFAULT_RETURN_PATH;
    }

    try {
        const parsed = new URL(trimmed, "https://autoapply.local");
        return `${parsed.pathname}${parsed.search}`;
    } catch {
        return CHECKOUT_DEFAULT_RETURN_PATH;
    }
}

function withRequestId<T extends Record<string, unknown>>(
    payload: T,
    status: number,
    requestId: string
) {
    const response = NextResponse.json(
        { ...payload, requestId },
        { status }
    );
    response.headers.set("x-request-id", requestId);
    response.headers.set("Cache-Control", "no-store");
    return response;
}

/**
 * POST /api/checkout
 * Creates a Stripe Checkout session for subscription or credit pack purchase.
 * Body: { plan: "pro_monthly" | "pro_yearly" | "unlimited" | "credit_pack" }
 */
export async function POST(req: Request) {
    const requestId = crypto.randomUUID();
    const url = new URL(req.url);
    const clientIp = getClientIp(req);
    const cookieHeader = req.headers.get("cookie") ?? "";
    const hasSessionCookie = /(?:^|;\s*)__session=/.test(cookieHeader);
    const hasKnownAuthCookie = KNOWN_AUTH_COOKIE_PATTERN.test(cookieHeader);
    const requestHost =
        req.headers.get("x-forwarded-host") ||
        req.headers.get("host") ||
        url.host;
    const userAgent = req.headers.get("user-agent") ?? "unknown";
    const referer = req.headers.get("referer") ?? null;

    try {
        const user = await getAuthUser(req);
        if (!user) {
            console.warn("[checkout] Unauthorized request", {
                requestId,
                host: requestHost,
                path: url.pathname,
                clientIp,
                referer,
                hasSessionCookie,
                hasKnownAuthCookie,
                userAgent,
            });
            return withRequestId({ error: "Unauthorized" }, 401, requestId);
        }

        if (!process.env.STRIPE_SECRET_KEY) {
            console.error("[checkout] STRIPE_SECRET_KEY is required", { requestId });
            return withRequestId(
                { error: "Checkout handler misconfigured" },
                503,
                requestId
            );
        }

        if (
            clientIp &&
            isRateLimited({
                store: checkoutRequestLog,
                key: `${clientIp}:${user.id}`,
                maxRequests: CHECKOUT_RATE_LIMIT_MAX_REQUESTS,
                windowMs: CHECKOUT_RATE_LIMIT_WINDOW_MS,
            })
        ) {
            console.warn("[checkout] Rate limited", {
                requestId,
                userId: user.id,
                clientIp,
            });
            return withRequestId(
                { error: "Too many checkout attempts. Please try again shortly." },
                429,
                requestId
            );
        }

        const body = await req
            .json()
            .catch(() => ({})) as { plan?: unknown; returnPath?: unknown };
        const plan = typeof body.plan === "string" ? body.plan : "";
        const returnPath = resolveSafeReturnPath(body.returnPath);

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
                return withRequestId({ error: "Invalid plan" }, 400, requestId);
        }

        if (!priceId || priceId === "price_placeholder") {
            return withRequestId(
                { error: "Stripe is not configured yet. Please set up price IDs in your environment." },
                503,
                requestId
            );
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (!appUrl) {
            console.error("[checkout] NEXT_PUBLIC_APP_URL is required for redirects", {
                requestId,
            });
            return withRequestId(
                { error: "Checkout handler misconfigured" },
                503,
                requestId
            );
        }

        let successUrl: URL;
        let cancelUrl: URL;
        try {
            successUrl = new URL(returnPath, appUrl);
            successUrl.searchParams.set("checkout", "success");
            cancelUrl = new URL(returnPath, appUrl);
            cancelUrl.searchParams.set("checkout", "cancelled");
        } catch {
            console.error("[checkout] NEXT_PUBLIC_APP_URL is invalid", {
                requestId,
                appUrl,
            });
            return withRequestId(
                { error: "Checkout handler misconfigured" },
                503,
                requestId
            );
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

        const response = NextResponse.json({ url: session.url });
        response.headers.set("x-request-id", requestId);
        response.headers.set("Cache-Control", "no-store");
        return response;
    } catch (error: any) {
        console.error("[checkout] Checkout error", {
            requestId,
            error,
        });
        return withRequestId(
            { error: error.message || "Failed to create checkout session" },
            500,
            requestId
        );
    }
}
