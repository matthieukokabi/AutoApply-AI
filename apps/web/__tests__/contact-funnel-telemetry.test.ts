import {
    getContactFunnelDailySummary,
    incrementFunnelEvent,
    resetContactTelemetryForTests,
} from "@/lib/contact-telemetry";

describe("contact funnel telemetry summary", () => {
    beforeEach(() => {
        resetContactTelemetryForTests();
    });

    it("does not flag anomalies for healthy completion and captcha rates", () => {
        for (let i = 0; i < 20; i += 1) {
            incrementFunnelEvent("page_view");
            incrementFunnelEvent("cta_click");
            incrementFunnelEvent("form_start");
            incrementFunnelEvent("captcha_pass");
            incrementFunnelEvent("submit_success");
        }

        const summary = getContactFunnelDailySummary();

        expect(summary.summary.completionRateFromFormStart).toBe(1);
        expect(summary.summary.captchaFailRate).toBe(0);
        expect(summary.summary.anomalies).toEqual([]);
    });

    it("flags completion drop anomaly when submit success is too low", () => {
        for (let i = 0; i < 12; i += 1) {
            incrementFunnelEvent("form_start");
        }
        incrementFunnelEvent("submit_success");

        const summary = getContactFunnelDailySummary();
        const anomalyIds = summary.summary.anomalies.map((item) => item.id);

        expect(anomalyIds).toContain("completion_drop");
    });

    it("flags captcha fail spike anomaly when fail rate is too high", () => {
        for (let i = 0; i < 10; i += 1) {
            incrementFunnelEvent("captcha_fail");
        }
        incrementFunnelEvent("captcha_pass");

        const summary = getContactFunnelDailySummary();
        const anomalyIds = summary.summary.anomalies.map((item) => item.id);

        expect(anomalyIds).toContain("captcha_fail_spike");
    });
});
