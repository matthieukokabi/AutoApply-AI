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

    it("returns safe diagnostics with signed-in auth state", async () => {
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
        expect(data.supportCode).toBe("AUTH_SESSION_ACTIVE");
        expect(data.auth.status).toBe("signed_in");
        expect(data.auth.lookup).toBe("ok");
        expect(data.auth.errorCode).toBeNull();
        expect(data.request.hasCookieHeader).toBe(true);
        expect(data.request.hasSessionCookie).toBe(true);
        expect(data.request.hasKnownAuthCookie).toBe(true);
        expect(data.configuration.appUrl.matchesRequestHost).toBe(true);

        const serialized = JSON.stringify(data);
        expect(serialized).not.toContain("super_secret");
    });

    it("infers anonymous state when Clerk auth lookup is unavailable", async () => {
        process.env.NEXT_PUBLIC_APP_URL = "https://autoapply.works";
        vi.mocked(auth).mockRejectedValue(
            new Error("auth() was called but Clerk can't detect usage of clerkMiddleware()")
        );

        const req = new Request("https://autoapply.works/api/auth/diagnostics");
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.auth.status).toBe("anonymous");
        expect(data.auth.lookup).toBe("unavailable");
        expect(data.auth.errorCode).toBe("AUTH_CONTEXT_UNAVAILABLE");
        expect(data.supportCode).toBe("AUTH_STATUS_INFERRED");
        expect(data.recommendations).not.toContain(
            "Server auth check failed. Verify Clerk middleware and server auth configuration."
        );
    });

    it("infers cookie-present unauthenticated state when cookies exist but auth lookup is unavailable", async () => {
        process.env.NEXT_PUBLIC_APP_URL = "https://autoapply.works";
        vi.mocked(auth).mockRejectedValue(
            new Error("Clerk can't detect usage of clerkMiddleware")
        );

        const req = new Request("https://autoapply.works/api/auth/diagnostics", {
            headers: {
                cookie: "__session=token; __client_uat=1234",
            },
        });

        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.auth.status).toBe("cookie_present_unauthenticated");
        expect(data.auth.lookup).toBe("unavailable");
        expect(data.supportCode).toBe("AUTH_STATUS_INFERRED");
        expect(data.request.hasKnownAuthCookie).toBe(true);
        expect(data.request.hasSessionCookie).toBe(true);
    });

    it("keeps real auth failures visible as error state", async () => {
        process.env.NEXT_PUBLIC_APP_URL = "https://autoapply.works";
        vi.mocked(auth).mockRejectedValue(new Error("upstream auth outage"));

        const req = new Request("https://autoapply.works/api/auth/diagnostics");
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.auth.status).toBe("error");
        expect(data.auth.lookup).toBe("error");
        expect(data.auth.errorCode).toBe("AUTH_LOOKUP_FAILURE");
        expect(data.supportCode).toBe("AUTH_INIT_BLOCKED");
        expect(data.recommendations).toContain(
            "Server auth check failed. Verify Clerk middleware and server auth configuration."
        );
    });

    it("returns 429 when diagnostics is called too frequently from one IP", async () => {
        process.env.NEXT_PUBLIC_APP_URL = "https://autoapply.works";
        vi.mocked(auth).mockResolvedValue({ userId: null } as any);

        const makeReq = () =>
            new Request("https://autoapply.works/api/auth/diagnostics", {
                headers: {
                    "x-forwarded-for": "203.0.113.55",
                },
            });

        for (let i = 0; i < 10; i += 1) {
            const res = await GET(makeReq());
            expect(res.status).toBe(200);
        }

        const limitedRes = await GET(makeReq());
        const data = await limitedRes.json();

        expect(limitedRes.status).toBe(429);
        expect(data.error).toContain("Too many diagnostics requests");
    });
});
