# AutoApply AI — Vercel Weekly Usage Review Playbook

Last updated: 2026-03-17 (Europe/Zurich)

## Why this exists

`vercel usage` is not available in Vercel CLI `50.1.6`, so weekly cost tracking uses deployment activity as an operational proxy.

## Weekly command

Run from `apps/web`:

```bash
vercel ls auto-apply-ai
```

## What to record each week

1. Number of `Ready` production deployments in the latest page.
2. Number of `Canceled` production deployments in the latest page.
3. Typical build duration for `Ready` deployments.
4. Whether deployment batching rule was respected.

## Guardrails

- If canceled deployments are above 30% of listed production deployments, reduce deploy retries and batch more fixes before production deploy.
- If ready deployments exceed weekly target, pause non-critical deploys and group low-risk changes.
- Keep one production deploy after several validated atomic steps, unless a production incident requires immediate release.

## Example snapshot (2026-03-17)

- Latest 20 production deployments listed.
- `Ready`: 10
- `Canceled`: 10
- Typical `Ready` build duration: ~41s to 1m
- Action: continue strict deploy batching and avoid retry loops.
