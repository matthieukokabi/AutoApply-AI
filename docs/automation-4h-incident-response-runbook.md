# 4h automation incident response

Use this runbook when users report no new job opportunities and/or no tailored CV/motivation outputs.

## Scope

- Scheduler cadence and missed runs
- Source connectors (Gmail/LinkedIn/job APIs)
- Pipeline stage failures and silent drops
- Recovery rerun for one affected profile

## Prerequisites

- Run from `apps/web`.
- Required runtime env must be present in the target environment:
`DATABASE_URL`, `N8N_WEBHOOK_SECRET`, source/API credentials, model credentials.
- Never print secret values in logs or reports.

## 1) Confirm scheduler health and 4h cadence

```bash
npm run incident:pipeline:diagnostics -- --json > /tmp/autoapply-pipeline-diagnostics.json
jq '.workflow | {id,name,active,cadenceHours,updatedAt}' /tmp/autoapply-pipeline-diagnostics.json
jq '.latest | {latestRunAt,latestRunStatus,latestSuccessAt,latestFailureReason}' /tmp/autoapply-pipeline-diagnostics.json
jq '.alerts' /tmp/autoapply-pipeline-diagnostics.json
```

Expected:

- `workflow.active=true`
- `cadenceHours=4`
- latest run timestamps are fresh
- no `scheduler_missed_threshold` alert

## 2) Drill down one affected profile

```bash
npm run incident:pipeline:diagnostics -- --email <user@email> --json > /tmp/autoapply-profile-diagnostics.json
jq '.profiles[0] | {email,automationEnabled,eligibleForAutomation,profileReady,preferencesReady,applicationsTotal,documentsGeneratedTotal}' /tmp/autoapply-profile-diagnostics.json
jq '.runs[0] | {executionId,status,failureReason,jobsFoundCount,documentsGeneratedCount}' /tmp/autoapply-profile-diagnostics.json
```

If `eligibleForAutomation=false`, fix profile state first (subscription/automation/profile/preferences).

## 3) Run alert guardrail (CI-compatible)

```bash
npm run incident:pipeline:alerts
```

- Exit code `0`: no blocking warning/critical alerts.
- Exit code `1`: at least one alert requires mitigation.

## 4) Execute safe recovery rerun

Dry-run first:

```bash
npm run incident:pipeline:recovery -- --email <user@email> --max-jobs 2
```

Real run only after dry-run looks correct:

```bash
npm run incident:pipeline:recovery -- --email <user@email> --max-jobs 2 --real-run
```

Success signals in output:

- `connectorResults` includes at least one `ok=true`
- `dedupedJobsCount > 0` (for generation path)
- `payloadTailoredCount > 0` (for tailored output path)
- `callbackStatus.ok=true` and HTTP `200` (persisted through webhook)
- `deltaApplications > 0` (new persisted records)

## 5) Verify persistence and user-facing impact

```bash
npm run incident:pipeline:diagnostics -- --email <user@email> --json > /tmp/autoapply-post-recovery.json
jq '.profiles[0] | {applicationsTotal,lastApplicationAt,documentsGeneratedTotal,lastDocumentGeneratedAt}' /tmp/autoapply-post-recovery.json
```

Expected after successful real run:

- `applicationsTotal` increased
- `documentsGeneratedTotal` increased (if tailored path triggered)
- recent timestamps updated

## 6) Failure code triage

- `scheduler_missed_threshold`: scheduler stopped or cadence drift; check active workflow and trigger config.
- `repeated_zero_jobs`: connectors/search filters produced no usable jobs repeatedly; inspect connector responses and normalization.
- `generation_failures_detected`: tailoring/scoring stage failing; inspect model/API timeout/error fields.
- `end_to_end_run_failure`: execution-level failure before persistence; inspect stage-level `hasError/errorMessage`.

## 6.1) Runtime/cache mismatch (important)

If DB metadata shows 4h schedule but diagnostics still show minute-level executions:

1. Confirm `workflow_entity.versionId` and latest `workflow_history` schedule rule are correct.
2. Treat this as stale in-memory n8n trigger registration.
3. Restart the n8n service (Render) once to flush old runtime trigger state.
4. Re-run diagnostics and verify recent execution timestamps no longer follow 1-minute cadence.

## 7) Incident closeout checklist

1. Scheduler confirmed active with 4h cadence.
2. One affected profile rerun succeeded end-to-end.
3. New applications persisted and tailored docs generated when applicable.
4. Alert guardrail executed and documented.
5. Incident report updated with timestamps + commit SHAs + remaining risks.
