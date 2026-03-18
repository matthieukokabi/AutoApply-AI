# Performance Budget Emergency Override (Wave 4)

## Purpose
`perf:budget:gate` is a hard gate in CI. It fails on:
- route budget violations (`lcpMs`, `cls`, `jsBytes`, `imageBytes`)
- metric regressions above allowed percentages

An emergency bypass exists only for short-term unblock during incident response.

## Normal behavior
- Thresholds are defined in `apps/web/config/performance-budgets.json`.
- CI runs deterministic route audit:
  1. `PERF_BASE_URL=http://127.0.0.1:4100 npm run perf:routes:audit`
  2. Script checks all required routes in `apps/web/config/performance-audit-routes.json`
  3. For each required route, Lighthouse reliability + budget gate are executed
- If a required route is unavailable, the audit fails before budgets are evaluated.
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
