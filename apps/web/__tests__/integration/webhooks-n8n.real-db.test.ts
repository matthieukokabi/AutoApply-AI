import { describe, expect, it, vi } from "vitest";

const itRealDb = process.env.RUN_REAL_DB_INTEGRATION === "1" ? it : it.skip;

describe("POST /api/webhooks/n8n (real-db)", () => {
    itRealDb(
        "persists mixed clean/blocked batch outcomes and workflow error row",
        async () => {
            if (!process.env.DATABASE_URL) {
                throw new Error("DATABASE_URL is required for real-db integration test");
            }

            const webhookSecret = "test_webhook_secret_real_db";
            process.env.N8N_WEBHOOK_SECRET = webhookSecret;

            vi.unmock("@/lib/prisma");
            vi.resetModules();

            const { POST } = await import("@/app/api/webhooks/n8n/route");
            const { prisma } = await import("@/lib/prisma");

            const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
            const runSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const externalPrefix = `it-mixed-batch-${runSuffix}`;
            const cleanExternalId = `${externalPrefix}-clean`;
            const blockedExternalId = `${externalPrefix}-blocked`;
            const userEmail = `integration+webhooks-${runSuffix}@example.com`;
            const clerkId = `integration-clerk-${runSuffix}`;

            let userId: string | null = null;
            try {
                const user = await prisma.user.create({
                    data: {
                        email: userEmail,
                        clerkId,
                        name: "Integration Test User",
                        automationEnabled: true,
                        subscriptionStatus: "pro",
                        creditsRemaining: 10,
                    },
                    select: { id: true },
                });
                userId = user.id;

                await prisma.masterProfile.create({
                    data: {
                        userId,
                        rawText: `Jane Doe
Senior Developer
Experience at Tech Corp (2021-2024)
Skills: React, TypeScript, Node.js, AWS
Education: Bachelor of Computer Science`,
                        structuredJson: {
                            skills: ["React", "TypeScript", "Node.js", "AWS"],
                            certifications: ["AWS Certified Cloud Practitioner"],
                            experience: ["Senior Developer at Tech Corp"],
                        },
                    },
                });

                const request = new Request("http://localhost/api/webhooks/n8n", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-webhook-secret": webhookSecret,
                    },
                    body: JSON.stringify({
                        type: "new_applications",
                        data: {
                            userId,
                            applications: [
                                {
                                    externalId: cleanExternalId,
                                    title: "Senior Developer",
                                    company: "Tech Corp",
                                    compatibilityScore: 90,
                                    additionalContext:
                                        "Verified candidate context: Kubernetes operations and Rust services ownership since 2024.",
                                    tailoredCvMarkdown: `# Jane Doe
## Experience
### Senior Developer at Tech Corp
**2024 - Present**
- Operated Kubernetes workloads and shipped Rust backend services.`,
                                    coverLetterMarkdown:
                                        "My Kubernetes and Rust experience directly matches your platform team needs.",
                                },
                                {
                                    externalId: blockedExternalId,
                                    title: "Senior Developer",
                                    company: "Tech Corp",
                                    compatibilityScore: 88,
                                    tailoredCvMarkdown: `# Jane Doe
## Experience
### Principal Engineer at Moonshot Labs
**2030 - Present**
- Led enterprise platform delivery with Kubernetes and Rust.`,
                                    coverLetterMarkdown:
                                        "I recently completed an Executive MBA and led Moonshot Labs cloud migration programs.",
                                },
                            ],
                        },
                    }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(200);
                expect(data.message).toContain("2 applications");

                const jobs = await prisma.job.findMany({
                    where: {
                        externalId: {
                            in: [cleanExternalId, blockedExternalId],
                        },
                    },
                    select: {
                        id: true,
                        externalId: true,
                    },
                });

                expect(jobs).toHaveLength(2);
                const cleanJob = jobs.find((job) => job.externalId === cleanExternalId);
                const blockedJob = jobs.find((job) => job.externalId === blockedExternalId);
                expect(cleanJob).toBeTruthy();
                expect(blockedJob).toBeTruthy();

                const cleanApplication = await prisma.application.findUnique({
                    where: {
                        userId_jobId: {
                            userId,
                            jobId: cleanJob!.id,
                        },
                    },
                    select: {
                        status: true,
                        tailoredCvMarkdown: true,
                        coverLetterMarkdown: true,
                    },
                });
                const blockedApplication = await prisma.application.findUnique({
                    where: {
                        userId_jobId: {
                            userId,
                            jobId: blockedJob!.id,
                        },
                    },
                    select: {
                        status: true,
                        tailoredCvMarkdown: true,
                        coverLetterMarkdown: true,
                    },
                });

                expect(cleanApplication?.status).toBe("tailored");
                expect(cleanApplication?.tailoredCvMarkdown).toEqual(expect.any(String));
                expect(cleanApplication?.coverLetterMarkdown).toEqual(expect.any(String));
                expect(blockedApplication?.status).toBe("discovered");
                expect(blockedApplication?.tailoredCvMarkdown).toBeNull();
                expect(blockedApplication?.coverLetterMarkdown).toBeNull();

                const workflowErrors = await prisma.workflowError.findMany({
                    where: {
                        userId,
                        errorType: "FACTUAL_GUARD_BLOCKED",
                    },
                    orderBy: { createdAt: "asc" },
                    select: {
                        errorType: true,
                        payload: true,
                    },
                });

                expect(workflowErrors).toHaveLength(1);
                expect(workflowErrors[0]?.errorType).toBe("FACTUAL_GUARD_BLOCKED");
                const payload = (workflowErrors[0]?.payload || {}) as Record<string, unknown>;
                const reasonCodes = Array.isArray(payload.reasonCodes)
                    ? (payload.reasonCodes as string[])
                    : [];
                expect(reasonCodes).toEqual(
                    expect.arrayContaining(["FACTUAL_GUARD_UNSUPPORTED_EMPLOYER"])
                );

                const persistedEvent = infoSpy.mock.calls
                    .map((call) => {
                        const raw = call[0];
                        if (typeof raw !== "string") {
                            return null;
                        }
                        try {
                            return JSON.parse(raw) as Record<string, unknown>;
                        } catch {
                            return null;
                        }
                    })
                    .find((entry) => entry?.event === "new_applications_persisted");

                expect(persistedEvent).toEqual(
                    expect.objectContaining({
                        persistedCount: 2,
                        tailoredCount: 1,
                        discoveredCount: 1,
                        quarantinedCount: 1,
                    })
                );
            } finally {
                infoSpy.mockRestore();
                if (userId) {
                    await prisma.workflowError.deleteMany({ where: { userId } });
                    await prisma.user.deleteMany({ where: { id: userId } });
                }
                await prisma.job.deleteMany({
                    where: {
                        externalId: {
                            startsWith: externalPrefix,
                        },
                    },
                });
                await prisma.$disconnect();
            }
        },
        45_000
    );
});
