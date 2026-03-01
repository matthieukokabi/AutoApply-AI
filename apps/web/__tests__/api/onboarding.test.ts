import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/onboarding/route";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const mockUser = {
    id: "user_1",
    clerkId: "clerk_test_user_123",
    email: "test@example.com",
    name: "Test User",
    subscriptionStatus: "free",
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("GET /api/onboarding", () => {
    it("returns needsOnboarding=true when no profile exists", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.masterProfile.findUnique).mockResolvedValue(null);
        vi.mocked(prisma.jobPreferences.findUnique).mockResolvedValue(null);

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.needsOnboarding).toBe(true);
        expect(data.needsPreferences).toBe(true);
        expect(data.user.email).toBe("test@example.com");
    });

    it("returns needsOnboarding=false when profile has rawText", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.masterProfile.findUnique).mockResolvedValue({
            id: "profile_1",
            userId: "user_1",
            rawText: "My CV content here",
            structuredJson: {},
        } as any);
        vi.mocked(prisma.jobPreferences.findUnique).mockResolvedValue({
            id: "pref_1",
            userId: "user_1",
            targetTitles: ["Software Engineer"],
            locations: ["Remote"],
        } as any);

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.needsOnboarding).toBe(false);
        expect(data.needsPreferences).toBe(false);
    });

    it("returns needsOnboarding=true when profile exists but rawText is empty", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.masterProfile.findUnique).mockResolvedValue({
            id: "profile_1",
            userId: "user_1",
            rawText: "",
            structuredJson: {},
        } as any);
        vi.mocked(prisma.jobPreferences.findUnique).mockResolvedValue(null);

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.needsOnboarding).toBe(true);
    });

    it("returns 401 when not authenticated", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(null);

        const response = await GET();
        expect(response.status).toBe(401);
    });
});
