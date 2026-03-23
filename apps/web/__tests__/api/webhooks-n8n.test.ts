import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/webhooks/n8n/route";
import { prisma } from "@/lib/prisma";
import { sendJobMatchEmail, sendTailoringCompleteEmail, sendCreditsLowEmail } from "@/lib/email";

const mockUser = {
    id: "user_1",
    email: "test@example.com",
    name: "Test User",
    subscriptionStatus: "pro",
    creditsRemaining: 10,
};

const mockJob = {
    id: "job_1",
    title: "Senior Developer",
    company: "Tech Corp",
};

const mockApplication = {
    id: "app_1",
    userId: "user_1",
    jobId: "job_1",
    compatibilityScore: 85,
    status: "tailored",
    job: mockJob,
};

beforeEach(() => {
    vi.clearAllMocks();
    process.env.N8N_WEBHOOK_SECRET = "test_webhook_secret";
});

function createWebhookRequest(type: string, data?: any) {
    return new Request("http://localhost/api/webhooks/n8n", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-webhook-secret": "test_webhook_secret",
        },
        body: JSON.stringify(
            data === undefined
                ? { type }
                : { type, data }
        ),
    });
}

function createRawWebhookRequest(body: unknown, secret = "test_webhook_secret") {
    return new Request("http://localhost/api/webhooks/n8n", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-webhook-secret": secret,
        },
        body: JSON.stringify(body),
    });
}

