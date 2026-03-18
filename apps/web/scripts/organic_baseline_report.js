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

function listMatchingReports(directory, prefixes, extension = ".json") {
    if (!fs.existsSync(directory)) {
        return [];
    }

    const prefixList = Array.isArray(prefixes) ? prefixes : [prefixes];
    return fs
        .readdirSync(directory)
        .filter((name) =>
            prefixList.some(
                (prefix) => name.startsWith(prefix) && name.endsWith(extension)
            )
        )
        .map((name) => path.join(directory, name))
        .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
}

function readLatestReport(reportsDir, prefixes) {
    const reports = listMatchingReports(reportsDir, prefixes, ".json");
    if (reports.length === 0) {
        return null;
    }

    return reports[reports.length - 1];
}

function classifyStatus(organicTrack) {
    if (!organicTrack || typeof organicTrack !== "object") {
        return "warning";
    }

    if (organicTrack.triggered) {
        return "fail";
    }

    if (organicTrack.status === "eligible") {
        return "pass";
    }

    return "warning";
}

function main() {
    const workspaceRoot = path.resolve(__dirname, "../../..");
    const reportsDir = path.resolve(
        process.env.OPS_REPORTS_DIR || path.join(workspaceRoot, "docs", "reports")
    );

    const sentinelPath = readLatestReport(reportsDir, [
        "wave7-conversion-sentinel-",
        "wave6-conversion-sentinel-",
        "wave5-conversion-sentinel-",
    ]);
    if (!sentinelPath) {
        console.error("No conversion sentinel report found for organic baseline artifact.");
        process.exit(1);
    }

    const historyPath = readLatestReport(reportsDir, ["wave7-telemetry-history-"]);
    const sentinelReport = readJson(sentinelPath);
    const historyReport = historyPath ? readJson(historyPath) : null;
    const organicTrack = sentinelReport?.channelTracks?.organic ||
        sentinelReport?.summary?.organicBaseline ||
        null;

    const outputPath =
        process.env.REPORT_PATH ||
        path.join(reportsDir, `wave7-organic-baseline-${formatTimestamp()}.json`);

    const output = {
        generatedAt: new Date().toISOString(),
        status: classifyStatus(organicTrack),
        organicBaseline: organicTrack,
        historyFreshness:
            historyReport?.freshness?.conversion?.status ||
            historyReport?.freshness?.sentinel?.status ||
            "unknown",
        sourceReports: {
            sentinel: path.resolve(sentinelPath),
            telemetryHistory: historyPath ? path.resolve(historyPath) : null,
        },
    };

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

    console.log(`Wave 7 organic baseline report: ${outputPath}`);
    console.log(JSON.stringify(output, null, 2));

    if (output.status === "fail") {
        process.exit(1);
    }
}

main();
