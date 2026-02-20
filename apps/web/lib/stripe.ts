import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2023-10-16",
    typescript: true,
});

export const PLANS = {
    free: {
        name: "Free",
        credits: 3,
        price: 0,
    },
    pro: {
        name: "Pro",
        credits: 50,
        monthlyPriceId: process.env.STRIPE_PRICE_PRO_MONTHLY,
        yearlyPriceId: process.env.STRIPE_PRICE_PRO_YEARLY,
    },
    unlimited: {
        name: "Unlimited",
        credits: Infinity,
        monthlyPriceId: process.env.STRIPE_PRICE_UNLIMITED_MONTHLY,
    },
    credit_pack: {
        name: "Credit Pack",
        credits: 10,
        priceId: process.env.STRIPE_PRICE_CREDIT_PACK,
    },
} as const;
