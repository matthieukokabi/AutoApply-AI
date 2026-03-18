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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alert-transport-"));
    TEMP_DIRS.push(dir);
    return dir;
}

describe("alert transport dispatch script", () => {
    it("writes local-only artifact when external sinks are not configured", () => {
        const reportsDir = createTempDir();
        const statePath = path.join(reportsDir, "wave7-alert-transport-state.json");
        const outputPath = path.join(reportsDir, "wave7-alert-transport-output.json");
        const configPath = path.join(reportsDir, "alert-transport.json");

        fs.writeFileSync(
            configPath,
            JSON.stringify(
                {
                    cooldownMinutes: 120,
                    maxRetries: 2,
                    retryDelayMs: 10,
                    warningBatchWindowMinutes: 30,
                    warningBatchSize: 3,
                },
                null,
                2
            )
        );

        fs.writeFileSync(
            path.join(reportsDir, "wave7-conversion-sentinel-20260318_230000.json"),
            JSON.stringify(
                {
                    status: "fail",
                    summary: {
                        triggerCode: "completion_rate_drop_consecutive_windows",
                    },
                },
                null,
                2
            )
        );

        const result = spawnSync("node", ["scripts/alert_transport_dispatch.js"], {
            cwd: path.resolve(process.cwd()),
            env: {
                ...process.env,
                ALERT_TRANSPORT_REPORTS_DIR: reportsDir,
                ALERT_TRANSPORT_STATE_PATH: statePath,
                ALERT_TRANSPORT_CONFIG_PATH: configPath,
                REPORT_PATH: outputPath,
                ALERT_TRANSPORT_WEBHOOK_URL: "",
                ALERT_TRANSPORT_EMAIL_TO: "",
                RESEND_API_KEY: "",
            },
            encoding: "utf8",
        });

        expect(result.status).toBe(0);

        const output = JSON.parse(fs.readFileSync(outputPath, "utf8"));
        expect(output.status).toBe("pass");
        expect(output.dispatchMode).toBe("critical_immediate");
        expect(output.delivery.status).toBe("local_only");
        expect(output.localArtifactIsSourceOfTruth).toBe(true);
    });

    it("suppresses duplicate critical alerts during cooldown window", () => {
        const reportsDir = createTempDir();
        const statePath = path.join(reportsDir, "wave7-alert-transport-state.json");
        const outputPathA = path.join(reportsDir, "wave7-alert-transport-output-a.json");
        const outputPathB = path.join(reportsDir, "wave7-alert-transport-output-b.json");
        const configPath = path.join(reportsDir, "alert-transport.json");

        fs.writeFileSync(
            configPath,
            JSON.stringify(
                {
                    cooldownMinutes: 180,
                    maxRetries: 1,
                    retryDelayMs: 10,
                    warningBatchWindowMinutes: 30,
                    warningBatchSize: 3,
                },
                null,
                2
            )
        );

        fs.writeFileSync(
            path.join(reportsDir, "wave7-conversion-sentinel-20260318_231000.json"),
            JSON.stringify(
                {
                    status: "fail",
                    summary: {
                        triggerCode: "organic_baseline_regression",
                    },
                },
                null,
                2
            )
        );

        const firstRun = spawnSync("node", ["scripts/alert_transport_dispatch.js"], {
            cwd: path.resolve(process.cwd()),
            env: {
                ...process.env,
                ALERT_TRANSPORT_REPORTS_DIR: reportsDir,
                ALERT_TRANSPORT_STATE_PATH: statePath,
                ALERT_TRANSPORT_CONFIG_PATH: configPath,
                REPORT_PATH: outputPathA,
                ALERT_TRANSPORT_WEBHOOK_URL: "",
                ALERT_TRANSPORT_EMAIL_TO: "",
                RESEND_API_KEY: "",
            },
            encoding: "utf8",
        });

        expect(firstRun.status).toBe(0);

        const secondRun = spawnSync("node", ["scripts/alert_transport_dispatch.js"], {
            cwd: path.resolve(process.cwd()),
            env: {
                ...process.env,
                ALERT_TRANSPORT_REPORTS_DIR: reportsDir,
                ALERT_TRANSPORT_STATE_PATH: statePath,
                ALERT_TRANSPORT_CONFIG_PATH: configPath,
                REPORT_PATH: outputPathB,
                ALERT_TRANSPORT_WEBHOOK_URL: "",
                ALERT_TRANSPORT_EMAIL_TO: "",
                RESEND_API_KEY: "",
            },
            encoding: "utf8",
        });

        expect(secondRun.status).toBe(0);

        const secondOutput = JSON.parse(fs.readFileSync(outputPathB, "utf8"));
        expect(secondOutput.dispatchMode).toBe("suppressed_cooldown");
        expect(secondOutput.cooldown.active).toBe(true);
    });
});
