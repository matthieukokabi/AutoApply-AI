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

function writeTrendReport(filePath: string, completionRates: number[]) {
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
});
