import { createRequire } from "module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const checkpoint = require("../scripts/n8n_workflow_checkpoint.js");

describe("n8n workflow checkpoint helpers", () => {
    it("parses repeated workflow ids and custom options", () => {
        const parsed = checkpoint.parseArgs([
            "--workflow-id",
            "wf1",
            "--workflow-id",
            "wf2",
            "--json",
            "--history-depth",
            "7",
            "--output",
            "docs/reports/custom.json",
        ]);

        expect(parsed.workflowIds).toEqual(["wf1", "wf2"]);
        expect(parsed.jsonOnly).toBe(true);
        expect(parsed.historyDepth).toBe(7);
        expect(parsed.outputPath).toBe("docs/reports/custom.json");
    });

    it("builds rollback summary with warning when no previous version exists", () => {
        const summary = checkpoint.summarizeWorkflow(
            {
                id: "wf-test",
                name: "Workflow Test",
                active: true,
                versionId: "v-current",
                activeVersionId: "v-current",
                createdAt: "2026-03-22T00:00:00.000Z",
                updatedAt: "2026-03-22T01:00:00.000Z",
                nodes: [{ id: "n1" }],
                connections: {},
                settings: {},
            },
            "v-current",
            [
                {
                    workflowId: "wf-test",
                    versionId: "v-current",
                    createdAt: "2026-03-22T01:00:00.000Z",
                    updatedAt: "2026-03-22T01:00:00.000Z",
                    name: "Workflow Test",
                    description: "",
                },
            ]
        );

        expect(summary.rollbackCandidateVersionId).toBeNull();
        expect(summary.alerts.some((alert: { code: string }) => alert.code === "no_rollback_candidate")).toBe(
            true
        );
    });
});
