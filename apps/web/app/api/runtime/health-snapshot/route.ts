import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";

const HEALTH_SNAPSHOT_HEADER = "x-health-snapshot-token";
const RUNTIME_HEALTH_SNAPSHOT_RATE_LIMIT_MAX_REQUESTS = 30;
const RUNTIME_HEALTH_SNAPSHOT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RUNTIME_HEALTH_SNAPSHOT_TOKEN_STALE_DAYS = 30;
const runtimeHealthSnapshotRequestLog = new Map<string, number[]>();

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

function readLatestFileFromPrefixes(
    reportsDir: string,
    prefixes: string[],
    extension: ".json" | ".txt"
) {
    const candidates = prefixes
        .map((prefix) => readLatestFile(reportsDir, prefix, extension))
        .filter(Boolean) as Array<{ filePath: string; raw: string }>;

    if (candidates.length === 0) {
        return null;
    }

    return candidates.sort(
        (a, b) => fs.statSync(a.filePath).mtimeMs - fs.statSync(b.filePath).mtimeMs
    )[candidates.length - 1];
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

function asRecord(value: unknown): JsonRecord {
    return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function readBoolean(record: JsonRecord, key: string) {
    const value = record[key];
    return typeof value === "boolean" ? value : null;
}

function readNumber(record: JsonRecord, key: string) {
    const value = record[key];
    return typeof value === "number" ? value : null;
}

function readString(record: JsonRecord, key: string, fallback = "unknown") {
    const value = record[key];
    return typeof value === "string" ? value : fallback;
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

function buildTokenRotationStatus(now = Date.now()) {
    const rotatedAtRaw =
        process.env.RUNTIME_HEALTH_SNAPSHOT_TOKEN_ROTATED_AT?.trim() || "";
    const warnings: string[] = [];
    if (!rotatedAtRaw) {
        warnings.push(
            "RUNTIME_HEALTH_SNAPSHOT_TOKEN_ROTATED_AT is missing; set it after each token rotation."
        );
        return {
            rotatedAt: null,
            ageDays: null,
            isStale: true,
            warnings,
        };
    }

    const rotatedAt = new Date(rotatedAtRaw);
    if (Number.isNaN(rotatedAt.getTime())) {
        warnings.push(
            "RUNTIME_HEALTH_SNAPSHOT_TOKEN_ROTATED_AT is invalid; expected ISO date."
        );
        return {
            rotatedAt: rotatedAtRaw,
            ageDays: null,
            isStale: true,
            warnings,
        };
    }

    const ageDays = Math.floor((now - rotatedAt.getTime()) / (24 * 60 * 60 * 1000));
    const isStale = ageDays >= RUNTIME_HEALTH_SNAPSHOT_TOKEN_STALE_DAYS;
    if (isStale) {
        warnings.push(
            `Health snapshot token rotation is stale (${ageDays} days old). Rotate token and update RUNTIME_HEALTH_SNAPSHOT_TOKEN_ROTATED_AT.`
        );
    }

    return {
        rotatedAt: rotatedAt.toISOString(),
        ageDays,
        isStale,
        warnings,
    };
}

function auditSnapshotAccess(event: {
    status: "success" | "unauthorized" | "disabled" | "rate_limited";
    clientIp: string | null;
    reason: string;
}) {
    const logPayload = {
        at: new Date().toISOString(),
        status: event.status,
        clientIp: event.clientIp,
        reason: event.reason,
    };

    if (event.status === "success") {
        console.info("[runtime-health-snapshot] access", logPayload);
        return;
    }

    console.warn("[runtime-health-snapshot] access", logPayload);
}

/**
 * GET /api/runtime/health-snapshot
 * Protected snapshot of latest perf/funnel/parity checks.
 */
export async function GET(req: Request) {
    const clientIp = getClientIp(req);
    const snapshotToken = process.env.RUNTIME_HEALTH_SNAPSHOT_TOKEN?.trim();
    if (!snapshotToken) {
        auditSnapshotAccess({
            status: "disabled",
            clientIp,
            reason: "missing_runtime_health_snapshot_token",
        });
        return NextResponse.json(
            { error: "Runtime health snapshot endpoint is disabled" },
            { status: 503 }
        );
    }

    const rateLimitKey = clientIp || "unknown";
    if (
        isRateLimited({
            store: runtimeHealthSnapshotRequestLog,
            key: rateLimitKey,
            maxRequests: RUNTIME_HEALTH_SNAPSHOT_RATE_LIMIT_MAX_REQUESTS,
            windowMs: RUNTIME_HEALTH_SNAPSHOT_RATE_LIMIT_WINDOW_MS,
        })
    ) {
        auditSnapshotAccess({
            status: "rate_limited",
            clientIp,
            reason: "snapshot_rate_limited",
        });
        return NextResponse.json(
            { error: "Too many requests" },
            { status: 429 }
        );
    }

    const providedToken = req.headers.get(HEALTH_SNAPSHOT_HEADER)?.trim();
    if (!providedToken || providedToken !== snapshotToken) {
        auditSnapshotAccess({
            status: "unauthorized",
            clientIp,
            reason: "invalid_snapshot_token",
        });
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reportsDir = resolveReportsDirectory();

    const perfReportFile = readLatestFileFromPrefixes(
        reportsDir,
        [
            "wave5-performance-budget-",
            "wave4-performance-budget-",
            "wave4-performance-routes-",
        ],
        ".json"
    );
    const perfReport = perfReportFile
        ? parseJsonPayload(perfReportFile.raw)
        : null;

    const funnelReportFile = readLatestFileFromPrefixes(
        reportsDir,
        [
            "wave6-conversion-trend-live-",
            "wave5-conversion-trend-",
            "wave4-conversion-telemetry-",
        ],
        ".json"
    );
    const funnelReport = funnelReportFile
        ? parseJsonPayload(funnelReportFile.raw)
        : null;
    const sentinelReportFile = readLatestFileFromPrefixes(
        reportsDir,
        ["wave6-conversion-sentinel-", "wave5-conversion-sentinel-"],
        ".json"
    );
    const sentinelReport = sentinelReportFile
        ? parseJsonPayload(sentinelReportFile.raw)
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
    const tokenRotationStatus = buildTokenRotationStatus();
    const funnelSourceFreshness = asRecord(funnelReport?.sourceFreshness);
    const funnelDataQuality = asRecord(funnelReport?.dataQuality);
    const sentinelSummary = asRecord(sentinelReport?.summary);
    const sentinelAlertDispatch = asRecord(sentinelSummary.alertDispatch);

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
                    sourceMode:
                        typeof funnelReport?.sourceMode === "string"
                            ? funnelReport.sourceMode
                            : null,
                    freshness: {
                        isFresh: readBoolean(funnelSourceFreshness, "isFresh"),
                        ageMinutes: readNumber(funnelSourceFreshness, "ageMinutes"),
                        freshnessWindowMinutes: readNumber(
                            funnelSourceFreshness,
                            "freshnessWindowMinutes"
                        ),
                    },
                    quality: {
                        score: readNumber(funnelDataQuality, "qualityScore"),
                        minimum: readNumber(funnelDataQuality, "minQualityScore"),
                        status: readString(funnelDataQuality, "status"),
                    },
                    sourceReport: funnelReportFile?.filePath || null,
                },
                conversionSentinel: {
                    status: toStatus(sentinelReport?.status),
                    triggerCode:
                        typeof sentinelSummary.triggerCode === "string"
                            ? sentinelSummary.triggerCode
                            : null,
                    alertDispatch: readString(
                        sentinelAlertDispatch,
                        "status",
                        "unknown"
                    ),
                    sourceReport: sentinelReportFile?.filePath || null,
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
            security: {
                tokenRotation: tokenRotationStatus,
                rateLimit: {
                    maxRequests: RUNTIME_HEALTH_SNAPSHOT_RATE_LIMIT_MAX_REQUESTS,
                    windowMs: RUNTIME_HEALTH_SNAPSHOT_RATE_LIMIT_WINDOW_MS,
                },
            },
        },
        { status: 200 }
    );

    auditSnapshotAccess({
        status: "success",
        clientIp,
        reason: "authorized_snapshot_fetch",
    });
    response.headers.set("Cache-Control", "no-store, max-age=0");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
}
