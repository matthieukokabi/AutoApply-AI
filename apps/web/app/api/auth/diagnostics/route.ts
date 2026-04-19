import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

const AUTH_COOKIE_NAMES = [
    "__session",
    "__client_uat",
    "__clerk_db_jwt",
    "__client",
    "__clerk_handshake",
];
const AUTH_DIAGNOSTICS_RATE_LIMIT_MAX_REQUESTS = 10;
const AUTH_DIAGNOSTICS_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const authDiagnosticsRequestLog = new Map<string, number[]>();

type AuthStatus =
    | "signed_in"
    | "signed_out"
    | "anonymous"
    | "cookie_present_unauthenticated"
    | "error";

type AuthLookupState = "ok" | "unavailable" | "error";

interface AuthResolution {
    status: AuthStatus;
    lookup: AuthLookupState;
    errorCode: string | null;
}

function parseCookieNames(cookieHeader: string) {
    if (!cookieHeader) return [];

    return cookieHeader
        .split(";")
        .map((part) => part.trim().split("=")[0])
        .filter(Boolean);
}

function hasCookie(cookieNames: string[], expectedName: string) {
    return cookieNames.includes(expectedName);
}

function resolveAppUrlDiagnostics(reqHost: string) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
        return {
            configured: false,
            valid: false,
            host: null,
            matchesRequestHost: null,
        };
    }

    try {
        const parsed = new URL(appUrl);
        return {
            configured: true,
            valid: true,
            host: parsed.host,
            matchesRequestHost: parsed.host === reqHost,
        };
    } catch {
        return {
            configured: true,
            valid: false,
            host: null,
            matchesRequestHost: null,
        };
    }
}

function isClerkContextUnavailableError(error: unknown) {
    if (!(error instanceof Error)) {
        return false;
    }

    const message = error.message.toLowerCase();
    return (
        message.includes("clerkmiddleware") ||
        message.includes("auth() was called") ||
        message.includes("can't detect usage") ||
        message.includes("unable to authenticate request")
    );
}

async function resolveAuthState(input: {
    hasKnownAuthCookie: boolean;
}): Promise<AuthResolution> {
    try {
        const { userId } = await auth();
        if (userId) {
            return {
                status: "signed_in",
                lookup: "ok",
                errorCode: null,
            };
        }

        return {
            status: input.hasKnownAuthCookie
                ? "cookie_present_unauthenticated"
                : "signed_out",
            lookup: "ok",
            errorCode: null,
        };
    } catch (error) {
        if (isClerkContextUnavailableError(error)) {
            return {
                status: input.hasKnownAuthCookie
                    ? "cookie_present_unauthenticated"
                    : "anonymous",
                lookup: "unavailable",
                errorCode: "AUTH_CONTEXT_UNAVAILABLE",
            };
        }

        return {
            status: "error",
            lookup: "error",
            errorCode: "AUTH_LOOKUP_FAILURE",
        };
    }
}

function resolveSupportCode(input: { status: AuthStatus; lookup: AuthLookupState }) {
    if (input.status === "error") {
        return "AUTH_INIT_BLOCKED";
    }

    if (input.status === "signed_in") {
        return "AUTH_SESSION_ACTIVE";
    }

    if (input.lookup === "unavailable") {
        return "AUTH_STATUS_INFERRED";
    }

    return "AUTH_NOT_SIGNED_IN";
}

