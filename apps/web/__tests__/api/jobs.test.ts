import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/jobs/route";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

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

const mockApplicationsSortedByMatch = [
    {
        id: "app_1",
        compatibilityScore: 91,
        atsKeywords: ["React", "TypeScript"],
        status: "tailored",
        recommendation: "apply",
        createdAt: new Date("2026-04-01T10:00:00.000Z"),
        job: {
            id: "job_1",
            externalId: "ext_1",
            title: "Senior React Developer",
            company: "TechCorp",
            location: "Remote",
            description: "Build awesome apps",
            source: "adzuna",
            url: "https://example.com/job/1",
            salary: "$120k",
            fetchedAt: new Date("2026-04-02T08:00:00.000Z"),
            postedAt: new Date("2026-04-01T08:00:00.000Z"),
        },
    },
    {
        id: "app_2",
        compatibilityScore: 76,
        atsKeywords: ["Node.js", "PostgreSQL"],
        status: "discovered",
        recommendation: "stretch",
        createdAt: new Date("2026-04-01T09:00:00.000Z"),
        job: {
            id: "job_2",
            externalId: "ext_2",
            title: "Backend Engineer",
            company: "DataInc",
            location: "Berlin",
            description: "API development",
            source: "remotive",
            url: "",
            salary: null,
            fetchedAt: new Date("2026-04-01T08:00:00.000Z"),
            postedAt: null,
        },
    },
];

beforeEach(() => {
    vi.clearAllMocks();
});

describe("GET /api/jobs", () => {
    it("returns jobs for the authenticated user", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.application.count).mockResolvedValue(2 as any);
        vi.mocked(prisma.job.findMany).mockResolvedValue(mockJobs as any);

        const request = new Request("http://localhost/api/jobs");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.jobs).toHaveLength(2);
        expect(data.hasAnyJobs).toBe(true);
        expect(data.jobs[0].application).toBeDefined();
        expect(data.jobs[0].application.compatibilityScore).toBe(85);
    });

    it("returns hasAnyJobs=false when user has no discovered jobs", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.application.count).mockResolvedValue(0 as any);
        vi.mocked(prisma.job.findMany).mockResolvedValue([] as any);

        const request = new Request("http://localhost/api/jobs");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.jobs).toEqual([]);
        expect(data.hasAnyJobs).toBe(false);
    });

    it("filters by source query param", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
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

    it("rejects invalid minScore query values", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);

        const request = new Request("http://localhost/api/jobs?minScore=invalid");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("Invalid minScore");
        expect(prisma.job.findMany).not.toHaveBeenCalled();
    });

    it("sorts server-side by highest match when sort=highest_match", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.application.findMany).mockResolvedValue(
            mockApplicationsSortedByMatch as any
        );

        const request = new Request("http://localhost/api/jobs?sort=highest_match");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(prisma.application.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: [{ compatibilityScore: "desc" }, { createdAt: "desc" }],
            })
        );
        expect(prisma.job.findMany).not.toHaveBeenCalled();
        expect(data.jobs).toHaveLength(2);
        expect(data.jobs[0].application.compatibilityScore).toBe(91);
        expect(data.jobs[1].application.compatibilityScore).toBe(76);
    });

    it("keeps source/search/minScore filters when sort=highest_match", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.application.findMany).mockResolvedValue(
            mockApplicationsSortedByMatch as any
        );

        const request = new Request(
            "http://localhost/api/jobs?sort=highest_match&source=adzuna&search=react&minScore=75"
        );
        const response = await GET(request);

        expect(response.status).toBe(200);
        expect(prisma.application.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    userId: "user_1",
                    compatibilityScore: { gte: 75 },
                    job: expect.objectContaining({
                        source: "adzuna",
                        OR: expect.any(Array),
                    }),
                }),
            })
        );
    });

    it("rejects invalid sort query values", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);

        const request = new Request("http://localhost/api/jobs?sort=top");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("Invalid sort");
        expect(prisma.job.findMany).not.toHaveBeenCalled();
        expect(prisma.application.findMany).not.toHaveBeenCalled();
    });

    it("falls back to default limit when limit query is invalid", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.job.findMany).mockResolvedValue(mockJobs as any);

        const request = new Request("http://localhost/api/jobs?limit=not-a-number");
        const response = await GET(request);

        expect(response.status).toBe(200);
        expect(prisma.job.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                take: 50,
            })
        );
    });

    it("clamps limit query param to minimum of 1", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.job.findMany).mockResolvedValue(mockJobs as any);

        const request = new Request("http://localhost/api/jobs?limit=0");
        const response = await GET(request);

        expect(response.status).toBe(200);
        expect(prisma.job.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                take: 1,
            })
        );
    });

    it("returns 401 when not authenticated", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(null);

        const request = new Request("http://localhost/api/jobs");
        const response = await GET(request);

        expect(response.status).toBe(401);
    });
});
