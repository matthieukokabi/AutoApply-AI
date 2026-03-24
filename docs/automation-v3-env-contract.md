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

## Safety rules

- Never print or commit secret values.
- Validation failures must report only missing env names.
- v3 rollout is additive: keep v2 workflows and UX unchanged unless explicitly switched via canary controls.
