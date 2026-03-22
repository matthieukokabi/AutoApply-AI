#!/usr/bin/env node

/**
 * Waits for first terminal post-update run and enforces non-zero discovery stages.
 *
 * Usage:
 *   node scripts/automation_pipeline_post_update_gate.js [--workflow-id <id>] [--timeout-seconds 21600] [--poll-seconds 60] [--allow-zero-jobs] [--json]
 */

const path = require("path");
const { spawnSync } = require("child_process");

function parseArgs(argv) {
    const parsed = {
        workflowId: null,
        timeoutSeconds: 0,
        pollSeconds: 60,
        requireNonZeroJobs: true,
        jsonOnly: false,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === "--workflow-id") {
            parsed.workflowId = argv[i + 1] || null;
            i += 1;
        } else if (token === "--timeout-seconds") {
            const value = Number(argv[i + 1]);
            if (Number.isFinite(value) && value >= 0) {
                parsed.timeoutSeconds = Math.floor(value);
            }
            i += 1;
        } else if (token === "--poll-seconds") {
            const value = Number(argv[i + 1]);
            if (Number.isFinite(value) && value > 0) {
                parsed.pollSeconds = Math.max(5, Math.floor(value));
            }
            i += 1;
        } else if (token === "--allow-zero-jobs") {
            parsed.requireNonZeroJobs = false;
        } else if (token === "--json") {
            parsed.jsonOnly = true;
        }
    }

    return parsed;
}

function toTimestamp(value) {
    if (!value) {
        return null;
    }
    const ms = new Date(value).getTime();
    if (!Number.isFinite(ms)) {
        return null;
    }
    return ms;
}

function getStageItemCount(stageSummaries, stageName) {
    const stage = (Array.isArray(stageSummaries) ? stageSummaries : []).find(
        (item) => item && item.stage === stageName
    );
    return stage && typeof stage.itemCount === "number" ? stage.itemCount : 0;
}

function evaluatePostUpdateRun(summary, options = {}) {
    const requireNonZeroJobs = options.requireNonZeroJobs !== false;
    const workflowUpdatedAtMs = toTimestamp(summary?.workflow?.updatedAt);
    const runs = Array.isArray(summary?.runs) ? summary.runs : [];
    const postUpdateTerminalRuns =
        workflowUpdatedAtMs === null
            ? runs.filter((run) => run && run.status !== "waiting")
            : runs.filter((run) => {
                  const startedAtMs = toTimestamp(run?.startedAt);
                  return (
                      startedAtMs !== null &&
                      startedAtMs >= workflowUpdatedAtMs &&
                      run &&
                      run.status !== "waiting"
                  );
              });

    if (postUpdateTerminalRuns.length === 0) {
        return {
            state: "pending",
            reason: "no_terminal_post_update_run",
            run: null,
            checks: {},
        };
    }

    const run = postUpdateTerminalRuns[0];
    const fetchJobsCount = getStageItemCount(run.stageSummaries, "Fetch Jobs via App API");
    const normalizeCount =
        getStageItemCount(run.stageSummaries, "Fetch & Normalize All Job Sources") ||
        getStageItemCount(run.stageSummaries, "Normalize & Deduplicate");
    const jobsFoundCount = typeof run.jobsFoundCount === "number" ? run.jobsFoundCount : 0;
    const checks = {
        terminalStatus: run.status,
        fetchJobsItemCount: fetchJobsCount,
        normalizeItemCount: normalizeCount,
        jobsFoundCount,
        requireNonZeroJobs,
    };

    if (run.status !== "success") {
        return {
            state: "failed",
            reason: `terminal_run_status_${String(run.status || "unknown")}`,
            run,
            checks,
        };
    }

    if (requireNonZeroJobs && fetchJobsCount <= 0) {
        return { state: "failed", reason: "fetch_jobs_zero_items", run, checks };
    }
    if (requireNonZeroJobs && normalizeCount <= 0) {
        return { state: "failed", reason: "normalize_zero_items", run, checks };
    }
    if (requireNonZeroJobs && jobsFoundCount <= 0) {
        return { state: "failed", reason: "jobs_found_zero", run, checks };
    }

    return { state: "passed", reason: "post_update_run_validated", run, checks };
}

function runDiagnostics(workflowId) {
    const diagnosticsPath = path.join(__dirname, "automation_pipeline_diagnostics.js");
    const args = [diagnosticsPath, "--json"];
    if (workflowId) {
        args.push("--workflow-id", workflowId);
    }
    const result = spawnSync(process.execPath, args, {
        encoding: "utf8",
        env: process.env,
    });

    if (result.status !== 0) {
        throw new Error(
            `diagnostics_failed:${(result.stderr || result.stdout || "").trim().slice(0, 400)}`
        );
    }

    const stdout = String(result.stdout || "").trim();
    if (!stdout) {
        throw new Error("diagnostics_empty_output");
    }
    return JSON.parse(stdout);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const startedAtMs = Date.now();
    let attempt = 0;

    while (true) {
        attempt += 1;
        const summary = runDiagnostics(args.workflowId);
        const evaluation = evaluatePostUpdateRun(summary, {
            requireNonZeroJobs: args.requireNonZeroJobs,
        });

        const output = {
            generatedAt: new Date().toISOString(),
            attempt,
            timeoutSeconds: args.timeoutSeconds,
            pollSeconds: args.pollSeconds,
            workflowId: summary?.workflow?.id || null,
            workflowUpdatedAt: summary?.workflow?.updatedAt || null,
            latest: summary?.latest || null,
            evaluation,
        };

        if (evaluation.state === "passed") {
            if (args.jsonOnly) {
                process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
            } else {
                process.stdout.write(
                    `post_update_gate: PASS (run ${evaluation.run?.executionId ?? "unknown"})\n`
                );
                process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
            }
            return;
        }

        if (evaluation.state === "failed") {
            if (args.jsonOnly) {
                process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
            } else {
                process.stderr.write(
                    `post_update_gate: FAIL (${evaluation.reason}) on run ${
                        evaluation.run?.executionId ?? "unknown"
                    }\n`
                );
                process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
            }
            process.exitCode = 1;
            return;
        }

        const elapsedMs = Date.now() - startedAtMs;
        const timeoutMs = args.timeoutSeconds * 1000;
        if (args.timeoutSeconds === 0 || elapsedMs >= timeoutMs) {
            if (args.jsonOnly) {
                process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
            } else {
                process.stderr.write("post_update_gate: PENDING (timeout reached)\n");
                process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
            }
            process.exitCode = 2;
            return;
        }

        await sleep(args.pollSeconds * 1000);
    }
}

if (require.main === module) {
    main().catch((error) => {
        process.stderr.write(`automation_pipeline_post_update_gate_failed: ${error.message}\n`);
        process.exitCode = 1;
    });
}

module.exports = {
    parseArgs,
    evaluatePostUpdateRun,
};
