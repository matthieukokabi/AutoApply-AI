import { NextResponse } from "next/server";
import { getContactTelemetrySnapshot } from "@/lib/contact-telemetry";

const CONTACT_DIAGNOSTICS_HEADER = "x-contact-diagnostics-token";

/**
 * GET /api/contact/diagnostics
 * Read-only telemetry for funnel + CAPTCHA + abuse counters.
 * Requires CONTACT_DIAGNOSTICS_TOKEN and matching request header.
 */
export async function GET(req: Request) {
    const diagnosticsToken = process.env.CONTACT_DIAGNOSTICS_TOKEN?.trim();
    if (!diagnosticsToken) {
        return NextResponse.json(
            { error: "Contact diagnostics endpoint is disabled" },
            { status: 503 }
        );
    }

    const providedToken = req.headers.get(CONTACT_DIAGNOSTICS_HEADER)?.trim();
    if (!providedToken || providedToken !== diagnosticsToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const response = NextResponse.json(
        {
            telemetry: getContactTelemetrySnapshot(),
        },
        { status: 200 }
    );
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
}
