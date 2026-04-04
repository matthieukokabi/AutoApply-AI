import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getExpectedSlotKeys, getZurichNowLabel } from "@/lib/discovery-scheduler";
import { sendAutomationHealthAlert } from "@/lib/email";

type HealthAlert = {
    code: string;
    severity: "warning" | "critical";
    detail: string;
    slotKey?: string | null;
};

function unauthorized() {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function nowMinusMinutes(minutes: number) {
    return new Date(Date.now() - minutes * 60_000);
}

function isFailureStatus(status: string) {
    return status === "failed" || status === "trigger_failed";
}

async function emitAlertOnce(alert: HealthAlert, context: Record<string, unknown>) {
    const alertKey = `disc_health:${alert.code}:${alert.slotKey || "none"}`;

    const existing = await prisma.n8nWebhookEvent.findUnique({
        where: { idempotencyKey: alertKey },
        select: { id: true },
    });
    if (existing) {
        return { emitted: false as const, alertKey };
    }

    await prisma.n8nWebhookEvent.create({
        data: {
            idempotencyKey: alertKey,
            type: "discovery_scheduler_alert",
            runId: "discovery_health_check",
        },
    });

    await prisma.workflowError.create({
        data: {
            workflowId: "job-discovery-pipeline-v3",
            nodeName: "external_scheduler_health",
            errorType: alert.code,
            message: alert.detail.slice(0, 500),
            payload: context as Prisma.InputJsonValue,
        },
    });

    const recipients = String(process.env.AUTOMATION_ALERT_EMAIL_TO || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

    if (recipients.length > 0) {
        await sendAutomationHealthAlert(
            recipients,
            `[AutoApply][${alert.severity.toUpperCase()}] Discovery scheduler health alert`,
            [
                `Code: ${alert.code}`,
                `Detail: ${alert.detail}`,
                `Slot: ${alert.slotKey || "n/a"}`,
                `Now: ${getZurichNowLabel()}`,
            ]
        );
    }

    return { emitted: true as const, alertKey };
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

        const expectedSlotKeys = getExpectedSlotKeys(new Date(), 2, 45);
        const rows = expectedSlotKeys.length
            ? await prisma.discoveryScheduleRun.findMany({
                  where: {
                      triggerKind: "scheduled",
                      slotKey: { in: expectedSlotKeys },
                  },
                  orderBy: { slotKey: "asc" },
              })
            : [];

        const rowBySlot = new Map(rows.map((row) => [row.slotKey, row]));
        const missingSlots = expectedSlotKeys.filter((slotKey) => !rowBySlot.has(slotKey));

        const stalePending = rows.filter(
            (row) =>
                (row.status === "accepted" || row.status === "triggered") &&
                row.requestedAt < nowMinusMinutes(90)
        );
        const failedRows = rows.filter((row) => isFailureStatus(row.status));

        const recentScheduled = await prisma.discoveryScheduleRun.findMany({
            where: { triggerKind: "scheduled" },
            orderBy: { requestedAt: "desc" },
            take: 3,
            select: {
                slotKey: true,
                status: true,
                usersProcessed: true,
                lockAcquired: true,
            },
        });

        const consecutiveFailures =
            recentScheduled.length >= 3 &&
            recentScheduled.every((row) => isFailureStatus(row.status));
        const suspiciousZeroUsers =
            recentScheduled.length >= 3 &&
            recentScheduled.every(
                (row) =>
                    row.status === "completed" &&
                    row.lockAcquired === true &&
                    row.usersProcessed === 0
            );

        const staleLocks = await prisma.automationLock.findMany({
            where: {
                workflow: "discovery_v3",
                expiresAt: { lt: nowMinusMinutes(10) },
            },
            select: { id: true, runId: true, slotId: true, expiresAt: true },
            take: 20,
        });

        const alerts: HealthAlert[] = [];

        for (const slotKey of missingSlots) {
            alerts.push({
                code: "MISSED_SCHEDULED_SLOT",
                severity: "critical",
                detail: `No discovery scheduler run was recorded for expected slot ${slotKey}.`,
                slotKey,
            });
        }

        for (const row of stalePending) {
            alerts.push({
                code: "RUN_STUCK_PENDING",
                severity: "critical",
                detail: `Discovery run for slot ${row.slotKey} is still ${row.status} after 90 minutes.`,
                slotKey: row.slotKey,
            });
        }

        for (const row of failedRows) {
            alerts.push({
                code: "RUN_FAILED",
                severity: "critical",
                detail: `Discovery run for slot ${row.slotKey} failed with status ${row.status}.`,
                slotKey: row.slotKey,
            });
        }

        if (consecutiveFailures) {
            alerts.push({
                code: "CONSECUTIVE_FAILURES",
                severity: "critical",
                detail: "The last three scheduled discovery runs failed.",
            });
        }

        if (suspiciousZeroUsers) {
            alerts.push({
                code: "ZERO_USERS_PROCESSED_SUSPICIOUS",
                severity: "warning",
                detail: "The last three completed discovery runs processed zero users.",
            });
        }

        if (staleLocks.length > 0) {
            alerts.push({
                code: "STALE_DISCOVERY_LOCKS",
                severity: "warning",
                detail: `${staleLocks.length} expired discovery locks remain in storage.`,
                slotKey: staleLocks[0]?.slotId || null,
            });
        }

        const emittedAlerts = [];
        for (const alert of alerts) {
            const emission = await emitAlertOnce(alert, {
                generatedAt: new Date().toISOString(),
                expectedSlotKeys,
                rowCount: rows.length,
                staleLocks,
                recentScheduled,
                alert,
            });
            emittedAlerts.push({
                ...alert,
                emitted: emission.emitted,
                alertKey: emission.alertKey,
            });
        }

        if (alerts.length > 0) {
            return NextResponse.json(
                {
                    healthy: false,
                    nowZurich: getZurichNowLabel(),
                    expectedSlotKeys,
                    alerts: emittedAlerts,
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            healthy: true,
            nowZurich: getZurichNowLabel(),
            expectedSlotKeys,
            observedSlots: rows.map((row) => ({
                slotKey: row.slotKey,
                status: row.status,
                usersProcessed: row.usersProcessed,
                persistedApplications: row.persistedApplications,
                requestedAt: row.requestedAt.toISOString(),
                finishedAt: row.finishedAt?.toISOString() || null,
            })),
        });
    } catch (error) {
        return NextResponse.json(
            {
                healthy: false,
                error: "Internal server error",
                reason: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
