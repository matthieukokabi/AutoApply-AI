import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/middleware", () => ({
    default: vi.fn(() => vi.fn(() => undefined)),
}));

vi.mock("@/i18n/routing", () => ({
    routing: {},
}));

import middleware from "@/middleware";

function mockRequest(pathname: string, userAgent?: string) {
    const url = `https://example.com${pathname}`;
    const headers = new Headers();
    if (userAgent) {
        headers.set("user-agent", userAgent);
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

        const response = await (middleware as any)(auth, mockRequest("/"));

        expect(response?.status).toBe(307);
        expect(response?.headers.get("location")).toBe("https://example.com/dashboard");
    });

    it("redirects signed-in users from locale root to locale dashboard", async () => {
        const auth = vi.fn().mockResolvedValue({ userId: "clerk_user_1" });

        const response = await (middleware as any)(auth, mockRequest("/fr"));

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
            mockRequest("/", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")
        );

        expect(response).toBeUndefined();
        expect(auth).not.toHaveBeenCalled();
    });

    it("does not invoke auth callback for bot requests on auth pages", async () => {
        const auth = vi.fn().mockResolvedValue({ userId: "clerk_user_1" });

        const response = await (middleware as any)(
            auth,
            mockRequest("/sign-in", "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)")
        );

        expect(response).toBeUndefined();
        expect(auth).not.toHaveBeenCalled();
    });
});
