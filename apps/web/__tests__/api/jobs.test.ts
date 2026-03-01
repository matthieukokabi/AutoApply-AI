import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/jobs/route";
import { prisma } from "@/lib/prisma";

const mockUser = {
    id: "user_1",
    clerkId: "clerk_test_user_123",
    email: "test@example.com",
    name: "Test User",
};

const mockJobs = [
    {
        id: "job_1",
        externalId: "ext_1",
        title: "Senior React Developer",
        company: "TechCorp",
        location: "Remote",
        description: "Build awesome apps",
        source: "adzuna",
        url: "https://example.com/job/1",
        salary: "$120k",
        fetchedAt: new Date(),
        applications: [
            {
                id: "app_1",
                compatibilityScore: 85,
                atsKeywords: ["React", "TypeScript"],
                status: "tailored",
                recommendation: "apply",
            },
        ],
    },
    {
        id: "job_2",
        externalId: "ext_2",
        title: "Backend Engineer",
        company: "DataInc",
        location: "Berlin",
        description: "API development",
        source: "remotive",
        url: "https://example.com/job/2",
        salary: null,
        fetchedAt: new Date(),
        applications: [
            {
                id: "app_2",
                compatibilityScore: 72,
                atsKeywords: ["Node.js", "PostgreSQL"],
                status: "discovered",
                recommendation: "stretch",
            },
        ],
    },
];

beforeEach(() => {
    vi.clearAllMocks();
});

describe("GET /api/jobs", () => {
    it("returns jobs for the authenticated user", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.job.findMany).mockResolvedValue(mockJobs as any);

        const request = new Request("http://localhost/api/jobs");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.jobs).toHaveLength(2);
        expect(data.jobs[0].application).toBeDefined();
        expect(data.jobs[0].application.compatibilityScore).toBe(85);
    });

    it("filters by source query param", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.job.findMany).mockResolvedValue([mockJobs[0]] as any);

        const request = new Request("http://localhost/api/jobs?source=adzuna");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(prisma.job.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    source: "adzuna",
                }),
            })
        );
    });

    it("returns 401 when not authenticated", async () => {
        const { auth } = await import("@clerk/nextjs");
        vi.mocked(auth).mockReturnValueOnce({ userId: null } as any);

        const request = new Request("http://localhost/api/jobs");
        const response = await GET(request);

        expect(response.status).toBe(401);
    });

    it("returns 404 when user not found in database", async () => {
        vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

        const request = new Request("http://localhost/api/jobs");
        const response = await GET(request);

        expect(response.status).toBe(404);
    });
});
