import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, DELETE } from "@/app/api/account/route";
import { prisma } from "@/lib/prisma";

const mockUserWithData = {
    id: "user_1",
    clerkId: "clerk_test_user_123",
    email: "test@example.com",
    name: "Test User",
    subscriptionStatus: "pro",
    creditsRemaining: 50,
    automationEnabled: true,
    createdAt: new Date("2025-01-01"),
    masterProfile: {
        id: "profile_1",
        rawText: "My CV content",
        structuredJson: {},
    },
    preferences: {
        id: "pref_1",
        targetTitles: ["Engineer"],
        locations: ["Remote"],
    },
    applications: [
        {
            id: "app_1",
            status: "tailored",
            job: { title: "Developer", company: "Corp" },
        },
    ],
};

const mockUser = {
    id: "user_1",
    clerkId: "clerk_test_user_123",
    email: "test@example.com",
    name: "Test User",
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("GET /api/account (GDPR data export)", () => {
    it("exports all user data", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUserWithData as any);

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.exportedAt).toBeDefined();
        expect(data.user.email).toBe("test@example.com");
        expect(data.masterProfile).toBeDefined();
        expect(data.preferences).toBeDefined();
        expect(data.applications).toHaveLength(1);
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

describe("DELETE /api/account (GDPR data deletion)", () => {
    it("deletes user and all associated data", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.user.delete).mockResolvedValue(mockUser as any);

        const response = await DELETE();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.message).toContain("deleted successfully");
        expect(prisma.user.delete).toHaveBeenCalledWith({
            where: { id: "user_1" },
        });
    });

    it("returns 401 when not authenticated", async () => {
        const { auth } = await import("@clerk/nextjs");
        vi.mocked(auth).mockReturnValueOnce({ userId: null } as any);

        const response = await DELETE();
        expect(response.status).toBe(401);
    });

    it("returns 404 when user not found", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

        const response = await DELETE();
        expect(response.status).toBe(404);
    });
});
