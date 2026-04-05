import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { sendAutomationHealthAlert } from "@/lib/email";
import { POST as DISCOVERY_POST } from "@/app/api/cron/discovery-v3/route";
import { POST as MANUAL_POST } from "@/app/api/cron/discovery-v3/manual/route";
import { POST as HEALTH_POST } from "@/app/api/cron/discovery-v3/health/route";
import { triggerDiscoveryRun } from "@/lib/discovery-trigger";
import {
    getCurrentZurichSlotKey,
    getExpectedSlotKeys,
    getZurichParts,
    getZurichNowLabel,
    normalizeSlotKey,
} from "@/lib/discovery-scheduler";

vi.mock("@/lib/discovery-trigger", () => ({
    triggerDiscoveryRun: vi.fn(),
}));

vi.mock("@/lib/discovery-scheduler", () => ({
    getCurrentZurichSlotKey: vi.fn(),
    getZurichNowLabel: vi.fn(() => "2026-04-04 12:20 Europe/Zurich"),
    normalizeSlotKey: vi.fn((value: unknown) =>
        typeof value === "string" ? value.trim() : null
    ),
    getZurichParts: vi.fn(() => ({
        year: 2026,
        month: 4,
        day: 4,
        hour: 12,
        minute: 20,
    })),
    getExpectedSlotKeys: vi.fn(() => []),
}));