describe("POST /api/webhooks/n8n", () => {
    it("returns 503 when webhook secret is not configured", async () => {
        delete process.env.N8N_WEBHOOK_SECRET;

        const request = new Request("http://localhost/api/webhooks/n8n", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "new_applications", data: { userId: "user_1", applications: [] } }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.error).toContain("misconfigured");
    });

    it("returns 401 for missing webhook secret", async () => {
        const request = new Request("http://localhost/api/webhooks/n8n", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "test", data: {} }),
        });

        const response = await POST(request);
        expect(response.status).toBe(401);
    });

    it("returns 401 for invalid webhook secret", async () => {
        const request = new Request("http://localhost/api/webhooks/n8n", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-webhook-secret": "wrong_secret",
            },
            body: JSON.stringify({ type: "test", data: {} }),
        });

        const response = await POST(request);
        expect(response.status).toBe(401);
    });

    it("accepts webhook secret with surrounding whitespace", async () => {
        vi.mocked(prisma.$queryRawUnsafe).mockResolvedValue([]);
        vi.mocked(prisma.user.findMany).mockResolvedValue([] as any);

        const request = createRawWebhookRequest(
            { type: "fetch_active_users" },
            "  test_webhook_secret  "
        );
        const response = await POST(request);

        expect(response.status).toBe(200);
    });

    it("returns 400 for unknown webhook type", async () => {
        const request = createWebhookRequest("unknown_type", {});
        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("Unknown webhook type");
    });

    it("returns 400 for invalid webhook payload envelope", async () => {
        const request = new Request("http://localhost/api/webhooks/n8n", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-webhook-secret": "test_webhook_secret",
            },
            body: JSON.stringify({ type: "new_applications", data: null }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("Invalid webhook payload");
    });

    describe("fetch_active_users", () => {
        it("accepts stringified JSON payloads from n8n expression bodies", async () => {
            vi.mocked(prisma.$queryRawUnsafe).mockResolvedValue([]);
            vi.mocked(prisma.user.findMany).mockResolvedValue([] as any);

            const request = createRawWebhookRequest(
                JSON.stringify({
                    type: "fetch_active_users",
                    runId: "n8n-string-payload",
                })
            );
            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.throttled).toBe(false);
            expect(data.users).toEqual([]);
        });

        it("accepts fetch_active_users payload without data envelope", async () => {
            vi.mocked(prisma.$queryRawUnsafe).mockResolvedValue([]);
            vi.mocked(prisma.user.findMany).mockResolvedValue([] as any);

            const request = createWebhookRequest("fetch_active_users");
            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.throttled).toBe(false);
            expect(data.users).toEqual([]);
        });

        it("returns users when cadence window is open", async () => {
            vi.mocked(prisma.$queryRawUnsafe).mockResolvedValue([]);
            vi.mocked(prisma.user.findMany).mockResolvedValue([
                {
                    id: "user_1",
                    email: "test@example.com",
                    name: "Test User",
                    subscriptionStatus: "pro",
                    creditsRemaining: 10,
                    masterProfile: { rawText: "CV TEXT" },
                    preferences: {
                        targetTitles: ["IT Operations Manager"],
                        locations: ["Zurich"],
                        remotePreference: "hybrid",
                        salaryMin: 100000,
                        industries: ["SaaS"],
                    },
                },
            ] as any);

            const request = createWebhookRequest("fetch_active_users", {});
            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.throttled).toBe(false);
            expect(Array.isArray(data.users)).toBe(true);
            expect(data.users).toHaveLength(1);
            expect(data.users[0]).toMatchObject({
                id: "user_1",
                email: "test@example.com",
                masterCvText: "CV TEXT",
            });
        });

        it("still returns eligible users when cadence window is throttled", async () => {
            vi.mocked(prisma.$queryRawUnsafe).mockResolvedValue([
                { startedAt: new Date() },
            ] as any);
            vi.mocked(prisma.user.findMany).mockResolvedValue([
                {
                    id: "user_1",
                    email: "test@example.com",
                    name: "Test User",
                    subscriptionStatus: "pro",
                    creditsRemaining: 10,
                    masterProfile: { rawText: "CV TEXT" },
                    preferences: {
                        targetTitles: ["IT Operations Manager"],
                        locations: ["Zurich"],
                        remotePreference: "hybrid",
                        salaryMin: 100000,
                        industries: ["SaaS"],
                    },
                },
            ] as any);

            const request = createWebhookRequest("fetch_active_users", {});
            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.throttled).toBe(true);
            expect(Array.isArray(data.users)).toBe(true);
            expect(data.users).toHaveLength(1);
            expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
        });
    });

    describe("fetch_jobs_for_user", () => {
        it("returns 400 for invalid payload", async () => {
            const request = createWebhookRequest("fetch_jobs_for_user", {
                user: null,
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain("Invalid fetch_jobs_for_user payload");
        });

        it("accepts stringified data payload envelope", async () => {
            vi.mocked(global.fetch).mockImplementation(async () => {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        results: [],
                        jobs: [],
                        data: [],
                    }),
                    text: async () => "",
                } as Response;
            });

            const request = createRawWebhookRequest({
                type: "fetch_jobs_for_user",
                data: JSON.stringify({
                    user: {
                        userId: "user_1",
                        targetTitles: ["IT Operations Manager"],
                        locations: ["Zurich"],
                        remotePreference: "hybrid",
                        masterCvText: "CV content",
                        subscriptionStatus: "pro",
                        creditsRemaining: 12,
                    },
                    sourceConfig: {
                        adzunaAppId: "",
                        adzunaAppKey: "",
                        jsearchApiKey: "",
                        joobleApiKey: "",
                        reedApiKey: "",
                    },
                }),
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(Array.isArray(data.jobs)).toBe(true);
        });

        it("returns normalized jobs and connector health", async () => {
            vi.mocked(global.fetch).mockImplementation(async (input: RequestInfo | URL) => {
                const url = String(input);

                if (url.includes("themuse.com")) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({
                            results: [
                                {
                                    id: "muse_1",
                                    name: "IT Operations Manager",
                                    company: { name: "Muse Corp" },
                                    locations: [{ name: "Zurich" }],
                                    contents:
                                        "<p>Role with architecture and operations scope.</p>".repeat(
                                            4
                                        ),
                                    refs: { landing_page: "https://example.com/jobs/1" },
                                    publication_date: "2026-03-20T10:00:00Z",
                                },
                            ],
                        }),
                        text: async () => "",
                    } as Response;
                }

                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        results: [],
                        jobs: [],
                        data: [],
                    }),
                    text: async () => "",
                } as Response;
            });

            const request = createWebhookRequest("fetch_jobs_for_user", {
                user: {
                    userId: "user_1",
                    targetTitles: ["IT Operations Manager"],
                    locations: ["Zurich"],
                    remotePreference: "hybrid",
                    masterCvText: "CV content",
                    subscriptionStatus: "pro",
                    creditsRemaining: 12,
                },
                sourceConfig: {
                    adzunaAppId: "",
                    adzunaAppKey: "",
                    jsearchApiKey: "",
                    joobleApiKey: "",
                    reedApiKey: "",
                },
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(Array.isArray(data.jobs)).toBe(true);
            expect(data.jobs.length).toBe(1);
            expect(data.jobs[0]).toMatchObject({
                title: "IT Operations Manager",
                source: "themuse",
                userId: "user_1",
                subscriptionStatus: "pro",
            });

            expect(Array.isArray(data.connectors)).toBe(true);
            expect(data.connectors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        source: "themuse",
                        ok: true,
                        normalizedCount: 1,
                    }),
                    expect.objectContaining({
                        source: "adzuna",
                        ok: false,
                        error: "missing_adzuna_credentials",
                    }),
                    expect.objectContaining({
                        source: "reed",
                        ok: false,
                        error: "missing_reed_api_key",
                    }),
                ])
            );
        });
    });

    describe("new_applications", () => {
        it("returns 400 when applications payload is invalid", async () => {
            const request = createWebhookRequest("new_applications", {
                userId: "user_1",
                applications: "invalid",
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain("Invalid new_applications payload");
            expect(prisma.job.upsert).not.toHaveBeenCalled();
        });

        it("creates job and application from n8n payload", async () => {
            vi.mocked(prisma.job.upsert).mockResolvedValue(mockJob as any);
            vi.mocked(prisma.application.upsert).mockResolvedValue(mockApplication as any);
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

            const request = createWebhookRequest("new_applications", {
                userId: "user_1",
                applications: [
                    {
                        externalId: "adzuna-123",
                        title: "Senior Developer",
                        company: "Tech Corp",
                        location: "Berlin",
                        description: "Job description",
                        source: "adzuna",
                        url: "https://example.com/job",
                        compatibilityScore: 85,
                        atsKeywords: ["React", "TypeScript"],
                        matchingStrengths: ["Frontend experience"],
                        gaps: [],
                        recommendation: "apply",
                        tailoredCvMarkdown: "# CV Content",
                        coverLetterMarkdown: "# Cover Letter",
                    },
                ],
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.message).toContain("1 applications");

            // Job should be upserted first
            expect(prisma.job.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { externalId: "adzuna-123" },
                    create: expect.objectContaining({
                        title: "Senior Developer",
                        company: "Tech Corp",
                    }),
                })
            );

            // Then application with the job ID
            expect(prisma.application.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId_jobId: { userId: "user_1", jobId: "job_1" } },
                    create: expect.objectContaining({
                        userId: "user_1",
                        jobId: "job_1",
                        compatibilityScore: 85,
                        status: "tailored",
                    }),
                })
            );
        });

        it("uses a stable fallback externalId when n8n payload omits externalId", async () => {
            vi.mocked(prisma.job.upsert).mockResolvedValue(mockJob as any);
            vi.mocked(prisma.application.upsert).mockResolvedValue(mockApplication as any);
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

            const request = createWebhookRequest("new_applications", {
                userId: "user_1",
                applications: [
                    {
                        title: "Backend Engineer",
                        company: "Data Inc",
                        compatibilityScore: 72,
                    },
                    {
                        title: "Frontend Engineer",
                        company: "UI Corp",
                        compatibilityScore: 80,
                    },
                ],
            });

            const response = await POST(request);
            expect(response.status).toBe(200);

            const firstCall = vi.mocked(prisma.job.upsert).mock.calls[0][0];
            const secondCall = vi.mocked(prisma.job.upsert).mock.calls[1][0];

            const firstExternalId = firstCall.where.externalId as string;
            const secondExternalId = secondCall.where.externalId as string;

            expect(firstExternalId).toMatch(/^manual-user_1-/);
            expect(firstCall.create.externalId).toBe(firstExternalId);
            expect(secondCall.create.externalId).toBe(secondExternalId);
            expect(firstExternalId).not.toBe(secondExternalId);
        });

        it("sends job match email notification", async () => {
            vi.mocked(prisma.job.upsert).mockResolvedValue(mockJob as any);
            vi.mocked(prisma.application.upsert).mockResolvedValue(mockApplication as any);
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

            const request = createWebhookRequest("new_applications", {
                userId: "user_1",
                applications: [
                    {
                        externalId: "adzuna-123",
                        title: "Senior Developer",
                        company: "Tech Corp",
                        compatibilityScore: 85,
                    },
                ],
            });

            await POST(request);

            expect(sendJobMatchEmail).toHaveBeenCalledWith(
                "test@example.com",
                "Test User",
                expect.arrayContaining([
                    expect.objectContaining({
                        title: "Senior Developer",
                        company: "Tech Corp",
                        score: 85,
                    }),
                ])
            );
        });

        it("sends credits-low email when credits are low", async () => {
            vi.mocked(prisma.job.upsert).mockResolvedValue(mockJob as any);
            vi.mocked(prisma.application.upsert).mockResolvedValue(mockApplication as any);
            vi.mocked(prisma.user.findUnique).mockResolvedValue({
                ...mockUser,
                subscriptionStatus: "pro",
                creditsRemaining: 2,
            } as any);

            const request = createWebhookRequest("new_applications", {
                userId: "user_1",
                applications: [{ externalId: "adzuna-123", compatibilityScore: 85 }],
            });

            await POST(request);

            expect(sendCreditsLowEmail).toHaveBeenCalledWith(
                "test@example.com",
                "Test User",
                2
            );
        });

        it("does not send credits-low email for unlimited users", async () => {
            vi.mocked(prisma.job.upsert).mockResolvedValue(mockJob as any);
            vi.mocked(prisma.application.upsert).mockResolvedValue(mockApplication as any);
            vi.mocked(prisma.user.findUnique).mockResolvedValue({
                ...mockUser,
                subscriptionStatus: "unlimited",
                creditsRemaining: 1,
            } as any);

            const request = createWebhookRequest("new_applications", {
                userId: "user_1",
                applications: [{ externalId: "adzuna-123", compatibilityScore: 85 }],
            });

            await POST(request);

            expect(sendCreditsLowEmail).not.toHaveBeenCalled();
        });
    });

    describe("single_tailoring_complete", () => {
        it("returns 400 when required IDs are missing", async () => {
            const request = createWebhookRequest("single_tailoring_complete", {
                userId: "",
                jobId: "",
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain("Invalid single_tailoring_complete payload");
            expect(prisma.application.upsert).not.toHaveBeenCalled();
        });

        it("saves tailoring results and sends email", async () => {
            vi.mocked(prisma.application.upsert).mockResolvedValue({
                ...mockApplication,
                compatibilityScore: 92,
                tailoredCvMarkdown: "# Tailored CV",
                coverLetterMarkdown: "# Cover Letter",
            } as any);
            vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

            const request = createWebhookRequest("single_tailoring_complete", {
                userId: "user_1",
                jobId: "job_1",
                jobTitle: "Senior Developer",
                company: "Tech Corp",
                compatibilityScore: 92,
                atsKeywords: ["React", "TypeScript"],
                matchingStrengths: ["Frontend experience"],
                gaps: [],
                recommendation: "apply",
                tailoredCvMarkdown: "# Tailored CV",
                coverLetterMarkdown: "# Cover Letter",
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.message).toBe("Tailoring results saved");
            expect(data.applicationId).toBe("app_1");

            // Should upsert application with tailoring data
            expect(prisma.application.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId_jobId: { userId: "user_1", jobId: "job_1" } },
                    create: expect.objectContaining({
                        compatibilityScore: 92,
                        tailoredCvMarkdown: "# Tailored CV",
                        coverLetterMarkdown: "# Cover Letter",
                    }),
                })
            );

            // Should send email notification
            expect(sendTailoringCompleteEmail).toHaveBeenCalledWith(
                "test@example.com",
                "Test User",
                "Senior Developer",
                "Tech Corp",
                92,
                "app_1"
            );
        });
    });

    describe("workflow_error", () => {
        it("returns 400 when required workflow error fields are missing", async () => {
            const request = createWebhookRequest("workflow_error", {
                workflowId: "wf_1",
                nodeName: "LLM Scoring",
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.error).toContain("Invalid workflow_error payload");
            expect(prisma.workflowError.create).not.toHaveBeenCalled();
        });

        it("logs workflow error to database", async () => {
            vi.mocked(prisma.workflowError.create).mockResolvedValue({} as any);

            const request = createWebhookRequest("workflow_error", {
                workflowId: "wf_1",
                nodeName: "LLM Scoring",
                errorType: "timeout",
                message: "LLM request timed out after 30s",
                payload: { jobId: "job_1" },
                userId: "user_1",
            });

            const response = await POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.message).toBe("Error logged");

            expect(prisma.workflowError.create).toHaveBeenCalledWith({
                data: {
                    workflowId: "wf_1",
                    nodeName: "LLM Scoring",
                    errorType: "timeout",
                    message: "LLM request timed out after 30s",
                    payload: { jobId: "job_1" },
                    userId: "user_1",
                },
            });
        });
    });
});
