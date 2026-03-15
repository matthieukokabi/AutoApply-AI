import { authMiddleware } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { locales, defaultLocale } from "@/i18n/config";

// Create the intl middleware for locale routing
const intlMiddleware = createMiddleware(routing);

export default authMiddleware({
    // These routes don't require authentication
    publicRoutes: [
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
    ],

    beforeAuth(req) {
        // Skip locale routing for API routes and Clerk internals
        if (
            req.nextUrl.pathname.startsWith("/api/") ||
            req.nextUrl.pathname.startsWith("/__clerk")
        ) {
            return;
        }
        // Handle locale routing before auth
        return intlMiddleware(req);
    },

    afterAuth(authResult, req) {
        const { userId } = authResult;
        const url = req.nextUrl;

        // Skip redirects for API routes — return void to preserve beforeAuth response
        if (url.pathname.startsWith("/api/")) {
            return;
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
            (url.pathname.endsWith("/sign-in") || url.pathname.endsWith("/sign-up") ||
             url.pathname === "/sign-in" || url.pathname === "/sign-up")
        ) {
            return NextResponse.redirect(new URL(`${localePrefix}/dashboard`, req.url));
        }

        // If user is NOT signed in and trying to access a protected route
        if (!userId && !authResult.isPublicRoute) {
            return NextResponse.redirect(new URL(`${localePrefix}/sign-in`, req.url));
        }

        // CRITICAL: Return void (not NextResponse.next()) to preserve
        // the intlMiddleware rewrite response from beforeAuth.
        return;
    },
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
        // API routes
        "/api/:path*",
    ],
};
