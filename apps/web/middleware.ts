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

        // Skip redirects for API routes
        if (url.pathname.startsWith("/api/")) {
            return NextResponse.next();
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

        return NextResponse.next();
    },
});

export const config = {
    matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
