import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SINGLE_WORKFLOW_PATH = path.resolve(
    __dirname,
    "../../../n8n/workflows/single-job-tailoring-v3.json"
);
const BATCH_WORKFLOW_PATH = path.resolve(
    __dirname,
    "../../../n8n/workflows/job-discovery-pipeline-v3.json"
);

function getWorkflowNodeJsCode(workflowPath: string, nodeName: string) {
    const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf8"));
    const node = (workflow.nodes || []).find((item: { name?: string }) => item.name === nodeName);
    if (!node || !node.parameters || typeof node.parameters.jsCode !== "string") {
        throw new Error(`node_js_code_missing:${nodeName}`);
    }
    return node.parameters.jsCode as string;
}

describe("cover-letter prompt contract", () => {
    it("tightens single-job cover-letter generation instructions", () => {
        const jsCode = getWorkflowNodeJsCode(SINGLE_WORKFLOW_PATH, "Parse Scoring Response v3");

        expect(jsCode).toContain("Cover letter specificity contract:");
        expect(jsCode).toContain("Company known:");
        expect(jsCode).toContain(
            "Mention the target company by exact name when companyKnown is true."
        );
        expect(jsCode).toContain(
            "Ground motivation_letter_markdown in at least two concrete cues from ATS keywords, job title, or job description."
        );
        expect(jsCode).toContain("Do not use generic template phrases such as");
        expect(jsCode).toContain("Dear Hiring Manager");
    });

    it("tightens batch cover-letter generation instructions and context assembly", () => {
        const jsCode = getWorkflowNodeJsCode(BATCH_WORKFLOW_PATH, "Build Tailor Prompt Batch v3");

        expect(jsCode).toContain("const jobsToTailor = candidates.map");
        expect(jsCode).toContain("companyKnown");
        expect(jsCode).toContain("Cover letter specificity contract:");
        expect(jsCode).toContain(
            "For each motivation_letter_markdown, mention the target company by exact name when companyKnown is true."
        );
        expect(jsCode).toContain(
            "Ground each letter in at least two concrete cues from title, atsKeywords, or description."
        );
        expect(jsCode).toContain(
            "Jobs to tailor (companyKnown indicates if company mention is mandatory):"
        );
    });
});
