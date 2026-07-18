import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKFLOW_PATH = path.resolve(__dirname, "../../../n8n/workflows/job-discovery-pipeline-v3.json");

function loadNodeJsCode(nodeName: string) {
    const workflow = JSON.parse(fs.readFileSync(WORKFLOW_PATH, "utf8"));
    const node = (workflow.nodes || []).find((item: { name?: string }) => item.name === nodeName);
    if (!node || !node.parameters || typeof node.parameters.jsCode !== "string") {
        throw new Error(`${nodeName}_missing_js_code`);
    }
    return node.parameters.jsCode;
}

function loadNode(nodeName: string) {
    const workflow = JSON.parse(fs.readFileSync(WORKFLOW_PATH, "utf8"));
    const node = (workflow.nodes || []).find((item: { name?: string }) => item.name === nodeName);
    if (!node || !node.parameters) {
        throw new Error(`${nodeName}_missing`);
    }
    return node;
}

function loadWorkflow() {
    return JSON.parse(fs.readFileSync(WORKFLOW_PATH, "utf8"));
}

function runBuildTailorPrompt(item: Record<string, any>) {
    const jsCode = loadNodeJsCode("Build Tailor Prompt Batch v3");
    const run = new Function("$input", jsCode);
    return run({ item: { json: item } }) as { json: Record<string, any> };
}

function runFinalizeUserResult(item: Record<string, any>) {
    const jsCode = loadNodeJsCode("Finalize User Result v3");
    const run = new Function("$", "$input", jsCode);
    return run(
        () => {
            throw new Error("unexpected_node_reference");
        },
        { item: { json: item } }
    ) as { json: Record<string, any> };
}

function runAggregateDiscoverySummary(items: Array<Record<string, any>>) {
    const jsCode = loadNodeJsCode("Aggregate Discovery Summary v3");
    const run = new Function("$", "$input", jsCode);
    const dollar = (name: string) => {
        if (name !== "Parse Lock Result v3") {
            throw new Error(`unexpected_node_reference:${name}`);
        }
        return {
            first: () => ({
                json: {
                    runId: "run_1",
                    slotId: "slot_1",
                    schedulerSource: "manual_operator",
                    triggerKind: "manual",
                    lockId: "lock_1",
                },
            }),
        };
    };
    return run(dollar, {
        all: () => items.map((json) => ({ json })),
    }) as Array<{ json: Record<string, any> }>;
}

function runPreparePersistNoTailor(items: Array<Record<string, any>>) {
    const jsCode = loadNodeJsCode("Prepare Persist (No Tailor) v3");
    const run = new Function("$input", jsCode);
    return run({
        all: () => items.map((json) => ({ json })),
    }) as Array<{ json: Record<string, any> }>;
}

function runBuildTailorErrorPayload(items: Array<Record<string, any>>) {
    const jsCode = loadNodeJsCode("Build Tailor Error Payload v3");
    const run = new Function("$input", jsCode);
    return run({
        all: () => items.map((json) => ({ json })),
    }) as Array<{ json: Record<string, any> }>;
}

