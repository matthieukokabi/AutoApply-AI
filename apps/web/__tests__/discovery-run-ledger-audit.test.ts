import { createRequire } from "module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const audit = require("../scripts/discovery_run_ledger_audit.js");

describe("discovery run ledger audit helpers", () => {
    it("parses default and explicit arguments", () => {
        const defaults = audit.parseArgs([]);
        expect(defaults.count).toBe(12);
        expect(defaults.workflowId).toBe("job-discovery-pipeline-v3");
        expect(defaults.runId).toBeNull();
        expect(defaults.jsonOnly).toBe(false);

        const parsed = audit.parseArgs([
            "--count",
            "5",
            "--hours",
            "24",
            "--run-id",
            "disc_v3_test_1",
            "--workflow-id",
            "wf-custom",
            "--json",
            "--fail-on-anomaly",
            "--zero-tailored-streak-threshold",
            "3",
            "--block-rate-spike-threshold",
            "0.75",
            "--min-runs-for-spike",
            "4",
        ]);

        expect(parsed.count).toBe(1);
        expect(parsed.hours).toBe(24);
        expect(parsed.runId).toBe("disc_v3_test_1");
        expect(parsed.workflowId).toBe("wf-custom");
        expect(parsed.jsonOnly).toBe(true);
        expect(parsed.failOnAnomaly).toBe(true);
        expect(parsed.zeroTailoredStreakThreshold).toBe(3);
        expect(parsed.blockRateSpikeThreshold).toBe(0.75);
        expect(parsed.minRunsForSpike).toBe(4);
    });

    it("extracts run metrics safely from metadata", () => {
        const metrics = audit.extractRunMetrics({
            metricsUpdatedAt: "2026-04-13T08:00:00.000Z",
            runMetrics: {
                tailoredCount: 2,
                discoveredCount: 4,
                factualGuardBlockedCount: "1",
                coverLetterQualityBlockedCount: "0",
            },
        });

        expect(metrics).toEqual({
            tailoredCount: 2,
            discoveredCount: 4,
            factualGuardBlockedCount: 1,
            coverLetterQualityBlockedCount: 0,
            metricsUpdatedAt: "2026-04-13T08:00:00.000Z",
        });

        const emptyMetrics = audit.extractRunMetrics(null);
        expect(emptyMetrics.tailoredCount).toBeNull();
        expect(emptyMetrics.discoveredCount).toBeNull();
        expect(emptyMetrics.factualGuardBlockedCount).toBeNull();
        expect(emptyMetrics.coverLetterQualityBlockedCount).toBeNull();
        expect(emptyMetrics.metricsUpdatedAt).toBeNull();
    });

    it("summarizes run outcomes and detects anomalies", () => {
        const rows = [
            {
                id: "run-3",
                runId: "disc_r3",
                slotKey: "disc_r3",
                status: "completed",
                triggerKind: "external_cron",
                schedulerSource: "vercel_cron",
                n8nExecutionId: "5003",
                requestedAt: "2026-04-13T09:00:00.000Z",
                startedAt: "2026-04-13T09:00:01.000Z",
                finishedAt: "2026-04-13T09:03:00.000Z",
                usersProcessed: 1,
                persistedApplications: 1,
                errorCode: null,
                errorMessage: null,
                metadata: {
                    runMetrics: {
                        tailoredCount: 0,
                        discoveredCount: 1,
                        factualGuardBlockedCount: 1,
                        coverLetterQualityBlockedCount: 0,
                    },
                },
            },
            {
                id: "run-2",
                runId: "disc_r2",
                slotKey: "disc_r2",
                status: "completed",
                triggerKind: "external_cron",
                schedulerSource: "vercel_cron",
                n8nExecutionId: "5002",
                requestedAt: "2026-04-13T05:00:00.000Z",
                startedAt: "2026-04-13T05:00:01.000Z",
                finishedAt: "2026-04-13T05:02:00.000Z",
                usersProcessed: 1,
                persistedApplications: 1,
                errorCode: null,
                errorMessage: null,
                metadata: {
                    runMetrics: {
                        tailoredCount: 0,
                        discoveredCount: 1,
                        factualGuardBlockedCount: 0,
                        coverLetterQualityBlockedCount: 1,
                    },
                },
            },
            {
                id: "run-1",
                runId: "disc_r1",
                slotKey: "disc_r1",
                status: "failed",
                triggerKind: "external_cron",
                schedulerSource: "vercel_cron",
                n8nExecutionId: "5001",
                requestedAt: "2026-04-13T01:00:00.000Z",
                startedAt: "2026-04-13T01:00:01.000Z",
                finishedAt: "2026-04-13T01:01:00.000Z",
                usersProcessed: 0,
                persistedApplications: 0,
                errorCode: "N8N_EXECUTION_FAILED",
                errorMessage: "boom",
                metadata: {},
            },
        ];

        const summary = audit.summarizeRuns(rows, {
            zeroTailoredStreakThreshold: 2,
            blockRateSpikeThreshold: 0.5,
            minRunsForSpike: 2,
        });

        expect(summary.totalRunsInspected).toBe(3);
        expect(summary.completedRuns).toBe(2);
        expect(summary.failedRuns).toBe(1);
        expect(summary.runsWithZeroTailoredOutputs).toBe(2);
        expect(summary.runsWithFactualGuardBlocks).toBe(1);
        expect(summary.runsWithCoverLetterQualityBlocks).toBe(1);
        expect(summary.runsMissingExpectedSummaryFields).toBe(0);
        expect(summary.latestRunStatus).toBe("completed");

        const anomalyCodes = new Set(
            summary.anomalies.map((anomaly: { code: string }) => anomaly.code)
        );
        expect(anomalyCodes.has("failed_runs_present")).toBe(true);
        expect(anomalyCodes.has("repeated_zero_tailored_runs")).toBe(true);
        expect(anomalyCodes.has("factual_guard_block_rate_spike")).toBe(true);
        expect(anomalyCodes.has("cover_letter_block_rate_spike")).toBe(true);
    });

    it("flags empty windows as no_recent_runs_found anomaly", () => {
        const anomalies = audit.detectAnomalies([]);
        expect(anomalies).toHaveLength(1);
        expect(anomalies[0].code).toBe("no_recent_runs_found");
    });
});
