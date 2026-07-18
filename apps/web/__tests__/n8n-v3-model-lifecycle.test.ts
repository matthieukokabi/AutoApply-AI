import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const workflowDirectory = path.resolve(process.cwd(), "../../n8n/workflows");
const v3WorkflowFiles = [
    "job-discovery-pipeline-v3.json",
    "single-job-tailoring-v3.json",
];

describe("n8n v3 model lifecycle", () => {
    it.each(v3WorkflowFiles)("does not call a retired Anthropic model in %s", (file) => {
        const workflow = fs.readFileSync(path.join(workflowDirectory, file), "utf8");

        expect(workflow).not.toContain("claude-sonnet-4-20250514");
        expect(workflow).toContain("claude-sonnet-4-6");
    });
});