describe("discovery v3 cron routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = "test_cron_secret";
        process.env.DISCOVERY_MANUAL_TRIGGER_SECRET = "test_manual_secret";
        process.env.AUTOMATION_ALERT_EMAIL_TO = "ops@example.com";
    });

    describe("POST /api/cron/discovery-v3", () => {
        it("returns 503 when CRON_SECRET is missing", async () => {
            delete process.env.CRON_SECRET;
            const request = new Request("http://localhost/api/cron/discovery-v3", {
                method: "POST",
                headers: { authorization: "Bearer whatever" },
            });

            const response = await DISCOVERY_POST(request);
            expect(response.status).toBe(503);
        });

        it("returns 202 when request is outside scheduled window", async () => {
            vi.mocked(getCurrentZurichSlotKey).mockReturnValue(null);

            const request = new Request("http://localhost/api/cron/discovery-v3", {
                method: "POST",
                headers: { authorization: "Bearer test_cron_secret" },
            });

            const response = await DISCOVERY_POST(request);
            const data = await response.json();
            expect(response.status).toBe(202);
            expect(data.status).toBe("skipped_not_scheduled_window");
            expect(data.nowZurich).toBe("2026-04-04 12:20 Europe/Zurich");
            expect(triggerDiscoveryRun).not.toHaveBeenCalled();
        });

        it("returns duplicate payload when slot was already accepted", async () => {
            vi.mocked(getCurrentZurichSlotKey).mockReturnValue("2026-04-04T12:20");
            vi.mocked(triggerDiscoveryRun).mockResolvedValue({
                ok: true,
                accepted: false,
                duplicate: true,
                slotKey: "2026-04-04T12:20",
                runId: "disc_v3_slot_2026_04_04T12_20_scheduled",
                ledgerId: "ledger_1",
                existingStatus: "completed",
            } as any);

            const request = new Request("http://localhost/api/cron/discovery-v3", {
                method: "POST",
                headers: { authorization: "Bearer test_cron_secret" },
            });

            const response = await DISCOVERY_POST(request);
            const data = await response.json();
            expect(response.status).toBe(200);
            expect(data.duplicate).toBe(true);
            expect(data.existingStatus).toBe("completed");
        });

        it("dispatches scheduled run and returns accepted payload", async () => {
            vi.mocked(getCurrentZurichSlotKey).mockReturnValue("2026-04-04T12:20");
            vi.mocked(triggerDiscoveryRun).mockResolvedValue({
                ok: true,
                accepted: true,
                duplicate: false,
                slotKey: "2026-04-04T12:20",
                runId: "disc_v3_slot_2026_04_04T12_20_scheduled",
                ledgerId: "ledger_2",
                webhookStatus: 200,
            } as any);

            const request = new Request("http://localhost/api/cron/discovery-v3", {
                method: "POST",
                headers: {
                    authorization: "Bearer test_cron_secret",
                    "x-vercel-id": "cdg1::abc",
                },
            });

            const response = await DISCOVERY_POST(request);
            const data = await response.json();

            expect(response.status).toBe(202);
            expect(data.accepted).toBe(true);
            expect(triggerDiscoveryRun).toHaveBeenCalledWith(
                expect.objectContaining({
                    slotKey: "2026-04-04T12:20",
                    schedulerSource: "vercel_cron",
                    triggerKind: "scheduled",
                })
            );
        });
    });

    describe("POST /api/cron/discovery-v3/manual", () => {
        it("returns 400 when no slot key is available", async () => {
            vi.mocked(getCurrentZurichSlotKey).mockReturnValue(null);
            vi.mocked(normalizeSlotKey).mockReturnValue(null);

            const request = new Request("http://localhost/api/cron/discovery-v3/manual", {
                method: "POST",
                headers: {
                    authorization: "Bearer test_manual_secret",
                    "content-type": "application/json",
                },
                body: JSON.stringify({}),
            });

            const response = await MANUAL_POST(request);
            const data = await response.json();
            expect(response.status).toBe(400);
            expect(data.error).toContain("slotKey");
            expect(data.nowZurich).toBe("2026-04-04 12:20 Europe/Zurich");
        });

        it("dispatches manual run with explicit slot", async () => {
            vi.mocked(normalizeSlotKey).mockReturnValue("2026-04-04T18:20");
            vi.mocked(triggerDiscoveryRun).mockResolvedValue({
                ok: true,
                accepted: true,
                duplicate: false,
                slotKey: "2026-04-04T18:20",
                runId: "disc_v3_slot_2026_04_04T18_20_manual",
                ledgerId: "ledger_manual_1",
                webhookStatus: 200,
            } as any);

            const request = new Request("http://localhost/api/cron/discovery-v3/manual", {
                method: "POST",
                headers: {
                    authorization: "Bearer test_manual_secret",
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    slotKey: "2026-04-04T18:20",
                    reason: "operator_replay",
                }),
            });

            const response = await MANUAL_POST(request);
            const data = await response.json();
            expect(response.status).toBe(202);
            expect(data.accepted).toBe(true);
            expect(triggerDiscoveryRun).toHaveBeenCalledWith(
                expect.objectContaining({
                    slotKey: "2026-04-04T18:20",
                    schedulerSource: "manual_operator",
                    triggerKind: "manual",
                    reason: "operator_replay",
                })
            );
        });
    });

    describe("POST /api/cron/discovery-v3/health", () => {
        it("returns healthy=true when no alerts are detected", async () => {
            vi.mocked(getExpectedSlotKeys).mockReturnValue([]);
            vi.mocked(prisma.discoveryScheduleRun.findMany)
                .mockResolvedValueOnce([] as any)
                .mockResolvedValueOnce([] as any);
            vi.mocked(prisma.automationLock.findMany)
                .mockResolvedValueOnce([] as any)
                .mockResolvedValueOnce([] as any);
            vi.mocked(prisma.automationLock.deleteMany).mockResolvedValue({
                count: 0,
            } as any);

            const request = new Request("http://localhost/api/cron/discovery-v3/health", {
                method: "POST",
                headers: { authorization: "Bearer test_cron_secret" },
            });

            const response = await HEALTH_POST(request);
            const data = await response.json();
            expect(response.status).toBe(200);
            expect(data.healthy).toBe(true);
            expect(data.activeExpectedSlotKeys).toEqual([]);
            expect(sendAutomationHealthAlert).not.toHaveBeenCalled();
        });

        it("emits missed-slot alert and returns unhealthy", async () => {
            vi.mocked(getExpectedSlotKeys).mockReturnValue(["2026-04-04T07:20"]);
            vi.mocked(prisma.discoveryScheduleRun.findMany)
                .mockResolvedValueOnce([] as any)
                .mockResolvedValueOnce([] as any);
            vi.mocked(prisma.automationLock.findMany)
                .mockResolvedValueOnce([] as any)
                .mockResolvedValueOnce([] as any);
            vi.mocked(prisma.automationLock.deleteMany).mockResolvedValue({
                count: 0,
            } as any);
            vi.mocked(prisma.n8nWebhookEvent.findUnique).mockResolvedValue(null as any);
            vi.mocked(prisma.n8nWebhookEvent.create).mockResolvedValue({} as any);
            vi.mocked(prisma.workflowError.create).mockResolvedValue({} as any);

            const request = new Request("http://localhost/api/cron/discovery-v3/health", {
                method: "POST",
                headers: { authorization: "Bearer test_cron_secret" },
            });

            const response = await HEALTH_POST(request);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.healthy).toBe(false);
            expect(data.alerts[0].code).toBe("MISSED_SCHEDULED_SLOT");
            expect(prisma.n8nWebhookEvent.create).toHaveBeenCalled();
            expect(prisma.workflowError.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        workflowId: "job-discovery-pipeline-v3",
                        errorType: "MISSED_SCHEDULED_SLOT",
                    }),
                })
            );
            expect(sendAutomationHealthAlert).toHaveBeenCalled();
        });

        it("returns 200 when only warning alerts are present", async () => {
            vi.mocked(getExpectedSlotKeys).mockReturnValue(["2026-04-04T07:20"]);
            vi.mocked(prisma.discoveryScheduleRun.findMany).mockReset();
            vi.mocked(prisma.discoveryScheduleRun.findMany)
                .mockResolvedValueOnce([
                    {
                        slotKey: "2026-04-04T07:20",
                        status: "completed",
                        requestedAt: new Date("2026-04-04T05:20:00.000Z"),
                        finishedAt: new Date("2026-04-04T05:21:00.000Z"),
                        usersProcessed: 0,
                        persistedApplications: 0,
                    },
                ] as any)
                .mockResolvedValueOnce([
                    {
                        slotKey: "2026-04-05T18:20",
                        status: "completed",
                        usersProcessed: 0,
                        lockAcquired: true,
                    },
                    {
                        slotKey: "2026-04-05T12:20",
                        status: "completed",
                        usersProcessed: 0,
                        lockAcquired: true,
                    },
                    {
                        slotKey: "2026-04-05T07:20",
                        status: "completed",
                        usersProcessed: 0,
                        lockAcquired: true,
                    },
                ] as any);
            vi.mocked(prisma.automationLock.findMany).mockReset();
            vi.mocked(prisma.automationLock.findMany)
                .mockResolvedValueOnce([] as any)
                .mockResolvedValueOnce([] as any);
            vi.mocked(prisma.automationLock.deleteMany).mockReset();
            vi.mocked(prisma.automationLock.deleteMany).mockResolvedValue({
                count: 0,
            } as any);
            vi.mocked(prisma.n8nWebhookEvent.findUnique).mockReset();
            vi.mocked(prisma.n8nWebhookEvent.findUnique).mockResolvedValue(null as any);
            vi.mocked(prisma.n8nWebhookEvent.create).mockReset();
            vi.mocked(prisma.n8nWebhookEvent.create).mockResolvedValue({} as any);
            vi.mocked(prisma.workflowError.create).mockReset();
            vi.mocked(prisma.workflowError.create).mockResolvedValue({} as any);

            const request = new Request("http://localhost/api/cron/discovery-v3/health", {
                method: "POST",
                headers: { authorization: "Bearer test_cron_secret" },
            });

            const response = await HEALTH_POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.healthy).toBe(false);
            expect(data.alerts).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        code: "ZERO_USERS_PROCESSED_SUSPICIOUS",
                        severity: "warning",
                    }),
                ])
            );
            expect(sendAutomationHealthAlert).toHaveBeenCalled();
        });

        it("keeps historical misses visible without failing current health", async () => {
            vi.mocked(getZurichParts).mockReturnValue({
                year: 2026,
                month: 4,
                day: 5,
                hour: 13,
                minute: 30,
            });
            vi.mocked(getExpectedSlotKeys).mockReturnValue([
                "2026-04-04T07:20",
                "2026-04-05T07:20",
                "2026-04-05T12:20",
            ]);
            vi.mocked(prisma.discoveryScheduleRun.findMany).mockReset();
            vi.mocked(prisma.discoveryScheduleRun.findMany)
                .mockResolvedValueOnce([
                    {
                        slotKey: "2026-04-05T07:20",
                        status: "completed",
                        requestedAt: new Date("2026-04-05T05:20:00.000Z"),
                        finishedAt: new Date("2026-04-05T05:21:00.000Z"),
                        usersProcessed: 1,
                        persistedApplications: 1,
                    },
                    {
                        slotKey: "2026-04-05T12:20",
                        status: "completed",
                        requestedAt: new Date("2026-04-05T10:20:00.000Z"),
                        finishedAt: new Date("2026-04-05T10:21:00.000Z"),
                        usersProcessed: 1,
                        persistedApplications: 1,
                    },
                ] as any)
                .mockResolvedValueOnce([
                    { slotKey: "2026-04-05T12:20", status: "completed", usersProcessed: 1, lockAcquired: true },
                    { slotKey: "2026-04-05T07:20", status: "completed", usersProcessed: 1, lockAcquired: true },
                ] as any);
            vi.mocked(prisma.automationLock.findMany).mockReset();
            vi.mocked(prisma.automationLock.findMany)
                .mockResolvedValueOnce([] as any)
                .mockResolvedValueOnce([] as any);
            vi.mocked(prisma.automationLock.deleteMany).mockReset();
            vi.mocked(prisma.automationLock.deleteMany).mockResolvedValue({
                count: 0,
            } as any);

            const request = new Request("http://localhost/api/cron/discovery-v3/health", {
                method: "POST",
                headers: { authorization: "Bearer test_cron_secret" },
            });

            const response = await HEALTH_POST(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.healthy).toBe(true);
            expect(data.historicalIncidents.missingSlots).toEqual([
                "2026-04-04T07:20",
            ]);
            expect(sendAutomationHealthAlert).not.toHaveBeenCalled();
        });
    });
});
