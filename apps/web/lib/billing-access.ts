export type BillingPlanStatus = "free" | "pro" | "unlimited";
export type BillingAccessKind = "free" | "stripe_portal" | "manual";

export interface BillingAccessUser {
    subscriptionStatus?: string | null;
    billingPortalAvailable?: boolean | null;
}

export function normalizePlanStatus(
    value: string | null | undefined
): BillingPlanStatus {
    if (value === "pro" || value === "unlimited" || value === "free") {
        return value;
    }

    return "free";
}

export function getBillingAccessKind(
    user: BillingAccessUser | null | undefined
): BillingAccessKind {
    const planStatus = normalizePlanStatus(user?.subscriptionStatus);

    if (planStatus === "free") {
        return "free";
    }

    return user?.billingPortalAvailable === true ? "stripe_portal" : "manual";
}

export function canManageBillingInStripe(
    user: BillingAccessUser | null | undefined
): boolean {
    return getBillingAccessKind(user) === "stripe_portal";
}

export function formatBillingPortalErrorMessage(params: {
    error?: string | null;
    fallback: string;
    requestId?: string | null;
}): string {
    const message = params.error?.trim() || params.fallback;
    return params.requestId ? `${message} (${params.requestId})` : message;
}
