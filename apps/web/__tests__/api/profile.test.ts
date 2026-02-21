import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/profile/route";
import { prisma } from "@/lib/prisma";

const mockProfile = {
    id: "profile_1",
    userId: "user_1",
    rawText: "Experienced software engineer with 5 years...",
    structuredJson: {
        contact: { name: "Test", email: "test@example.com", phone: "", location: "" },
        summary: "Experienced software engineer",
        experience: [],
        education: [],
        skills: ["TypeScript", "React"],
    },
};

const mockUserWithProfile = {
    id: "user_1",
    clerkId: "clerk_test_user_123",
    email: "test@example.com",
    name: "Test User",
    masterProfile: mockProfile,
};

const mockUserNoProfile = {
    id: "user_1",
    clerkId: "clerk_test_user_123",
    email: "test@example.com",
    name: "Test User",
    masterProfile: null,
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("GET /api/profile", () => {
    it("returns profile when user and profile exist", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUserWithProfile as any);

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.profile).toBeDefined();
        expect(data.profile.rawText).toBe(mockProfile.rawText);
    });

    it("returns null profile when no profile exists", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUserNoProfile as any);

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.profile).toBeNull();
    });

    it("returns 404 when user not found", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

        const response = await GET();
        expect(response.status).toBe(404);
    });
});

describe("POST /api/profile", () => {
    it("upserts profile with valid data", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUserNoProfile as any);
        vi.mocked(prisma.masterProfile.upsert).mockResolvedValue(mockProfile as any);

        const request = new Request("http://localhost/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                rawText: "Updated CV content that is long enough to pass validation checks.",
                structuredJson: mockProfile.structuredJson,
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.profile).toBeDefined();
        expect(prisma.masterProfile.upsert).toHaveBeenCalled();
    });
});