describe("job discovery v3 persistence branches", () => {
    it("emits one no-tailor persist item per input user", () => {
        const result = runPreparePersistNoTailor([
            {
                userId: "user_1",
                applicationsBase: [{ externalId: "job_1", status: "discovered" }],
            },
            {
                userId: "user_2",
                applicationsBase: [{ externalId: "job_2", status: "discovered" }],
            },
        ]);

        expect(result).toHaveLength(2);
        expect(result.map((item) => item.json.userId)).toEqual(["user_1", "user_2"]);
        expect(result[0].json.applicationsFinal).toEqual([
            expect.objectContaining({ externalId: "job_1" }),
        ]);
        expect(result[1].json.applicationsFinal).toEqual([
            expect.objectContaining({ externalId: "job_2" }),
        ]);
    });

    it("does not drop the second no-tailor user", () => {
        const result = runPreparePersistNoTailor([
            { userId: "first_user", applicationsBase: [] },
            {
                userId: "second_user",
                applicationsBase: [{ externalId: "second_user_job", status: "discovered" }],
            },
        ]);

        expect(result.find((item) => item.json.userId === "second_user")).toMatchObject({
            json: {
                applicationsFinal: [
                    expect.objectContaining({ externalId: "second_user_job" }),
                ],
            },
        });
    });

    it("routes tailor-parse failures to persistence as well as error logging", () => {
        const workflow = loadWorkflow();
        const falseBranch = workflow.connections?.["Tailor Parsed? v3"]?.main?.[1] || [];

        expect(falseBranch).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ node: "Build Tailor Error Payload v3" }),
                expect.objectContaining({ node: "Prepare Persist Payload v3" }),
            ])
        );
    });

    it("emits one tailor error payload per failed user", () => {
        const result = runBuildTailorErrorPayload([
            {
                runId: "run_1",
                slotId: "slot_1",
                userId: "user_1",
                tailorReasonCode: "TAILORING_PARSE_FAILURE",
                tailorParseFallbackToDiscovered: true,
                config: { webhookSecret: "secret" },
            },
            {
                runId: "run_1",
                slotId: "slot_1",
                userId: "user_2",
                tailorReasonCode: "TAILORING_PARSE_FAILURE",
                tailorParseFallbackToDiscovered: true,
                config: { webhookSecret: "secret" },
            },
        ]);

        expect(result).toHaveLength(2);
        expect(result.map((item) => item.json.userId)).toEqual(["user_1", "user_2"]);
        expect(result[1].json.workflowErrorData).toMatchObject({
            userId: "user_2",
            payload: {
                userId: "user_2",
                fallbackToDiscovered: true,
            },
        });
    });

    it("limits tailor prompt batches and payload size to avoid response truncation", () => {
        const result = runBuildTailorPrompt({
            user: {
                masterCvText: "C".repeat(6000),
            },
            candidatesToTailor: [
                {
                    title: "Senior Engineer",
                    company: "Acme",
                    atsKeywords: ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"],
                    description: "A".repeat(1600),
                },
                {
                    title: "Second Engineer",
                    company: "Beta",
                    description: "B".repeat(1600),
                },
            ],
        });

        expect(result.json.candidatesToTailor).toHaveLength(1);
        expect(result.json.tailorPromptMeta).toMatchObject({
            sourceCandidates: 2,
            selectedCandidates: 1,
            maxTailorJobsPerRequest: 1,
            maxCvChars: 4500,
            maxJobDescriptionChars: 1200,
        });
        expect(result.json.tailorPrompt).toContain("Senior Engineer");
        expect(result.json.tailorPrompt).not.toContain("Second Engineer");
        expect(result.json.tailorPrompt).toContain("Keep outputs concise");
        expect(result.json.tailorPrompt).not.toContain("A".repeat(1201));
        expect(result.json.tailorPrompt).not.toContain("C".repeat(4501));
    });

    it("raises tailor response budget after shrinking batch payloads", () => {
        const node = loadNode("HTTP Tailor Batch v3");
        expect(node.parameters.jsonBody).toContain("max_tokens: 3600");
    });

    it("treats recovered tailor parse fallback as a warning, not a failed user", () => {
        const result = runFinalizeUserResult({
            runId: "run_1",
            slotId: "slot_1",
            userId: "user_1",
            applicationsFinal: [{ externalId: "job_1", status: "discovered" }],
            tailorReasonCode: "TAILORING_PARSE_FAILURE",
            tailorParseFallbackToDiscovered: true,
        });

        expect(result.json).toMatchObject({
            processed: true,
            failed: false,
            warning: true,
            persistedCount: 1,
            reasonCode: "TAILORING_PARSE_FAILURE",
        });
    });

    it("marks run summaries with persisted warning results as successful warnings", () => {
        const result = runAggregateDiscoverySummary([
            {
                usersSeen: 5,
                usersCanary: 5,
                processed: true,
                failed: false,
                warning: true,
                persistedCount: 18,
            },
        ]);

        expect(result[0].json).toMatchObject({
            runId: "run_1",
            usersSeen: 5,
            usersCanary: 5,
            usersProcessed: 1,
            usersFailed: 0,
            usersWarned: 1,
            persistedApplications: 18,
            status: "completed_with_warnings",
        });
    });
});
