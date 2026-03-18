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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-conversion-"));
    TEMP_DIRS.push(dir);
    return dir;
}

describe("perf conversion correlation report", () => {
    it("flags routes where perf regression and conversion drop co-occur", () => {
        const reportsDir = createTempDir();
        const outputPath = path.join(
            reportsDir,
            "wave6-perf-conversion-correlation-test.json"
        );
        const perfTrendPath = path.join(reportsDir, "wave5-perf-trend-20260318_200000.json");
        const conversionTrendPath = path.join(
            reportsDir,
            "wave6-conversion-trend-live-20260318_200000.json"
        );

        fs.writeFileSync(
            perfTrendPath,
            JSON.stringify(
                {
                    routeTrends: [
                        {
                            route: "/en/contact",
                            perRouteRegressionDeltas: {
                                lcpMs: { vsPrevious: { percent: 25 } },
                                cls: { vsPrevious: { percent: 5 } },
                                jsBytes: { vsPrevious: { percent: 2 } },
                                imageBytes: { vsPrevious: { percent: 1 } },
                            },
                        },
                    ],
                },
                null,
                2
            )
        );

        fs.writeFileSync(
            conversionTrendPath,
            JSON.stringify(
                {
                    keyMetrics: {
                        weeklyCompletionRateBaseline: 0.6,
                    },
                    funnel: {
                        daily: {
                            segmentation: {
                                byRoute: [
                                    {
                                        segment: "/en/contact",
                                        summary: {
                                            formStarts: 15,
                                            completionRateFromFormStart: 0.35,
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
                null,
                2
            )
        );

        const result = spawnSync("node", ["scripts/perf_conversion_correlation_report.js"], {
            cwd: path.resolve(process.cwd()),
            env: {
                ...process.env,
                PERF_CONVERSION_REPORTS_DIR: reportsDir,
                PERF_TREND_SOURCE_REPORT: perfTrendPath,
                CONVERSION_TREND_SOURCE_REPORT: conversionTrendPath,
                REPORT_PATH: outputPath,
            },
            encoding: "utf8",
        });

        expect(result.status).toBe(0);

        const output = JSON.parse(fs.readFileSync(outputPath, "utf8"));
        expect(output.status).toBe("warning");
        expect(output.totals.cooccurrenceCount).toBe(1);
        expect(output.cooccurrenceFlags[0].route).toBe("/en/contact");
    });
});
