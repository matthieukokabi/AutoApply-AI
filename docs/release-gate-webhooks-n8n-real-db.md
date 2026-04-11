# Manual Release Gate: n8n Webhooks Real-DB Factual Guard

## Purpose

Run a manual, CI-safe gate before release-sensitive changes affecting the Tailor/new-applications persistence path.

The gate executes only:

`apps/web/__tests__/integration/webhooks-n8n.real-db.test.ts`

This test verifies in one real-DB run that:

- one clean item persists as `tailored`
- one hallucinated item is downgraded to `discovered` with null tailored markdown fields
- one `WorkflowError` row is persisted with `errorType=FACTUAL_GUARD_BLOCKED`
- aggregate persisted counters remain coherent (`tailored=1`, `discovered=1`, `quarantined=1`)

## Workflow

GitHub Actions workflow name:

`Webhooks n8n Real-DB Release Gate`

Workflow file:

`.github/workflows/webhooks-n8n-real-db-release-gate.yml`

Trigger:

- manual only (`workflow_dispatch`)

## Required secret

Set this repository secret before running the gate:

- `AUTOAPPLY_TEST_DATABASE_URL`
  - must point to a dedicated non-production test database
  - must include schema/migrations compatible with `apps/web/prisma/schema.prisma`

No database URL is hardcoded in the workflow.

## Operator run steps

1. Open GitHub Actions in this repository.
2. Select workflow `Webhooks n8n Real-DB Release Gate`.
3. Click `Run workflow` on the target branch/commit.
4. Wait for job `Real-DB factual-guard mixed-batch gate` to complete.
5. Confirm pass/fail and check step summary for expected proof points.

## Command executed by the gate

Inside `apps/web`, with `RUN_REAL_DB_INTEGRATION=1` and `DATABASE_URL=${{ secrets.AUTOAPPLY_TEST_DATABASE_URL }}`:

`npm run test -- __tests__/integration/webhooks-n8n.real-db.test.ts`