function buildRecommendations(input: {
    hasCookieHeader: boolean;
    hasSessionCookie: boolean;
    hasKnownAuthCookie: boolean;
    appUrlValid: boolean;
    appUrlMatchesHost: boolean | null;
    authStatus: AuthStatus;
    authLookup: AuthLookupState;
}) {
    const recommendations: string[] = [];

    if (input.authStatus === "signed_in") {
        recommendations.push("Auth session is active.");
    }

    if (input.authStatus === "anonymous") {
        recommendations.push("No auth cookies detected. This is normal before sign-in.");
    }

    if (input.authStatus === "signed_out") {
        recommendations.push("No active session found. Sign in again to continue.");
    }

    if (input.authStatus === "cookie_present_unauthenticated") {
        if (input.hasSessionCookie) {
            recommendations.push(
                "Session cookie exists but no active authenticated session was confirmed. Sign out and sign in again."
            );
        } else {
            recommendations.push(
                "Auth cookies exist but session cookie is missing. Complete sign-in again to refresh session."
            );
        }
    }

    if (!input.hasCookieHeader && input.authStatus !== "signed_in") {
        recommendations.push("Browser did not send cookies. Enable cookies for autoapply.works.");
    }

    if (input.hasCookieHeader && !input.hasKnownAuthCookie && input.authStatus !== "signed_in") {
        recommendations.push(
            "No known auth cookies detected. Disable strict tracking protection and retry sign-in."
        );
    }

    if (!input.appUrlValid) {
        recommendations.push("NEXT_PUBLIC_APP_URL is missing or invalid on the server.");
    } else if (input.appUrlMatchesHost === false) {
        recommendations.push(
            "Request host and NEXT_PUBLIC_APP_URL host differ. Verify deployment domain configuration."
        );
    }

    if (input.authLookup === "unavailable") {
        recommendations.push(
            "Server auth lookup is unavailable on this diagnostics route; status is inferred from request cookies."
        );
    }

    if (input.authStatus === "error") {
        recommendations.push(
            "Server auth check failed. Verify Clerk middleware and server auth configuration."
        );
    }

    if (recommendations.length === 0) {
        recommendations.push(
            "No obvious server-side issue detected. If auth still fails, test without VPN/ad blocker/private DNS."
        );
    }

    return recommendations;
}

/**
 * GET /api/auth/diagnostics
 * Production-safe auth diagnostics for onboarding/support triage.
 * Returns booleans/status only; no secrets or token values are exposed.
 */
export async function GET(req: Request) {
    const url = new URL(req.url);
    const clientIp = getClientIp(req);
    const cookieHeader = req.headers.get("cookie") || "";
    const cookieNames = parseCookieNames(cookieHeader);
    const reqHost =
        req.headers.get("x-forwarded-host") ||
        req.headers.get("host") ||
        url.host;
    const reqProto =
        req.headers.get("x-forwarded-proto") ||
        url.protocol.replace(":", "");

    if (
        clientIp &&
        isRateLimited({
            store: authDiagnosticsRequestLog,
            key: clientIp,
            maxRequests: AUTH_DIAGNOSTICS_RATE_LIMIT_MAX_REQUESTS,
            windowMs: AUTH_DIAGNOSTICS_RATE_LIMIT_WINDOW_MS,
        })
    ) {
        const response = NextResponse.json(
            { error: "Too many diagnostics requests. Please try again shortly." },
            { status: 429 }
        );
        response.headers.set("Cache-Control", "no-store, max-age=0");
        return response;
    }

    const hasSessionCookie = hasCookie(cookieNames, "__session");
    const hasKnownAuthCookie = AUTH_COOKIE_NAMES.some((name) => hasCookie(cookieNames, name));
    const appUrlDiagnostics = resolveAppUrlDiagnostics(reqHost);
    const authResolution = await resolveAuthState({ hasKnownAuthCookie });

    const recommendations = buildRecommendations({
        hasCookieHeader: cookieHeader.length > 0,
        hasSessionCookie,
        hasKnownAuthCookie,
        appUrlValid: appUrlDiagnostics.valid,
        appUrlMatchesHost: appUrlDiagnostics.matchesRequestHost,
        authStatus: authResolution.status,
        authLookup: authResolution.lookup,
    });

    const response = NextResponse.json(
        {
            generatedAt: new Date().toISOString(),
            request: {
                path: url.pathname,
                host: reqHost,
                protocol: reqProto,
                hasCookieHeader: cookieHeader.length > 0,
                cookieCount: cookieNames.length,
                hasSessionCookie,
                hasKnownAuthCookie,
            },
            auth: {
                status: authResolution.status,
                lookup: authResolution.lookup,
                errorCode: authResolution.errorCode,
            },
            configuration: {
                appUrl: appUrlDiagnostics,
                clerkPublishableKeyConfigured: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
                clerkSecretKeyConfigured: !!process.env.CLERK_SECRET_KEY,
                expectedAuthHost: "clerk.autoapply.works",
            },
            recommendations,
            supportCode: resolveSupportCode({
                status: authResolution.status,
                lookup: authResolution.lookup,
            }),
        },
        { status: 200 }
    );

    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
}
