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

## External scheduler baseline (discovery v3)

- One scheduler authority only: external cron calls app endpoints.
- Expected discovery slots (Europe/Zurich): `07:20`, `12:20`, `18:20`.
- Scheduler endpoints:
  - `POST /api/cron/discovery-v3` (slot dispatch)
  - `POST /api/cron/discovery-v3/health` (dead-man health check)
  - `POST /api/cron/discovery-v3/manual` (operator-only replay path)

## 1) Confirm scheduler health and 4h cadence

```bash
npm run incident:pipeline:diagnostics -- --json > /tmp/autoapply-pipeline-diagnostics.json
jq '.workflow | {id,name,active,cadenceHours,updatedAt}' /tmp/autoapply-pipeline-diagnostics.json
jq '.latest | {latestRunAt,latestRunStatus,latestSuccessAt,latestFailureReason}' /tmp/autoapply-pipeline-diagnostics.json
jq '.alerts' /tmp/autoapply-pipeline-diagnostics.json
```

```bash
curl -sS -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${APP_URL}/api/cron/discovery-v3/health" | jq .
```

Expected:

- `workflow.active=true`
- `cadenceHours=4` (fixed slots now externally dispatched at `:20` in Zurich windows)
- latest run timestamps are fresh
- no `scheduler_missed_threshold` alert
- health endpoint returns `healthy=true`

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

Operator slot replay path (external scheduler architecture):

```bash
curl -sS -X POST \
  -H "Authorization: Bearer ${DISCOVERY_MANUAL_TRIGGER_SECRET:-$CRON_SECRET}" \
  -H "Content-Type: application/json" \
  "${APP_URL}/api/cron/discovery-v3/manual" \
  -d '{"slotKey":"2026-04-04T12:20","reason":"incident_manual_replay"}' | jq .
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

## 8) v3 emergency disable (no UX/UI impact)

Use this when v3 automation behavior is unhealthy and you need immediate fallback to v2 routing.

1. Disable server-side canary routing in `apps/web` env:

```bash
V3_CANARY_USER_IDS=
V3_CANARY_SAMPLE_RATE=0
```

2. Pause external cron jobs for `/api/cron/discovery-v3` and `/api/cron/discovery-v3/health` (or rotate `CRON_SECRET`).
3. Redeploy web app so `/api/tailor` routes all users back to v2 webhook path.
4. Keep all v2 workflows unchanged and active.
5. Keep v3 workflows additive (do not delete them); optionally deactivate them in n8n if needed for noise reduction.

## 9) Inspect v3 workflow errors (DLQ-style triage)

`workflow_error` callbacks are stored in `workflow_errors`.

```sql
SELECT "createdAt", "workflowId", "nodeName", "errorType", message, "userId"
FROM workflow_errors
WHERE "workflowId" IN ('job-discovery-pipeline-v3', 'single-job-tailoring-v3')
ORDER BY "createdAt" DESC
LIMIT 100;
```

Filter by run id (when payload includes it):

```sql
SELECT "createdAt", "workflowId", "nodeName", "errorType", message, payload
FROM workflow_errors
WHERE payload ->> 'runId' = '<runId>'
ORDER BY "createdAt" DESC;
```

## 10) Verify idempotency behavior

`new_applications` and `single_tailoring_complete` idempotency keys are persisted in `n8n_webhook_events`.

Check recent v3 keys:

```sql
SELECT type, "idempotencyKey", "runId", "createdAt"
FROM n8n_webhook_events
WHERE "idempotencyKey" LIKE 'disc_v3:%'
   OR "idempotencyKey" LIKE 'tailor_v3:%'
ORDER BY "createdAt" DESC
LIMIT 100;
```

Confirm no duplicate keys exist:

```sql
SELECT "idempotencyKey", COUNT(*) AS c
FROM n8n_webhook_events
GROUP BY "idempotencyKey"
HAVING COUNT(*) > 1;
```

Expected: no rows (unique guard holds).  
Operational check: replay the same webhook idempotency key twice and confirm second response is HTTP 200 with duplicate/ignored semantics and no duplicate notification email.

## 11) Rollback canary routing and workflow versions

1. Disable canary env (`V3_CANARY_USER_IDS`, `V3_CANARY_SAMPLE_RATE`) and redeploy web app.
2. Capture/confirm rollback checkpoints before any live workflow version change:

```bash
cd apps/web
npm run incident:pipeline:checkpoint -- --workflow-id <v3_discovery_workflow_id> --workflow-id <v3_single_tailor_workflow_id> --output ../../docs/reports/n8n-workflow-checkpoint-v3-<timestamp>.json
```

3. If a live rollback is required, use checkpoint version IDs to restore:
   - `n8n.workflow_entity.versionId`
   - `n8n.workflow_entity.activeVersionId`
   - `n8n.workflow_published_version.publishedVersionId`
4. Record rollback event + resulting version IDs in incident notes.

## 12) Confirm no UI/design regressions

v3 reliability rollout is backend-only. Validate that no public design or UX changed:

1. File-level guard:

```bash
git diff --name-only <baseline_sha> HEAD -- apps/web/app apps/web/components apps/web/styles
```

Expected: no intentional visual/layout/styling changes for v3 rollout.

2. Behavior smoke:

```bash
cd apps/web
npm run smoke:onboarding -- https://autoapply.works
npm run smoke:onboarding:auth-blocked -- https://autoapply.works
```

3. If any frontend wiring file changed, verify rendered output is visually identical before marking incident closed.
