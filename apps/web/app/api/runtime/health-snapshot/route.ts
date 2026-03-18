import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

const HEALTH_SNAPSHOT_HEADER = "x-health-snapshot-token";

type JsonRecord = Record<string, unknown>;

function resolveReportsDirectory() {
    const overrideDir = process.env.RUNTIME_HEALTH_SNAPSHOT_REPORTS_DIR?.trim();
    if (overrideDir) {
        return path.resolve(overrideDir);
    }

    const candidates = [
        path.resolve(process.cwd(), "../../docs/reports"),
        path.resolve(process.cwd(), "../docs/reports"),
        path.resolve(process.cwd(), "docs/reports"),
    ];

    return candidates.find((dir) => fs.existsSync(dir)) || candidates[0];
}

function readLatestFile(
    reportsDir: string,
    prefix: string,
    extension: ".json" | ".txt"
) {
    if (!fs.existsSync(reportsDir)) {
        return null;
    }

    const matches = fs
        .readdirSync(reportsDir)
        .filter((name) => name.startsWith(prefix) && name.endsWith(extension))
        .map((name) => path.join(reportsDir, name))
        .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);

    if (matches.length === 0) {
        return null;
    }

    const filePath = matches[matches.length - 1];
    const raw = fs.readFileSync(filePath, "utf8");
    return {
        filePath,
        raw,
    };
}

function parseJsonPayload(raw: string): JsonRecord | null {
    try {
        return JSON.parse(raw) as JsonRecord;
    } catch {
        return null;
    }
}

function toStatus(value: unknown) {
    return typeof value === "string" ? value : "unknown";
}

function canonicalParityStatus(raw: string) {
    if (raw.includes("PASS canonical_og_parity_all_indexable")) {
        return "pass";
    }

    if (raw.includes("FAIL")) {
        return "fail";
    }

    return "unknown";
}

/**
 * GET /api/runtime/health-snapshot
 * Protected snapshot of latest perf/funnel/parity checks.
 */
export async function GET(req: Request) {
    const snapshotToken = process.env.RUNTIME_HEALTH_SNAPSHOT_TOKEN?.trim();
    if (!snapshotToken) {
        return NextResponse.json(
            { error: "Runtime health snapshot endpoint is disabled" },
            { status: 503 }
        );
    }

    const providedToken = req.headers.get(HEALTH_SNAPSHOT_HEADER)?.trim();
    if (!providedToken || providedToken !== snapshotToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reportsDir = resolveReportsDirectory();

    const perfReportFile = readLatestFile(
        reportsDir,
        "wave4-performance-routes-",
        ".json"
    );
    const perfReport = perfReportFile
        ? parseJsonPayload(perfReportFile.raw)
        : null;

    const funnelReportFile = readLatestFile(
        reportsDir,
        "wave4-conversion-telemetry-",
        ".json"
    );
    const funnelReport = funnelReportFile
        ? parseJsonPayload(funnelReportFile.raw)
        : null;

    const parityTextFile = readLatestFile(
        reportsDir,
        "wave3-canonical-og-parity-prod-",
        ".txt"
    );
    const squirrelReportFile = readLatestFile(
        reportsDir,
        "wave3-live-squirrel-audit-prod-",
        ".json"
    );
    const squirrelReport = squirrelReportFile
        ? parseJsonPayload(squirrelReportFile.raw)
        : null;

    const parityCanonicalStatus = parityTextFile
        ? canonicalParityStatus(parityTextFile.raw)
        : "unavailable";
    const paritySquirrelStatus = toStatus(squirrelReport?.status);
    const parityOverallStatus =
        parityCanonicalStatus === "pass" && paritySquirrelStatus === "pass"
            ? "pass"
            : parityCanonicalStatus === "unavailable" && paritySquirrelStatus === "unknown"
              ? "unavailable"
              : "warning";

    const response = NextResponse.json(
        {
            generatedAt: new Date().toISOString(),
            reportsDir,
            snapshot: {
                perfGate: {
                    status: toStatus(perfReport?.status),
                    sourceReport: perfReportFile?.filePath || null,
                    failureReason:
                        typeof perfReport?.failureReason === "string"
                            ? perfReport.failureReason
                            : null,
                },
                funnelTelemetry: {
                    status: toStatus(funnelReport?.status),
                    anomalyCount:
                        typeof funnelReport?.anomalyCount === "number"
                            ? funnelReport.anomalyCount
                            : null,
                    sourceReport: funnelReportFile?.filePath || null,
                },
                parityChecks: {
                    overallStatus: parityOverallStatus,
                    canonicalOgParity: {
                        status: parityCanonicalStatus,
                        sourceReport: parityTextFile?.filePath || null,
                    },
                    liveSquirrel: {
                        status: paritySquirrelStatus,
                        sourceReport: squirrelReportFile?.filePath || null,
                    },
                },
            },
        },
        { status: 200 }
    );

    response.headers.set("Cache-Control", "no-store, max-age=0");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
}
