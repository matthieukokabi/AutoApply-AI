import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, DELETE } from "@/app/api/account/route";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

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
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUserWithData as any);

        const request = new Request("http://localhost/api/account");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.exportedAt).toBeDefined();
        expect(data.user.email).toBe("test@example.com");
        expect(data.masterProfile).toBeDefined();
        expect(data.preferences).toBeDefined();
        expect(data.applications).toHaveLength(1);
    });

    it("returns 401 when not authenticated", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(null);

        const request = new Request("http://localhost/api/account");
        const response = await GET(request);
        expect(response.status).toBe(401);
    });

    it("returns 404 when user not found in database", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

        const request = new Request("http://localhost/api/account");
        const response = await GET(request);
        expect(response.status).toBe(404);
    });
});

describe("DELETE /api/account (GDPR data deletion)", () => {
    it("deletes user and all associated data", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.user.delete).mockResolvedValue(mockUser as any);

        const request = new Request("http://localhost/api/account", { method: "DELETE" });
        const response = await DELETE(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.message).toContain("deleted successfully");
        expect(prisma.user.delete).toHaveBeenCalledWith({
            where: { id: "user_1" },
        });
    });

    it("returns 401 when not authenticated", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(null);

        const request = new Request("http://localhost/api/account", { method: "DELETE" });
        const response = await DELETE(request);
        expect(response.status).toBe(401);
    });
});
