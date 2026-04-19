import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "child_process";

const TEMP_DIRS: string[] = [];

afterEach(() => {
    for (const dir of TEMP_DIRS.splice(0, TEMP_DIRS.length)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

function createTempDir() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "conversion-sentinel-"));
    TEMP_DIRS.push(dir);
    return dir;
}

function writeTrendReport(
    filePath: string,
    completionRates: number[],
    options?: {
        generatedAt?: string;
        organicFormStarts?: number;
        organicCompletionRate?: number;
        status?: "pass" | "alert" | "fail";
        sourceMode?: string;
        failureCodes?: string[];
    }
) {
    const days = completionRates.map((rate, index) => ({
        date: `2026-03-${String(index + 10).padStart(2, "0")}`,
        summary: {
            formStarts: 20,
            completionRateFromFormStart: rate,
        },
    }));

    fs.writeFileSync(
        filePath,
        JSON.stringify(
            {
                generatedAt: options?.generatedAt || "2026-03-18T22:00:00.000Z",
                status: options?.status ?? "pass",
                sourceMode: options?.sourceMode ?? "live",
                failureCodes: options?.failureCodes ?? [],
                channels: {
                    organic: {
                        formStarts: options?.organicFormStarts ?? 12,
                        submitSuccess: Math.round(
                            (options?.organicCompletionRate ?? 0.55) *
                                (options?.organicFormStarts ?? 12)
                        ),
                        completionRateFromFormStart:
                            options?.organicCompletionRate ?? 0.55,
                    },
                },
                funnel: {
                    weekly: {
                        days,
                    },
                },
            },
            null,
            2
        )
    );
}

