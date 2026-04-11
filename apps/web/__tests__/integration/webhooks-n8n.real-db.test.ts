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

    itRealDb(
        "surfaces older relevant guard events under noisy FACTUAL_GUARD_BLOCKED history",
        async () => {
            if (!process.env.DATABASE_URL) {
                throw new Error("DATABASE_URL is required for real-db integration test");
            }

            vi.unmock("@/lib/prisma");
            vi.resetModules();

            const { prisma } = await import("@/lib/prisma");
            const {
                getFactualGuardByApplicationId,
                summarizeApplicationStates,
            } = await import("@/lib/factual-guard-visibility");

            const runSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const externalPrefix = `it-guard-noisy-${runSuffix}`;
            const userEmail = `integration+guard-noisy-${runSuffix}@example.com`;
            const noiseUserEmail = `integration+guard-noisy-other-${runSuffix}@example.com`;
            const clerkId = `integration-guard-noisy-${runSuffix}`;
            const noiseClerkId = `integration-guard-noisy-other-${runSuffix}`;

            let userId: string | null = null;
            let noiseUserId: string | null = null;
            try {
                const [user, noiseUser] = await Promise.all([
                    prisma.user.create({
                        data: {
                            email: userEmail,
                            clerkId,
                            name: "Integration Guard User",
                            automationEnabled: true,
                            subscriptionStatus: "pro",
                            creditsRemaining: 10,
                        },
                        select: { id: true },
                    }),
                    prisma.user.create({
                        data: {
                            email: noiseUserEmail,
                            clerkId: noiseClerkId,
                            name: "Integration Guard Noise User",
                            automationEnabled: true,
                            subscriptionStatus: "pro",
                            creditsRemaining: 10,
                        },
                        select: { id: true },
                    }),
                ]);
                userId = user.id;
                noiseUserId = noiseUser.id;

                const [targetJob, plainDiscoveredJob, tailoredJob] = await Promise.all([
                    prisma.job.create({
                        data: {
                            externalId: `${externalPrefix}-target`,
                            title: "Target Role",
                            company: "Target Corp",
                            location: "Remote",
                            description: "Target role description",
                            source: "manual",
                            url: "https://example.com/target",
                        },
                        select: { id: true, externalId: true },
                    }),
                    prisma.job.create({
                        data: {
                            externalId: `${externalPrefix}-plain`,
                            title: "Plain Discovered Role",
                            company: "Plain Corp",
                            location: "Remote",
                            description: "Plain role description",
                            source: "manual",
                            url: "https://example.com/plain",
                        },
                        select: { id: true, externalId: true },
                    }),
                    prisma.job.create({
                        data: {
                            externalId: `${externalPrefix}-tailored`,
                            title: "Tailored Role",
                            company: "Tailored Corp",
                            location: "Remote",
                            description: "Tailored role description",
                            source: "manual",
                            url: "https://example.com/tailored",
                        },
                        select: { id: true, externalId: true },
                    }),
                ]);

                await prisma.application.createMany({
                    data: [
                        {
                            userId,
                            jobId: targetJob.id,
                            compatibilityScore: 86,
                            status: "discovered",
                            tailoredCvMarkdown: null,
                            coverLetterMarkdown: null,
                        },
                        {
                            userId,
                            jobId: plainDiscoveredJob.id,
                            compatibilityScore: 72,
                            status: "discovered",
                            tailoredCvMarkdown: null,
                            coverLetterMarkdown: null,
                        },
                        {
                            userId,
                            jobId: tailoredJob.id,
                            compatibilityScore: 91,
                            status: "tailored",
                            tailoredCvMarkdown: "# Tailored content",
                            coverLetterMarkdown: "# Cover letter content",
                        },
                    ],
                });

                const applications = await prisma.application.findMany({
                    where: { userId },
                    select: {
                        id: true,
                        jobId: true,
                        status: true,
                        tailoredCvMarkdown: true,
                        coverLetterMarkdown: true,
                        job: {
                            select: { externalId: true },
                        },
                    },
                    orderBy: { createdAt: "asc" },
                });

                const targetApplication = applications.find(
                    (application) => application.jobId === targetJob.id
                );
                const plainDiscoveredApplication = applications.find(
                    (application) => application.jobId === plainDiscoveredJob.id
                );
                expect(targetApplication).toBeTruthy();
                expect(plainDiscoveredApplication).toBeTruthy();

                const olderRelevantBlockedAt = new Date("2024-01-15T09:00:00.000Z");
                await prisma.workflowError.create({
                    data: {
                        workflowId: "job-discovery-pipeline-v3",
                        nodeName: "Guard Evaluation",
                        errorType: "FACTUAL_GUARD_BLOCKED",
                        message: "FACTUAL_GUARD_UNSUPPORTED_EMPLOYER",
                        userId,
                        payload: {
                            jobId: targetJob.id,
                            reasonCodes: ["FACTUAL_GUARD_UNSUPPORTED_EMPLOYER"],
                        },
                        createdAt: olderRelevantBlockedAt,
                    },
                });

                const noisyRows = Array.from({ length: 650 }, (_, index) => ({
                    workflowId: "job-discovery-pipeline-v3",
                    nodeName: "Guard Evaluation",
                    errorType: "FACTUAL_GUARD_BLOCKED",
                    message: "FACTUAL_GUARD_UNSUPPORTED_TOOL",
                    userId,
                    payload: {
                        applicationId: `noise-app-${runSuffix}-${index}`,
                        jobId: `noise-job-${runSuffix}-${index}`,
                        externalId: `noise-external-${runSuffix}-${index}`,
                        reasonCodes: ["FACTUAL_GUARD_UNSUPPORTED_TOOL"],
                    },
                    createdAt: new Date(Date.now() + index),
                }));
                await prisma.workflowError.createMany({ data: noisyRows });

                await prisma.workflowError.create({
                    data: {
                        workflowId: "single-job-tailoring-v3",
                        nodeName: "Guard Evaluation",
                        errorType: "FACTUAL_GUARD_BLOCKED",
                        message: "FACTUAL_GUARD_UNSUPPORTED_YEAR",
                        userId: noiseUserId,
                        payload: {
                            jobId: targetJob.id,
                            reasonCodes: ["FACTUAL_GUARD_UNSUPPORTED_YEAR"],
                        },
                    },
                });

                const factualGuardByApplicationId = await getFactualGuardByApplicationId({
                    userId,
                    applications,
                });
                const summary = summarizeApplicationStates({
                    applications,
                    factualGuardByApplicationId,
                });

                expect(factualGuardByApplicationId.size).toBe(1);
                expect(factualGuardByApplicationId.get(targetApplication!.id)).toEqual({
                    blocked: true,
                    reasonCodes: ["FACTUAL_GUARD_UNSUPPORTED_EMPLOYER"],
                    blockedAt: olderRelevantBlockedAt.toISOString(),
                });
                expect(factualGuardByApplicationId.get(plainDiscoveredApplication!.id)).toBeUndefined();
                expect(summary).toEqual(
                    expect.objectContaining({
                        totalCount: 3,
                        tailoredCount: 1,
                        discoveredCount: 2,
                        guardBlockedCount: 1,
                        plainDiscoveredCount: 1,
                    })
                );
                expect(summary.plainDiscoveredCount + summary.guardBlockedCount).toBe(
                    summary.discoveredCount
                );
            } finally {
                if (userId || noiseUserId) {
                    await prisma.workflowError.deleteMany({
                        where: {
                            userId: {
                                in: [userId, noiseUserId].filter(Boolean) as string[],
                            },
                        },
                    });
                }
                if (userId || noiseUserId) {
                    await prisma.user.deleteMany({
                        where: {
                            id: {
                                in: [userId, noiseUserId].filter(Boolean) as string[],
                            },
                        },
                    });
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
        60_000
    );

    itRealDb(
        "returns factual-guard mapping and summary contract for GET /api/applications under noisy history",
        async () => {
            if (!process.env.DATABASE_URL) {
                throw new Error("DATABASE_URL is required for real-db integration test");
            }

            vi.unmock("@/lib/prisma");
            vi.resetModules();

            const { prisma } = await import("@/lib/prisma");
            const { getAuthUser } = await import("@/lib/auth");
            const { GET } = await import("@/app/api/applications/route");

            const runSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const externalPrefix = `it-applications-route-noisy-${runSuffix}`;
            const userEmail = `integration+applications-route-${runSuffix}@example.com`;
            const noiseUserEmail = `integration+applications-route-noise-${runSuffix}@example.com`;
            const clerkId = `integration-applications-route-${runSuffix}`;
            const noiseClerkId = `integration-applications-route-noise-${runSuffix}`;

            let userId: string | null = null;
            let noiseUserId: string | null = null;
            try {
                const [user, noiseUser] = await Promise.all([
                    prisma.user.create({
                        data: {
                            email: userEmail,
                            clerkId,
                            name: "Integration Applications Route User",
                            automationEnabled: true,
                            subscriptionStatus: "pro",
                            creditsRemaining: 10,
                        },
                        select: { id: true },
                    }),
                    prisma.user.create({
                        data: {
                            email: noiseUserEmail,
                            clerkId: noiseClerkId,
                            name: "Integration Applications Route Noise User",
                            automationEnabled: true,
                            subscriptionStatus: "pro",
                            creditsRemaining: 10,
                        },
                        select: { id: true },
                    }),
                ]);
                userId = user.id;
                noiseUserId = noiseUser.id;

                const [guardedJob, plainJob, tailoredJob] = await Promise.all([
                    prisma.job.create({
                        data: {
                            externalId: `${externalPrefix}-guarded`,
                            title: "Guarded Discovered Role",
                            company: "Guarded Corp",
                            location: "Remote",
                            description: "Guarded role",
                            source: "manual",
                            url: "https://example.com/guarded",
                        },
                        select: { id: true, externalId: true },
                    }),
                    prisma.job.create({
                        data: {
                            externalId: `${externalPrefix}-plain`,
                            title: "Plain Discovered Role",
                            company: "Plain Corp",
                            location: "Remote",
                            description: "Plain role",
                            source: "manual",
                            url: "https://example.com/plain",
                        },
                        select: { id: true, externalId: true },
                    }),
                    prisma.job.create({
                        data: {
                            externalId: `${externalPrefix}-tailored`,
                            title: "Tailored Role",
                            company: "Tailored Corp",
                            location: "Remote",
                            description: "Tailored role",
                            source: "manual",
                            url: "https://example.com/tailored",
                        },
                        select: { id: true, externalId: true },
                    }),
                ]);

                await prisma.application.createMany({
                    data: [
                        {
                            userId,
                            jobId: guardedJob.id,
                            compatibilityScore: 84,
                            status: "discovered",
                            tailoredCvMarkdown: null,
                            coverLetterMarkdown: null,
                        },
                        {
                            userId,
                            jobId: plainJob.id,
                            compatibilityScore: 70,
                            status: "discovered",
                            tailoredCvMarkdown: null,
                            coverLetterMarkdown: null,
                        },
                        {
                            userId,
                            jobId: tailoredJob.id,
                            compatibilityScore: 93,
                            status: "tailored",
                            tailoredCvMarkdown: "# Tailored CV",
                            coverLetterMarkdown: "# Tailored Cover Letter",
                        },
                    ],
                });

                const [guardedApplication, plainApplication, tailoredApplication] = await Promise.all([
                    prisma.application.findUnique({
                        where: { userId_jobId: { userId, jobId: guardedJob.id } },
                        select: { id: true },
                    }),
                    prisma.application.findUnique({
                        where: { userId_jobId: { userId, jobId: plainJob.id } },
                        select: { id: true },
                    }),
                    prisma.application.findUnique({
                        where: { userId_jobId: { userId, jobId: tailoredJob.id } },
                        select: { id: true },
                    }),
                ]);
                expect(guardedApplication).toBeTruthy();
                expect(plainApplication).toBeTruthy();
                expect(tailoredApplication).toBeTruthy();

                const olderRelevantBlockedAt = new Date("2024-02-01T08:30:00.000Z");
                await prisma.workflowError.create({
                    data: {
                        workflowId: "job-discovery-pipeline-v3",
                        nodeName: "Guard Evaluation",
                        errorType: "FACTUAL_GUARD_BLOCKED",
                        message: "FACTUAL_GUARD_UNSUPPORTED_EMPLOYER",
                        userId,
                        payload: {
                            applicationId: guardedApplication!.id,
                            reasonCodes: ["FACTUAL_GUARD_UNSUPPORTED_EMPLOYER"],
                        },
                        createdAt: olderRelevantBlockedAt,
                    },
                });

                const noisyRows = Array.from({ length: 700 }, (_, index) => ({
                    workflowId: "job-discovery-pipeline-v3",
                    nodeName: "Guard Evaluation",
                    errorType: "FACTUAL_GUARD_BLOCKED",
                    message: "FACTUAL_GUARD_UNSUPPORTED_TOOL",
                    userId,
                    payload: {
                        applicationId: `noise-app-${runSuffix}-${index}`,
                        jobId: `noise-job-${runSuffix}-${index}`,
                        externalId: `noise-external-${runSuffix}-${index}`,
                        reasonCodes: ["FACTUAL_GUARD_UNSUPPORTED_TOOL"],
                    },
                    createdAt: new Date(Date.now() + index),
                }));
                await prisma.workflowError.createMany({ data: noisyRows });

                await prisma.workflowError.create({
                    data: {
                        workflowId: "single-job-tailoring-v3",
                        nodeName: "Guard Evaluation",
                        errorType: "FACTUAL_GUARD_BLOCKED",
                        message: "FACTUAL_GUARD_UNSUPPORTED_YEAR",
                        userId: noiseUserId,
                        payload: {
                            applicationId: guardedApplication!.id,
                            reasonCodes: ["FACTUAL_GUARD_UNSUPPORTED_YEAR"],
                        },
                    },
                });

                vi.mocked(getAuthUser).mockResolvedValue({
                    id: userId,
                    email: userEmail,
                    clerkId,
                } as any);

                const request = new Request("http://localhost/api/applications");
                const response = await GET(request);
                const data = await response.json();

                expect(response.status).toBe(200);
                expect(Array.isArray(data.applications)).toBe(true);
                expect(data.applications).toHaveLength(3);

                const guardedEntry = data.applications.find(
                    (application: any) => application.job?.externalId === guardedJob.externalId
                );
                const plainEntry = data.applications.find(
                    (application: any) => application.job?.externalId === plainJob.externalId
                );
                const tailoredEntry = data.applications.find(
                    (application: any) => application.job?.externalId === tailoredJob.externalId
                );

                expect(guardedEntry?.factualGuard).toEqual({
                    blocked: true,
                    reasonCodes: ["FACTUAL_GUARD_UNSUPPORTED_EMPLOYER"],
                    blockedAt: olderRelevantBlockedAt.toISOString(),
                });
                expect(plainEntry?.factualGuard).toBeNull();
                expect(tailoredEntry?.factualGuard).toBeNull();

                const blockedCount = data.applications.filter(
                    (application: any) => application.factualGuard?.blocked === true
                ).length;
                expect(blockedCount).toBe(1);

                expect(data.summary).toEqual(
                    expect.objectContaining({
                        totalCount: 3,
                        tailoredCount: 1,
                        discoveredCount: 2,
                        guardBlockedCount: 1,
                        plainDiscoveredCount: 1,
                    })
                );
                expect(data.summary.plainDiscoveredCount + data.summary.guardBlockedCount).toBe(
                    data.summary.discoveredCount
                );
            } finally {
                if (userId || noiseUserId) {
                    await prisma.workflowError.deleteMany({
                        where: {
                            userId: {
                                in: [userId, noiseUserId].filter(Boolean) as string[],
                            },
                        },
                    });
                }
                if (userId || noiseUserId) {
                    await prisma.user.deleteMany({
                        where: {
                            id: {
                                in: [userId, noiseUserId].filter(Boolean) as string[],
                            },
                        },
                    });
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
        60_000
    );
});
