import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/contact/diagnostics/route";
import { POST } from "@/app/api/contact/route";
import { resetContactTelemetryForTests } from "@/lib/contact-telemetry";
import { resetContactMailHealthForTests } from "@/lib/contact-mail-health";

function withAntiBotFields(payload: Record<string, unknown>) {
    const generatedSessionId = `session_${Math.random().toString(36).slice(2, 28)}`;
    return JSON.stringify({
        website: "",
        formStartedAt: Date.now() - 5000,
        formSessionId: generatedSessionId,
        ...payload,
    });
}

describe("GET /api/contact/diagnostics", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetContactTelemetryForTests();
        resetContactMailHealthForTests();
        process.env.RESEND_API_KEY = "re_test_key";
        delete process.env.TURNSTILE_SECRET_KEY;
        delete process.env.CONTACT_DIAGNOSTICS_TOKEN;
    });

    it("returns 503 when diagnostics token is not configured", async () => {
        const request = new Request("http://localhost/api/contact/diagnostics");
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.error).toContain("disabled");
    });

    it("returns 401 for invalid diagnostics token", async () => {
        process.env.CONTACT_DIAGNOSTICS_TOKEN = "diag_secret";

        const request = new Request("http://localhost/api/contact/diagnostics", {
            headers: {
                "x-contact-diagnostics-token": "wrong_secret",
            },
        });
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toContain("Unauthorized");
    });

    it("returns captcha and abuse telemetry snapshot for authorized requests", async () => {
        process.env.CONTACT_DIAGNOSTICS_TOKEN = "diag_secret";
        process.env.TURNSTILE_SECRET_KEY = "turnstile_secret";

        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true }),
        } as any);
        await POST(
            new Request("http://localhost/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: withAntiBotFields({
                    name: "Solve",
                    email: "solve@example.com",
                    subject: "support",
                    message: "captcha solve",
                    turnstileToken: "token_solve",
                }),
            })
        );

        vi.mocked(global.fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: false,
                "error-codes": ["invalid-input-response"],
            }),
        } as any);
        await POST(
            new Request("http://localhost/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: withAntiBotFields({
                    name: "Fail",
                    email: "fail@example.com",
                    subject: "support",
                    message: "captcha fail",
                    turnstileToken: "token_fail",
                }),
            })
        );

        await POST(
            new Request("http://localhost/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: withAntiBotFields({
                    name: "Missing Token",
                    email: "missing@example.com",
                    subject: "support",
                    message: "captcha missing token",
                }),
            })
        );

        const request = new Request("http://localhost/api/contact/diagnostics", {
            headers: {
                "x-contact-diagnostics-token": "diag_secret",
            },
        });
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.telemetry.blocked.byReason.turnstile_failed).toBe(1);
        expect(data.telemetry.blocked.byReason.missing_turnstile_token).toBe(1);
        expect(data.telemetry.captcha.solve).toBe(1);
        expect(data.telemetry.captcha.fail).toBe(2);
        expect(data.telemetry.captcha.error).toBe(0);
        expect(data.telemetry.captcha.attempts).toBe(3);
        expect(data.telemetry.captcha.successRate).toBeCloseTo(1 / 3, 4);
        expect(data.telemetry.captcha.errorCodes["invalid-input-response"]).toBe(1);
        expect(data.telemetry.captcha.errorCodes.missing_token).toBe(1);
        expect(data.telemetry.funnel.lifetime.events.captcha_pass).toBe(1);
        expect(data.telemetry.funnel.lifetime.events.captcha_fail).toBe(2);
        expect(data.mailHealth.config.destinationEmail).toBe("contact@autoapply.works");
        expect(data.mailHealth.config.fromEmail).toBe(
            "AutoApply Works <contact@autoapply.works>"
        );
        expect(data.mailHealth.recent.totals.sent).toBe(1);
        expect(
            Array.isArray(data.telemetry.funnel.daily.summary.anomalies)
        ).toBe(true);
    });
});
