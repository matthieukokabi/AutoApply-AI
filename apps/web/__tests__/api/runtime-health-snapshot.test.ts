import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/runtime/health-snapshot/route";

const TEMP_DIRS: string[] = [];

afterEach(() => {
    delete process.env.RUNTIME_HEALTH_SNAPSHOT_TOKEN;
    delete process.env.RUNTIME_HEALTH_SNAPSHOT_REPORTS_DIR;
    delete process.env.RUNTIME_HEALTH_SNAPSHOT_TOKEN_ROTATED_AT;
    delete process.env.RESEND_API_KEY;
    delete process.env.CONTACT_INBOX_EMAIL;
    delete process.env.CONTACT_FROM_EMAIL;

    for (const dir of TEMP_DIRS.splice(0, TEMP_DIRS.length)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

function createReportsDir() {
    const reportsDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "runtime-health-snapshot-")
    );
    TEMP_DIRS.push(reportsDir);
    return reportsDir;
}

describe("GET /api/runtime/health-snapshot", () => {
    it("returns 503 when endpoint token is not configured", async () => {
        const response = await GET(
            new Request("http://localhost/api/runtime/health-snapshot")
        );
        const data = await response.json();

        expect(response.status).toBe(503);
        expect(data.error).toContain("disabled");
    });

    it("returns 401 for invalid token", async () => {
        process.env.RUNTIME_HEALTH_SNAPSHOT_TOKEN = "snapshot_secret";

        const response = await GET(
            new Request("http://localhost/api/runtime/health-snapshot", {
                headers: {
                    "x-health-snapshot-token": "invalid_secret",
                },
            })
        );
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toContain("Unauthorized");
    });

    it("returns latest perf/funnel/parity snapshot for authorized requests", async () => {
        const reportsDir = createReportsDir();
        process.env.RUNTIME_HEALTH_SNAPSHOT_TOKEN = "snapshot_secret";
        process.env.RUNTIME_HEALTH_SNAPSHOT_REPORTS_DIR = reportsDir;
        process.env.RUNTIME_HEALTH_SNAPSHOT_TOKEN_ROTATED_AT =
            "2026-03-17T00:00:00.000Z";
        process.env.RESEND_API_KEY = "re_test_key";

        fs.writeFileSync(
            path.join(reportsDir, "wave5-performance-budget-20260318_200000.json"),
            JSON.stringify(
                {
                    status: "pass",
                    failureReason: null,
                },
                null,
                2
            )
        );
        fs.writeFileSync(
            path.join(reportsDir, "wave6-conversion-trend-live-20260318_200000.json"),
            JSON.stringify(
                {
                    status: "alert",
                    anomalyCount: 2,
                    sourceMode: "live",
                    sourceFreshness: {
                        isFresh: true,
                        ageMinutes: 3,
                        freshnessWindowMinutes: 180,
                    },
                    dataQuality: {
                        qualityScore: 92,
                        minQualityScore: 80,
                        status: "pass",
                    },
                },
                null,
                2
            )
        );
        fs.writeFileSync(
            path.join(reportsDir, "wave6-conversion-sentinel-20260318_200000.json"),
            JSON.stringify(
                {
                    status: "pass",
                    summary: {
                        triggerCode: null,
                        alertDispatch: {
                            status: "no_alert",
                        },
                    },
                },
                null,
                2
            )
        );
        fs.writeFileSync(
            path.join(reportsDir, "wave3-canonical-og-parity-prod-2026-03-18.txt"),
            "PASS canonical_og_parity_all_indexable\n"
        );
        fs.writeFileSync(
            path.join(reportsDir, "wave3-live-squirrel-audit-prod-2026-03-18.json"),
            JSON.stringify(
                {
                    status: "pass",
                },
                null,
                2
            )
        );

        const response = await GET(
            new Request("http://localhost/api/runtime/health-snapshot", {
                headers: {
                    "x-health-snapshot-token": "snapshot_secret",
                },
            })
        );
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toContain("no-store");
        expect(response.headers.get("x-robots-tag")).toContain("noindex");
        expect(data.snapshot.perfGate.status).toBe("pass");
        expect(data.snapshot.funnelTelemetry.status).toBe("alert");
        expect(data.snapshot.funnelTelemetry.anomalyCount).toBe(2);
        expect(data.snapshot.funnelTelemetry.sourceMode).toBe("live");
        expect(data.snapshot.funnelTelemetry.freshness.isFresh).toBe(true);
        expect(data.snapshot.funnelTelemetry.quality.score).toBe(92);
        expect(data.snapshot.conversionSentinel.status).toBe("pass");
        expect(data.snapshot.parityChecks.overallStatus).toBe("pass");
        expect(data.snapshot.parityChecks.canonicalOgParity.status).toBe("pass");
        expect(data.snapshot.parityChecks.liveSquirrel.status).toBe("pass");
        expect(data.snapshot.contactMail.status).toBe("configured");
        expect(data.snapshot.contactMail.destinationEmail).toBe(
            "contact@autoapply.works"
        );
        expect(data.snapshot.contactMail.missingEnv).toEqual([]);
        expect(data.security.tokenRotation.isStale).toBe(false);
    });

    it("returns stale token warning when rotation timestamp is too old", async () => {
        const reportsDir = createReportsDir();
        process.env.RUNTIME_HEALTH_SNAPSHOT_TOKEN = "snapshot_secret";
        process.env.RUNTIME_HEALTH_SNAPSHOT_REPORTS_DIR = reportsDir;
        process.env.RUNTIME_HEALTH_SNAPSHOT_TOKEN_ROTATED_AT =
            "2026-01-01T00:00:00.000Z";

        fs.writeFileSync(
            path.join(reportsDir, "wave5-performance-budget-20260318_200000.json"),
            JSON.stringify({ status: "pass", failureReason: null }, null, 2)
        );
        fs.writeFileSync(
            path.join(reportsDir, "wave6-conversion-trend-live-20260318_200000.json"),
            JSON.stringify(
                {
                    status: "pass",
                    anomalyCount: 0,
                    sourceMode: "live",
                    sourceFreshness: {
                        isFresh: true,
                        ageMinutes: 2,
                        freshnessWindowMinutes: 180,
                    },
                    dataQuality: {
                        qualityScore: 95,
                        minQualityScore: 80,
                        status: "pass",
                    },
                },
                null,
                2
            )
        );
        fs.writeFileSync(
            path.join(reportsDir, "wave6-conversion-sentinel-20260318_200000.json"),
            JSON.stringify(
                {
                    status: "pass",
                    summary: {
                        triggerCode: null,
                        alertDispatch: {
                            status: "no_alert",
                        },
                    },
                },
                null,
                2
            )
        );
        fs.writeFileSync(
            path.join(reportsDir, "wave3-canonical-og-parity-prod-2026-03-18.txt"),
            "PASS canonical_og_parity_all_indexable\n"
        );
        fs.writeFileSync(
            path.join(reportsDir, "wave3-live-squirrel-audit-prod-2026-03-18.json"),
            JSON.stringify({ status: "pass" }, null, 2)
        );

        const response = await GET(
            new Request("http://localhost/api/runtime/health-snapshot", {
                headers: {
                    "x-health-snapshot-token": "snapshot_secret",
                },
            })
        );
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.security.tokenRotation.isStale).toBe(true);
        expect(data.security.tokenRotation.warnings[0]).toContain("stale");
    });

    it("rate limits repeated requests from the same IP", async () => {
        const reportsDir = createReportsDir();
        process.env.RUNTIME_HEALTH_SNAPSHOT_TOKEN = "snapshot_secret";
        process.env.RUNTIME_HEALTH_SNAPSHOT_REPORTS_DIR = reportsDir;
        process.env.RUNTIME_HEALTH_SNAPSHOT_TOKEN_ROTATED_AT =
            "2026-03-17T00:00:00.000Z";

        fs.writeFileSync(
            path.join(reportsDir, "wave5-performance-budget-20260318_200000.json"),
            JSON.stringify({ status: "pass", failureReason: null }, null, 2)
        );
        fs.writeFileSync(
            path.join(reportsDir, "wave6-conversion-trend-live-20260318_200000.json"),
            JSON.stringify(
                {
                    status: "pass",
                    anomalyCount: 0,
                    sourceMode: "live",
                    sourceFreshness: {
                        isFresh: true,
                        ageMinutes: 2,
                        freshnessWindowMinutes: 180,
                    },
                    dataQuality: {
                        qualityScore: 95,
                        minQualityScore: 80,
                        status: "pass",
                    },
                },
                null,
                2
            )
        );
        fs.writeFileSync(
            path.join(reportsDir, "wave6-conversion-sentinel-20260318_200000.json"),
            JSON.stringify(
                {
                    status: "pass",
                    summary: {
                        triggerCode: null,
                        alertDispatch: {
                            status: "no_alert",
                        },
                    },
                },
                null,
                2
            )
        );
        fs.writeFileSync(
            path.join(reportsDir, "wave3-canonical-og-parity-prod-2026-03-18.txt"),
            "PASS canonical_og_parity_all_indexable\n"
        );
        fs.writeFileSync(
            path.join(reportsDir, "wave3-live-squirrel-audit-prod-2026-03-18.json"),
            JSON.stringify({ status: "pass" }, null, 2)
        );

        const ip = "198.51.100.40";
        for (let i = 0; i < 30; i += 1) {
            const response = await GET(
                new Request("http://localhost/api/runtime/health-snapshot", {
                    headers: {
                        "x-health-snapshot-token": "snapshot_secret",
                        "x-forwarded-for": ip,
                    },
                })
            );
            expect(response.status).toBe(200);
        }

        const limitedResponse = await GET(
            new Request("http://localhost/api/runtime/health-snapshot", {
                headers: {
                    "x-health-snapshot-token": "snapshot_secret",
                    "x-forwarded-for": ip,
                },
            })
        );
        const data = await limitedResponse.json();

        expect(limitedResponse.status).toBe(429);
        expect(data.error).toContain("Too many requests");
    });
});
