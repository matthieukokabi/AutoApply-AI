import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { triggerDiscoveryRun } from "@/lib/discovery-trigger";

describe("triggerDiscoveryRun", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.N8N_WEBHOOK_SECRET = "test_webhook_secret";
        process.env.N8N_WEBHOOK_URL = "https://n8n.example.com";
        process.env.N8N_DISCOVERY_V3_WEBHOOK_URL =
            "https://n8n.example.com/webhook/stale-composite-path";

        vi.mocked(prisma.discoveryScheduleRun.create).mockResolvedValue({
            id: "ledger_1",
            runId: "disc_v3_slot_2026_08_02T07_20_scheduled",
            status: "accepted",
            slotKey: "2026-08-02T07:20",
        } as never);
        vi.mocked(prisma.discoveryScheduleRun.update).mockResolvedValue({} as never);
    });

    it("retries the canonical discovery path when an explicit override returns 404", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(new Response("not registered", { status: 404 }))
            .mockResolvedValueOnce(new Response("started", { status: 200 }));

        const result = await triggerDiscoveryRun({
            slotKey: "2026-08-02T07:20",
            schedulerSource: "vercel_cron",
            triggerKind: "scheduled",
        });

        expect(result.ok).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[0][0]).toBe(
            "https://n8n.example.com/webhook/stale-composite-path"
        );
        expect(fetchMock.mock.calls[1][0]).toBe(
            "https://n8n.example.com/webhook/discovery-pipeline-v3"
        );
        expect(prisma.discoveryScheduleRun.update).toHaveBeenCalledWith({
            where: { id: "ledger_1" },
            data: { status: "triggered" },
        });
    });

    it("does not retry non-404 failures", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(new Response("upstream error", { status: 500 }));

        const result = await triggerDiscoveryRun({
            slotKey: "2026-08-02T07:20",
            schedulerSource: "vercel_cron",
            triggerKind: "scheduled",
        });

        expect(result.ok).toBe(false);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({ errorCode: "N8N_TRIGGER_HTTP_500" });
    });
});
