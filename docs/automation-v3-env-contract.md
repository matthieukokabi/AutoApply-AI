# Automation v3 environment contract

This contract defines the required server/runtime variables for the additive v3 automation layer.

## Required core integration variables

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Base URL used by v3 n8n workflows to call app webhooks (for example `https://autoapply.works`). |
| `N8N_WEBHOOK_SECRET` | Shared secret sent in `x-webhook-secret` for app webhook authentication. |
| `ANTHROPIC_API_KEY` | API key used by v3 scoring/tailoring model calls. |
| `ADZUNA_APP_ID` | Adzuna API app id for discovery connectors. |
| `ADZUNA_APP_KEY` | Adzuna API app key for discovery connectors. |
| `JSEARCH_API_KEY` | JSearch API key for discovery connectors. |
| `JOOBLE_API_KEY` | Jooble API key for discovery connectors. |
| `REED_API_KEY` | Reed API key for discovery connectors. |

## Canary control variables

| Variable | Purpose |
| --- | --- |
| `V3_CANARY_USER_IDS` | CSV allowlist of user IDs forced onto v3 paths (server-side only, no UI flag). |
| `V3_CANARY_SAMPLE_RATE` | Optional sample rate for deterministic canary sampling. Accepts `0..1` (fraction) or `1..100` (percentage). |

## Throughput and retry control variables

| Variable | Purpose |
| --- | --- |
| `V3_JOB_CAP_PER_USER` | Hard cap on normalized/scored jobs per user per discovery run. |
| `V3_TAILOR_CAP_PER_USER` | Hard cap on tailored jobs per user per discovery run. |
| `V3_LLM_PACE_MS` | Minimum pacing delay between sequential tailoring calls. |
| `V3_MAX_RETRIES` | Maximum retry attempts for retriable LLM/API failures. |
| `V3_RETRY_BASE_MS` | Base delay for exponential retry backoff. |
| `V3_RETRY_CAP_MS` | Maximum delay cap for retry backoff. |

## External scheduler variables (Option A)

| Variable | Purpose |
| --- | --- |
| `CRON_SECRET` | Bearer secret for `/api/cron/discovery-v3` and `/api/cron/discovery-v3/health`. |
| `DISCOVERY_MANUAL_TRIGGER_SECRET` | Optional dedicated secret for `/api/cron/discovery-v3/manual` (falls back to `CRON_SECRET`). |
| `N8N_DISCOVERY_V3_WEBHOOK_URL` | Optional explicit n8n webhook URL override for discovery v3 trigger dispatch (defaults to `${N8N_WEBHOOK_URL}/webhook/discovery-pipeline-v3`). |
| `AUTOMATION_ALERT_EMAIL_TO` | Optional CSV recipients for scheduler health alerts (`missed slot`, `stuck run`, `consecutive failures`, `stale locks`). |

## Schedule source of truth

- Single schedule authority: external cron only.
- Discovery slots are fixed Zurich-local windows: `07:20`, `12:20`, `18:20`.
- n8n discovery v3 trigger must run via webhook path `discovery-pipeline-v3` (no internal schedule trigger/jitter path).

## Safety rules

- Never print or commit secret values.
- Validation failures must report only missing env names.
- v3 rollout is additive: keep v2 workflows and UX unchanged unless explicitly switched via canary controls.
- Keep exactly one active scheduler authority for discovery v3 (external cron).

## Emergency rollback controls

- Fast disable: set `V3_CANARY_USER_IDS` to empty and `V3_CANARY_SAMPLE_RATE=0`, then redeploy `apps/web`.
- External scheduler disable: pause cron entries that call `/api/cron/discovery-v3` and `/api/cron/discovery-v3/health` (or rotate `CRON_SECRET`) before changing workflow versions.
- Keep v2 workflows in place; do not delete or mutate legacy/v2 definitions during v3 rollback.
- Before changing any live n8n workflow version bindings, capture a checkpoint with:

```bash
cd apps/web
npm run incident:pipeline:checkpoint -- --workflow-id <workflow_id> --output ../../docs/reports/n8n-workflow-checkpoint-<timestamp>.json
```

- Follow [4h automation incident response](/Users/magikmad/Documents/New project/AutoApply-AI/docs/automation-4h-incident-response-runbook.md) sections 8-12 for DLQ/error triage, idempotency verification, and no-UI-change validation.
