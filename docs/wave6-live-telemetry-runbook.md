# Wave 6 Live Telemetry Runbook

Use this runbook to generate Wave 6 live operations artifacts (no payment actions).

## Preconditions

1. `CONTACT_DIAGNOSTICS_TOKEN` exists in Vercel for `Production`, `Preview`, and `Development`.
2. Latest production deployment includes current runtime config.
3. Local shell has `CONTACT_DIAGNOSTICS_TOKEN` exported for report generation.

## Generate Artifacts

Run in `apps/web`:

```bash
CONTACT_DIAGNOSTICS_TOKEN="<token>" npm run wave6:ops:live
```

This generates:

- `docs/reports/wave6-conversion-trend-live-*.json`
- `docs/reports/wave6-conversion-sentinel-*.json`
- `docs/reports/wave6-perf-conversion-correlation-*.json`
- `docs/reports/wave6-ops-summary-*.json`

## Quick Verification

1. Trend report must show `"sourceMode": "live"` and `"sourceFreshness.isFresh": true`.
2. Sentinel report must not contain source guardrail failure codes.
3. Ops summary mission-control payload should include:
   - `seoParityStatus`
   - `perfGateStatus`
   - `conversionSentinelStatus`
   - `telemetryFreshness`
   - `topAnomalies`
