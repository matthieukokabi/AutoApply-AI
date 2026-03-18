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

function readSegmentAlerts(segments = []) {
    return segments
        .filter((segment) => {
            const formStarts = segment?.summary?.formStarts || 0;
            const completionRate = segment?.summary?.completionRateFromFormStart || 0;
            return formStarts >= 5 && completionRate < 0.2;
        })
        .slice(0, 10)
        .map((segment) => ({
            segment: segment.segment,
            formStarts: segment.summary.formStarts,
            completionRateFromFormStart: segment.summary.completionRateFromFormStart,
        }));
}

async function main() {
    const workspaceRoot = path.resolve(__dirname, "../../..");
    const reportsDir = path.join(workspaceRoot, "docs", "reports");
    const baseUrl = (process.argv[2] || process.env.CONVERSION_TELEMETRY_BASE_URL || "https://autoapply.works").replace(/\/$/, "");
    const diagnosticsToken = process.env.CONTACT_DIAGNOSTICS_TOKEN?.trim();
    const reportPath =
        process.env.REPORT_PATH ||
        path.join(reportsDir, `wave5-conversion-trend-${formatTimestamp()}.json`);

    if (!diagnosticsToken) {
        console.error("CONTACT_DIAGNOSTICS_TOKEN is required to generate conversion trend report.");
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

    const telemetry = payload?.telemetry || null;
    const funnelDaily = telemetry?.funnel?.daily || null;
    const funnelWeekly = telemetry?.funnel?.weekly || null;
    const dailyAnomalies = funnelDaily?.summary?.anomalies || [];
    const weeklyAnomalies = funnelWeekly?.anomalies || [];
    const routeAlerts = readSegmentAlerts(funnelDaily?.segmentation?.byRoute || []);
    const campaignAlerts = readSegmentAlerts(funnelDaily?.segmentation?.byCampaign || []);

    const anomalyCount =
        dailyAnomalies.length +
        weeklyAnomalies.length +
        routeAlerts.length +
        campaignAlerts.length;

    const output = {
        generatedAt: new Date().toISOString(),
        baseUrl,
        source: `${baseUrl}/api/contact/diagnostics`,
        status: anomalyCount > 0 ? "alert" : "pass",
        anomalyCount,
        keyMetrics: {
            dailyCompletionRateFromFormStart:
                funnelDaily?.summary?.completionRateFromFormStart ?? null,
            dailyCaptchaFailRate: funnelDaily?.summary?.captchaFailRate ?? null,
            weeklyCompletionRateLatest:
                funnelWeekly?.trend?.completionRateFromFormStart?.latest ?? null,
            weeklyCompletionRateBaseline:
                funnelWeekly?.trend?.completionRateFromFormStart?.baseline ?? null,
            weeklyCaptchaFailRateLatest:
                funnelWeekly?.trend?.captchaFailRate?.latest ?? null,
            weeklyCaptchaFailRateBaseline:
                funnelWeekly?.trend?.captchaFailRate?.baseline ?? null,
        },
        anomalies: {
            daily: dailyAnomalies,
            weekly: weeklyAnomalies,
            routeDropoff: routeAlerts,
            campaignDropoff: campaignAlerts,
        },
        funnel: {
            daily: funnelDaily,
            weekly: funnelWeekly,
        },
    };

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    console.log(`Wave 5 conversion trend report: ${reportPath}`);
    console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
    console.error("Conversion trend report generation failed:", error);
    process.exit(1);
});
