# AutoApply AI — Vercel Deploy Batching Rule

Last updated: 2026-04-19 (Europe/Zurich)

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
COMMIT_SHA="$(git rev-parse HEAD)"
COMMIT_REF="$(git rev-parse --abbrev-ref HEAD)"
DEPLOYED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

vercel deploy --prod --yes \
  --meta commit_sha="${COMMIT_SHA}" \
  --meta commit_ref="${COMMIT_REF}" \
  --meta deployed_at="${DEPLOYED_AT}" \
  --meta deploy_source="manual_cli" \
  --env DEPLOY_PROVENANCE_COMMIT_SHA="${COMMIT_SHA}" \
  --env DEPLOY_PROVENANCE_COMMIT_REF="${COMMIT_REF}" \
  --env DEPLOY_PROVENANCE_DEPLOYED_AT="${DEPLOYED_AT}" \
  --env DEPLOY_PROVENANCE_SOURCE="manual_cli"
```

This ensures each deployment exposes traceable provenance in:
- Vercel deployment metadata (`meta.*`)
- protected runtime snapshot response (`provenance.*`)

## Post-deploy check

Immediately run:

```bash
npm run smoke:uptime:prod
```

If smoke fails, pause additional deploys until root cause is identified.

## Required post-deploy provenance capture

After deploy succeeds, capture and log the live production linkage:

```bash
vercel inspect autoapply.works --json | sed -n '/^{/,$p' | jq '{
  id,
  createdAt,
  url,
  aliases,
  target,
  meta
}'
```

Append to `SESSION_LOG.md`:
- deployed commit SHA
- deployment ID + URL
- alias confirmation (`autoapply.works`)
- deployment timestamp
- runtime snapshot probe result (`/api/runtime/health-snapshot`: 200/401/503 as applicable)
