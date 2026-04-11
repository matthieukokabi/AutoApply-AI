import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/stats/route";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

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
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.application.count)
            .mockResolvedValueOnce(15 as any) // totalApplications
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
        vi.mocked(prisma.application.findMany).mockResolvedValue([
            {
                id: "app_discovered_1",
                status: "discovered",
                jobId: "job_discovered_1",
                tailoredCvMarkdown: null,
                coverLetterMarkdown: null,
                job: { externalId: "external_discovered_1" },
            },
            {
                id: "app_discovered_2",
                status: "discovered",
                jobId: "job_discovered_2",
                tailoredCvMarkdown: null,
                coverLetterMarkdown: null,
                job: { externalId: "external_discovered_2" },
            },
        ] as any);
        vi.mocked(prisma.workflowError.findMany).mockResolvedValue([
            {
                createdAt: new Date("2026-04-11T12:00:00.000Z"),
                message: "FACTUAL_GUARD_UNSUPPORTED_EMPLOYER",
                payload: {
                    applicationId: "app_discovered_1",
                    reasonCodes: ["FACTUAL_GUARD_UNSUPPORTED_EMPLOYER"],
                },
            },
        ] as any);

        const request = new Request("http://localhost/api/stats");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.totalApplications).toBe(15);
        expect(data.tailoredDocs).toBe(4);
        expect(data.pendingReview).toBe(4);
        expect(data.discoveredCount).toBe(5);
        expect(data.guardBlockedCount).toBe(1);
        expect(data.plainDiscoveredCount).toBe(4);
        expect(data.plainDiscoveredCount + data.guardBlockedCount).toBe(data.discoveredCount);
        expect(data.avgScore).toBe(79); // rounded
        expect(data.subscriptionStatus).toBe("pro");
        expect(data.creditsRemaining).toBe(42);
    });

    it("returns 401 when not authenticated", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(null);

        const request = new Request("http://localhost/api/stats");
        const response = await GET(request);
        expect(response.status).toBe(401);
    });
});
