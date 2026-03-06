import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT } from "@/app/api/preferences/route";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const mockUser = {
    id: "user_1",
    clerkId: "clerk_test_user_123",
    email: "test@example.com",
};

const mockPreferences = {
    id: "pref_1",
    userId: "user_1",
    targetTitles: ["Frontend Engineer", "React Developer"],
    locations: ["London", "Remote"],
    remotePreference: "remote",
    salaryMin: 80000,
    salaryCurrency: "GBP",
    industries: ["Technology"],
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("GET /api/preferences", () => {
    it("returns preferences when they exist", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.jobPreferences.findUnique).mockResolvedValue(mockPreferences as any);

        const request = new Request("http://localhost/api/preferences");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.preferences.targetTitles).toContain("Frontend Engineer");
        expect(data.preferences.remotePreference).toBe("remote");
    });

    it("returns null when no preferences set", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.jobPreferences.findUnique).mockResolvedValue(null);

        const request = new Request("http://localhost/api/preferences");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.preferences).toBeNull();
    });

    it("returns 401 when not authenticated", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(null);

        const request = new Request("http://localhost/api/preferences");
        const response = await GET(request);
        expect(response.status).toBe(401);
    });
});

describe("PUT /api/preferences", () => {
    it("upserts preferences with valid data", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.jobPreferences.upsert).mockResolvedValue(mockPreferences as any);

        const request = new Request("http://localhost/api/preferences", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                targetTitles: ["Frontend Engineer"],
                locations: ["London"],
                remotePreference: "remote",
                salaryMin: "80000",
                salaryCurrency: "GBP",
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
