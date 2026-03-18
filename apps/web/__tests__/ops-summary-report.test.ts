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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ops-summary-"));
    TEMP_DIRS.push(dir);
    return dir;
}

describe("ops summary report script", () => {
    it("builds a pass mission-control summary when source reports are healthy", () => {
        const reportsDir = createTempDir();
        const outputReportPath = path.join(reportsDir, "wave5-ops-summary-test.json");

        fs.writeFileSync(
            path.join(reportsDir, "wave4-performance-budget-20260318_200000.json"),
            JSON.stringify({ status: "pass" }, null, 2)
        );
        fs.writeFileSync(
            path.join(reportsDir, "wave4-lighthouse-reliability-20260318_200000.json"),
            JSON.stringify({ summary: { status: "pass" } }, null, 2)
        );
        fs.writeFileSync(
            path.join(reportsDir, "wave5-conversion-trend-20260318_200000.json"),
            JSON.stringify({ status: "pass" }, null, 2)
        );
        fs.writeFileSync(
            path.join(reportsDir, "wave3-canonical-og-parity-prod-2026-03-18.txt"),
            "PASS canonical_og_parity_all_indexable\n"
        );
        fs.writeFileSync(
            path.join(reportsDir, "wave3-live-squirrel-audit-prod-2026-03-18.json"),
            JSON.stringify({ status: "pass" }, null, 2)
        );

        const result = spawnSync("node", ["scripts/ops_summary_report.js"], {
            cwd: path.resolve(process.cwd()),
            env: {
                ...process.env,
                OPS_REPORTS_DIR: reportsDir,
                REPORT_PATH: outputReportPath,
            },
            encoding: "utf8",
        });

        expect(result.status).toBe(0);

        const output = JSON.parse(fs.readFileSync(outputReportPath, "utf8"));
        expect(output.overallStatus).toBe("pass");
        expect(output.components.perfGate.status).toBe("pass");
        expect(output.components.lighthouseReliability.status).toBe("pass");
        expect(output.components.funnelHealth.status).toBe("pass");
        expect(output.components.parityChecks.status).toBe("pass");
        expect(output.missionControlSummary[0]).toContain("PASS");
    });
});
