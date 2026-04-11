import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/applications/route";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const mockUser = {
    id: "user_1",
    clerkId: "clerk_test_user_123",
    email: "test@example.com",
};

const mockApplications = [
    {
        id: "app_1",
        userId: "user_1",
        jobId: "job_1",
        status: "discovered",
        tailoredCvMarkdown: null,
        coverLetterMarkdown: null,
        compatibilityScore: 85,
        atsKeywords: ["React", "TypeScript"],
        matchingStrengths: ["Frontend experience"],
        gaps: [],
        recommendation: "apply",
        createdAt: new Date(),
        job: {
            id: "job_1",
            externalId: "external_job_1",
            title: "Frontend Engineer",
            company: "Acme Corp",
            location: "Remote",
        },
    },
    {
        id: "app_2",
        userId: "user_1",
        jobId: "job_2",
        status: "tailored",
        tailoredCvMarkdown: "# Tailored CV",
        coverLetterMarkdown: "# Cover Letter",
        compatibilityScore: 72,
        atsKeywords: ["Node.js"],
        matchingStrengths: ["Backend experience"],
        gaps: ["Go experience"],
        recommendation: "stretch",
        createdAt: new Date(),
        job: {
            id: "job_2",
            externalId: "external_job_2",
            title: "Backend Developer",
            company: "Tech Inc",
            location: "Berlin",
        },
    },
];

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.workflowError.findMany).mockResolvedValue([]);
});

