import { NextResponse } from "next/server";
import {
    getCurrentZurichSlotKey,
    getZurichNowLabel,
} from "@/lib/discovery-scheduler";
import { triggerDiscoveryRun } from "@/lib/discovery-trigger";

function unauthorized() {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function resolveSchedulerSource(req: Request) {
    if (req.headers.get("x-vercel-id")) {
        return "vercel_cron";
    }
    if (req.headers.get("x-vercel-cron")) {
        return "vercel_cron";
    }
    return "external_cron";
}

export async function GET(req: Request) {
    return POST(req);
}

export async function POST(req: Request) {
    try {
        const cronSecret = process.env.CRON_SECRET?.trim();
        if (!cronSecret) {
            return NextResponse.json(
                { error: "Cron endpoint misconfigured" },
                { status: 503 }
            );
        }

        const authHeader = req.headers.get("authorization")?.trim();
        if (authHeader !== `Bearer ${cronSecret}`) {
            return unauthorized();
        }

        const slotKey = getCurrentZurichSlotKey(new Date());
        if (!slotKey) {
            return NextResponse.json(
                {
                    ok: true,
                    accepted: false,
                    status: "skipped_not_scheduled_window",
                    nowZurich: getZurichNowLabel(),
                },
                { status: 202 }
            );
        }

        const schedulerSource = resolveSchedulerSource(req);
        const result = await triggerDiscoveryRun({
            slotKey,
            schedulerSource,
            triggerKind: "scheduled",
            reason: "external_cron_dispatch",
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

