import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { locales, defaultLocale } from "@/i18n/config";

// Create the intl middleware for locale routing
const intlMiddleware = createMiddleware(routing);

const publicRoutes = [
    "/",
    "/:locale",
    "/:locale/sign-in(.*)",
    "/:locale/sign-up(.*)",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/__clerk(.*)",
    "/api/(.*)",
    "/:locale/terms",
    "/:locale/privacy",
    "/:locale/contact",
    "/terms",
    "/privacy",
    "/contact",
    "/:locale/blog",
    "/:locale/blog/(.*)",
    "/blog",
    "/blog/(.*)",
    "/:locale/roadmap",
    "/roadmap",
];

const isPublicRoute = createRouteMatcher(publicRoutes);

export default clerkMiddleware(async (auth, req) => {
    let intlResponse: ReturnType<typeof intlMiddleware> | undefined;

    // Skip locale routing for API routes and Clerk internals
    if (
        !req.nextUrl.pathname.startsWith("/api/") &&
        !req.nextUrl.pathname.startsWith("/__clerk")
    ) {
        intlResponse = intlMiddleware(req);
    }

    const { userId } = await auth();
    const url = req.nextUrl;

    // Skip redirects for API routes and preserve intl response when present
    if (url.pathname.startsWith("/api/")) {
        return intlResponse;
    }

    // IMPORTANT: Do NOT redirect Clerk's internal auth routes
    const isClerkInternalRoute =
        url.pathname.includes("/sso-callback") ||
        url.pathname.includes("/factor-") ||
        url.pathname.includes("/verify") ||
        url.pathname.includes("/reset-password") ||
        url.pathname.includes("/verify-email");

    // Detect locale from path
    const pathLocale = locales.find(
        (l) => url.pathname.startsWith(`/${l}/`) || url.pathname === `/${l}`
    );
    const localePrefix = pathLocale && pathLocale !== defaultLocale ? `/${pathLocale}` : "";

    // If signed-in user visits landing page, redirect to dashboard
    if (
        userId &&
        !isClerkInternalRoute &&
        (url.pathname === "/" || locales.some((l) => url.pathname === `/${l}`))
    ) {
        return NextResponse.redirect(new URL(`${localePrefix}/dashboard`, req.url));
    }

    // If user is signed in and on sign-in/sign-up page, redirect to dashboard
    if (
        userId &&
        !isClerkInternalRoute &&
        (url.pathname.endsWith("/sign-in") ||
            url.pathname.endsWith("/sign-up") ||
            url.pathname === "/sign-in" ||
            url.pathname === "/sign-up")
    ) {
        return NextResponse.redirect(new URL(`${localePrefix}/dashboard`, req.url));
    }

    // If user is NOT signed in and trying to access a protected route
    if (!userId && !isPublicRoute(req)) {
        return NextResponse.redirect(new URL(`${localePrefix}/sign-in`, req.url));
    }

    // Preserve locale rewrite/redirect response from intl middleware when set.
    return intlResponse;
});

export const config = {
    // OPTIMIZED: Only run middleware on routes that actually need it.
    // Previously matched EVERYTHING ("/((?!.+\\.[\\w]+$|_next).*)") — caused
    // 1.2M+ edge invocations/month from bots, crawlers, and prefetches.
    // Now only matches specific route patterns that need auth or i18n.
    matcher: [
        // Landing page (locale routing + signed-in redirect)
        "/",
        "/en",
        "/fr",
        "/de",
        "/es",
        "/it",
        // Dashboard routes — with locale prefix (protected — need auth)
        "/(en|fr|de|es|it)/dashboard/:path*",
        "/(en|fr|de|es|it)/profile/:path*",
        "/(en|fr|de|es|it)/jobs/:path*",
        "/(en|fr|de|es|it)/settings/:path*",
        "/(en|fr|de|es|it)/documents/:path*",
        "/(en|fr|de|es|it)/onboarding/:path*",
        // Dashboard routes — bare (no locale) so intlMiddleware can add locale prefix
        // Required because Clerk redirects to /dashboard after sign-in
        "/dashboard/:path*",
        "/profile/:path*",
        "/jobs/:path*",
        "/settings/:path*",
        "/documents/:path*",
        "/onboarding/:path*",
        // Auth pages
        "/(en|fr|de|es|it)/sign-in/:path*",
        "/(en|fr|de|es|it)/sign-up/:path*",
        "/sign-in/:path*",
        "/sign-up/:path*",
        // Public pages that need locale routing (with and without locale prefix)
        "/(en|fr|de|es|it)/blog/:path*",
        "/(en|fr|de|es|it)/terms",
        "/(en|fr|de|es|it)/privacy",
        "/(en|fr|de|es|it)/contact",
        "/(en|fr|de|es|it)/roadmap",
        "/blog/:path*",
        "/terms",
        "/privacy",
        "/contact",
        "/roadmap",
        // Authenticated API routes only (avoid unnecessary middleware invocations
        // on public webhooks/OG image routes to reduce edge usage on Vercel)
        "/api/account",
        "/api/applications",
        "/api/applications/:path*",
        "/api/checkout",
        "/api/debug/auth",
        "/api/jobs",
        "/api/onboarding",
        "/api/preferences",
        "/api/profile",
        "/api/profile/:path*",
        "/api/stats",
        "/api/tailor",
        "/api/user",
    ],
};
