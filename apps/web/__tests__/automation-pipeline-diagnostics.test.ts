import { createRequire } from "module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const diagnostics = require("../scripts/automation_pipeline_diagnostics.js");

describe("automation pipeline diagnostics script helpers", () => {
    it("computes schedule cadence from trigger interval rules", () => {
        expect(
            diagnostics.pickScheduleCadenceMinutes([
                {
                    name: "Schedule Trigger",
                    parameters: { rule: { interval: [{ field: "hours", hoursInterval: 4 }] } },
                },
            ])
        ).toBe(240);

        expect(
            diagnostics.pickScheduleCadenceMinutes([
                {
                    name: "Schedule Trigger",
                    parameters: {
                        rule: { interval: [{ field: "minutes", minutesInterval: 30 }] },
                    },
                },
            ])
        ).toBe(30);
    });

    it("raises required incident alerts for missed scheduler and failing runs", () => {
        const staleSuccess = new Date(Date.now() - 400 * 60 * 1000).toISOString();
        const alerts = diagnostics.inferAlerts({
            cadenceMinutes: 240,
            latestSuccessfulRunAt: staleSuccess,
            runSummaries: [
                {
                    status: "error",
                    failureReason: "execution_error",
                    stageSummaries: [],
                },
                {
                    status: "success",
                    failureReason: "zero_jobs_after_normalization",
                    stageSummaries: [
                        {
                            stage: "LLM CV Tailoring",
                            hasError: true,
                        },
                    ],
                },
                {
                    status: "success",
                    failureReason: "zero_jobs_after_normalization",
                    stageSummaries: [],
                },
                {
                    status: "success",
                    failureReason: "zero_jobs_after_normalization",
                    stageSummaries: [],
                },
            ],
        });

        const codes = new Set(alerts.map((alert: { code: string }) => alert.code));
        expect(codes.has("scheduler_missed_threshold")).toBe(true);
        expect(codes.has("repeated_zero_jobs")).toBe(true);
        expect(codes.has("generation_failures_detected")).toBe(true);
        expect(codes.has("end_to_end_run_failure")).toBe(true);
    });
});
