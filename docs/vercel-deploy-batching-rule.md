# AutoApply AI — Vercel Deploy Batching Rule

Last updated: 2026-03-17 (Europe/Zurich)

## Goal

Reduce Vercel build-minute spend by deploying production only in controlled batches.

## Rule

Do not trigger production deploys for every atomic commit.

Create one production deploy only when at least one condition is true:

1. A P0 fix needs immediate live validation.
2. Two or more validated atomic commits are ready as one release batch.
3. A scheduled owner validation window is open (for example live payment/family QA).

## Required pre-deploy gate

Before any `--prod` deploy:

1. Pull latest `main` (`git pull --ff-only origin main`).
2. Run in `apps/web`:
   - `npm run lint`
   - `npm test`
   - `npm run build`
3. Confirm no unresolved P0 blocker was introduced by the batch.
4. If the batch is release-sensitive for Tailor/webhook persistence or factual-guard behavior, run `Webhooks n8n Real-DB Release Gate` and capture the green run URL in the PR/release notes.
5. Record deploy reason + commit range in `SESSION_LOG.md`.

## Production deploy command

From `apps/web`:

```bash
vercel deploy --prod --yes
```

## Post-deploy check

Immediately run:

```bash
npm run smoke:uptime:prod
```

If smoke fails, pause additional deploys until root cause is identified.
