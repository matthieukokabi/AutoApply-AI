import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/tailor/route";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { sendCreditsLowEmail } from "@/lib/email";

const mockUser = {
    id: "user_1",
    clerkId: "clerk_test_user_123",
    email: "test@example.com",
    name: "Test User",
    subscriptionStatus: "pro",
    creditsRemaining: 10,
    masterProfile: {
        id: "profile_1",
        rawText: "Experienced software engineer with 5 years of React and Node.js experience.",
        structuredJson: { skills: ["React", "Node.js"] },
    },
};

const mockJob = {
    id: "job_1",
    externalId: "manual-123",
    title: "Senior React Developer",
    company: "Tech Corp",
    description: "React developer needed with TypeScript experience.",
};

beforeEach(() => {
    vi.clearAllMocks();
    process.env.N8N_WEBHOOK_URL = "http://n8n:5678";
    process.env.N8N_WEBHOOK_SECRET = "test-webhook-secret";
    // Reset fetch mock
    vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
        text: async () => "",
    } as any);
});

describe("POST /api/tailor", () => {
    it("successfully triggers tailoring for authenticated user", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.job.upsert).mockResolvedValue(mockJob as any);
        vi.mocked(prisma.user.update).mockResolvedValue({
            ...mockUser,
            creditsRemaining: 9,
        } as any);

        const request = new Request("http://localhost/api/tailor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jobDescription: "Looking for a senior React developer with TypeScript experience.",
                jobTitle: "Senior React Developer",
                company: "Tech Corp",
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.message).toBe("Tailoring job started");
        expect(data.jobId).toBe("job_1");
    });

    it("returns 401 for unauthenticated user", async () => {
        vi.mocked(getAuthUser).mockResolvedValue(null);

        const request = new Request("http://localhost/api/tailor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobDescription: "test" }),
        });

        const response = await POST(request);
        expect(response.status).toBe(401);
    });

    it("returns 404 when user not found in database", async () => {
        vi.mocked(getAuthUser).mockResolvedValue({ id: "user_1" } as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

        const request = new Request("http://localhost/api/tailor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobDescription: "test" }),
        });

        const response = await POST(request);
        expect(response.status).toBe(404);
    });

    it("returns 503 when tailoring webhook URL is not configured", async () => {
        delete process.env.N8N_WEBHOOK_URL;

        vi.mocked(getAuthUser).mockResolvedValue({ id: "user_1" } as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);

        const request = new Request("http://localhost/api/tailor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobDescription: "test" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.error).toContain("unavailable");
        expect(prisma.job.upsert).not.toHaveBeenCalled();
        expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("returns 503 when tailoring webhook secret is not configured", async () => {
        delete process.env.N8N_WEBHOOK_SECRET;

        vi.mocked(getAuthUser).mockResolvedValue({ id: "user_1" } as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);

        const request = new Request("http://localhost/api/tailor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobDescription: "test" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.error).toContain("unavailable");
        expect(global.fetch).not.toHaveBeenCalled();
        expect(prisma.job.upsert).not.toHaveBeenCalled();
        expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("returns 503 when tailoring webhook URL is invalid", async () => {
        process.env.N8N_WEBHOOK_URL = "not-a-valid-url";

        vi.mocked(getAuthUser).mockResolvedValue({ id: "user_1" } as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);

        const request = new Request("http://localhost/api/tailor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobDescription: "test" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.error).toContain("unavailable");
        expect(global.fetch).not.toHaveBeenCalled();
        expect(prisma.job.upsert).not.toHaveBeenCalled();
        expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("returns 400 when no master profile exists", async () => {
        vi.mocked(getAuthUser).mockResolvedValue({ id: "user_1" } as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue({
            ...mockUser,
            masterProfile: null,
        } as any);

        const request = new Request("http://localhost/api/tailor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobDescription: "test" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("CV");
    });

    it("returns 403 when user has no credits remaining", async () => {
        vi.mocked(getAuthUser).mockResolvedValue({ id: "user_1" } as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue({
            ...mockUser,
            creditsRemaining: 0,
            subscriptionStatus: "free",
        } as any);

        const request = new Request("http://localhost/api/tailor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobDescription: "test" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toContain("credits");
    });

    it("allows unlimited users with 0 credits", async () => {
        vi.mocked(getAuthUser).mockResolvedValue({ id: "user_1" } as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue({
            ...mockUser,
            creditsRemaining: 0,
            subscriptionStatus: "unlimited",
        } as any);
        vi.mocked(prisma.job.upsert).mockResolvedValue(mockJob as any);

        const request = new Request("http://localhost/api/tailor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jobDescription: "Looking for a developer.",
            }),
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
        // Unlimited users should NOT have credits deducted
        expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("returns 400 when job description is missing", async () => {
        vi.mocked(getAuthUser).mockResolvedValue({ id: "user_1" } as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);

        const request = new Request("http://localhost/api/tailor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobTitle: "Developer" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("Job description");
    });

    it("accepts existing jobId without jobDescription when stored job has description", async () => {
        process.env.N8N_WEBHOOK_URL = "http://n8n:5678";

        vi.mocked(getAuthUser).mockResolvedValue({ id: "user_1" } as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.job.findUnique).mockResolvedValue(mockJob as any);
        vi.mocked(prisma.user.update).mockResolvedValue({
            ...mockUser,
            creditsRemaining: 9,
        } as any);

        const request = new Request("http://localhost/api/tailor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jobId: "job_1",
            }),
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
        expect(prisma.job.findUnique).toHaveBeenCalledWith({ where: { id: "job_1" } });

        const fetchCall = vi.mocked(global.fetch).mock.calls[0];
        const body = JSON.parse(fetchCall[1]?.body as string);
        expect(body.jobDescription).toBe(mockJob.description);

        delete process.env.N8N_WEBHOOK_URL;
    });

    it("returns 400 when existing job has no stored description and none is provided", async () => {
        vi.mocked(getAuthUser).mockResolvedValue({ id: "user_1" } as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.job.findUnique).mockResolvedValue({
            ...mockJob,
            description: "",
        } as any);

        const request = new Request("http://localhost/api/tailor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jobId: "job_1",
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("Job description");
    });

    it("deducts credit for non-unlimited users", async () => {
        vi.mocked(getAuthUser).mockResolvedValue({ id: "user_1" } as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.job.upsert).mockResolvedValue(mockJob as any);
        vi.mocked(prisma.user.update).mockResolvedValue({
            ...mockUser,
            creditsRemaining: 9,
        } as any);

        const request = new Request("http://localhost/api/tailor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobDescription: "Looking for a developer." }),
        });

        await POST(request);

        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: "user_1" },
            data: { creditsRemaining: { decrement: 1 } },
        });
    });

    it("sends credits-low email when credits drop to 1", async () => {
        vi.mocked(getAuthUser).mockResolvedValue({ id: "user_1" } as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue({
            ...mockUser,
            creditsRemaining: 2,
            subscriptionStatus: "pro",
        } as any);
        vi.mocked(prisma.job.upsert).mockResolvedValue(mockJob as any);
        vi.mocked(prisma.user.update).mockResolvedValue({
            ...mockUser,
            creditsRemaining: 1,
        } as any);

        const request = new Request("http://localhost/api/tailor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobDescription: "Looking for a developer." }),
        });

        await POST(request);

        expect(sendCreditsLowEmail).toHaveBeenCalledWith(
            "test@example.com",
            "Test User",
            1
        );
    });

    it("returns 502 and does not deduct credits when webhook dispatch fails", async () => {
        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: false,
            text: async () => "upstream error",
        } as any);
        vi.mocked(getAuthUser).mockResolvedValue({ id: "user_1" } as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.job.upsert).mockResolvedValue(mockJob as any);

        const request = new Request("http://localhost/api/tailor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobDescription: "Looking for a developer." }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(502);
        expect(data.error).toContain("dispatch failed");
        expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("triggers n8n webhook with correct payload", async () => {
        vi.mocked(getAuthUser).mockResolvedValue({ id: "user_1" } as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.job.upsert).mockResolvedValue(mockJob as any);
        vi.mocked(prisma.user.update).mockResolvedValue({
            ...mockUser,
            creditsRemaining: 9,
        } as any);

        const request = new Request("http://localhost/api/tailor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jobDescription: "React developer needed.",
                jobTitle: "React Developer",
            }),
        });

        await POST(request);

        expect(global.fetch).toHaveBeenCalledWith(
            "http://n8n:5678/webhook/single-job-tailor-v3",
            expect.objectContaining({
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-webhook-secret": "test-webhook-secret",
                },
            })
        );

        // Verify the payload includes required fields
        const fetchCall = vi.mocked(global.fetch).mock.calls[0];
        const body = JSON.parse(fetchCall[1]?.body as string);
        expect(body.userId).toBe("user_1");
        expect(body.jobId).toBe("job_1");
        expect(body.jobDescription).toBe("React developer needed.");
        expect(body.masterCvText).toBeDefined();
    });

    it("preserves configured webhook base path when dispatching to n8n", async () => {
        process.env.N8N_WEBHOOK_URL = "http://n8n:5678/custom-base";

        vi.mocked(getAuthUser).mockResolvedValue({ id: "user_1" } as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.job.upsert).mockResolvedValue(mockJob as any);
        vi.mocked(prisma.user.update).mockResolvedValue({
            ...mockUser,
            creditsRemaining: 9,
        } as any);

        const request = new Request("http://localhost/api/tailor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jobDescription: "React developer needed.",
            }),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(global.fetch).toHaveBeenCalledWith(
            "http://n8n:5678/custom-base/webhook/single-job-tailor-v3",
            expect.anything()
        );
    });

    it("returns 400 when job URL is invalid", async () => {
        vi.mocked(getAuthUser).mockResolvedValue({ id: "user_1" } as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);

        const request = new Request("http://localhost/api/tailor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jobDescription: "Valid description",
                jobUrl: "javascript:alert(1)",
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("Job URL");
        expect(prisma.job.upsert).not.toHaveBeenCalled();
    });

    it("stores source as linkedin when tailoring from a LinkedIn job URL", async () => {
        vi.mocked(getAuthUser).mockResolvedValue({ id: "user_1" } as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.job.upsert).mockResolvedValue(mockJob as any);
        vi.mocked(prisma.user.update).mockResolvedValue({
            ...mockUser,
            creditsRemaining: 9,
        } as any);

        const request = new Request("http://localhost/api/tailor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jobDescription: "LinkedIn opportunity description",
                jobUrl: "https://www.linkedin.com/jobs/view/1234567890/",
            }),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(prisma.job.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                create: expect.objectContaining({
                    source: "linkedin",
                }),
            })
        );
    });

    it("returns 400 when job description exceeds the max length", async () => {
        vi.mocked(getAuthUser).mockResolvedValue({ id: "user_1" } as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);

        const request = new Request("http://localhost/api/tailor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jobDescription: "x".repeat(12001),
            }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("exceed");
        expect(prisma.job.upsert).not.toHaveBeenCalled();
    });

    it("returns 429 when one IP exceeds tailoring request limits", async () => {
        const headers = {
            "Content-Type": "application/json",
            "x-forwarded-for": "198.51.100.77",
        };

        vi.mocked(getAuthUser).mockResolvedValue({ id: "user_1" } as any);
        vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
        vi.mocked(prisma.job.upsert).mockResolvedValue(mockJob as any);
        vi.mocked(prisma.user.update).mockResolvedValue({
            ...mockUser,
            creditsRemaining: 9,
        } as any);

        for (let i = 0; i < 8; i += 1) {
            const response = await POST(
                new Request("http://localhost/api/tailor", {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        jobDescription: `Looking for a developer ${i}`,
                        jobTitle: "Developer",
                    }),
                })
            );
            expect(response.status).toBe(200);
        }

        const limitedResponse = await POST(
            new Request("http://localhost/api/tailor", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    jobDescription: "This should be rate limited",
                    jobTitle: "Developer",
                }),
            })
        );
        const data = await limitedResponse.json();

        expect(limitedResponse.status).toBe(429);
        expect(data.error).toContain("Too many tailoring requests");
        expect(global.fetch).toHaveBeenCalledTimes(8);
    });
});
