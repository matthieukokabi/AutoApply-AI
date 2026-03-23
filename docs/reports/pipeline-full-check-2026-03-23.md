# AutoApply Pipeline Full Check — 2026-03-23

## Scope
- End-to-end production health check of n8n automation workflows (discovery + tailoring).
- Verify saved state/rollback readiness.
- Diagnose and fix live v2 discovery failures without broad refactor.

## Findings (before fix)
- Workflow `hL4t2SFOT4IUeBcO` (Job Discovery & Tailoring Pipeline v2) was active but failing on scheduled runs.
- Latest failing stage: `Fetch Jobs via App API` with `Bad request - please check your parameters`.
- Root cause in live node config:
  - `Fetch Jobs via App API` had empty `bodyParameters` (sent invalid payload to `/api/webhooks/n8n`).
  - `LLM Relevance Scoring` and `LLM CV Tailoring` also had empty body payloads.
  - `Batch Save via App API` was configured as a direct HTTP call with non-contract payload (`batch_job_result`) instead of the app contract (`new_applications` envelope).

## Fix applied
- Re-published hardened incident template to v2 workflow while preserving the live `Load Config` node secrets.
- Command used:
  - `node apps/web/scripts/incident_patch_job_discovery_workflow.js --apply-prod --workflow-id hL4t2SFOT4IUeBcO`
- Result:
  - Previous version: `59d0426f-8eac-4eba-b848-6a6caf2e359c`
  - New active version: `5fa7d526-1d25-46ff-a99b-b8de9929ae04`
  - Schedule rule preserved: every 4 hours (`triggerAtMinute: 0`)

## Validation evidence

### 1) Rollback checkpoint
- Command:
  - `npm run incident:pipeline:checkpoint`
- Artifact:
  - `docs/reports/n8n-workflow-checkpoint-20260323_170552.json`
- Confirmed:
  - v2 discovery active + published version now points to `5fa7d526-1d25-46ff-a99b-b8de9929ae04`.
  - rollback candidate available: `59d0426f-8eac-4eba-b848-6a6caf2e359c`.

### 2) Recovery dry-run (no writes)
- Command:
  - `npm run incident:pipeline:recovery -- --email armand.kokabi+auto@gmail.com --max-jobs 3 --base-url https://autoapply.works`
- Result:
  - connectors: adzuna/themuse/remotive/arbeitnow/jsearch/jooble/reed all HTTP `200`
  - scored jobs: `3`
  - tailored candidates: `1`
  - callback not executed (dry-run expected)

### 3) Recovery real-run (writes enabled)
- Command:
  - `npm run incident:pipeline:recovery -- --email armand.kokabi+auto@gmail.com --max-jobs 2 --base-url https://autoapply.works --real-run`
- Result:
  - callback status: HTTP `200`
  - payload generated correctly (`new_applications`)
  - no scoring/tailoring errors

### 4) Recovery real-run on main profile
- Command:
  - `npm run incident:pipeline:recovery -- --email matthieu.kokabi@gmail.com --max-jobs 2 --base-url https://autoapply.works --real-run`
- Result:
  - `deltaApplications = 2`
  - tailored document persisted (`status=tailored`, compatibility `85`)
  - proves persistence + tailored output generation are operational on live backend path

## Current status
- Discovery v2 workflow config is now contract-aligned and saved.
- Single-job workflows:
  - `3iUzBukfS6TME2yn` active (`/webhook/single-job-tailor`) — currently used by `/api/tailor`.
  - `inuJ5oto7szOIlRN` active (`/webhook/single-job-tailor-v2`) — not yet wired as default app endpoint.
- LinkedIn auto-discovery remains disabled by design (`manual_job_url_import` only).

## Remaining gate (still pending)
- Need first terminal scheduled run **after** v2 version `5fa7d526-1d25-46ff-a99b-b8de9929ae04` to close scheduler confidence gate.
- Expected schedule cadence: every 4 hours at minute `00` (Europe/Berlin timezone in n8n config).
