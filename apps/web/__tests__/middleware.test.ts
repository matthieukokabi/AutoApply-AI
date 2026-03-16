import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/middleware", () => ({
    default: vi.fn(() => vi.fn(() => undefined)),
}));

vi.mock("@/i18n/routing", () => ({
    routing: {},
}));

import middleware, { config } from "@/middleware";

function mockRequest(
    pathname: string,
    options?: { userAgent?: string; cookie?: string }
) {
    const url = `https://example.com${pathname}`;
    const headers = new Headers();
    if (options?.userAgent) {
        headers.set("user-agent", options.userAgent);
    }
    if (options?.cookie) {
        headers.set("cookie", options.cookie);
    }

    return {
        url,
        nextUrl: new URL(url),
        headers,
    };
}

describe("middleware auth + i18n routing", () => {
    it("redirects signed-in users from root to dashboard", async () => {
        const auth = vi.fn().mockResolvedValue({ userId: "clerk_user_1" });

        const response = await (middleware as any)(
            auth,
            mockRequest("/", { cookie: "__session=session_token" })
        );

        expect(response?.status).toBe(307);
        expect(response?.headers.get("location")).toBe("https://example.com/dashboard");
    });

    it("redirects signed-in users from locale root to locale dashboard", async () => {
        const auth = vi.fn().mockResolvedValue({ userId: "clerk_user_1" });

        const response = await (middleware as any)(
            auth,
            mockRequest("/fr", { cookie: "__session=session_token" })
        );

        expect(response?.status).toBe(307);
        expect(response?.headers.get("location")).toBe("https://example.com/fr/dashboard");
    });

    it("redirects signed-out users on protected locale routes to locale sign-in", async () => {
        const auth = vi.fn().mockResolvedValue({ userId: null });

        const response = await (middleware as any)(auth, mockRequest("/fr/dashboard"));

        expect(response?.status).toBe(307);
        expect(response?.headers.get("location")).toBe("https://example.com/fr/sign-in");
    });

    it("allows signed-out users on public auth pages", async () => {
        const auth = vi.fn().mockResolvedValue({ userId: null });

        const response = await (middleware as any)(auth, mockRequest("/fr/sign-in"));

        expect(response).toBeUndefined();
        expect(auth).not.toHaveBeenCalled();
    });

    it("skips redirects for API routes", async () => {
        const auth = vi.fn().mockResolvedValue({ userId: null });

        const response = await (middleware as any)(auth, mockRequest("/api/jobs"));

        expect(response).toBeUndefined();
    });

    it("does not invoke auth callback for API routes", async () => {
        const auth = vi.fn().mockResolvedValue({ userId: "clerk_user_1" });

        const response = await (middleware as any)(auth, mockRequest("/api/user"));

        expect(response).toBeUndefined();
        expect(auth).not.toHaveBeenCalled();
    });

    it("does not invoke auth callback for public content routes", async () => {
        const auth = vi.fn().mockResolvedValue({ userId: "clerk_user_1" });

        const response = await (middleware as any)(auth, mockRequest("/blog"));

        expect(response).toBeUndefined();
        expect(auth).not.toHaveBeenCalled();
    });

    it("does not invoke auth callback for bot requests on root landing", async () => {
        const auth = vi.fn().mockResolvedValue({ userId: "clerk_user_1" });

        const response = await (middleware as any)(
            auth,
            mockRequest("/", {
                userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
                cookie: "__session=session_token",
            })
        );

        expect(response).toBeUndefined();
        expect(auth).not.toHaveBeenCalled();
    });

    it("does not invoke auth callback for bot requests on auth pages", async () => {
        const auth = vi.fn().mockResolvedValue({ userId: "clerk_user_1" });

        const response = await (middleware as any)(
            auth,
            mockRequest("/sign-in", {
                userAgent: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
                cookie: "__session=session_token",
            })
        );

        expect(response).toBeUndefined();
        expect(auth).not.toHaveBeenCalled();
    });

    it("does not invoke auth callback for anonymous root requests without session cookie", async () => {
        const auth = vi.fn().mockResolvedValue({ userId: "clerk_user_1" });

        const response = await (middleware as any)(auth, mockRequest("/"));

        expect(response).toBeUndefined();
        expect(auth).not.toHaveBeenCalled();
    });

    it("keeps matcher scope narrow for locale-prefixed public content routes", () => {
        const matcher = (config as { matcher: string[] }).matcher;
        expect(matcher).toContain("/blog/:path*");
        expect(matcher).toContain("/auth-diagnostics");
        expect(matcher).not.toContain("/(en|fr|de|es|it)/blog/:path*");
        expect(matcher).not.toContain("/(en|fr|de|es|it)/terms");
        expect(matcher).not.toContain("/(en|fr|de|es|it)/privacy");
        expect(matcher).not.toContain("/(en|fr|de|es|it)/contact");
        expect(matcher).not.toContain("/(en|fr|de|es|it)/roadmap");
        expect(matcher).not.toContain("/(en|fr|de|es|it)/auth-diagnostics");
    });
});
