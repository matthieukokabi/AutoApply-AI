import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH } from "@/app/api/applications/[id]/route";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const mockUser = {
    id: "user_1",
    clerkId: "clerk_test_user_123",
    email: "test@example.com",
    name: "Test User",
};

const mockApplication = {
    id: "app_1",
    userId: "user_1",
    jobId: "job_1",
    compatibilityScore: 85,
    atsKeywords: ["React", "TypeScript"],
    matchingStrengths: ["5 years experience"],
    gaps: [],
    recommendation: "apply",
    status: "tailored",
    appliedAt: null,
    notes: null,
    tailoredCvMarkdown: "# CV",
    coverLetterMarkdown: "# Cover Letter",
    job: {
        id: "job_1",
        title: "Senior React Developer",
        company: "TechCorp",
        location: "Remote",
    },
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe("GET /api/applications/[id]", () => {
    it("returns a single application with job details", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.application.findFirst).mockResolvedValue(mockApplication as any);

        const request = new Request("http://localhost/api/applications/app_1");
        const params = { id: "app_1" };
        const response = await GET(request, { params });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.application.id).toBe("app_1");
        expect(data.application.job.title).toBe("Senior React Developer");
        expect(data.application.compatibilityScore).toBe(85);
    });

    it("returns 404 when application not found", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.application.findFirst).mockResolvedValue(null);

        const request = new Request("http://localhost/api/applications/nonexistent");
        const params = { id: "nonexistent" };
        const response = await GET(request, { params });

        expect(response.status).toBe(404);
    });

    it("returns 401 when not authenticated", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(null);

        const request = new Request("http://localhost/api/applications/app_1");
        const params = { id: "app_1" };
        const response = await GET(request, { params });

        expect(response.status).toBe(401);
    });
});

describe("PATCH /api/applications/[id]", () => {
    it("updates application status", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.application.findFirst).mockResolvedValue(mockApplication as any);
        vi.mocked(prisma.application.update).mockResolvedValue({
            ...mockApplication,
            status: "applied",
            appliedAt: new Date(),
        } as any);

        const request = new Request("http://localhost/api/applications/app_1", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "applied" }),
        });

        const params = { id: "app_1" };
        const response = await PATCH(request, { params });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.application.status).toBe("applied");
        expect(prisma.application.update).toHaveBeenCalled();
    });

    it("rejects invalid status", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.application.findFirst).mockResolvedValue(mockApplication as any);

        const request = new Request("http://localhost/api/applications/app_1", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "invalid_status" }),
        });

        const params = { id: "app_1" };
        const response = await PATCH(request, { params });

        expect(response.status).toBe(400);
    });

    it("rejects payloads without update fields", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.application.findFirst).mockResolvedValue(mockApplication as any);

        const request = new Request("http://localhost/api/applications/app_1", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });

        const params = { id: "app_1" };
        const response = await PATCH(request, { params });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("At least one");
        expect(prisma.application.update).not.toHaveBeenCalled();
    });

    it("rejects non-string notes payloads", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.application.findFirst).mockResolvedValue(mockApplication as any);

        const request = new Request("http://localhost/api/applications/app_1", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notes: { value: "nope" } }),
        });

        const params = { id: "app_1" };
        const response = await PATCH(request, { params });
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("notes must be");
        expect(prisma.application.update).not.toHaveBeenCalled();
    });

    it("updates notes without changing status", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.application.findFirst).mockResolvedValue(mockApplication as any);
        vi.mocked(prisma.application.update).mockResolvedValue({
            ...mockApplication,
            notes: "Great opportunity",
        } as any);

        const request = new Request("http://localhost/api/applications/app_1", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notes: "Great opportunity" }),
        });

        const params = { id: "app_1" };
        const response = await PATCH(request, { params });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.application.notes).toBe("Great opportunity");
    });

    it("updates tailored document markdown fields", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.application.findFirst).mockResolvedValue(mockApplication as any);
        vi.mocked(prisma.application.update).mockResolvedValue({
            ...mockApplication,
            tailoredCvMarkdown: "# Updated CV",
            coverLetterMarkdown: "# Updated Cover Letter",
        } as any);

        const request = new Request("http://localhost/api/applications/app_1", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                tailoredCvMarkdown: "# Updated CV",
                coverLetterMarkdown: "# Updated Cover Letter",
            }),
        });

        const params = { id: "app_1" };
        const response = await PATCH(request, { params });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.application.tailoredCvMarkdown).toBe("# Updated CV");
        expect(data.application.coverLetterMarkdown).toBe("# Updated Cover Letter");
        expect(prisma.application.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    tailoredCvMarkdown: "# Updated CV",
                    coverLetterMarkdown: "# Updated Cover Letter",
                }),
            })
        );
    });

    it("rejects invalid tailoredCvMarkdown payload type", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.application.findFirst).mockResolvedValue(mockApplication as any);

        const request = new Request("http://localhost/api/applications/app_1", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                tailoredCvMarkdown: { value: "invalid" },
            }),
        });

        const params = { id: "app_1" };
        const response = await PATCH(request, { params });
        expect(response.status).toBe(400);
    });

    it("returns 404 when application not found", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.application.findFirst).mockResolvedValue(null);

        const request = new Request("http://localhost/api/applications/nonexistent", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "applied" }),
        });

        const params = { id: "nonexistent" };
        const response = await PATCH(request, { params });

        expect(response.status).toBe(404);
    });
});
