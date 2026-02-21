import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/stats/route";
import { prisma } from "@/lib/prisma";

const mockUser = {
    id: "user_1",
    clerkId: "clerk_test_user_123",
    email: "test@example.com",
    subscriptionStatus: "pro",
    creditsRemaining: 42,
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("GET /api/stats", () => {
    it("returns dashboard stats for authenticated user", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.application.count)
            .mockResolvedValueOnce(15 as any) // totalApplications
            .mockResolvedValueOnce(10 as any) // tailoredDocs
            .mockResolvedValueOnce(3 as any); // monthlyUsage
        vi.mocked(prisma.application.aggregate).mockResolvedValue({
            _avg: { compatibilityScore: 78.5 },
        } as any);
        vi.mocked(prisma.application.groupBy).mockResolvedValue([
            { status: "discovered", _count: { id: 5 } },
            { status: "tailored", _count: { id: 4 } },
            { status: "applied", _count: { id: 3 } },
            { status: "interview", _count: { id: 2 } },
            { status: "offer", _count: { id: 1 } },
        ] as any);

        const response = await GET();
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.totalApplications).toBe(15);
        expect(data.tailoredDocs).toBe(10);
        expect(data.avgScore).toBe(79); // rounded
        expect(data.subscriptionStatus).toBe("pro");
        expect(data.creditsRemaining).toBe(42);
    });

    it("returns 404 when user not found", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

        const response = await GET();
        expect(response.status).toBe(404);
    });
});