describe("GET /api/applications", () => {
    it("returns all applications for authenticated user", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.application.findMany).mockResolvedValue(mockApplications as any);

        const request = new Request("http://localhost/api/applications");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.applications).toHaveLength(2);
        expect(data.applications[0].job.title).toBe("Frontend Engineer");
        expect(data.summary).toEqual(
            expect.objectContaining({
                totalCount: 2,
                tailoredCount: 1,
                discoveredCount: 1,
                plainDiscoveredCount: 1,
                guardBlockedCount: 0,
            })
        );
    });

    it("keeps legacy fallback linkage via externalId when applicationId is absent", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.application.findMany).mockResolvedValue(mockApplications as any);
        vi.mocked(prisma.workflowError.findMany).mockResolvedValue([
            {
                id: "err_external_fallback",
                createdAt: new Date("2026-04-11T12:00:00.000Z"),
                message: "FACTUAL_GUARD_UNSUPPORTED_EMPLOYER",
                payload: {
                    externalId: "external_job_1",
                    reasonCodes: ["FACTUAL_GUARD_UNSUPPORTED_EMPLOYER"],
                },
            },
        ] as any);

        const request = new Request("http://localhost/api/applications");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.applications[0].factualGuard).toEqual({
            blocked: true,
            reasonCodes: ["FACTUAL_GUARD_UNSUPPORTED_EMPLOYER"],
            blockedAt: "2026-04-11T12:00:00.000Z",
        });
        expect(data.applications[1].factualGuard).toBeNull();
        expect(data.summary).toEqual(
            expect.objectContaining({
                totalCount: 2,
                tailoredCount: 1,
                discoveredCount: 1,
                plainDiscoveredCount: 0,
                guardBlockedCount: 1,
            })
        );
        expect(data.summary.plainDiscoveredCount + data.summary.guardBlockedCount).toBe(
            data.summary.discoveredCount
        );
        expect(prisma.workflowError.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    userId: "user_1",
                    errorType: "FACTUAL_GUARD_BLOCKED",
                }),
            })
        );
        const workflowLookupCall = vi.mocked(prisma.workflowError.findMany).mock.calls[0]?.[0] as any;
        expect(workflowLookupCall.take).toBeUndefined();
        expect(workflowLookupCall.where.OR).toEqual(
            expect.arrayContaining([
                { payload: { path: ["applicationId"], equals: "app_1" } },
                { payload: { path: ["jobId"], equals: "job_1" } },
                { payload: { path: ["externalId"], equals: "external_job_1" } },
            ])
        );
    });

    it("prefers direct applicationId linkage over fallback correlation", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.application.findMany).mockResolvedValue(mockApplications as any);
        vi.mocked(prisma.workflowError.findMany).mockResolvedValue([
            {
                id: "err_external_newer",
                createdAt: new Date("2026-04-11T12:05:00.000Z"),
                message: "FACTUAL_GUARD_UNSUPPORTED_YEAR",
                payload: {
                    externalId: "external_job_1",
                    reasonCodes: ["FACTUAL_GUARD_UNSUPPORTED_YEAR"],
                },
            },
            {
                id: "err_application_linked",
                createdAt: new Date("2026-04-11T12:00:00.000Z"),
                message: "FACTUAL_GUARD_UNSUPPORTED_EMPLOYER",
                payload: {
                    applicationId: "app_1",
                    reasonCodes: ["FACTUAL_GUARD_UNSUPPORTED_EMPLOYER"],
                },
            },
        ] as any);

        const request = new Request("http://localhost/api/applications");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.applications[0].factualGuard).toEqual({
            blocked: true,
            reasonCodes: ["FACTUAL_GUARD_UNSUPPORTED_EMPLOYER"],
            blockedAt: "2026-04-11T12:00:00.000Z",
        });
        expect(data.summary).toEqual(
            expect.objectContaining({
                discoveredCount: 1,
                plainDiscoveredCount: 0,
                guardBlockedCount: 1,
            })
        );
    });

    it("surfaces older relevant fallback rows and ignores unrelated guard rows", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.application.findMany).mockResolvedValue(mockApplications as any);
        vi.mocked(prisma.workflowError.findMany).mockResolvedValue([
            {
                id: "err_unrelated_newer",
                createdAt: new Date("2026-04-11T12:10:00.000Z"),
                message: "FACTUAL_GUARD_UNSUPPORTED_EMPLOYER",
                payload: {
                    externalId: "external_job_unrelated",
                    reasonCodes: ["FACTUAL_GUARD_UNSUPPORTED_EMPLOYER"],
                },
            },
            {
                id: "err_relevant_older",
                createdAt: new Date("2025-01-15T10:00:00.000Z"),
                message: "FACTUAL_GUARD_UNSUPPORTED_CERTIFICATION",
                payload: {
                    jobId: "job_1",
                    reasonCodes: ["FACTUAL_GUARD_UNSUPPORTED_CERTIFICATION"],
                },
            },
        ] as any);

        const request = new Request("http://localhost/api/applications");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.applications[0].factualGuard).toEqual({
            blocked: true,
            reasonCodes: ["FACTUAL_GUARD_UNSUPPORTED_CERTIFICATION"],
            blockedAt: "2025-01-15T10:00:00.000Z",
        });
        expect(data.applications[1].factualGuard).toBeNull();
        expect(data.summary).toEqual(
            expect.objectContaining({
                totalCount: 2,
                tailoredCount: 1,
                discoveredCount: 1,
                plainDiscoveredCount: 0,
                guardBlockedCount: 1,
            })
        );
        expect(data.summary.plainDiscoveredCount + data.summary.guardBlockedCount).toBe(
            data.summary.discoveredCount
        );
    });

    it("filters by status when query param provided", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.application.findMany).mockResolvedValue([mockApplications[0]] as any);

        const request = new Request("http://localhost/api/applications?status=discovered");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(prisma.application.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ status: "discovered" }),
            })
        );
    });

    it("filters by jobId when query param provided", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.application.findMany).mockResolvedValue([mockApplications[0]] as any);

        const request = new Request("http://localhost/api/applications?jobId=job_1&limit=1");
        const response = await GET(request);

        expect(response.status).toBe(200);
        expect(prisma.application.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ jobId: "job_1" }),
                take: 1,
            })
        );
    });

    it("returns 400 for invalid status query param", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);

        const request = new Request("http://localhost/api/applications?status=invalid_status");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("Invalid status");
        expect(prisma.application.findMany).not.toHaveBeenCalled();
    });

    it("falls back to default limit when limit query param is invalid", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.application.findMany).mockResolvedValue(mockApplications as any);

        const request = new Request("http://localhost/api/applications?limit=not-a-number");
        const response = await GET(request);

        expect(response.status).toBe(200);
        expect(prisma.application.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                take: 100,
            })
        );
    });

    it("clamps limit query param to minimum of 1", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.application.findMany).mockResolvedValue(mockApplications as any);

        const request = new Request("http://localhost/api/applications?limit=0");
        const response = await GET(request);

        expect(response.status).toBe(200);
        expect(prisma.application.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                take: 1,
            })
        );
    });

    it("returns 401 when not authenticated", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(null);

        const request = new Request("http://localhost/api/applications");
        const response = await GET(request);
        expect(response.status).toBe(401);
    });
});
