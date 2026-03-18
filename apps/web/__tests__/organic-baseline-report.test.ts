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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "organic-baseline-report-"));
    TEMP_DIRS.push(dir);
    return dir;
}

describe("organic baseline report script", () => {
    it("generates a wave7 organic baseline artifact from latest sentinel report", () => {
        const reportsDir = createTempDir();
        const outputPath = path.join(reportsDir, "wave7-organic-baseline-test.json");

        fs.writeFileSync(
            path.join(reportsDir, "wave7-conversion-sentinel-20260318_235500.json"),
            JSON.stringify(
                {
                    status: "pass",
                    channelTracks: {
                        organic: {
                            status: "eligible",
                            triggered: false,
                            dropPercent: 8.1,
                        },
                    },
                },
                null,
                2
            )
        );

        fs.writeFileSync(
            path.join(reportsDir, "wave7-telemetry-history-20260318_235501.json"),
            JSON.stringify(
                {
                    status: "pass",
                    freshness: {
                        conversion: { status: "fresh" },
                        sentinel: { status: "fresh" },
                    },
                },
                null,
                2
            )
        );

        const result = spawnSync("node", ["scripts/organic_baseline_report.js"], {
            cwd: path.resolve(process.cwd()),
            env: {
                ...process.env,
                OPS_REPORTS_DIR: reportsDir,
                REPORT_PATH: outputPath,
            },
            encoding: "utf8",
        });

        expect(result.status).toBe(0);

        const output = JSON.parse(fs.readFileSync(outputPath, "utf8"));
        expect(output.status).toBe("pass");
        expect(output.organicBaseline.status).toBe("eligible");
        expect(output.sourceReports.sentinel).toContain("wave7-conversion-sentinel");
    });
});
