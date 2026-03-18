import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/contact/telemetry/route";
import {
    getContactTelemetrySnapshot,
    resetContactTelemetryForTests,
} from "@/lib/contact-telemetry";

describe("POST /api/contact/telemetry", () => {
    beforeEach(() => {
        resetContactTelemetryForTests();
    });

    it("returns 400 for invalid event values", async () => {
        const response = await POST(
            new Request("http://localhost/api/contact/telemetry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ event: "submit_success" }),
            })
        );
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain("Invalid telemetry event");
    });

    it("captures allowed funnel events", async () => {
        const response = await POST(
            new Request("http://localhost/api/contact/telemetry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ event: "page_view" }),
            })
        );
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(getContactTelemetrySnapshot().funnel.lifetime.events.page_view).toBe(1);
    });

    it("enforces IP rate limit for telemetry endpoint", async () => {
        const ip = "203.0.113.99";
        for (let i = 0; i < 60; i += 1) {
            const response = await POST(
                new Request("http://localhost/api/contact/telemetry", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-forwarded-for": ip,
                    },
                    body: JSON.stringify({ event: "cta_click" }),
                })
            );
            expect(response.status).toBe(200);
        }

        const limitedResponse = await POST(
            new Request("http://localhost/api/contact/telemetry", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-forwarded-for": ip,
                },
                body: JSON.stringify({ event: "cta_click" }),
            })
        );
        const data = await limitedResponse.json();

        expect(limitedResponse.status).toBe(429);
        expect(data.error).toContain("Too many telemetry requests");
    });
});
