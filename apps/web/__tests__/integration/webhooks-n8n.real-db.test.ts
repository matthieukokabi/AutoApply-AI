import { describe, expect, it, vi } from "vitest";

const itRealDb = process.env.RUN_REAL_DB_INTEGRATION === "1" ? it : it.skip;

describe("POST /api/webhooks/n8n (real-db)", () => {
    itRealDb(
        "creates runId-only discovery ledger summary and derives runMetrics from durable rows",
        async () => {
            if (!process.env.DATABASE_URL) {
                throw new Error("DATABASE_URL is required for real-db integration test");
            }

            const webhookSecret = "test_webhook_secret_real_db_discovery_status";
            process.env.N8N_WEBHOOK_SECRET = webhookSecret;

            vi.unmock("@/lib/prisma");
            vi.resetModules();

            const { POST } = await import("@/app/api/webhooks/n8n/route");
            const { prisma } = await import("@/lib/prisma");

            const runSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const externalPrefix = `it-discovery-status-${runSuffix}`;
            const runId = `${externalPrefix}-run`;
            const userEmail = `integration+discovery-status-${runSuffix}@example.com`;
            const clerkId = `integration-discovery-status-${runSuffix}`;

            let userId: string | null = null;
            try {
                const user = await prisma.user.create({
                    data: {
                        email: userEmail,
                        clerkId,
                        name: "Integration Discovery Status User",
                        automationEnabled: true,
                        subscriptionStatus: "pro",
                        creditsRemaining: 10,
                    },
                    select: { id: true },
                });
                userId = user.id;

                const [tailoredJob, discoveredJob] = await Promise.all([
                    prisma.job.create({
                        data: {
                            externalId: `${externalPrefix}-tailored`,
                            title: "Tailored Role",
                            company: "Tailored Corp",
                            location: "Remote",
                            description: "Tailored role description",
                            source: "manual",
                            url: "https://example.com/discovery-status-tailored",
                        },
                        select: { id: true },
                    }),
                    prisma.job.create({
                        data: {
                            externalId: `${externalPrefix}-discovered`,
                            title: "Discovered Role",
                            company: "Discovery Corp",
                            location: "Remote",
                            description: "Discovered role description",
                            source: "manual",
                            url: "https://example.com/discovery-status-discovered",
                        },
                        select: { id: true },
                    }),
                ]);

                const [tailoredApplication, discoveredApplication] = await Promise.all([
                    prisma.application.create({
                        data: {
                            userId,
                            jobId: tailoredJob.id,
                            compatibilityScore: 91,
                            status: "tailored",
                            tailoredCvMarkdown: "# Tailored CV",
                            coverLetterMarkdown: "# Tailored Cover Letter",
                        },
                        select: { id: true },
                    }),
                    prisma.application.create({
                        data: {
                            userId,
                            jobId: discoveredJob.id,
                            compatibilityScore: 72,
                            status: "discovered",
                            tailoredCvMarkdown: null,
                            coverLetterMarkdown: null,
                        },
                        select: { id: true },
                    }),
                ]);

                await prisma.applicationRunAttribution.createMany({
                    data: [
                        {
                            applicationId: tailoredApplication.id,
                            userId,
                            jobId: tailoredJob.id,
                            eventType: "new_applications",
                            workflowId: "job-discovery-pipeline-v3",
                            runId,
                            n8nExecutionId: 9111,
                            writeAction: "created",
                            persistedStatus: "tailored",
                            persistedTailoredCv: true,
                            persistedCoverLetter: true,
                        },
                        {
                            applicationId: discoveredApplication.id,
                            userId,
                            jobId: discoveredJob.id,
                            eventType: "new_applications",
                            workflowId: "job-discovery-pipeline-v3",
                            runId,
                            n8nExecutionId: 9111,
                            writeAction: "created",
                            persistedStatus: "discovered",
                            persistedTailoredCv: false,
                            persistedCoverLetter: false,
                        },
                    ],
                });

                await prisma.workflowError.createMany({
                    data: [
                        {
                            workflowId: "job-discovery-pipeline-v3",
                            nodeName: "Factual Guard",
                            errorType: "FACTUAL_GUARD_BLOCKED",
                            message: "FACTUAL_GUARD_UNSUPPORTED_TECHNOLOGY",
                            userId,
                            payload: {
                                runId,
                                applicationId: discoveredApplication.id,
                                reasonCodes: ["FACTUAL_GUARD_UNSUPPORTED_TECHNOLOGY"],
                            },
                        },
                        {
                            workflowId: "job-discovery-pipeline-v3",
                            nodeName: "Cover Letter Quality Gate",
                            errorType: "COVER_LETTER_QUALITY_BLOCKED",
                            message: "COVER_LETTER_QUALITY_LOW_GROUNDING",
                            userId,
                            payload: {
                                runId,
                                applicationId: discoveredApplication.id,
                                reasonCodes: ["COVER_LETTER_QUALITY_LOW_GROUNDING"],
                            },
                        },
                    ],
                });

                const response = await POST(
                    new Request("http://localhost/api/webhooks/n8n", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "x-webhook-secret": webhookSecret,
                        },
                        body: JSON.stringify({
                            type: "discovery_run_status",
                            executionId: 9123,
                            data: {
                                runId,
                                status: "completed",
                                usersSeen: 1,
                                usersCanary: 1,
                                usersProcessed: 1,
                                usersFailed: 0,
                                lockAcquired: true,
                                lockReleased: true,
                            },
                        }),
                    })
                );
                const responseBody = await response.json();

                expect(response.status).toBe(200);
                expect(responseBody.ok).toBe(true);
                expect(responseBody.updated).toBe(true);
                expect(responseBody.created).toBe(true);
                expect(responseBody.runId).toBe(runId);

                const ledgerRow = await prisma.discoveryScheduleRun.findUnique({
                    where: { runId },
                    select: {
                        runId: true,
                        slotKey: true,
                        status: true,
                        triggerKind: true,
                        schedulerSource: true,
                        n8nExecutionId: true,
                        persistedApplications: true,
                        metadata: true,
                    },
                });
                expect(ledgerRow).toBeTruthy();
                expect(ledgerRow?.runId).toBe(runId);
                expect(ledgerRow?.slotKey).toBe(runId);
                expect(ledgerRow?.status).toBe("completed");
                expect(ledgerRow?.triggerKind).toBe("scheduled");
                expect(ledgerRow?.schedulerSource).toBe("n8n_callback");
                expect(ledgerRow?.n8nExecutionId).toBe(9123);
                expect(ledgerRow?.persistedApplications).toBe(2);

                const metadata =
                    ledgerRow?.metadata && typeof ledgerRow.metadata === "object"
                        ? (ledgerRow.metadata as Record<string, unknown>)
                        : {};
                const runMetrics =
                    metadata.runMetrics && typeof metadata.runMetrics === "object"
                        ? (metadata.runMetrics as Record<string, unknown>)
                        : {};
                expect(runMetrics).toEqual(
                    expect.objectContaining({
                        tailoredCount: 1,
                        discoveredCount: 1,
                        factualGuardBlockedCount: 1,
                        coverLetterQualityBlockedCount: 1,
                    })
                );
                expect(typeof metadata.metricsUpdatedAt).toBe("string");
            } finally {
                await prisma.discoveryScheduleRun.deleteMany({ where: { runId } });
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
        60_000
    );

    itRealDb(
        "persists failed discovery ledger row from workflow_error when only runId is provided",
        async () => {
            if (!process.env.DATABASE_URL) {
                throw new Error("DATABASE_URL is required for real-db integration test");
            }

            const webhookSecret = "test_webhook_secret_real_db_discovery_failed";
            process.env.N8N_WEBHOOK_SECRET = webhookSecret;

            vi.unmock("@/lib/prisma");
            vi.resetModules();

            const { POST } = await import("@/app/api/webhooks/n8n/route");
            const { prisma } = await import("@/lib/prisma");

            const runSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const runId = `it-discovery-failed-${runSuffix}`;
            const errorMessage = `TAILORING_PARSE_FAILURE ${runId}`;
            try {
                const response = await POST(
                    new Request("http://localhost/api/webhooks/n8n", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "x-webhook-secret": webhookSecret,
                        },
                        body: JSON.stringify({
                            type: "workflow_error",
                            data: {
                                workflowId: "job-discovery-pipeline-v3",
                                nodeName: "Parse Tailoring Output v3",
                                errorType: "TAILORING_PARSE_FAILURE",
                                message: errorMessage,
                                payload: {
                                    runId,
                                },
                            },
                        }),
                    })
                );
                const responseBody = await response.json();

                expect(response.status).toBe(200);
                expect(responseBody.message).toBe("Error logged");

                const ledgerRow = await prisma.discoveryScheduleRun.findUnique({
                    where: { runId },
                    select: {
                        runId: true,
                        slotKey: true,
                        status: true,
                        triggerKind: true,
                        schedulerSource: true,
                        errorCode: true,
                        errorMessage: true,
                        finishedAt: true,
                    },
                });

                expect(ledgerRow).toBeTruthy();
                expect(ledgerRow?.runId).toBe(runId);
                expect(ledgerRow?.slotKey).toBe(runId);
                expect(ledgerRow?.status).toBe("failed");
                expect(ledgerRow?.triggerKind).toBe("scheduled");
                expect(ledgerRow?.schedulerSource).toBe("n8n_callback");
                expect(ledgerRow?.errorCode).toBe("TAILORING_PARSE_FAILURE");
                expect(ledgerRow?.errorMessage).toBe(errorMessage);
                expect(ledgerRow?.finishedAt).toBeTruthy();
            } finally {
                await prisma.workflowError.deleteMany({
                    where: {
                        workflowId: "job-discovery-pipeline-v3",
                        message: errorMessage,
                    },
                });
                await prisma.discoveryScheduleRun.deleteMany({ where: { runId } });
                await prisma.$disconnect();
            }
        },
        45_000
    );

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
                                        "My Kubernetes and Rust experience directly matches the Senior Developer needs at Tech Corp.",
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
        "persists durable successful-run attribution across batch and single-job upserts",
        async () => {
            if (!process.env.DATABASE_URL) {
                throw new Error("DATABASE_URL is required for real-db integration test");
            }

            const webhookSecret = "test_webhook_secret_real_db_attribution";
            process.env.N8N_WEBHOOK_SECRET = webhookSecret;

            vi.unmock("@/lib/prisma");
            vi.resetModules();

            const { POST } = await import("@/app/api/webhooks/n8n/route");
            const { prisma } = await import("@/lib/prisma");

            const runSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const externalPrefix = `it-attr-${runSuffix}`;
            const externalId = `${externalPrefix}-job`;
            const userEmail = `integration+attr-${runSuffix}@example.com`;
            const clerkId = `integration-attr-${runSuffix}`;

            let userId: string | null = null;
            try {
                const user = await prisma.user.create({
                    data: {
                        email: userEmail,
                        clerkId,
                        name: "Integration Attribution User",
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
Skills: React, TypeScript, Node.js, AWS`,
                        structuredJson: {
                            skills: ["React", "TypeScript", "Node.js", "AWS"],
                        },
                    },
                });

                const batchCreate = await POST(
                    new Request("http://localhost/api/webhooks/n8n", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "x-webhook-secret": webhookSecret,
                        },
                        body: JSON.stringify({
                            type: "new_applications",
                            runId: `${externalPrefix}-run-1`,
                            executionId: 7001,
                            data: {
                                userId,
                                schedulerSource: "manual_operator",
                                triggerKind: "controlled_verification",
                                slotId: `${externalPrefix}-slot-1`,
                                applications: [
                                    {
                                        externalId,
                                        title: "Senior Developer",
                                        company: "Tech Corp",
                                        compatibilityScore: 90,
                                        tailoredCvMarkdown: `# Jane Doe
## Experience
### Senior Developer at Tech Corp
**2024 - Present**
- Built React and TypeScript services.`,
                                        coverLetterMarkdown:
                                            "I am applying for the Senior Developer role at Tech Corp and bring React and TypeScript delivery experience.",
                                    },
                                ],
                            },
                        }),
                    })
                );
                expect(batchCreate.status).toBe(200);

                const createdJob = await prisma.job.findUnique({
                    where: { externalId },
                    select: { id: true },
                });
                expect(createdJob?.id).toBeTruthy();

                const batchUpdate = await POST(
                    new Request("http://localhost/api/webhooks/n8n", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "x-webhook-secret": webhookSecret,
                        },
                        body: JSON.stringify({
                            type: "new_applications",
                            runId: `${externalPrefix}-run-2`,
                            executionId: 7002,
                            data: {
                                userId,
                                schedulerSource: "manual_operator",
                                triggerKind: "controlled_verification",
                                slotId: `${externalPrefix}-slot-2`,
                                applications: [
                                    {
                                        externalId,
                                        title: "Senior Developer",
                                        company: "Tech Corp",
                                        compatibilityScore: 91,
                                        tailoredCvMarkdown: `# Jane Doe
## Experience
### Senior Developer at Tech Corp
**2024 - Present**
- Built and operated React and TypeScript services.`,
                                        coverLetterMarkdown:
                                            "I am applying for the Senior Developer role at Tech Corp and bring React and TypeScript delivery experience.",
                                    },
                                ],
                            },
                        }),
                    })
                );
                expect(batchUpdate.status).toBe(200);

                const singleUpdate = await POST(
                    new Request("http://localhost/api/webhooks/n8n", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "x-webhook-secret": webhookSecret,
                        },
                        body: JSON.stringify({
                            type: "single_tailoring_complete",
                            runId: `${externalPrefix}-run-3`,
                            executionId: 7003,
                            data: {
                                userId,
                                jobId: createdJob!.id,
                                schedulerSource: "manual_operator",
                                triggerKind: "single_job_manual",
                                slotId: `${externalPrefix}-slot-3`,
                                jobTitle: "Senior Developer",
                                company: "Tech Corp",
                                compatibilityScore: 92,
                                tailoredCvMarkdown: `# Jane Doe
## Experience
### Senior Developer at Tech Corp
**2024 - Present**
- Led React and TypeScript delivery for production services.`,
                                coverLetterMarkdown:
                                    "I am applying for the Senior Developer role at Tech Corp and bring React and TypeScript delivery experience.",
                            },
                        }),
                    })
                );
                expect(singleUpdate.status).toBe(200);

                const application = await prisma.application.findUnique({
                    where: {
                        userId_jobId: {
                            userId,
                            jobId: createdJob!.id,
                        },
                    },
                    select: { id: true },
                });
                expect(application?.id).toBeTruthy();

                const attributions = await prisma.applicationRunAttribution.findMany({
                    where: { applicationId: application!.id },
                    orderBy: { createdAt: "asc" },
                    select: {
                        eventType: true,
                        workflowId: true,
                        runId: true,
                        n8nExecutionId: true,
                        writeAction: true,
                        persistedStatus: true,
                        persistedTailoredCv: true,
                        persistedCoverLetter: true,
                    },
                });

                expect(attributions).toEqual([
                    expect.objectContaining({
                        eventType: "new_applications",
                        workflowId: "job-discovery-pipeline-v3",
                        runId: `${externalPrefix}-run-1`,
                        n8nExecutionId: 7001,
                        writeAction: "created",
                        persistedStatus: "tailored",
                        persistedTailoredCv: true,
                        persistedCoverLetter: true,
                    }),
                    expect.objectContaining({
                        eventType: "new_applications",
                        workflowId: "job-discovery-pipeline-v3",
                        runId: `${externalPrefix}-run-2`,
                        n8nExecutionId: 7002,
                        writeAction: "updated",
                        persistedStatus: "tailored",
                        persistedTailoredCv: true,
                        persistedCoverLetter: true,
                    }),
                    expect.objectContaining({
                        eventType: "single_tailoring_complete",
                        workflowId: "single-job-tailoring-v3",
                        runId: `${externalPrefix}-run-3`,
                        n8nExecutionId: 7003,
                        writeAction: "updated",
                        persistedStatus: "tailored",
                        persistedTailoredCv: true,
                        persistedCoverLetter: true,
                    }),
                ]);
            } finally {
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
        "quarantines only cover letter and preserves tailored CV for single_tailoring_complete",
        async () => {
            if (!process.env.DATABASE_URL) {
                throw new Error("DATABASE_URL is required for real-db integration test");
            }

            const webhookSecret = "test_webhook_secret_real_db_cover_quality_single";
            process.env.N8N_WEBHOOK_SECRET = webhookSecret;

            vi.unmock("@/lib/prisma");
            vi.resetModules();

            const { POST } = await import("@/app/api/webhooks/n8n/route");
            const { prisma } = await import("@/lib/prisma");

            const runSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const externalPrefix = `it-cover-quality-single-${runSuffix}`;
            const userEmail = `integration+cover-quality-single-${runSuffix}@example.com`;
            const clerkId = `integration-cover-quality-single-${runSuffix}`;
            const externalId = `${externalPrefix}-job`;

            let userId: string | null = null;
            let jobId: string | null = null;
            try {
                const user = await prisma.user.create({
                    data: {
                        email: userEmail,
                        clerkId,
                        name: "Integration Cover Quality Single User",
                        automationEnabled: true,
                        subscriptionStatus: "pro",
                        creditsRemaining: 10,
                    },
                    select: { id: true },
                });
                userId = user.id;

                const job = await prisma.job.create({
                    data: {
                        externalId,
                        title: "Senior Developer",
                        company: "Tech Corp",
                        location: "Remote",
                        description:
                            "Build and operate React and TypeScript services for a production platform team.",
                        source: "manual",
                        url: "https://example.com/cover-quality-single",
                    },
                    select: { id: true },
                });
                jobId = job.id;

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
                        type: "single_tailoring_complete",
                        data: {
                            userId,
                            jobId,
                            jobTitle: "Senior Developer",
                            company: "Tech Corp",
                            jobDescription:
                                "Build and operate React and TypeScript services for a production platform team.",
                            compatibilityScore: 91,
                            tailoredCvMarkdown: `# Jane Doe
## Experience
### Senior Developer at Tech Corp
**2024 - Present**
- Built and operated React and TypeScript services for production workloads.`,
                            coverLetterMarkdown:
                                "Dear Hiring Manager, I am excited to apply. Thank you for your time and consideration.",
                        },
                    }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(200);
                expect(data.message).toBe("Cover letter quarantined; tailored CV saved");
                expect(data.coverLetterQuarantined).toBe(true);
                expect(Array.isArray(data.reasonCodes)).toBe(true);
                expect(data.reasonCodes).toEqual(
                    expect.arrayContaining([
                        "COVER_LETTER_QUALITY_MISSING_COMPANY",
                        "COVER_LETTER_QUALITY_LOW_GROUNDING",
                        "COVER_LETTER_QUALITY_GENERIC_TEMPLATE",
                    ])
                );

                const application = await prisma.application.findUnique({
                    where: {
                        userId_jobId: {
                            userId,
                            jobId,
                        },
                    },
                    select: {
                        status: true,
                        tailoredCvMarkdown: true,
                        coverLetterMarkdown: true,
                    },
                });

                expect(application?.status).toBe("tailored");
                expect(application?.tailoredCvMarkdown).toEqual(expect.any(String));
                expect(application?.coverLetterMarkdown).toBeNull();

                const coverQualityErrors = await prisma.workflowError.findMany({
                    where: {
                        userId,
                        errorType: "COVER_LETTER_QUALITY_BLOCKED",
                    },
                    orderBy: { createdAt: "asc" },
                    select: {
                        errorType: true,
                        payload: true,
                    },
                });

                expect(coverQualityErrors).toHaveLength(1);
                expect(coverQualityErrors[0]?.errorType).toBe("COVER_LETTER_QUALITY_BLOCKED");
                const payload = (coverQualityErrors[0]?.payload || {}) as Record<string, unknown>;
                const reasonCodes = Array.isArray(payload.reasonCodes)
                    ? (payload.reasonCodes as string[])
                    : [];
                expect(reasonCodes).toEqual(
                    expect.arrayContaining([
                        "COVER_LETTER_QUALITY_MISSING_COMPANY",
                        "COVER_LETTER_QUALITY_LOW_GROUNDING",
                        "COVER_LETTER_QUALITY_GENERIC_TEMPLATE",
                    ])
                );

                const factualGuardErrors = await prisma.workflowError.count({
                    where: {
                        userId,
                        errorType: "FACTUAL_GUARD_BLOCKED",
                    },
                });
                expect(factualGuardErrors).toBe(0);
            } finally {
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
        "quarantines only cover letter and preserves tailored CV for new_applications",
        async () => {
            if (!process.env.DATABASE_URL) {
                throw new Error("DATABASE_URL is required for real-db integration test");
            }

            const webhookSecret = "test_webhook_secret_real_db_cover_quality_batch";
            process.env.N8N_WEBHOOK_SECRET = webhookSecret;

            vi.unmock("@/lib/prisma");
            vi.resetModules();

            const { POST } = await import("@/app/api/webhooks/n8n/route");
            const { prisma } = await import("@/lib/prisma");

            const runSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const externalPrefix = `it-cover-quality-batch-${runSuffix}`;
            const externalId = `${externalPrefix}-candidate`;
            const userEmail = `integration+cover-quality-batch-${runSuffix}@example.com`;
            const clerkId = `integration-cover-quality-batch-${runSuffix}`;

            let userId: string | null = null;
            let resolvedJobId: string | null = null;
            try {
                const user = await prisma.user.create({
                    data: {
                        email: userEmail,
                        clerkId,
                        name: "Integration Cover Quality Batch User",
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
                                    externalId,
                                    title: "Senior Developer",
                                    company: "Tech Corp",
                                    description:
                                        "Build and operate React and TypeScript services for a production platform team.",
                                    compatibilityScore: 89,
                                    tailoredCvMarkdown: `# Jane Doe
## Experience
### Senior Developer at Tech Corp
**2024 - Present**
- Built and operated React and TypeScript services for production workloads.`,
                                    coverLetterMarkdown:
                                        "Dear Hiring Manager, I am excited to apply. Thank you for your time and consideration.",
                                },
                            ],
                        },
                    }),
                });

                const response = await POST(request);
                const data = await response.json();

                expect(response.status).toBe(200);
                expect(data.message).toContain("1 applications");

                const job = await prisma.job.findUnique({
                    where: { externalId },
                    select: { id: true },
                });
                expect(job).toBeTruthy();
                resolvedJobId = job!.id;

                const application = await prisma.application.findUnique({
                    where: {
                        userId_jobId: {
                            userId,
                            jobId: resolvedJobId,
                        },
                    },
                    select: {
                        status: true,
                        tailoredCvMarkdown: true,
                        coverLetterMarkdown: true,
                    },
                });

                expect(application?.status).toBe("tailored");
                expect(application?.tailoredCvMarkdown).toEqual(expect.any(String));
                expect(application?.coverLetterMarkdown).toBeNull();

                const coverQualityErrors = await prisma.workflowError.findMany({
                    where: {
                        userId,
                        errorType: "COVER_LETTER_QUALITY_BLOCKED",
                    },
                    orderBy: { createdAt: "asc" },
                    select: {
                        errorType: true,
                        payload: true,
                    },
                });

                expect(coverQualityErrors).toHaveLength(1);
                expect(coverQualityErrors[0]?.errorType).toBe("COVER_LETTER_QUALITY_BLOCKED");
                const payload = (coverQualityErrors[0]?.payload || {}) as Record<string, unknown>;
                const reasonCodes = Array.isArray(payload.reasonCodes)
                    ? (payload.reasonCodes as string[])
                    : [];
                expect(reasonCodes).toEqual(
                    expect.arrayContaining([
                        "COVER_LETTER_QUALITY_MISSING_COMPANY",
                        "COVER_LETTER_QUALITY_LOW_GROUNDING",
                        "COVER_LETTER_QUALITY_GENERIC_TEMPLATE",
                    ])
                );

                const factualGuardErrors = await prisma.workflowError.count({
                    where: {
                        userId,
                        errorType: "FACTUAL_GUARD_BLOCKED",
                    },
                });
                expect(factualGuardErrors).toBe(0);
            } finally {
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

    itRealDb(
        "surfaces cover-letter quality quarantine for tailored applications on GET /api/applications",
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
            const externalPrefix = `it-applications-route-cover-quality-${runSuffix}`;
            const userEmail = `integration+applications-cover-quality-${runSuffix}@example.com`;
            const noiseUserEmail = `integration+applications-cover-quality-noise-${runSuffix}@example.com`;
            const clerkId = `integration-applications-cover-quality-${runSuffix}`;
            const noiseClerkId = `integration-applications-cover-quality-noise-${runSuffix}`;

            let userId: string | null = null;
            let noiseUserId: string | null = null;
            try {
                const [user, noiseUser] = await Promise.all([
                    prisma.user.create({
                        data: {
                            email: userEmail,
                            clerkId,
                            name: "Integration Applications Cover Quality User",
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
                            name: "Integration Applications Cover Quality Noise User",
                            automationEnabled: true,
                            subscriptionStatus: "pro",
                            creditsRemaining: 10,
                        },
                        select: { id: true },
                    }),
                ]);
                userId = user.id;
                noiseUserId = noiseUser.id;

                const [coverBlockedJob, cleanTailoredJob, discoveredJob] = await Promise.all([
                    prisma.job.create({
                        data: {
                            externalId: `${externalPrefix}-cover-blocked`,
                            title: "Senior Developer",
                            company: "Tech Corp",
                            location: "Remote",
                            description: "Role where tailored CV is valid and cover letter can be quarantined",
                            source: "manual",
                            url: "https://example.com/cover-blocked",
                        },
                        select: { id: true, externalId: true },
                    }),
                    prisma.job.create({
                        data: {
                            externalId: `${externalPrefix}-tailored-clean`,
                            title: "Senior Developer",
                            company: "Clean Corp",
                            location: "Remote",
                            description: "Role with complete tailored outputs",
                            source: "manual",
                            url: "https://example.com/tailored-clean",
                        },
                        select: { id: true, externalId: true },
                    }),
                    prisma.job.create({
                        data: {
                            externalId: `${externalPrefix}-discovered`,
                            title: "Discovered Role",
                            company: "Discovery Corp",
                            location: "Remote",
                            description: "Discovered role",
                            source: "manual",
                            url: "https://example.com/discovered",
                        },
                        select: { id: true, externalId: true },
                    }),
                ]);

                await prisma.application.createMany({
                    data: [
                        {
                            userId,
                            jobId: coverBlockedJob.id,
                            compatibilityScore: 92,
                            status: "tailored",
                            tailoredCvMarkdown: "# Tailored CV",
                            coverLetterMarkdown: null,
                        },
                        {
                            userId,
                            jobId: cleanTailoredJob.id,
                            compatibilityScore: 88,
                            status: "tailored",
                            tailoredCvMarkdown: "# Tailored CV",
                            coverLetterMarkdown: "# Tailored Cover Letter",
                        },
                        {
                            userId,
                            jobId: discoveredJob.id,
                            compatibilityScore: 70,
                            status: "discovered",
                            tailoredCvMarkdown: null,
                            coverLetterMarkdown: null,
                        },
                    ],
                });

                const [coverBlockedApplication, cleanTailoredApplication, discoveredApplication] =
                    await Promise.all([
                        prisma.application.findUnique({
                            where: { userId_jobId: { userId, jobId: coverBlockedJob.id } },
                            select: { id: true },
                        }),
                        prisma.application.findUnique({
                            where: { userId_jobId: { userId, jobId: cleanTailoredJob.id } },
                            select: { id: true },
                        }),
                        prisma.application.findUnique({
                            where: { userId_jobId: { userId, jobId: discoveredJob.id } },
                            select: { id: true },
                        }),
                    ]);
                expect(coverBlockedApplication).toBeTruthy();
                expect(cleanTailoredApplication).toBeTruthy();
                expect(discoveredApplication).toBeTruthy();

                const blockedAt = new Date("2026-04-12T08:15:00.000Z");
                await prisma.workflowError.create({
                    data: {
                        workflowId: "single-job-tailoring-v3",
                        nodeName: "Cover Letter Quality Gate",
                        errorType: "COVER_LETTER_QUALITY_BLOCKED",
                        message:
                            "COVER_LETTER_QUALITY_MISSING_COMPANY,COVER_LETTER_QUALITY_LOW_GROUNDING,COVER_LETTER_QUALITY_GENERIC_TEMPLATE",
                        userId,
                        payload: {
                            applicationId: coverBlockedApplication!.id,
                            reasonCodes: [
                                "COVER_LETTER_QUALITY_MISSING_COMPANY",
                                "COVER_LETTER_QUALITY_LOW_GROUNDING",
                                "COVER_LETTER_QUALITY_GENERIC_TEMPLATE",
                            ],
                        },
                        createdAt: blockedAt,
                    },
                });

                const noisyRows = Array.from({ length: 420 }, (_, index) => ({
                    workflowId: "job-discovery-pipeline-v3",
                    nodeName: "Cover Letter Quality Gate",
                    errorType: "COVER_LETTER_QUALITY_BLOCKED",
                    message: "COVER_LETTER_QUALITY_LOW_GROUNDING",
                    userId,
                    payload: {
                        applicationId: `noise-cover-quality-app-${runSuffix}-${index}`,
                        jobId: `noise-cover-quality-job-${runSuffix}-${index}`,
                        externalId: `noise-cover-quality-external-${runSuffix}-${index}`,
                        reasonCodes: ["COVER_LETTER_QUALITY_LOW_GROUNDING"],
                    },
                    createdAt: new Date(Date.now() + index),
                }));
                await prisma.workflowError.createMany({ data: noisyRows });

                await prisma.workflowError.create({
                    data: {
                        workflowId: "single-job-tailoring-v3",
                        nodeName: "Cover Letter Quality Gate",
                        errorType: "COVER_LETTER_QUALITY_BLOCKED",
                        message: "COVER_LETTER_QUALITY_GENERIC_TEMPLATE",
                        userId: noiseUserId,
                        payload: {
                            applicationId: coverBlockedApplication!.id,
                            reasonCodes: ["COVER_LETTER_QUALITY_GENERIC_TEMPLATE"],
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

                const coverBlockedEntry = data.applications.find(
                    (application: any) => application.job?.externalId === coverBlockedJob.externalId
                );
                const cleanTailoredEntry = data.applications.find(
                    (application: any) => application.job?.externalId === cleanTailoredJob.externalId
                );
                const discoveredEntry = data.applications.find(
                    (application: any) => application.job?.externalId === discoveredJob.externalId
                );

                expect(coverBlockedEntry?.status).toBe("tailored");
                expect(coverBlockedEntry?.tailoredCvMarkdown).toEqual(expect.any(String));
                expect(coverBlockedEntry?.coverLetterMarkdown).toBeNull();
                expect(coverBlockedEntry?.coverLetterQuality).toEqual({
                    blocked: true,
                    reasonCodes: [
                        "COVER_LETTER_QUALITY_MISSING_COMPANY",
                        "COVER_LETTER_QUALITY_LOW_GROUNDING",
                        "COVER_LETTER_QUALITY_GENERIC_TEMPLATE",
                    ],
                    blockedAt: blockedAt.toISOString(),
                });
                expect(coverBlockedEntry?.factualGuard).toBeNull();

                expect(cleanTailoredEntry?.status).toBe("tailored");
                expect(cleanTailoredEntry?.coverLetterQuality).toBeNull();
                expect(cleanTailoredEntry?.factualGuard).toBeNull();

                expect(discoveredEntry?.status).toBe("discovered");
                expect(discoveredEntry?.coverLetterQuality).toBeNull();

                const coverLetterQualityBlockedCount = data.applications.filter(
                    (application: any) => application.coverLetterQuality?.blocked === true
                ).length;
                expect(coverLetterQualityBlockedCount).toBe(1);

                expect(data.summary).toEqual(
                    expect.objectContaining({
                        totalCount: 3,
                        tailoredCount: 2,
                        discoveredCount: 1,
                        guardBlockedCount: 0,
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
