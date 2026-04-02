import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKFLOW_PATH = path.resolve(__dirname, "../../../n8n/workflows/job-discovery-pipeline-v3.json");
const PARSE_NODE_NAME = "Parse Scores v3";

function loadParseScoresJsCode() {
    const workflow = JSON.parse(fs.readFileSync(WORKFLOW_PATH, "utf8"));
    const node = (workflow.nodes || []).find((item: { name?: string }) => item.name === PARSE_NODE_NAME);
    if (!node || !node.parameters || typeof node.parameters.jsCode !== "string") {
        throw new Error("parse_scores_v3_node_missing_js_code");
    }
    return node.parameters.jsCode;
}

function runParseScoresNode(prev: Record<string, any>, resp: Record<string, any>) {
    const jsCode = loadParseScoresJsCode();
    const run = new Function("$", "$input", jsCode);
    const dollar = (name: string) => {
        if (name !== "Normalize/Dedupe Jobs v3") {
            throw new Error(`unexpected_node_reference:${name}`);
        }
        return { item: { json: prev } };
    };
    return run(dollar, { item: { json: resp } }) as { json: Record<string, any> };
}

describe("job discovery v3 Parse Scores node", () => {
    const basePrev = {
        config: { v3TailorCapPerUser: 2 },
        jobsCapped: [
            { id: "job_1", title: "Role 1" },
            { id: "job_2", title: "Role 2" },
        ],
    };

    it("recovers partial score rows when Anthropic response truncates at max_tokens", () => {
        const truncatedText = `[
  {"idx":0,"compatibility_score":88,"ats_keywords":["node"],"matching_strengths":["fit"],"gaps":[],"recommendation":"tailor"},
  {"idx":1,"compatibility_score":71,"ats_keywords":["ts"]`;

        const result = runParseScoresNode(basePrev, {
            stop_reason: "max_tokens",
            usage: { input_tokens: 950, output_tokens: 1400 },
            content: [{ text: truncatedText }],
        });

        expect(result.json.scoreParseOk).toBe(true);
        expect(result.json.scoreParsedPartially).toBe(true);
        expect(result.json.scoreParseMeta.parsedRows).toBe(1);
        expect(result.json.scoredJobs).toHaveLength(2);
        expect(result.json.scoredJobs[0].compatibilityScore).toBe(88);
        expect(result.json.scoredJobs[1].compatibilityScore).toBe(0);
        expect(result.json.candidatesToTailor).toHaveLength(1);
    });

    it("emits SCORING_TRUNCATION_FAILURE when max_tokens response has no complete score row", () => {
        const result = runParseScoresNode(basePrev, {
            stop_reason: "max_tokens",
            usage: { input_tokens: 500, output_tokens: 1400 },
            content: [{ text: `[\n{"idx":0,"compatibility_score":85` }],
        });

        expect(result.json.scoreParseOk).toBe(false);
        expect(result.json.scoreReasonCode).toBe("SCORING_TRUNCATION_FAILURE");
        expect(result.json.scoreParseMeta.stopReason).toBe("max_tokens");
        expect(result.json.scoreParseMeta.outputTokens).toBe(1400);
    });

    it("keeps full-array parse behavior unchanged on valid JSON response", () => {
        const result = runParseScoresNode(basePrev, {
            stop_reason: "end_turn",
            usage: { input_tokens: 400, output_tokens: 300 },
            content: [
                {
                    text: JSON.stringify([
                        {
                            idx: 0,
                            compatibility_score: 92,
                            ats_keywords: ["node", "ts"],
                            matching_strengths: ["backend"],
                            gaps: [],
                            recommendation: "tailor",
                        },
                        {
                            idx: 1,
                            compatibility_score: 64,
                            ats_keywords: ["react"],
                            matching_strengths: ["frontend"],
                            gaps: ["graphql"],
                            recommendation: "skip",
                        },
                    ]),
                },
            ],
        });

        expect(result.json.scoreParseOk).toBe(true);
        expect(result.json.scoreParsedPartially).toBe(false);
        expect(result.json.scoredJobs[0].compatibilityScore).toBe(92);
        expect(result.json.scoredJobs[1].compatibilityScore).toBe(64);
        expect(result.json.candidatesToTailor).toHaveLength(1);
    });
});
