import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/debug/auth/route";
import { prisma } from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs";

describe("GET /api/debug/auth", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.ENABLE_DEBUG_AUTH_ENDPOINT;
        delete process.env.DEBUG_AUTH_SECRET;
    });

    it("returns 404 when debug endpoint is disabled", async () => {
        const req = new Request("http://localhost/api/debug/auth");
        const response = await GET(req);

        expect(response.status).toBe(404);
    });

    it("returns 503 when enabled but secret is missing", async () => {
        process.env.ENABLE_DEBUG_AUTH_ENDPOINT = "true";

        const req = new Request("http://localhost/api/debug/auth");
        const response = await GET(req);
        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.error).toContain("misconfigured");
    });

    it("returns 401 when secret header is invalid", async () => {
        process.env.ENABLE_DEBUG_AUTH_ENDPOINT = "true";
        process.env.DEBUG_AUTH_SECRET = "debug_secret";

        const req = new Request("http://localhost/api/debug/auth", {
            headers: { "x-debug-auth-secret": "wrong" },
        });
        const response = await GET(req);

        expect(response.status).toBe(401);
    });

    it("returns diagnostics when enabled and secret matches", async () => {
        process.env.ENABLE_DEBUG_AUTH_ENDPOINT = "true";
        process.env.DEBUG_AUTH_SECRET = "debug_secret";

        vi.mocked(auth).mockReturnValue({ userId: "clerk_123" } as any);
        vi.mocked(currentUser).mockResolvedValue({
            id: "clerk_123",
            emailAddresses: [{ emailAddress: "user@example.com" }],
            firstName: "Test",
            lastName: "User",
            externalAccounts: [],
        } as any);
        vi.mocked(prisma.user.count).mockResolvedValue(2 as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue({
            id: "user_1",
            clerkId: "clerk_123",
            email: "user@example.com",
            subscriptionStatus: "pro",
        } as any);
        vi.mocked(prisma.masterProfile.findUnique).mockResolvedValue({
            id: "profile_1",
            rawText: "Experienced software engineer with extensive TypeScript background.",
        } as any);

        const req = new Request("http://localhost/api/debug/auth", {
            headers: { "x-debug-auth-secret": "debug_secret" },
        });
        const response = await GET(req);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.database).toEqual({ status: "ok", userCount: 2 });
        expect((data.dbUser as any).status).toBe("found");
        expect((data.profile as any).status).toBe("found");
    });
});
