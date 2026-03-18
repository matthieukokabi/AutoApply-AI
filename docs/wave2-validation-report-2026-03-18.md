# Wave 2 Validation Report (2026-03-18)

## Scope
- Wave 2 hardening + SEO precision verification for `AutoApply-AI/apps/web`.
- Required checks: `lint`, `test`, `build`, plus live squirrel audit.
- Baseline reference: Wave 1 checklist completed on 2026-03-17.

## Local Validation (Current Code)
- `npm run lint` ✅
- `npm run test` ✅ (`31` files, `236` tests passed)
- `npm run build` ✅
- Local squirrel audit (`bash scripts/live_squirrel_audit.sh http://127.0.0.1:4100 en`) ✅

Local audit artifact:
- `docs/reports/live-squirrel-audit-local-2026-03-18.json`

Key local audit assertions passing:
- Canonical present and query/hash-free (`https://autoapply.works/en`)
- Full hreflang set including `x-default`
- `robots=index,follow` on marketing page
- `robots=noindex,nofollow` on auth page (`/en/sign-in`)
- Security headers present (`CSP`, `CSP-Report-Only`, `Permissions-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `COOP`, `CORP`)

## Live Production Squirrel Audit (No New Deploy Yet)
- Production audit executed against `https://autoapply.works`.
- Result: ❌ `fail` (expected drift because latest commits are not yet deployed to Vercel).

Production audit artifact:
- `docs/reports/live-squirrel-audit-prod-2026-03-18.json`

Observed live gaps:
- Missing security headers (`CSP`, `CSP-Report-Only`, `Permissions-Policy`, `COOP/CORP`, etc.)
- Missing canonical on `/en`
- Missing `x-default` hreflang
- Auth page still `robots=index, follow` (noindex not active live)

## Wave 1 vs Wave 2 Delta
Scoring method: control coverage over combined Wave 1 + Wave 2 checklist controls.
- Total controls tracked: `16`
- Wave 1 baseline coverage: `6/16` (`37.5%`)
- Current local coverage after Wave 2 implementation: `15/16` (`93.75%`)
- Delta vs Wave 1 baseline: `+9 controls` (`+56.25pp`)

Remaining local control pending:
- Remove `unsafe-inline` from enforced CSP using nonce/hash rollout (direct removal currently breaks Next inline bootstrap scripts).

## Deployment/Validation Gate
- Do **not** mark Wave 2 as fully complete in production until:
  1. A batched Vercel production deploy is triggered.
  2. `npm run smoke:squirrel:prod` re-run returns `status: pass`.
