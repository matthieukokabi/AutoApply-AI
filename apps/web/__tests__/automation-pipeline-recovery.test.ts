import { createRequire } from "module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const recovery = require("../scripts/automation_pipeline_recovery_run.js");

describe("automation pipeline recovery script helpers", () => {
    it("dedupes jobs and filters low-quality entries", () => {
        const jobs = recovery.dedupeJobs([
            {
                externalId: "job-1",
                title: "DevOps Engineer",
                description: "A".repeat(120),
            },
            {
                externalId: "job-1",
                title: "DevOps Engineer Duplicate",
                description: "A".repeat(140),
            },
            {
                externalId: "job-2",
                title: "Short Description",
                description: "Too short",
            },
        ]);

        expect(jobs).toHaveLength(1);
        expect(jobs[0].externalId).toBe("job-1");
    });

    it("handles failed connector responses without producing normalized jobs", () => {
        const result = recovery.buildConnectorResult("jsearch", {
            ok: false,
            status: 429,
            error: "rate_limited",
            body: { data: [{ job_id: "x" }] },
        });

        expect(result.ok).toBe(false);
        expect(result.status).toBe(429);
        expect(result.error).toBe("rate_limited");
        expect(result.normalized).toEqual([]);
    });

    it("maps generated tailoring output into persistence payload", () => {
        const scored = [
            {
                externalId: "arbeitnow-1",
                title: "IT Operation Lead",
                company: "Example AG",
                location: "Zurich",
                description: "A".repeat(180),
                source: "arbeitnow",
                url: "https://example.com/jobs/1",
                salary: null,
                postedAt: "2026-03-19T00:00:00.000Z",
                compatibilityScore: 82,
                atsKeywords: ["incident response"],
                matchingStrengths: ["operations"],
                gaps: [],
                recommendation: "apply",
            },
        ];

        const tailoredByExternalId = new Map<string, any>([
            [
                "arbeitnow-1",
                {
                    tailoredCvMarkdown: "# Tailored CV",
                    coverLetterMarkdown: "# Motivation Letter",
                    tailoringError: null,
                },
            ],
        ]);

        const payload = recovery.buildApplicationsPayload(
            scored,
            tailoredByExternalId,
            "recovery-run-id"
        );

        expect(payload).toHaveLength(1);
        expect(payload[0].status).toBe("tailored");
        expect(payload[0].tailoredCvMarkdown).toContain("Tailored CV");
        expect(payload[0].coverLetterMarkdown).toContain("Motivation Letter");
        expect(payload[0].runId).toBe("recovery-run-id");
    });

    it("builds expanded search criteria from user preferences", () => {
        const criteria = recovery.buildSearchCriteria({
            targetTitles: ["IT Operation Lead", "Incident Manager"],
            locations: ["Zürich", "Zurich"],
            remotePreference: "hybrid",
        });

        expect(criteria.searchTitle).toBe("IT Operation Lead");
        expect(criteria.searchLocation).toBe("Zürich");
        expect(criteria.titleCandidates).toContain("Incident Manager");
        expect(criteria.remotePreference).toBe("hybrid");
        expect(criteria.locationCandidates).toEqual(["Zürich", "Zurich"]);
    });

    it("filters location preference for hybrid searches", () => {
        const hybridHit = recovery.matchesLocationPreference(
            {
                location: "Zürich, Switzerland",
                title: "IT Operations Manager",
                description: "Hybrid role with 2 days remote.",
            },
            {
                locationCandidates: ["Zürich"],
                remotePreference: "hybrid",
            }
        );
        const nonMatchingOnsite = recovery.matchesLocationPreference(
            {
                location: "Berlin, Germany",
                title: "IT Operations Specialist",
                description: "On-site only, no home office.",
            },
            {
                locationCandidates: ["Zürich"],
                remotePreference: "hybrid",
            }
        );

        expect(hybridHit).toBe(true);
        expect(nonMatchingOnsite).toBe(false);
    });
});
