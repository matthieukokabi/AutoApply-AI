import { NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import {
    incrementFunnelEvent,
    type ContactFunnelEvent,
} from "@/lib/contact-telemetry";

const CONTACT_TELEMETRY_RATE_LIMIT_MAX_REQUESTS = 60;
const CONTACT_TELEMETRY_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const contactTelemetryRequestLog = new Map<string, number[]>();

const ALLOWED_PUBLIC_EVENTS: ContactFunnelEvent[] = [
    "page_view",
    "cta_click",
    "form_start",
];

function isAllowedPublicEvent(value: unknown): value is ContactFunnelEvent {
    return (
        typeof value === "string" &&
        (ALLOWED_PUBLIC_EVENTS as string[]).includes(value)
    );
}

/**
 * POST /api/contact/telemetry
 * Public event capture for contact funnel steps before submit.
 */
export async function POST(req: Request) {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const event = (body as { event?: unknown })?.event;
    if (!isAllowedPublicEvent(event)) {
        return NextResponse.json({ error: "Invalid telemetry event" }, { status: 400 });
    }

    const clientIp = getClientIp(req) || "unknown";
    if (
        isRateLimited({
            store: contactTelemetryRequestLog,
            key: clientIp,
            maxRequests: CONTACT_TELEMETRY_RATE_LIMIT_MAX_REQUESTS,
            windowMs: CONTACT_TELEMETRY_RATE_LIMIT_WINDOW_MS,
        })
    ) {
        return NextResponse.json(
            { error: "Too many telemetry requests" },
            { status: 429 }
        );
    }

    incrementFunnelEvent(event);
    const response = NextResponse.json({ success: true }, { status: 200 });
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
}
