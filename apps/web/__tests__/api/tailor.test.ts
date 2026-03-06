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
};

beforeEach(() => {
    vi.clearAllMocks();
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

    it("triggers n8n webhook with correct payload", async () => {
        process.env.N8N_WEBHOOK_URL = "http://n8n:5678";

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
            "http://n8n:5678/webhook/single-job-tailor",
            expect.objectContaining({
                method: "POST",
                headers: { "Content-Type": "application/json" },
            })
        );

        // Verify the payload includes required fields
        const fetchCall = vi.mocked(global.fetch).mock.calls[0];
        const body = JSON.parse(fetchCall[1]?.body as string);
        expect(body.userId).toBe("user_1");
        expect(body.jobId).toBe("job_1");
        expect(body.jobDescription).toBe("React developer needed.");
        expect(body.masterCvText).toBeDefined();

        delete process.env.N8N_WEBHOOK_URL;
    });
});
