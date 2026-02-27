import { authMiddleware } from "@clerk/nextjs";
import { NextResponse } from "next/server";

export default authMiddleware({
    publicRoutes: [
        "/",
        "/sign-in(.*)",
        "/sign-up(.*)",
        "/__clerk(.*)",
        "/api/webhooks/stripe",
        "/api/webhooks/n8n",
        "/api/debug/auth",
        "/terms",
        "/privacy",
        "/contact",
    ],
    afterAuth(authResult, req) {
        const { userId } = authResult;
        const url = req.nextUrl;

        // IMPORTANT: Do NOT redirect Clerk's internal auth routes (sso-callback, factor-one, etc.)
        // These sub-paths are used by Clerk to finalize OAuth flows and must not be intercepted.
        const isClerkInternalRoute =
            url.pathname.includes("/sso-callback") ||
            url.pathname.includes("/factor-") ||
            url.pathname.includes("/verify") ||
            url.pathname.includes("/reset-password") ||
            url.pathname.includes("/verify-email");

        // If user is signed in and on the main sign-in/sign-up page (NOT an internal Clerk route),
        // redirect to dashboard
        if (
            userId &&
            !isClerkInternalRoute &&
            (url.pathname === "/sign-in" || url.pathname === "/sign-up")
        ) {
            return NextResponse.redirect(new URL("/dashboard", req.url));
        }

        // If user is NOT signed in and trying to access a protected route, redirect to sign-in
        if (!userId && !authResult.isPublicRoute) {
            return NextResponse.redirect(new URL("/sign-in", req.url));
        }

        return NextResponse.next();
    },
});

export const config = {
    matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
