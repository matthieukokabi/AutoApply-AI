import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT } from "@/app/api/preferences/route";
import { prisma } from "@/lib/prisma";

const mockPreferences = {
    id: "pref_1",
    userId: "user_1",
    targetTitles: ["Frontend Engineer", "React Developer"],
    locations: ["London", "Remote"],
    remotePreference: "remote",
    salaryMin: 80000,
    industries: ["Technology"],
};

const mockUserWithPrefs = {
    id: "user_1",
    clerkId: "clerk_test_user_123",
    email: "test@example.com",
    preferences: mockPreferences,
};

const mockUserNoPrefs = {
    id: "user_1",
    clerkId: "clerk_test_user_123",
    email: "test@example.com",
    preferences: null,
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("GET /api/preferences", () => {
    it("returns preferences when they exist", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUserWithPrefs as any);

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.preferences.targetTitles).toContain("Frontend Engineer");
        expect(data.preferences.remotePreference).toBe("remote");
    });

    it("returns null when no preferences set", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUserNoPrefs as any);

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.preferences).toBeNull();
    });
});

describe("PUT /api/preferences", () => {
    it("upserts preferences with valid data", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUserNoPrefs as any);
        vi.mocked(prisma.jobPreferences.upsert).mockResolvedValue(mockPreferences as any);

        const request = new Request("http://localhost/api/preferences", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                targetTitles: ["Frontend Engineer"],
                locations: ["London"],
                remotePreference: "remote",
                salaryMin: "80000",
                industries: ["Technology"],
            }),
        });

        const response = await PUT(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.preferences).toBeDefined();
        expect(prisma.jobPreferences.upsert).toHaveBeenCalled();
    });
});
