import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKFLOW_PATH = path.resolve(__dirname, "../../../n8n/workflows/job-discovery-pipeline-v3.json");
const PARSE_NODE_NAME = "Parse Tailor Batch v3";

function loadParseTailorJsCode() {
    const workflow = JSON.parse(fs.readFileSync(WORKFLOW_PATH, "utf8"));
    const node = (workflow.nodes || []).find((item: { name?: string }) => item.name === PARSE_NODE_NAME);
    if (!node || !node.parameters || typeof node.parameters.jsCode !== "string") {
        throw new Error("parse_tailor_v3_node_missing_js_code");
    }
    return node.parameters.jsCode;
}

function runParseTailorNode(prev: Record<string, any>, resp: Record<string, any>) {
    const jsCode = loadParseTailorJsCode();
    const run = new Function("$", "$input", jsCode);
    const dollar = (name: string) => {
        if (name !== "Build Tailor Prompt Batch v3") {
            throw new Error(`unexpected_node_reference:${name}`);
        }
        return { item: { json: prev } };
    };
    return run(dollar, { item: { json: resp } }) as { json: Record<string, any> };
}

describe("job discovery v3 Parse Tailor node", () => {
    const basePrev = {
        candidatesToTailor: [{ source: "manual", externalId: "job-1" }],
        applicationsBase: [
            {
                source: "manual",
                externalId: "job-1",
                status: "discovered",
                tailoredCvMarkdown: null,
                coverLetterMarkdown: null,
            },
        ],
    };

    it("recovers malformed trailing-brace tail near array end", () => {
        const malformedTailText =
            '[{"idx":0,"tailored_cv_markdown":"# Tailored CV","motivation_letter_markdown":"Hi there"}}]';

        const result = runParseTailorNode(basePrev, {
            content: [{ text: malformedTailText }],
        });

        expect(result.json.tailorParseOk).toBe(true);
        expect(result.json.tailorParseRecoveredTrailingBrace).toBe(true);
        expect(result.json.applicationsFinal).toHaveLength(1);
        expect(result.json.applicationsFinal[0].status).toBe("tailored");
        expect(result.json.applicationsFinal[0].tailoredCvMarkdown).toContain("Tailored CV");
        expect(result.json.applicationsFinal[0].coverLetterMarkdown).toContain("Hi there");
    });

    it("keeps valid full-array parse behavior unchanged", () => {
        const validText = JSON.stringify([
            {
                idx: 0,
                tailored_cv_markdown: "# Valid Tailored CV",
                motivation_letter_markdown: "Valid cover letter",
            },
        ]);

        const result = runParseTailorNode(basePrev, {
            content: [{ text: validText }],
        });

        expect(result.json.tailorParseOk).toBe(true);
        expect(result.json.tailorParseRecoveredTrailingBrace).toBe(false);
        expect(result.json.applicationsFinal[0].status).toBe("tailored");
    });

    it("fails closed on malformed mid-body JSON", () => {
        const malformedMidBody = '[{"idx":0,"tailored_cv_markdown":"x",,"motivation_letter_markdown":"y"}]';

        const result = runParseTailorNode(basePrev, {
            content: [{ text: malformedMidBody }],
        });

        expect(result.json.tailorParseOk).toBe(false);
        expect(result.json.tailorReasonCode).toBe("TAILORING_PARSE_FAILURE");
    });
});
