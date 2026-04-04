import { NextResponse } from "next/server";
import {
    getCurrentZurichSlotKey,
    getZurichNowLabel,
    normalizeSlotKey,
} from "@/lib/discovery-scheduler";
import { triggerDiscoveryRun } from "@/lib/discovery-trigger";

function unauthorized() {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: Request) {
    try {
        const manualSecret =
            process.env.DISCOVERY_MANUAL_TRIGGER_SECRET?.trim() ||
            process.env.CRON_SECRET?.trim();
        if (!manualSecret) {
            return NextResponse.json(
                { error: "Manual trigger endpoint misconfigured" },
                { status: 503 }
            );
        }

        const authHeader = req.headers.get("authorization")?.trim();
        if (authHeader !== `Bearer ${manualSecret}`) {
            return unauthorized();
        }

        let payload: Record<string, unknown> = {};
        try {
            const json = await req.json();
            if (json && typeof json === "object" && !Array.isArray(json)) {
                payload = json as Record<string, unknown>;
            }
        } catch {
            payload = {};
        }

        const slotFromBody = normalizeSlotKey(payload.slotKey);
        const fallbackSlot = getCurrentZurichSlotKey(new Date());
        const slotKey = slotFromBody || fallbackSlot;

        if (!slotKey) {
            return NextResponse.json(
                {
                    error: "slotKey is required outside scheduled windows",
                    nowZurich: getZurichNowLabel(),
                },
                { status: 400 }
            );
        }

        const reason =
            typeof payload.reason === "string" && payload.reason.trim()
                ? payload.reason.trim()
                : "manual_operator_trigger";

        const result = await triggerDiscoveryRun({
            slotKey,
            schedulerSource: "manual_operator",
            triggerKind: "manual",
            reason,
        });

        if (result.duplicate) {
            return NextResponse.json(
                {
                    ok: true,
                    accepted: false,
                    duplicate: true,
                    slotKey: result.slotKey,
                    runId: result.runId,
                    ledgerId: result.ledgerId,
                    existingStatus: result.existingStatus,
                },
                { status: 200 }
            );
        }

        if (!result.ok) {
            return NextResponse.json(
                {
                    ok: false,
                    accepted: false,
                    slotKey: result.slotKey,
                    runId: result.runId,
                    ledgerId: result.ledgerId,
                    errorCode: result.errorCode,
                    errorMessage: result.errorMessage,
                },
                { status: 502 }
            );
        }

        return NextResponse.json(
            {
                ok: true,
                accepted: true,
                duplicate: false,
                slotKey: result.slotKey,
                runId: result.runId,
                ledgerId: result.ledgerId,
                webhookStatus: result.webhookStatus,
            },
            { status: 202 }
        );
    } catch (error) {
        return NextResponse.json(
            {
                error: "Internal server error",
                reason: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}

