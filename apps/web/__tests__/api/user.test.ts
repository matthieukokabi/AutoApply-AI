import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH } from "@/app/api/user/route";
import { prisma } from "@/lib/prisma";

const mockUser = {
    id: "user_1",
    clerkId: "clerk_test_user_123",
    email: "test@example.com",
    name: "Test User",
    automationEnabled: false,
    subscriptionStatus: "free",
    creditsRemaining: 3,
};

const mockProUser = {
    ...mockUser,
    subscriptionStatus: "pro",
    creditsRemaining: 50,
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("GET /api/user", () => {
    it("returns user info for authenticated user", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.user.email).toBe("test@example.com");
        expect(data.user.subscriptionStatus).toBe("free");
        expect(data.user.creditsRemaining).toBe(3);
    });

    it("returns 401 when not authenticated", async () => {
        const { auth } = await import("@clerk/nextjs");
        vi.mocked(auth).mockReturnValueOnce({ userId: null } as any);

        const response = await GET();
        expect(response.status).toBe(401);
    });

    it("returns 404 when user not found", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

        const response = await GET();
        expect(response.status).toBe(404);
    });
});

describe("PATCH /api/user", () => {
    it("updates automation toggle for pro users", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockProUser as any);
        vi.mocked(prisma.user.update).mockResolvedValue({
            ...mockProUser,
            automationEnabled: true,
        } as any);

        const request = new Request("http://localhost/api/user", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ automationEnabled: true }),
        });

        const response = await PATCH(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.user.automationEnabled).toBe(true);
        expect(prisma.user.update).toHaveBeenCalled();
    });

    it("rejects automation for free users", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);

        const request = new Request("http://localhost/api/user", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ automationEnabled: true }),
        });

        const response = await PATCH(request);
        expect(response.status).toBe(403);
    });

    it("returns 401 when not authenticated", async () => {
        const { auth } = await import("@clerk/nextjs");
        vi.mocked(auth).mockReturnValueOnce({ userId: null } as any);

        const request = new Request("http://localhost/api/user", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ automationEnabled: true }),
        });

        const response = await PATCH(request);
        expect(response.status).toBe(401);
    });
});
