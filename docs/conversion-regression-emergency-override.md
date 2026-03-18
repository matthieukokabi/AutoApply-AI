# Conversion Regression Sentinel Emergency Override (Wave 5)

## Purpose
`telemetry:conversion:sentinel` is a hard guardrail for conversion quality. It fails when completion rate from form starts drops beyond configured threshold for consecutive windows.

## Normal behavior
- Sentinel config: `apps/web/config/conversion-regression-sentinel.json`
- Source artifact: latest `docs/reports/wave5-conversion-trend-*.json` (or explicit `CONVERSION_SENTINEL_SOURCE_REPORT`)
- Trigger condition:
  - completion drop exceeds `dropThresholdPercent`
  - sustained for `consecutiveWindowsToFail` windows

If triggered, CI/release fails.

## Emergency override path
Set repository variable `CONVERSION_SENTINEL_EMERGENCY_BYPASS` to a short incident reason.

Example value:
- `incident-2026-03-18-conversion-tracking-outage`

When set:
- Sentinel still writes `docs/reports/wave5-conversion-sentinel-*.json`
- Status becomes `pass_with_emergency_bypass`
- Pipeline unblocks with explicit audit trail

## Mandatory follow-up
1. Fix root cause of conversion drop or telemetry quality issue.
2. Remove `CONVERSION_SENTINEL_EMERGENCY_BYPASS`.
3. Re-run pipeline and confirm sentinel passes without override.
