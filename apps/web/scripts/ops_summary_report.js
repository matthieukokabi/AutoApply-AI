#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function formatTimestamp(date = new Date()) {
    const yyyy = String(date.getUTCFullYear());
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const hh = String(date.getUTCHours()).padStart(2, "0");
    const mi = String(date.getUTCMinutes()).padStart(2, "0");
    const ss = String(date.getUTCSeconds()).padStart(2, "0");
    return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listMatchingReports(directory, prefix, extension = ".json") {
    if (!fs.existsSync(directory)) {
        return [];
    }

    return fs
        .readdirSync(directory)
        .filter((name) => name.startsWith(prefix) && name.endsWith(extension))
        .map((name) => path.join(directory, name))
        .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
}

function toStatus(value, fallback = "unavailable") {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function classifyStatus(status) {
    const normalized = status.toLowerCase();
    if (normalized === "fail") {
        return "fail";
    }

    if (normalized.includes("alert") || normalized.includes("warning")) {
        return "warning";
    }

    if (normalized === "pass" || normalized === "pass_with_emergency_bypass") {
        return normalized;
    }

    return "unavailable";
}

function canonicalParityStatus(rawText) {
    if (rawText.includes("PASS canonical_og_parity_all_indexable")) {
        return "pass";
    }

    if (rawText.includes("FAIL")) {
        return "fail";
    }

    return "unavailable";
}

function readLatestFile(reportsDir, prefix, extension) {
    const candidates = listMatchingReports(reportsDir, prefix, extension);
    if (candidates.length === 0) {
        return null;
    }

    return candidates[candidates.length - 1];
}

function readLatestFromPrefixes(reportsDir, prefixes, extension = ".json") {
    const allCandidates = prefixes
        .flatMap((prefix) => listMatchingReports(reportsDir, prefix, extension))
        .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);

    if (allCandidates.length === 0) {
        return null;
    }

    return allCandidates[allCandidates.length - 1];
}

function createComponentSummary(name, status, detail, sourceReport) {
    return {
        name,
        status,
        detail,
        sourceReport,
    };
}

function main() {
    const workspaceRoot = path.resolve(__dirname, "../../..");
    const reportsDir = path.resolve(
        process.env.OPS_REPORTS_DIR || path.join(workspaceRoot, "docs", "reports")
    );
    const outputPath =
        process.env.REPORT_PATH ||
        path.join(reportsDir, `wave5-ops-summary-${formatTimestamp()}.json`);

    const perfGatePath = readLatestFromPrefixes(
        reportsDir,
        ["wave5-performance-budget-", "wave4-performance-budget-"],
        ".json"
    );
    const lighthousePath = readLatestFromPrefixes(
        reportsDir,
        ["wave5-lighthouse-reliability-", "wave4-lighthouse-reliability-"],
        ".json"
    );
    const funnelPath = readLatestFile(reportsDir, "wave5-conversion-trend-", ".json");
    const parityPath = readLatestFile(
        reportsDir,
        "wave3-canonical-og-parity-prod-",
        ".txt"
    );
    const squirrelPath = readLatestFile(
        reportsDir,
        "wave3-live-squirrel-audit-prod-",
        ".json"
    );

    const perfGate = perfGatePath ? readJson(perfGatePath) : null;
    const lighthouse = lighthousePath ? readJson(lighthousePath) : null;
    const funnel = funnelPath ? readJson(funnelPath) : null;
    const squirrel = squirrelPath ? readJson(squirrelPath) : null;
    const parityRaw = parityPath ? fs.readFileSync(parityPath, "utf8") : "";

    const perfStatus = classifyStatus(toStatus(perfGate?.status));
    const lighthouseStatus = classifyStatus(toStatus(lighthouse?.summary?.status));
    const funnelStatus = classifyStatus(toStatus(funnel?.status));
    const parityCanonicalStatus = classifyStatus(canonicalParityStatus(parityRaw));
    const paritySquirrelStatus = classifyStatus(toStatus(squirrel?.status));

    const parityOverallStatus =
        parityCanonicalStatus === "pass" && paritySquirrelStatus === "pass"
            ? "pass"
            : parityCanonicalStatus === "fail" || paritySquirrelStatus === "fail"
              ? "fail"
              : "warning";

    const components = {
        perfGate: createComponentSummary(
            "perfGate",
            perfStatus,
            perfStatus === "pass"
                ? "Performance budget gate is passing."
                : "Performance budget gate requires attention.",
            perfGatePath
        ),
        lighthouseReliability: createComponentSummary(
            "lighthouseReliability",
            lighthouseStatus,
            lighthouseStatus === "pass"
                ? "Lighthouse reliability checks are stable."
                : "Lighthouse reliability checks require attention.",
            lighthousePath
        ),
        funnelHealth: createComponentSummary(
            "funnelHealth",
            funnelStatus,
            funnelStatus === "pass"
                ? "Conversion trend is stable with no active anomalies."
                : "Conversion trend includes anomalies or alerts.",
            funnelPath
        ),
        parityChecks: createComponentSummary(
            "parityChecks",
            parityOverallStatus,
            parityOverallStatus === "pass"
                ? "Canonical parity and live squirrel checks are passing."
                : "Parity checks require attention.",
            parityPath || squirrelPath
        ),
    };

    const componentStatuses = Object.values(components).map((component) =>
        classifyStatus(component.status)
    );

    let overallStatus = "pass";
    if (componentStatuses.some((status) => status === "fail")) {
        overallStatus = "fail";
    } else if (componentStatuses.some((status) => status !== "pass")) {
        overallStatus = "warning";
    }

    const missionControlSummary = [
        `Overall status: ${overallStatus.toUpperCase()}`,
        `Perf gate: ${components.perfGate.status}`,
        `Lighthouse reliability: ${components.lighthouseReliability.status}`,
        `Funnel health: ${components.funnelHealth.status}`,
        `Parity checks: ${components.parityChecks.status}`,
    ];

    const output = {
        generatedAt: new Date().toISOString(),
        reportsDir,
        overallStatus,
        components,
        missionControlSummary,
        sourceReports: {
            perfGate: perfGatePath,
            lighthouseReliability: lighthousePath,
            funnelHealth: funnelPath,
            canonicalParity: parityPath,
            liveSquirrel: squirrelPath,
        },
    };

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    console.log(`Wave 5 ops summary report: ${outputPath}`);
    console.log(JSON.stringify(output, null, 2));
}

main();
