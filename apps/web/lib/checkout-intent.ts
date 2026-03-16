export const SUPPORTED_LOCALES = ["en", "fr", "de", "es", "it"] as const;

export const CHECKOUT_PLANS = [
    "pro_monthly",
    "pro_yearly",
    "unlimited",
    "unlimited_yearly",
    "credit_pack",
] as const;

export type CheckoutPlan = (typeof CHECKOUT_PLANS)[number];
const CHECKOUT_ERROR_FALLBACK = "Failed to start checkout. Please try again.";

const supportedLocaleSet = new Set<string>(SUPPORTED_LOCALES);
const checkoutPlanSet = new Set<string>(CHECKOUT_PLANS);

type QueryLike = URLSearchParams | { get(name: string): string | null };
type AuthRoute =
    | "sign-in"
    | "sign-up"
    | "settings"
    | "dashboard"
    | "auth-diagnostics";

function buildRoutePath(locale: string | null, route: AuthRoute) {
    return locale ? `/${locale}/${route}` : `/${route}`;
}

export function getAuthPathsForLocale(localeParam: string | undefined) {
    const locale =
        typeof localeParam === "string" && supportedLocaleSet.has(localeParam)
            ? localeParam
            : null;

    return {
        signInPath: buildRoutePath(locale, "sign-in"),
        signUpPath: buildRoutePath(locale, "sign-up"),
        settingsPath: buildRoutePath(locale, "settings"),
        dashboardPath: buildRoutePath(locale, "dashboard"),
    };
}

export function getLocalizedPathForRoute(pathname: string, route: AuthRoute) {
    const segments = pathname.split("/").filter(Boolean);
    const locale = segments[0];
    const normalizedLocale = locale && supportedLocaleSet.has(locale) ? locale : null;
    return buildRoutePath(normalizedLocale, route);
}

export function isCheckoutPlan(
    value: string | null | undefined
): value is CheckoutPlan {
    return typeof value === "string" && checkoutPlanSet.has(value);
}

export function resolveCheckoutIntentPlan(query: QueryLike): CheckoutPlan | null {
    const upgradePlan = query.get("upgrade");
    if (isCheckoutPlan(upgradePlan)) {
        return upgradePlan;
    }

    // Legacy fallback for links generated before `upgrade` query adoption.
    const legacyPlan = query.get("plan");
    if (isCheckoutPlan(legacyPlan)) {
        return legacyPlan;
    }

    return null;
}

export function buildAuthIntentUrl(
    basePath: string,
    plan: CheckoutPlan | null,
    from: string | null
) {
    if (!plan && !from) {
        return basePath;
    }

    const params = new URLSearchParams();
    if (plan) {
        params.set("upgrade", plan);
    }
    if (from) {
        params.set("from", from);
    }

    return `${basePath}?${params.toString()}`;
}

export function buildPostAuthRedirectUrl(
    settingsPath: string,
    dashboardPath: string,
    plan: CheckoutPlan | null,
    from: string | null
) {
    if (!plan) {
        return dashboardPath;
    }

    const params = new URLSearchParams({ upgrade: plan });
    if (from) {
        params.set("from", from);
    }

    return `${settingsPath}?${params.toString()}`;
}

export function isUnauthorizedCheckoutError(
    status: number,
    errorMessage: string | null | undefined
) {
    if (status === 401) {
        return true;
    }

    if (!errorMessage) {
        return false;
    }

    const normalizedMessage = errorMessage.toLowerCase();
    return (
        normalizedMessage.includes("unauthorized") ||
        normalizedMessage.includes("not authenticated")
    );
}

export function shouldRedirectToAuthBeforeCheckout(
    isAuthLoaded: boolean,
    userId: string | null | undefined
) {
    return isAuthLoaded && !userId;
}

export function getCheckoutErrorMessage(errorMessage: string | null | undefined) {
    const normalizedError =
        typeof errorMessage === "string" ? errorMessage.trim() : "";
    return normalizedError || CHECKOUT_ERROR_FALLBACK;
}
