import { authMiddleware } from "@clerk/nextjs";
import { NextResponse } from "next/server";

export default authMiddleware({
    publicRoutes: [
        "/",
        "/sign-in(.*)",
        "/sign-up(.*)",
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

        // If user is signed in and trying to access sign-in/sign-up, redirect to dashboard
        if (userId && (url.pathname.startsWith("/sign-in") || url.pathname.startsWith("/sign-up"))) {
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
