import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@clerk/nextjs/server";
import { GET } from "@/app/api/auth/diagnostics/route";

describe("GET /api/auth/diagnostics", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.NEXT_PUBLIC_APP_URL;
        delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
        delete process.env.CLERK_SECRET_KEY;
    });

    it("returns safe diagnostics with auth and cookie booleans", async () => {
        process.env.NEXT_PUBLIC_APP_URL = "https://autoapply.works";
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_123";
        process.env.CLERK_SECRET_KEY = "sk_test_123";
        vi.mocked(auth).mockResolvedValue({ userId: "clerk_123" } as any);

        const req = new Request("https://autoapply.works/api/auth/diagnostics", {
            headers: {
                cookie: "__session=super_secret; __client_uat=1234",
                "x-forwarded-host": "autoapply.works",
                "x-forwarded-proto": "https",
            },
        });

        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(res.headers.get("cache-control")).toContain("no-store");
        expect(data.supportCode).toBe("AUTH_INIT_BLOCKED");
        expect(data.auth.status).toBe("signed_in");
        expect(data.request.hasCookieHeader).toBe(true);
        expect(data.request.hasSessionCookie).toBe(true);
        expect(data.request.hasKnownAuthCookie).toBe(true);
        expect(data.configuration.appUrl.matchesRequestHost).toBe(true);

        const serialized = JSON.stringify(data);
        expect(serialized).not.toContain("super_secret");
    });

    it("marks auth status error when auth lookup fails", async () => {
        process.env.NEXT_PUBLIC_APP_URL = "invalid_url";
        vi.mocked(auth).mockRejectedValue(new Error("auth failure"));

        const req = new Request("https://autoapply.works/api/auth/diagnostics");
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.auth.status).toBe("error");
        expect(data.request.hasCookieHeader).toBe(false);
        expect(data.configuration.appUrl.valid).toBe(false);
        expect(Array.isArray(data.recommendations)).toBe(true);
        expect(data.recommendations.length).toBeGreaterThan(0);
    });
});
