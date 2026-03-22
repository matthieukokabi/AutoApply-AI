import { createRequire } from "module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const postUpdateGate = require("../scripts/automation_pipeline_post_update_gate.js");

describe("automation pipeline post-update gate helpers", () => {
    it("returns pending when no terminal post-update run exists", () => {
        const updatedAt = "2026-03-22T00:00:00.000Z";
        const evaluation = postUpdateGate.evaluatePostUpdateRun(
            {
                workflow: { updatedAt },
                runs: [
                    {
                        executionId: 1,
                        status: "waiting",
                        startedAt: "2026-03-22T00:01:00.000Z",
                        stageSummaries: [],
                    },
                ],
            },
            { requireNonZeroJobs: true }
        );

        expect(evaluation.state).toBe("pending");
        expect(evaluation.reason).toBe("no_terminal_post_update_run");
    });

    it("fails when first terminal post-update run is not successful", () => {
        const updatedAt = "2026-03-22T00:00:00.000Z";
        const evaluation = postUpdateGate.evaluatePostUpdateRun(
            {
                workflow: { updatedAt },
                runs: [
                    {
                        executionId: 2,
                        status: "error",
                        startedAt: "2026-03-22T00:05:00.000Z",
                        stageSummaries: [],
                    },
                ],
            },
            { requireNonZeroJobs: true }
        );

        expect(evaluation.state).toBe("failed");
        expect(evaluation.reason).toBe("terminal_run_status_error");
    });

    it("passes when post-update run is successful with non-zero discovery counts", () => {
        const updatedAt = "2026-03-22T00:00:00.000Z";
        const evaluation = postUpdateGate.evaluatePostUpdateRun(
            {
                workflow: { updatedAt },
                runs: [
                    {
                        executionId: 3,
                        status: "success",
                        startedAt: "2026-03-22T00:10:00.000Z",
                        jobsFoundCount: 8,
                        stageSummaries: [
                            { stage: "Fetch Jobs via App API", itemCount: 2 },
                            { stage: "Fetch & Normalize All Job Sources", itemCount: 8 },
                        ],
                    },
                ],
            },
            { requireNonZeroJobs: true }
        );

        expect(evaluation.state).toBe("passed");
        expect(evaluation.reason).toBe("post_update_run_validated");
    });

    it("fails successful run when normalize stage has zero items", () => {
        const updatedAt = "2026-03-22T00:00:00.000Z";
        const evaluation = postUpdateGate.evaluatePostUpdateRun(
            {
                workflow: { updatedAt },
                runs: [
                    {
                        executionId: 4,
                        status: "success",
                        startedAt: "2026-03-22T00:12:00.000Z",
                        jobsFoundCount: 8,
                        stageSummaries: [{ stage: "Fetch Jobs via App API", itemCount: 2 }],
                    },
                ],
            },
            { requireNonZeroJobs: true }
        );

        expect(evaluation.state).toBe("failed");
        expect(evaluation.reason).toBe("normalize_zero_items");
    });
});
