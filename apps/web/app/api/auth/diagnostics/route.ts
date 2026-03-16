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

function buildRecommendations(input: {
    hasCookieHeader: boolean;
    hasSessionCookie: boolean;
    hasKnownAuthCookie: boolean;
    appUrlValid: boolean;
    appUrlMatchesHost: boolean | null;
    authStatus: "signed_in" | "signed_out" | "error";
}) {
    const recommendations: string[] = [];

    if (!input.hasCookieHeader) {
        recommendations.push("Browser did not send cookies. Enable cookies for autoapply.works.");
    }

    if (input.hasCookieHeader && !input.hasKnownAuthCookie) {
        recommendations.push("No known auth cookies detected. Disable strict tracking protection and retry sign-in.");
    }

    if (input.hasKnownAuthCookie && !input.hasSessionCookie) {
        recommendations.push("Auth cookies exist but session cookie is missing. Complete sign-in again to refresh session.");
    }

    if (!input.appUrlValid) {
        recommendations.push("NEXT_PUBLIC_APP_URL is missing or invalid on the server.");
    } else if (input.appUrlMatchesHost === false) {
        recommendations.push("Request host and NEXT_PUBLIC_APP_URL host differ. Verify deployment domain configuration.");
    }

    if (input.authStatus === "error") {
        recommendations.push("Server auth check failed. Verify Clerk middleware and server auth configuration.");
    }

    if (recommendations.length === 0) {
        recommendations.push("No obvious server-side issue detected. If auth still fails, test without VPN/ad blocker/private DNS.");
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

    let authStatus: "signed_in" | "signed_out" | "error" = "signed_out";
    try {
        const { userId } = await auth();
        authStatus = userId ? "signed_in" : "signed_out";
    } catch {
        authStatus = "error";
    }

    const recommendations = buildRecommendations({
        hasCookieHeader: cookieHeader.length > 0,
        hasSessionCookie,
        hasKnownAuthCookie,
        appUrlValid: appUrlDiagnostics.valid,
        appUrlMatchesHost: appUrlDiagnostics.matchesRequestHost,
        authStatus,
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
                status: authStatus,
            },
            configuration: {
                appUrl: appUrlDiagnostics,
                clerkPublishableKeyConfigured: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
                clerkSecretKeyConfigured: !!process.env.CLERK_SECRET_KEY,
                expectedAuthHost: "clerk.autoapply.works",
            },
            recommendations,
            supportCode: "AUTH_INIT_BLOCKED",
        },
        { status: 200 }
    );

    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
}
