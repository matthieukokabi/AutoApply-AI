# Conversion Sentinel Failure Runbook

Use this runbook when `apps/web/scripts/conversion_regression_sentinel.js` exits with `status: fail`.

## missing_conversion_trend_report

1. Run `npm run telemetry:conversion:weekly -- https://autoapply.works` and confirm a fresh `wave6-conversion-trend-live-*.json` report exists.
2. Verify the report path passed to `CONVERSION_SENTINEL_SOURCE_REPORT` is correct.
3. Re-run `npm run telemetry:conversion:sentinel`.

## missing_weekly_windows

1. Open the trend report and confirm `funnel.weekly.days` exists with daily summary data.
2. Regenerate the trend report from live diagnostics.
3. Re-run sentinel after confirming window data is present.

## source_report_failed

1. Inspect `failureCodes` in the trend report.
2. Fix the underlying trend source issue first.
3. Re-run trend generation and then sentinel.

## source_stale

1. Verify `CONTACT_DIAGNOSTICS_TOKEN` is available in the runtime where trend generation runs.
2. Regenerate trend report and confirm `sourceFreshness.isFresh: true`.
3. Re-run sentinel.

## fallback_window_exceeded

1. Stop using seeded fallback and restore live diagnostics access.
2. Regenerate fresh live trend reports until fallback count is below policy.
3. Re-run sentinel.

## required_funnel_events_missing

1. Inspect `dataQuality.checks.requiredEvents.missing` in trend report.
2. Verify contact funnel instrumentation emits all required events:
   `page_view`, `cta_click`, `form_start`, `captcha_pass`, `captcha_fail`, `submit_success`, `submit_fail`.
3. Regenerate trend and re-run sentinel.

## quality_score_below_threshold

1. Review `dataQuality` details in trend report (freshness and segmentation coverage).
2. Fix root cause (stale source, missing dimensions, missing events).
3. Regenerate trend and re-run sentinel.

## route_dimension_missing

1. Check route segmentation in trend report (`funnel.daily.segmentation.byRoute`).
2. Ensure funnel client context includes valid route paths.
3. Regenerate trend and re-run sentinel.

## campaign_dimension_missing

1. Check campaign segmentation in trend report (`funnel.daily.segmentation.byCampaign`).
2. Ensure campaign context is propagated from query params/session into funnel events.
3. Regenerate trend and re-run sentinel.

## completion_rate_drop_consecutive_windows

1. Confirm regression in `windows` section and confidence tier (`medium` or `high`).
2. Compare recent deploys and acquisition mix changes for the impacted window.
3. Check CAPTCHA fail rates and submit failures for correlated spikes.
4. Roll back recent conversion-impacting changes if regression is confirmed.
