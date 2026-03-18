import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/runtime/health-snapshot/route";

const TEMP_DIRS: string[] = [];

afterEach(() => {
    delete process.env.RUNTIME_HEALTH_SNAPSHOT_TOKEN;
    delete process.env.RUNTIME_HEALTH_SNAPSHOT_REPORTS_DIR;

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

        fs.writeFileSync(
            path.join(reportsDir, "wave4-performance-routes-20260318_200000.json"),
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
            path.join(reportsDir, "wave4-conversion-telemetry-20260318_200000.json"),
            JSON.stringify(
                {
                    status: "alert",
                    anomalyCount: 2,
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
        expect(data.snapshot.parityChecks.overallStatus).toBe("pass");
        expect(data.snapshot.parityChecks.canonicalOgParity.status).toBe("pass");
        expect(data.snapshot.parityChecks.liveSquirrel.status).toBe("pass");
    });
});
