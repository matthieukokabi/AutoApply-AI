import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/profile/route";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const mockUser = {
    id: "user_1",
    clerkId: "clerk_test_user_123",
    email: "test@example.com",
    name: "Test User",
};

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

beforeEach(() => {
    vi.clearAllMocks();
});

describe("GET /api/profile", () => {
    it("returns profile when user and profile exist", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.masterProfile.findUnique).mockResolvedValue(mockProfile as any);

        const request = new Request("http://localhost/api/profile");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.profile).toBeDefined();
        expect(data.profile.rawText).toBe(mockProfile.rawText);
    });

    it("returns null profile when no profile exists", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.masterProfile.findUnique).mockResolvedValue(null);

        const request = new Request("http://localhost/api/profile");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.profile).toBeNull();
    });

    it("returns 401 when not authenticated", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(null);

        const request = new Request("http://localhost/api/profile");
        const response = await GET(request);
        expect(response.status).toBe(401);
    });
});

describe("POST /api/profile", () => {
    it("upserts profile with valid data", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
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

    it("returns 400 when structuredJson is missing", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);

        const request = new Request("http://localhost/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                rawText: "Valid raw text",
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("required");
        expect(prisma.masterProfile.upsert).not.toHaveBeenCalled();
    });

    it("returns 400 when rawText exceeds max length", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);

        const request = new Request("http://localhost/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                rawText: "a".repeat(150001),
                structuredJson: mockProfile.structuredJson,
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("maximum length");
        expect(prisma.masterProfile.upsert).not.toHaveBeenCalled();
    });

    it("returns 400 when structuredJson payload is too large", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);

        const request = new Request("http://localhost/api/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                rawText: "Valid raw text",
                structuredJson: { blob: "x".repeat(500001) },
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("too large");
        expect(prisma.masterProfile.upsert).not.toHaveBeenCalled();
    });
});
