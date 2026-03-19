# INCIDENT — AutoApply 4h automation pipeline outage (job discovery + tailoring)

Date: 2026-03-19  
Project: `autoapply.works`  
Workflow ID: `eddfsS251UHbmNIj`

## Root cause(s) (ranked by impact)

1. **Published workflow version drift (primary)**
   - Runtime stayed bound to historical active version `7d0a5683-743f-4cb5-8e07-e186dbc83c91` (schedule `minutesInterval: 1`) while patches were initially applied only to `workflow_entity` nodes.
   - Impact: scheduler fired every minute (and later duplicate minute triggers), causing repeated zero-job runs and connector pressure.

2. **n8n runtime stale in-memory trigger registrations**
   - After metadata corrections, minute-level trigger registrations already in memory continued to fire until process reload.
   - Impact: cadence in DB/config shows 4h but live runtime still emits minute-level triggers until service restart.

3. **Insufficient stage-level observability + guardrails before incident**
   - Missing per-run stage correlation and executable alerts delayed detection of connector/generation regressions.
   - Impact: silent degradation of end-to-end pipeline behavior.

4. **Tailoring/scoring parser brittleness under model response variance/timeouts**
   - Strict parse path previously dropped outputs on malformed/partial model payloads.
   - Impact: potential “jobs found but no tailored docs persisted” symptom.

## Affected stage(s)

- `Schedule Trigger`
- `Fetch Active Users with Prefs & CV`
- `Fetch Job Source`
- `Normalize & Deduplicate`
- `LLM Scoring` / `Parse Scoring Response`
- `LLM CV Tailoring` / `Parse Tailored Response`
- `Batch Save via App API`
- Webhook ingest: `/api/webhooks/n8n` (`new_applications`, `workflow_error`)

## Fixes applied (file-by-file + commit-by-commit)

- `c54118a` — incident diagnostics command
  - `apps/web/scripts/automation_pipeline_diagnostics.js`
  - `apps/web/package.json`
  - `TODO.md`

- `1d2d023` — workflow normalization + callback hard-fail + run correlation
  - `apps/web/scripts/incident_patch_job_discovery_workflow.js`
  - `n8n/workflows/job-discovery-pipeline.json`
  - `TODO.md`

- `04a50f9` — recovery command (per-profile, dry-run default)
  - `apps/web/scripts/automation_pipeline_recovery_run.js`
  - `apps/web/package.json`
  - `TODO.md`

- `aae6954` — parser hardening + recovery timeout
  - `apps/web/scripts/incident_patch_job_discovery_workflow.js`
  - `apps/web/scripts/automation_pipeline_recovery_run.js`
  - `n8n/workflows/job-discovery-pipeline.json`
  - `apps/web/__tests__/conversion-telemetry-weekly-report.test.ts`
  - `TODO.md`

- `e6a0d1c` — structured stage logging with `runId`
  - `apps/web/app/api/webhooks/n8n/route.ts`
  - `TODO.md`

- `8d20d3c` — fail-on-alert diagnostics guardrail
  - `apps/web/scripts/automation_pipeline_diagnostics.js`
  - `apps/web/package.json`
  - `TODO.md`

- `1b0914a` — helper exports + incident regression tests
  - `apps/web/scripts/automation_pipeline_diagnostics.js`
  - `apps/web/scripts/automation_pipeline_recovery_run.js`
  - `apps/web/__tests__/automation-pipeline-diagnostics.test.ts`
  - `apps/web/__tests__/automation-pipeline-recovery.test.ts`
  - `TODO.md`

- `7538dd3` — runbook publication
  - `docs/automation-4h-incident-response-runbook.md`
  - `TODO.md`

- `388d42e` — publish n8n version metadata correctly
  - `apps/web/scripts/incident_patch_job_discovery_workflow.js`
  - `n8n/workflows/job-discovery-pipeline.json`
  - `TODO.md`

- `708e67d` — cadence gate mitigation at fetch stage (effective 4h processing window)
  - `apps/web/scripts/incident_patch_job_discovery_workflow.js`
  - `n8n/workflows/job-discovery-pipeline.json`
  - `TODO.md`

## Validation proof

### 1) Real profile rerun with jobs + tailoring execution

- Profile: `matthieu.kokabi@gmail.com`
- Command executed (real-run):
  - `npm run incident:pipeline:recovery -- --email matthieu.kokabi@gmail.com --max-jobs 2 --real-run`
- Output evidence:
  - `connectors`: multiple `ok=true`, including `arbeitnow normalizedCount=100`
  - `jobs.dedupedCount=2`
  - `jobs.payloadTailoredCount=1`
  - `persistence.callbackStatus.ok=true`, `status=200`

### 2) Tailored CV/motivation persisted and linked

DB evidence from recent applications (affected profile):

- `2026-03-19T01:00:47.470Z`
  - `status=tailored`
  - `has_cv=true`
  - `has_cover=true`
  - source: `arbeitnow`
- `2026-03-19T01:00:48.498Z`
  - `status=discovered`
  - source: `arbeitnow`

This confirms persistence of new opportunities + tailored docs in production store.

### 3) Scheduler 4h configuration + active version

- Current workflow metadata:
  - `activeVersionId=91d8faf2-92d9-4281-a9dd-e9b222be703c`
  - schedule rule: `hoursInterval=4`, `triggerAtMinute=0`
- History evidence:
  - previous active version used `minutesInterval=1`
  - new published version contains corrected 4h rule

### 4) Current runtime status (important caveat)

- Despite corrected DB/published version metadata, live runtime still shows stale minute-level trigger executions until service reload.
- Mitigation now in place: fetch-stage cadence gate only allows full user/job processing on 4h slots, reducing incident impact while waiting for restart.

## Remaining risks + mitigations

- **Risk:** stale in-memory n8n registrations may continue minute-level trigger events.
  - **Mitigation:** cadence gate at fetch stage + alert checks (`npm run incident:pipeline:alerts`).

- **Risk:** repeated zero-jobs alert persists if connectors return no usable jobs.
  - **Mitigation:** run diagnostics by profile + manual recovery run to validate connector health and persistence path.

- **Risk:** duplicate opportunities on repeated manual recovery runs.
  - **Mitigation:** unique `(userId, jobId)` constraint and callback idempotent path in webhook ingestion.

## Follow-up (separate from incident fix)

1. **Mandatory closeout action:** restart n8n Render service once to clear stale in-memory trigger registrations.
2. After restart, run:
   - `npm run incident:pipeline:diagnostics -- --json`
   - verify no new minute-level execution pattern and confirm effective 4h cadence only.
3. Run one controlled `--real-run` recovery check and log resulting application IDs.
4. If `repeated_zero_jobs` remains, investigate connector-specific result quality (source-by-source response payload sampling).

## Rollback notes

- Workflow rollback target version (pre-incident): `7d0a5683-743f-4cb5-8e07-e186dbc83c91`.
- To rollback quickly:
  1. Set `workflow_entity.versionId` and `activeVersionId` to pre-incident version.
  2. Update `workflow_published_version.publishedVersionId` accordingly.
  3. Insert publish history event and restart n8n service.
- Caution: rollback reintroduces 1-minute scheduler behavior and previous parser/callback weaknesses.
