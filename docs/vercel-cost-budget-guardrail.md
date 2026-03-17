# AutoApply AI — Vercel Monthly Cost Budget Guardrail

Last updated: 2026-03-17 (Europe/Zurich)

## Budget target

- Monthly Vercel budget cap: **$60**
- Soft alert threshold: **$40** (67%)
- Hard alert threshold: **$50** (83%)
- Emergency threshold: **$60** (100%)

## Weekly review cadence

Every week (same weekday):

1. Open Vercel dashboard billing/usage view for the current month.
2. Record:
   - month-to-date spend
   - top cost category (build minutes, serverless execution, bandwidth, etc.)
   - 7-day average daily burn
3. Append a short note in `SESSION_LOG.md`.

## Action playbook by threshold

### Soft alert (>= $40)

1. Keep `createDeployments=disabled` and deploy only batched releases.
2. Pause non-critical production redeploys.
3. Re-check middleware/auth short-circuit effectiveness on high-traffic routes.

### Hard alert (>= $50)

1. Freeze all non-P0 production deploys.
2. Run only one approved deploy batch for urgent fixes.
3. Disable/slow heavy non-essential cron or background jobs where possible.

### Emergency (>= $60)

1. Stop production deploys except incident recovery.
2. Trigger incident review in `SESSION_LOG.md` with root-cause category.
3. Apply immediate cost controls before any new feature rollout.

## Owner escalation rules

- If burn rate projects month-end > $60:
  - Owner must approve each production deploy explicitly.
- If two consecutive weeks exceed projected budget:
  - run a dedicated cost-optimization sprint before growth work.

## Reporting format (append to session log)

Use this one-line format:

```text
Vercel weekly usage review — MTD: $X, 7d burn/day: $Y, top driver: <category>, action: <none|soft|hard|emergency>
```
