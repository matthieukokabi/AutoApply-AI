# Performance Budget Emergency Override (Wave 4)

## Purpose
`perf:budget:gate` is a hard gate in CI. It fails on:
- route budget violations (`lcpMs`, `cls`, `jsBytes`, `imageBytes`)
- metric regressions above allowed percentages

An emergency bypass exists only for short-term unblock during incident response.

## Normal behavior
- Thresholds are defined in `apps/web/config/performance-budgets.json`.
- CI runs:
  1. `npm run perf:lighthouse:reliability -- http://127.0.0.1:4100 /en`
  2. `PERF_BUDGET_SOURCE_REPORT=... npm run perf:budget:gate`
- If violations exist, CI fails.

## Emergency override path
Set repository variable `PERF_BUDGET_EMERGENCY_BYPASS` to a short reason string.

Example value:
- `incident-2026-03-18-hotfix-window`

When set:
- Budget violations are still reported in `docs/reports/wave4-performance-budget-*.json`.
- CI status becomes `pass_with_emergency_bypass` instead of failing.

## Mandatory follow-up after bypass
1. Fix the performance regression.
2. Remove `PERF_BUDGET_EMERGENCY_BYPASS` from repository variables.
3. Re-run CI and confirm the gate passes without override.
