export const DISCOVERY_SCHEDULE_TIMEZONE = "Europe/Zurich";
export const DISCOVERY_SLOT_TIMES = [
    { hour: 7, minute: 20 },
    { hour: 12, minute: 20 },
    { hour: 18, minute: 20 },
];
export const DISCOVERY_SLOT_TOLERANCE_MINUTES = 45;

function pad(value: number) {
    return String(value).padStart(2, "0");
}

type ZurichParts = {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
};

function toNumber(part: string | undefined, fallback = 0) {
    const parsed = Number(part);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function getZurichParts(date: Date = new Date()): ZurichParts {
    const formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: DISCOVERY_SCHEDULE_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    });
    const parts = formatter.formatToParts(date);
    const map = new Map(parts.map((part) => [part.type, part.value]));

    return {
        year: toNumber(map.get("year")),
        month: toNumber(map.get("month")),
        day: toNumber(map.get("day")),
        hour: toNumber(map.get("hour")),
        minute: toNumber(map.get("minute")),
    };
}

export function formatZurichDayKey(parts: ZurichParts) {
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function formatSlotKey(dayKey: string, hour: number, minute: number) {
    return `${dayKey}T${pad(hour)}:${pad(minute)}`;
}

export function normalizeSlotKey(value: unknown) {
    if (typeof value !== "string") {
        return null;
    }

    const slotKey = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(slotKey)) {
        return null;
    }

    return slotKey;
}

function slotKeyToNaiveMs(slotKey: string) {
    const match = slotKey.match(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
    );
    if (!match) {
        return null;
    }

    const [, year, month, day, hour, minute] = match;
    return Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        0,
        0
    );
}

export function getCurrentZurichSlotKey(
    now: Date = new Date(),
    toleranceMinutes = DISCOVERY_SLOT_TOLERANCE_MINUTES
) {
    const parts = getZurichParts(now);
    const dayKey = formatZurichDayKey(parts);
    const nowMinutes = parts.hour * 60 + parts.minute;

    let matched: { hour: number; minute: number } | null = null;
    let smallestDelta = Number.POSITIVE_INFINITY;

    for (const slot of DISCOVERY_SLOT_TIMES) {
        const slotMinutes = slot.hour * 60 + slot.minute;
        const delta = Math.abs(nowMinutes - slotMinutes);
        if (delta <= toleranceMinutes && delta < smallestDelta) {
            matched = slot;
            smallestDelta = delta;
        }
    }

    if (!matched) {
        return null;
    }

    return formatSlotKey(dayKey, matched.hour, matched.minute);
}

export function buildDiscoveryRunId(slotKey: string, triggerKind: string) {
    const safeSlot = String(slotKey || "")
        .replace(/[^0-9A-Za-z]+/g, "_")
        .replace(/^_+|_+$/g, "");
    const safeKind = String(triggerKind || "scheduled")
        .replace(/[^0-9A-Za-z]+/g, "_")
        .replace(/^_+|_+$/g, "");
    return `disc_v3_slot_${safeSlot}_${safeKind}`;
}

export function resolveDiscoveryWebhookUrl() {
    const explicit = process.env.N8N_DISCOVERY_V3_WEBHOOK_URL?.trim();
    if (explicit) {
        return explicit;
    }

    const base = process.env.N8N_WEBHOOK_URL?.trim();
    if (!base) {
        return null;
    }

    return `${base.replace(/\/$/, "")}/webhook/discovery-pipeline-v3`;
}

function addDays(dayKey: string, days: number) {
    const [y, m, d] = dayKey.split("-").map((value) => Number(value));
    const date = new Date(Date.UTC(y, m - 1, d + days));
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
        date.getUTCDate()
    )}`;
}

export function getExpectedSlotKeys(
    now: Date = new Date(),
    lookbackDays = 2,
    graceMinutes = DISCOVERY_SLOT_TOLERANCE_MINUTES
) {
    const parts = getZurichParts(now);
    const today = formatZurichDayKey(parts);
    const nowNaiveMs = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        0,
        0
    );
    const cutoffMs = nowNaiveMs - graceMinutes * 60_000;

    const dayKeys = new Set<string>();
    for (let i = 0; i <= lookbackDays; i += 1) {
        dayKeys.add(addDays(today, -i));
    }

    const expected: string[] = [];
    for (const dayKey of Array.from(dayKeys).sort()) {
        for (const slot of DISCOVERY_SLOT_TIMES) {
            const slotKey = formatSlotKey(dayKey, slot.hour, slot.minute);
            const slotMs = slotKeyToNaiveMs(slotKey);
            if (slotMs !== null && slotMs <= cutoffMs) {
                expected.push(slotKey);
            }
        }
    }

    return expected;
}

export function getZurichNowLabel(now: Date = new Date()) {
    const parts = getZurichParts(now);
    return `${formatZurichDayKey(parts)} ${pad(parts.hour)}:${pad(parts.minute)} ${DISCOVERY_SCHEDULE_TIMEZONE}`;
}
