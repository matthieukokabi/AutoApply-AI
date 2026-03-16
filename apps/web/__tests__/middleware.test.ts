import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/middleware", () => ({
    default: vi.fn(() => vi.fn(() => undefined)),
}));

vi.mock("@/i18n/routing", () => ({
    routing: {},
}));

import middleware from "@/middleware";

function mockRequest(pathname: string) {
    const url = `https://example.com${pathname}`;
    return {
        url,
        nextUrl: new URL(url),
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
});
