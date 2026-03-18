# Wave 3 Validation Report (2026-03-18)

## Scope
Wave 3 SEO/security/perf hardening validation for `apps/web` after batched production deployment.

Wave 3 implementation commits in this batch:
- `919dc0a` — canonical/`og:url` parity helper + `/coming-soon` metadata guards
- `88e3320` — redirect regression CI assertions
- `24926d9` — CAPTCHA telemetry + diagnostics endpoint
- `713bf95` — CSP phase 2 hash-based allowances for analytics bootstrap scripts
- `128628b` — Organization + ContactPoint structured data on trust pages

## Deployment
- Production deploy completed via Vercel CLI on 2026-03-18.
- Production URL: `https://autoapply.works`
- Vercel deployment URL: `https://auto-apply-k0fc5k9xs-matts-projects-d33e5f04.vercel.app`

## Local Gate (Post-Wave 3 Code)
- `npm run lint` ✅
- `npm run test` ✅ (`36` files, `248` tests passed)
- `npm run build` ✅

## Production Verification Evidence

### 1) Canonical + `og:url` parity on indexable localized pages
- Status: ✅ PASS
- Coverage: 50 checks (`5 locales x 10 indexable routes`)
- Evidence artifact:
  - `docs/reports/wave3-canonical-og-parity-prod-2026-03-18.txt`

### 2) `/` vs `/coming-soon` metadata distinction
- Status: ✅ PASS
- Verified in production:
  - Landing title: `AutoApply AI — AI-Powered Career Assistant | AutoApply AI`
  - Coming-soon title: `Coming Soon — AutoApply AI`
  - Landing robots: `index, follow`
  - Coming-soon robots: `noindex, nofollow`
- Evidence artifact:
  - `docs/reports/wave3-landing-vs-coming-soon-prod-2026-03-18.txt`

### 3) Live squirrel audit (post-deploy)
- Status: ✅ PASS
- Key confirms:
  - canonical + hreflang complete
  - auth noindex preserved
  - CSP / CSP-Report-Only / Permissions-Policy / COOP / CORP present
- Evidence artifact:
  - `docs/reports/wave3-live-squirrel-audit-prod-2026-03-18.json`

## External Benchmark (Lighthouse + A11y)
Two production Lighthouse runs were executed against `https://autoapply.works/en`.

Artifacts:
- `docs/reports/wave3-lighthouse-prod-2026-03-18-run1.json`
- `docs/reports/wave3-lighthouse-prod-2026-03-18-run2.json`

Run 1 scores:
- Performance: `null` (NO_LCP in headless trace)
- Accessibility: `0.71`
- Best Practices: `0.92`
- SEO: `0.82`

Run 2 scores:
- Performance: `null` (NO_LCP in headless trace)
- Accessibility: `0.71`
- Best Practices: `0.92`
- SEO: `0.82`

Delta (Run 2 - Run 1):
- Accessibility: `0.00`
- Best Practices: `0.00`
- SEO: `0.00`
- Performance: `N/A` (NO_LCP in both runs)

A11y pass execution status:
- Lighthouse accessibility category audit executed successfully in both runs (stable score captured).

## Wave 3 Checklist Status
- Deploy + verify canonical and `og:url` parity: ✅
- Confirm `/` vs `/coming-soon` metadata distinction: ✅
- Redirect regression CI assertions: ✅
- CAPTCHA telemetry + abuse dashboard hooks: ✅
- CSP phase 2 advancement (nonce/hash path): ✅
- Organization + ContactPoint structured data on trust pages: ✅
- Production benchmark + delta capture: ✅

## Residual Follow-up
- Investigate headless Lighthouse `NO_LCP` on landing route to recover performance scoring in CI-style runs.
- If needed, add a second benchmark profile (desktop, no throttling) for stable perf trend tracking.
