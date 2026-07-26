import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

const TERMINAL_SUBSCRIPTION_STATUSES = new Set([
    "canceled",
    "incomplete_expired",
]);

function isMissingExternalResource(error: unknown) {
    if (!error || typeof error !== "object") {
        return false;
    }

    const candidate = error as { code?: unknown; status?: unknown };
    return candidate.code === "resource_missing" || candidate.status === 404;
}

async function findStripeCustomerIds(
    stripeCustomerId: string | null,
    email: string
) {
    const customerIds = new Set<string>();

    if (stripeCustomerId) {
        try {
            const customer = await stripe.customers.retrieve(stripeCustomerId);
            if (!customer.deleted) {
                customerIds.add(customer.id);
            }
        } catch (error) {
            if (!isMissingExternalResource(error)) {
                throw error;
            }
        }
    }

    const customersByEmail = await stripe.customers.list({
        email,
        limit: 100,
    });

    for (const customer of customersByEmail.data) {
        if (
            !customer.deleted &&
            customer.email?.trim().toLowerCase() === email.trim().toLowerCase()
        ) {
            customerIds.add(customer.id);
        }
    }

    return Array.from(customerIds);
}

async function deleteStripeBillingData(
    stripeCustomerId: string | null,
    email: string
) {
    const customerIds = await findStripeCustomerIds(stripeCustomerId, email);

    for (const customerId of customerIds) {
        const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: "all",
            limit: 100,
        });

        for (const subscription of subscriptions.data) {
            if (!TERMINAL_SUBSCRIPTION_STATUSES.has(subscription.status)) {
                await stripe.subscriptions.cancel(subscription.id, {
                    prorate: false,
                });
            }
        }

        try {
            await stripe.customers.del(customerId);
        } catch (error) {
            if (!isMissingExternalResource(error)) {
                throw error;
            }
        }
    }
}

/**
 * GET /api/account — export all user data (GDPR data export)
 */
export async function GET(req: Request) {
    try {
        const authUser = await getAuthUser(req);
        if (!authUser) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findFirst({
            where: { id: authUser.id },
            include: {
                masterProfile: true,
                preferences: true,
                applications: {
                    include: { job: true },
                },
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({
            exportedAt: new Date().toISOString(),
            user: {
                email: user.email,
                name: user.name,
                subscriptionStatus: user.subscriptionStatus,
                creditsRemaining: user.creditsRemaining,
                automationEnabled: user.automationEnabled,
                createdAt: user.createdAt,
            },
            masterProfile: user.masterProfile,
            preferences: user.preferences,
            applications: user.applications,
        });
    } catch (error) {
        console.error("GET /api/account error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * DELETE /api/account — GDPR data deletion endpoint
 * Permanently deletes all user data (cascading via Prisma relations).
 */
export async function DELETE(req: Request) {
    const requestId = crypto.randomUUID();

    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!process.env.STRIPE_SECRET_KEY || !process.env.CLERK_SECRET_KEY) {
            console.error("[account-deletion] required service configuration missing", {
                requestId,
                hasStripeKey: Boolean(process.env.STRIPE_SECRET_KEY),
                hasClerkKey: Boolean(process.env.CLERK_SECRET_KEY),
            });
            return NextResponse.json(
                {
                    error: "Account deletion is temporarily unavailable",
                    requestId,
                },
                { status: 503 }
            );
        }

        await deleteStripeBillingData(user.stripeCustomerId, user.email);

        const clerk = await clerkClient();
        try {
            await clerk.users.deleteUser(user.clerkId);
        } catch (error) {
            if (!isMissingExternalResource(error)) {
                throw error;
            }
        }

        // Prisma cascade delete handles masterProfile, preferences, applications
        await prisma.user.delete({
            where: { id: user.id },
        });

        return NextResponse.json({
            message: "Account and all associated data deleted successfully",
            requestId,
        });
    } catch (error) {
        console.error("[account-deletion] deletion failed", {
            requestId,
            error,
        });
        return NextResponse.json(
            {
                error: "Account deletion could not be completed",
                requestId,
            },
            { status: 500 }
        );
    }
}
