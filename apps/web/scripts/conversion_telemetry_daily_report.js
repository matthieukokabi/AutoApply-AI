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

async function main() {
    const workspaceRoot = path.resolve(__dirname, "../../..");
    const reportsDir = path.join(workspaceRoot, "docs", "reports");
    const baseUrl = (process.argv[2] || process.env.CONVERSION_TELEMETRY_BASE_URL || "https://autoapply.works").replace(/\/$/, "");
    const diagnosticsToken = process.env.CONTACT_DIAGNOSTICS_TOKEN?.trim();
    const reportPath =
        process.env.REPORT_PATH ||
        path.join(reportsDir, `wave4-conversion-telemetry-${formatTimestamp()}.json`);

    if (!diagnosticsToken) {
        console.error("CONTACT_DIAGNOSTICS_TOKEN is required to generate conversion telemetry report.");
        process.exit(1);
    }

    const response = await fetch(`${baseUrl}/api/contact/diagnostics`, {
        method: "GET",
        headers: {
            "x-contact-diagnostics-token": diagnosticsToken,
        },
    });

    let payload = {};
    try {
        payload = await response.json();
    } catch {
        payload = {};
    }

    if (!response.ok) {
        console.error("Failed to fetch contact diagnostics:", response.status, payload);
        process.exit(1);
    }

    const funnelDaily = payload?.telemetry?.funnel?.daily || null;
    const anomalies = funnelDaily?.summary?.anomalies || [];
    const completionRateFromFormStart = funnelDaily?.summary?.completionRateFromFormStart ?? null;
    const captchaFailRate = funnelDaily?.summary?.captchaFailRate ?? null;

    const output = {
        generatedAt: new Date().toISOString(),
        baseUrl,
        source: `${baseUrl}/api/contact/diagnostics`,
        status: anomalies.length > 0 ? "alert" : "pass",
        anomalyCount: anomalies.length,
        keyMetrics: {
            completionRateFromFormStart,
            captchaFailRate,
        },
        telemetry: payload?.telemetry || null,
    };

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    console.log(`Wave 4 conversion telemetry report: ${reportPath}`);
    console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
    console.error("Conversion telemetry report generation failed:", error);
    process.exit(1);
});
