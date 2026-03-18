import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { afterEach, describe, expect, it } from "vitest";

const TEMP_DIRS: string[] = [];

afterEach(() => {
    for (const dir of TEMP_DIRS.splice(0, TEMP_DIRS.length)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

function createTempDir() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "telemetry-history-"));
    TEMP_DIRS.push(dir);
    return dir;
}

describe("telemetry history store script", () => {
    it("persists conversion/sentinel/perf snapshots and outputs rolling comparisons", () => {
        const reportsDir = createTempDir();
        const outputPath = path.join(reportsDir, "wave7-telemetry-history-test.json");
        const storePath = path.join(reportsDir, "wave7-telemetry-history-store.json");
        const configPath = path.join(reportsDir, "telemetry-history-store.json");

        fs.writeFileSync(
            configPath,
            JSON.stringify(
                {
                    retentionDays: 30,
                    maxEntriesPerStream: 100,
                    rollingWindowsDays: [7, 14, 30],
                    minSamplesPerWindow: 1,
                },
                null,
                2
            )
        );

        fs.writeFileSync(
            path.join(reportsDir, "wave6-conversion-trend-live-20260318_220000.json"),
            JSON.stringify(
                {
                    generatedAt: "2026-03-18T22:00:00.000Z",
                    status: "pass",
                    sourceMode: "live",
                    anomalyCount: 0,
                    keyMetrics: {
                        dailyCompletionRateFromFormStart: 0.45,
                        dailyCaptchaFailRate: 0.11,
                    },
                    dataQuality: {
                        qualityScore: 95,
                    },
                    funnel: {
                        daily: {
                            summary: {
                                formStarts: 22,
                            },
                        },
                    },
                },
                null,
                2
            )
        );

        fs.writeFileSync(
            path.join(reportsDir, "wave6-conversion-sentinel-20260318_220100.json"),
            JSON.stringify(
                {
                    generatedAt: "2026-03-18T22:01:00.000Z",
                    status: "pass",
                    summary: {
                        triggered: false,
                        triggerCode: null,
                        highestRegressionConfidence: "none",
                        alertDispatch: {
                            status: "no_alert",
                        },
                    },
                },
                null,
                2
            )
        );

        fs.writeFileSync(
            path.join(reportsDir, "wave5-perf-trend-20260318_220200.json"),
            JSON.stringify(
                {
                    generatedAt: "2026-03-18T22:02:00.000Z",
                    overallStatus: "pass",
                    deterministicRoutes: {
                        highIntentRoute: "/en/sign-up",
                    },
                    routeTrends: [
                        {
                            route: "/en/sign-up",
                            percentiles: {
                                lcpMs: { p75: 1210 },
                                cls: { p75: 0.03 },
                                jsBytes: { p75: 450000 },
                                imageBytes: { p75: 12000 },
                            },
                        },
                    ],
                },
                null,
                2
            )
        );

        const result = spawnSync("node", ["scripts/telemetry_history_store.js"], {
            cwd: path.resolve(process.cwd()),
            env: {
                ...process.env,
                TELEMETRY_HISTORY_REPORTS_DIR: reportsDir,
                TELEMETRY_HISTORY_STORE_PATH: storePath,
                TELEMETRY_HISTORY_CONFIG_PATH: configPath,
                REPORT_PATH: outputPath,
            },
            encoding: "utf8",
        });

        expect(result.status).toBe(0);

        const output = JSON.parse(fs.readFileSync(outputPath, "utf8"));
        const store = JSON.parse(fs.readFileSync(storePath, "utf8"));

        expect(output.streamCounts.conversion).toBe(1);
        expect(output.streamCounts.sentinel).toBe(1);
        expect(output.streamCounts.perf).toBe(1);
        expect(output.rollingComparisons.conversion.completionRateFromFormStart).toHaveProperty("7d");
        expect(store.streams.conversion[0].sourceMode).toBe("live");
        expect(store.streams.perf[0].route).toBe("/en/sign-up");
    });

    it("applies retention and compaction on persistent store", () => {
        const reportsDir = createTempDir();
        const outputPath = path.join(reportsDir, "wave7-telemetry-history-test.json");
        const storePath = path.join(reportsDir, "wave7-telemetry-history-store.json");
        const configPath = path.join(reportsDir, "telemetry-history-store.json");

        fs.writeFileSync(
            configPath,
            JSON.stringify(
                {
                    retentionDays: 1,
                    maxEntriesPerStream: 1,
                    rollingWindowsDays: [7],
                    minSamplesPerWindow: 1,
                },
                null,
                2
            )
        );

        const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
        const recentDateA = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        const recentDateB = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

        fs.writeFileSync(
            storePath,
            JSON.stringify(
                {
                    updatedAt: oldDate,
                    streams: {
                        conversion: [
                            { generatedAt: oldDate, sourceReport: "old-c.json" },
                            {
                                generatedAt: recentDateA,
                                sourceReport: "recent-c-1.json",
                                completionRateFromFormStart: 0.4,
                            },
                            {
                                generatedAt: recentDateB,
                                sourceReport: "recent-c-2.json",
                                completionRateFromFormStart: 0.5,
                            },
                        ],
                        sentinel: [
                            { generatedAt: oldDate, sourceReport: "old-s.json" },
                            { generatedAt: recentDateB, sourceReport: "recent-s-1.json" },
                        ],
                        perf: [
                            { generatedAt: oldDate, sourceReport: "old-p.json" },
                            {
                                generatedAt: recentDateA,
                                sourceReport: "recent-p-1.json",
                                lcpP75: 1500,
                            },
                            {
                                generatedAt: recentDateB,
                                sourceReport: "recent-p-2.json",
                                lcpP75: 1200,
                            },
                        ],
                    },
                },
                null,
                2
            )
        );

        const result = spawnSync("node", ["scripts/telemetry_history_store.js"], {
            cwd: path.resolve(process.cwd()),
            env: {
                ...process.env,
                TELEMETRY_HISTORY_REPORTS_DIR: reportsDir,
                TELEMETRY_HISTORY_STORE_PATH: storePath,
                TELEMETRY_HISTORY_CONFIG_PATH: configPath,
                REPORT_PATH: outputPath,
            },
            encoding: "utf8",
        });

        expect(result.status).toBe(0);

        const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
        expect(store.streams.conversion).toHaveLength(1);
        expect(store.streams.sentinel).toHaveLength(1);
        expect(store.streams.perf).toHaveLength(1);
        expect(store.streams.conversion[0].sourceReport).toContain("recent-c-2");
        expect(store.streams.perf[0].sourceReport).toContain("recent-p-2");
    });
});
