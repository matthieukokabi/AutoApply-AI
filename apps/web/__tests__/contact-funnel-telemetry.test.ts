import {
    getContactFunnelDailySummary,
    getContactTelemetrySnapshot,
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
        const stage = summary.summary.dropOffAttribution.find(
            (item) => item.stage === "captcha_pass_to_submit_success"
        );
        expect(stage?.dropOffRate).toBe(0);
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

    it("tracks route/campaign segmentation for funnel events", () => {
        incrementFunnelEvent("page_view", {
            routePath: "/en/contact",
            campaign: "spring_launch",
        });
        incrementFunnelEvent("form_start", {
            routePath: "/en/contact",
            campaign: "spring_launch",
        });
        incrementFunnelEvent("submit_success", {
            routePath: "/en/contact",
            campaign: "spring_launch",
        });

        const snapshot = getContactTelemetrySnapshot();
        const routeSegment = snapshot.funnel.lifetime.segmentation.byRoute.find(
            (item) => item.segment === "/en/contact"
        );
        const campaignSegment =
            snapshot.funnel.lifetime.segmentation.byCampaign.find(
                (item) => item.segment === "spring_launch"
            );

        expect(routeSegment?.summary.submitSuccess).toBe(1);
        expect(campaignSegment?.summary.formStarts).toBe(1);
        expect(snapshot.funnel.weekly.windowDays).toBe(7);
        expect(snapshot.funnel.weekly.days).toHaveLength(7);
    });
});
