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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "conversion-weekly-report-"));
    TEMP_DIRS.push(dir);
    return dir;
}

describe("conversion telemetry weekly report script", () => {
    it("builds organic/paid/direct channel breakdown from campaign segmentation", () => {
        const reportsDir = createTempDir();
        const seededPath = path.join(reportsDir, "wave5-conversion-trend-seeded.json");
        const outputPath = path.join(reportsDir, "wave6-conversion-trend-live-test.json");

        fs.writeFileSync(
            seededPath,
            JSON.stringify(
                {
                    generatedAt: "2026-03-18T22:00:00.000Z",
                    funnel: {
                        daily: {
                            events: {
                                page_view: 60,
                                cta_click: 36,
                                form_start: 20,
                                captcha_pass: 14,
                                captcha_fail: 2,
                                submit_success: 10,
                                submit_fail: 2,
                            },
                            summary: {
                                formStarts: 20,
                                completionRateFromFormStart: 0.5,
                                captchaFailRate: 0.125,
                            },
                            segmentation: {
                                byRoute: [
                                    {
                                        segment: "/en/contact",
                                        summary: {
                                            formStarts: 20,
                                            submitSuccess: 10,
                                            captchaPass: 14,
                                            captchaFail: 2,
                                        },
                                    },
                                ],
                                byCampaign: [
                                    {
                                        segment: "en_acq_launch_202603",
                                        summary: {
                                            formStarts: 10,
                                            submitSuccess: 6,
                                            captchaPass: 7,
                                            captchaFail: 1,
                                        },
                                    },
                                    {
                                        segment: "google_paid_cpc",
                                        summary: {
                                            formStarts: 6,
                                            submitSuccess: 3,
                                            captchaPass: 5,
                                            captchaFail: 1,
                                        },
                                    },
                                    {
                                        segment: "unknown",
                                        summary: {
                                            formStarts: 4,
                                            submitSuccess: 1,
                                            captchaPass: 2,
                                            captchaFail: 0,
                                        },
                                    },
                                ],
                            },
                        },
                        weekly: {
                            trend: {
                                completionRateFromFormStart: {
                                    latest: 0.5,
                                    baseline: 0.52,
                                },
                                captchaFailRate: {
                                    latest: 0.125,
                                    baseline: 0.1,
                                },
                            },
                            anomalies: [],
                        },
                    },
                },
                null,
                2
            )
        );

        const result = spawnSync("node", ["scripts/conversion_telemetry_weekly_report.js"], {
            cwd: path.resolve(process.cwd()),
            env: {
                ...process.env,
                CONVERSION_TELEMETRY_ALLOW_SEEDED_FALLBACK: "true",
                CONVERSION_TELEMETRY_SEEDED_REPORT: seededPath,
                CONVERSION_TELEMETRY_MAX_FALLBACK_REPORTS_IN_WINDOW: "10",
                REPORT_PATH: outputPath,
                TELEMETRY_HISTORY_REPORTS_DIR: reportsDir,
            },
            encoding: "utf8",
        });

        expect(result.status).toBe(0);

        const output = JSON.parse(fs.readFileSync(outputPath, "utf8"));
        expect(output.channels.classificationVersion).toBe("wave7_v1");

        const byChannel = Object.fromEntries(
            output.channels.breakdown.map((entry: any) => [entry.channel, entry])
        );
        expect(byChannel.organic.formStarts).toBe(10);
        expect(byChannel.paid.formStarts).toBe(6);
        expect(byChannel.direct.formStarts).toBe(4);
    });
});