describe("conversion regression sentinel script", () => {
    it("passes for stable weekly conversion trend", () => {
        const tmpDir = createTempDir();
        const trendReportPath = path.join(tmpDir, "wave5-conversion-trend-stable.json");
        const outputReportPath = path.join(tmpDir, "wave5-conversion-sentinel-output.json");

        writeTrendReport(trendReportPath, [0.58, 0.6, 0.59, 0.57, 0.58, 0.6, 0.59]);

        const result = spawnSync("node", ["scripts/conversion_regression_sentinel.js"], {
            cwd: path.resolve(process.cwd()),
            env: {
                ...process.env,
                CONVERSION_SENTINEL_SOURCE_REPORT: trendReportPath,
                REPORT_PATH: outputReportPath,
            },
            encoding: "utf8",
        });

        expect(result.status).toBe(0);
        const output = JSON.parse(fs.readFileSync(outputReportPath, "utf8"));
        expect(output.status).toBe("pass");
        expect(output.summary.triggered).toBe(false);
    });

    it("fails when completion drop exceeds threshold in consecutive windows", () => {
        const tmpDir = createTempDir();
        const trendReportPath = path.join(tmpDir, "wave5-conversion-trend-regression.json");
        const outputReportPath = path.join(tmpDir, "wave5-conversion-sentinel-output.json");

        writeTrendReport(trendReportPath, [0.61, 0.6, 0.62, 0.34, 0.33, 0.32, 0.31]);

        const result = spawnSync("node", ["scripts/conversion_regression_sentinel.js"], {
            cwd: path.resolve(process.cwd()),
            env: {
                ...process.env,
                CONVERSION_SENTINEL_SOURCE_REPORT: trendReportPath,
                REPORT_PATH: outputReportPath,
            },
            encoding: "utf8",
        });

        expect(result.status).toBe(1);
        const output = JSON.parse(fs.readFileSync(outputReportPath, "utf8"));
        expect(output.status).toBe("fail");
        expect(output.summary.triggered).toBe(true);
        expect(output.summary.triggerReason).toContain("completion_rate_drop");
    });

    it("does not fail on sparse organic traffic even when organic completion is low", () => {
        const tmpDir = createTempDir();
        const trendReportPath = path.join(tmpDir, "wave5-conversion-trend-organic-sparse.json");
        const outputReportPath = path.join(tmpDir, "wave5-conversion-sentinel-output.json");
        const historyStorePath = path.join(tmpDir, "wave7-telemetry-history-store.json");

        writeTrendReport(trendReportPath, [0.59, 0.6, 0.58, 0.6, 0.59, 0.61, 0.6], {
            generatedAt: "2026-03-18T22:00:00.000Z",
            organicFormStarts: 4,
            organicCompletionRate: 0,
        });

        fs.writeFileSync(
            historyStorePath,
            JSON.stringify(
                {
                    streams: {
                        conversion: [
                            {
                                generatedAt: "2026-03-10T22:00:00.000Z",
                                sourceMode: "live",
                                channels: {
                                    organic: {
                                        formStarts: 18,
                                        completionRateFromFormStart: 0.55,
                                    },
                                },
                            },
                            {
                                generatedAt: "2026-03-11T22:00:00.000Z",
                                sourceMode: "live",
                                channels: {
                                    organic: {
                                        formStarts: 16,
                                        completionRateFromFormStart: 0.52,
                                    },
                                },
                            },
                            {
                                generatedAt: "2026-03-12T22:00:00.000Z",
                                sourceMode: "live",
                                channels: {
                                    organic: {
                                        formStarts: 20,
                                        completionRateFromFormStart: 0.57,
                                    },
                                },
                            },
                            {
                                generatedAt: "2026-03-13T22:00:00.000Z",
                                sourceMode: "live",
                                channels: {
                                    organic: {
                                        formStarts: 14,
                                        completionRateFromFormStart: 0.54,
                                    },
                                },
                            },
                        ],
                    },
                },
                null,
                2
            )
        );

        const result = spawnSync("node", ["scripts/conversion_regression_sentinel.js"], {
            cwd: path.resolve(process.cwd()),
            env: {
                ...process.env,
                CONVERSION_SENTINEL_SOURCE_REPORT: trendReportPath,
                CONVERSION_SENTINEL_HISTORY_STORE_PATH: historyStorePath,
                REPORT_PATH: outputReportPath,
            },
            encoding: "utf8",
        });

        expect(result.status).toBe(0);
        const output = JSON.parse(fs.readFileSync(outputReportPath, "utf8"));
        expect(output.status).toBe("pass");
        expect(output.channelTracks.organic.status).toBe("guarded_sparse_current");
        expect(output.summary.organicBaseline.triggered).toBe(false);
    });

    it("auto-selects canonical wave6 trend report regardless of wave7 file mtime", () => {
        const tmpDir = createTempDir();
        const reportsDir = path.join(tmpDir, "reports");
        fs.mkdirSync(reportsDir, { recursive: true });

        const wave6TrendPath = path.join(
            reportsDir,
            "wave6-conversion-trend-live-20260318_221719.json"
        );
        const wave7TrendPath = path.join(
            reportsDir,
            "wave7-conversion-trend-live-20260318_234850.json"
        );
        const outputReportPath = path.join(tmpDir, "wave6-conversion-sentinel-output.json");
        const statePath = path.join(tmpDir, "wave6-conversion-sentinel-state.json");
        const historyStorePath = path.join(tmpDir, "wave7-telemetry-history-store.json");

        writeTrendReport(wave6TrendPath, [0.58, 0.6, 0.59, 0.57, 0.58, 0.6, 0.59]);
        writeTrendReport(wave7TrendPath, [0.58, 0.6, 0.59, 0.57, 0.58, 0.6, 0.59], {
            status: "fail",
            failureCodes: [
                "route_dimension_missing",
                "campaign_dimension_missing",
                "quality_score_below_threshold",
            ],
        });

        const now = Date.now();
        fs.utimesSync(wave6TrendPath, new Date(now - 120_000), new Date(now - 120_000));
        fs.utimesSync(wave7TrendPath, new Date(now), new Date(now));

        const result = spawnSync("node", ["scripts/conversion_regression_sentinel.js"], {
            cwd: path.resolve(process.cwd()),
            env: {
                ...process.env,
                CONVERSION_SENTINEL_REPORTS_DIR: reportsDir,
                CONVERSION_SENTINEL_HISTORY_STORE_PATH: historyStorePath,
                CONVERSION_SENTINEL_STATE_PATH: statePath,
                REPORT_PATH: outputReportPath,
            },
            encoding: "utf8",
        });

        expect(result.status).toBe(0);
        const output = JSON.parse(fs.readFileSync(outputReportPath, "utf8"));
        expect(output.status).toBe("pass");
        expect(output.sourceReport).toBe(path.resolve(wave6TrendPath));
    });
});
