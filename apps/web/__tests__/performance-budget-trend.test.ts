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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "perf-trend-"));
    TEMP_DIRS.push(dir);
    return dir;
}

function writeJson(filePath: string, payload: unknown) {
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

describe("performance budget and trend scripts", () => {
    it("fails budget gate when percentile trend regression exceeds limit", () => {
        const reportsDir = createTempDir();
        const sourceReportPath = path.join(reportsDir, "wave4-lighthouse-reliability-source.json");
        const outputReportPath = path.join(reportsDir, "wave4-performance-budget-output.json");

        writeJson(sourceReportPath, {
            target: {
                route: "/en",
            },
            attempts: [
                {
                    status: "pass",
                    metrics: {
                        lcpMs: 2800,
                        cls: 0.05,
                        jsBytes: 500000,
                        imageBytes: 120000,
                    },
                },
            ],
        });

        writeJson(path.join(reportsDir, "wave4-performance-budget-a.json"), {
            status: "pass",
            route: "/en",
            metrics: {
                lcpMs: 1000,
                cls: 0.02,
                jsBytes: 420000,
                imageBytes: 80000,
            },
        });
        writeJson(path.join(reportsDir, "wave4-performance-budget-b.json"), {
            status: "pass",
            route: "/en",
            metrics: {
                lcpMs: 1100,
                cls: 0.021,
                jsBytes: 425000,
                imageBytes: 82000,
            },
        });
        writeJson(path.join(reportsDir, "wave4-performance-budget-c.json"), {
            status: "pass",
            route: "/en",
            metrics: {
                lcpMs: 1200,
                cls: 0.022,
                jsBytes: 430000,
                imageBytes: 84000,
            },
        });

        const result = spawnSync("node", ["scripts/performance_budget_gate.js"], {
            cwd: path.resolve(process.cwd()),
            env: {
                ...process.env,
                PERF_BUDGET_REPORTS_DIR: reportsDir,
                PERF_BUDGET_SOURCE_REPORT: sourceReportPath,
                REPORT_PATH: outputReportPath,
            },
            encoding: "utf8",
        });

        expect(result.status).toBe(1);
        const output = JSON.parse(fs.readFileSync(outputReportPath, "utf8"));
        expect(output.status).toBe("fail");
        expect(
            output.violations.some((item: { type: string }) => item.type === "percentile_regression_exceeded")
        ).toBe(true);
        expect(output.perRouteRegressionDeltas.lcpMs.vsTrendPercentile.percent).not.toBeNull();
    });

    it("builds route percentile trend report with per-route deltas", () => {
        const reportsDir = createTempDir();
        const outputReportPath = path.join(reportsDir, "wave5-perf-trend-output.json");

        const reports = [
            {
                filename: "wave4-performance-budget-1.json",
                route: "/en",
                metrics: { lcpMs: 1200, cls: 0.03, jsBytes: 430000, imageBytes: 90000 },
            },
            {
                filename: "wave4-performance-budget-2.json",
                route: "/en",
                metrics: { lcpMs: 1300, cls: 0.031, jsBytes: 432000, imageBytes: 92000 },
            },
            {
                filename: "wave4-performance-budget-3.json",
                route: "/en",
                metrics: { lcpMs: 1250, cls: 0.029, jsBytes: 431000, imageBytes: 91000 },
            },
            {
                filename: "wave4-performance-budget-4.json",
                route: "/en/sign-up",
                metrics: { lcpMs: 1800, cls: 0.05, jsBytes: 450000, imageBytes: 100000 },
            },
            {
                filename: "wave4-performance-budget-5.json",
                route: "/en/sign-up",
                metrics: { lcpMs: 1900, cls: 0.048, jsBytes: 452000, imageBytes: 101000 },
            },
            {
                filename: "wave4-performance-budget-6.json",
                route: "/en/sign-up",
                metrics: { lcpMs: 1850, cls: 0.049, jsBytes: 451000, imageBytes: 100500 },
            },
        ];

        for (const report of reports) {
            writeJson(path.join(reportsDir, report.filename), {
                status: "pass",
                route: report.route,
                metrics: report.metrics,
            });
        }

        const result = spawnSync("node", ["scripts/performance_trend_report.js"], {
            cwd: path.resolve(process.cwd()),
            env: {
                ...process.env,
                PERF_REPORTS_DIR: reportsDir,
                REPORT_PATH: outputReportPath,
            },
            encoding: "utf8",
        });

        expect(result.status).toBe(0);
        const output = JSON.parse(fs.readFileSync(outputReportPath, "utf8"));
        expect(output.overallStatus).toBe("pass");
        expect(output.deterministicRoutes.requiredRoutes).toContain("/en");
        const enRoute = output.routeTrends.find((item: { route: string }) => item.route === "/en");
        expect(enRoute).toBeDefined();
        expect(enRoute.perRouteRegressionDeltas.lcpMs.vsP75.value).not.toBeNull();
    });
});
