import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "../../..");

function read(relativePath: string) {
    return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

const ACTIVE_DISCOVERY_FILES = [
    "apps/web/app/api/webhooks/n8n/route.ts",
    "apps/web/scripts/automation_pipeline_recovery_run.js",
    "apps/web/scripts/incident_patch_job_discovery_workflow.js",
    "n8n/workflows/job-discovery-pipeline.json",
    "n8n/workflows/job-discovery-pipeline-v3.json",
];

const DEPLOYMENT_CONTRACT_FILES = [
    ".env.example",
    "render.yaml",
    "n8n/.env.n8n.example",
    "n8n/docker-compose.cloud.yml",
    "docs/automation-v3-env-contract.md",
];

describe("JSearch retirement contract", () => {
    it("removes JSearch requests and connector expectations from active discovery", () => {
        for (const relativePath of ACTIVE_DISCOVERY_FILES) {
            const content = read(relativePath);
            expect(content, relativePath).not.toContain("jsearch.p.rapidapi.com");
            expect(content, relativePath).not.toContain("JSEARCH_API_KEY");
            expect(content, relativePath).not.toContain("missing_jsearch_api_key");
            expect(content, relativePath).not.toMatch(/source:\s*["']jsearch["']/);
        }
    });

    it("does not require a JSearch key in deployment or environment contracts", () => {
        for (const relativePath of DEPLOYMENT_CONTRACT_FILES) {
            expect(read(relativePath), relativePath).not.toContain("JSEARCH_API_KEY");
        }
    });

    it("advertises the six remaining discovery sources", () => {
        const messages = ["en", "fr", "de", "es", "it"].map((locale) =>
            read(`apps/web/messages/${locale}.json`)
        );
        for (const messageCatalog of messages) {
            expect(messageCatalog).toContain("Adzuna, The Muse, Remotive, Arbeitnow, Jooble, Reed.");
            expect(messageCatalog).not.toContain("JSearch");
        }

        expect(read("apps/web/messages/en.json")).toContain("6 Job Board APIs");
        expect(read("docs/social-media-kit.md")).toContain("6 official APIs");
    });
});
