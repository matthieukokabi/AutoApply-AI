# INCIDENT — AutoApply Contact/Social/Mail Fix (2026-03-19)

## Scope
Production P0 incident for `https://autoapply.works`:
- Contact endpoint returned `Contact endpoint misconfigured`.
- Official contact/social identity needed canonical enforcement.

## Root cause (ranked)
1. Primary: Production runtime had no `RESEND_API_KEY`, and contact API path hard-failed with a generic 503 misconfiguration response.
2. Secondary: Contact API routed with legacy email defaults (`support@autoapply.works`, `noreply@autoapply.works`) instead of official canonical routing target `contact@autoapply.works`.
3. Secondary: UI + structured-data still contained legacy social identities (`x.com/autoapplyai`, `linkedin.com/company/autoapply-ai`).

## Affected stages
- `Contact form submit -> API route (/api/contact)`
- `Mail transport routing and operator visibility`
- `Public social identity surfaces (landing footer, dashboard links, trust-page structured data)`

## Fixes applied

### Commit `e3136a3` — contact incident + mail health
- Added mail routing/health helper with canonical identity constants and config preflight:
  - `apps/web/lib/contact-mail-health.ts`
- Hardened contact route to avoid dead-end 503s:
  - `apps/web/app/api/contact/route.ts`
  - On missing transport or send failure, queue submission for manual follow-up and return user-safe actionable fallback.
  - Added structured response codes (`CONTACT_MAIL_QUEUED_NO_TRANSPORT`, `CONTACT_MAIL_QUEUED_SEND_FAILURE`, etc).
- Added diagnostics/runtime mail health visibility:
  - `apps/web/app/api/contact/diagnostics/route.ts`
  - `apps/web/app/api/runtime/health-snapshot/route.ts`
- Updated tests:
  - `apps/web/__tests__/api/contact.test.ts`
  - `apps/web/__tests__/api/contact-diagnostics.test.ts`
  - `apps/web/__tests__/api/runtime-health-snapshot.test.ts`
  - `apps/web/__tests__/setup.ts`

### Commit `fd2fe7b` — canonical social identity lock
- Added canonical brand identity constants:
  - `apps/web/lib/brand-identity.ts`
- Updated key UI social links to canonical URLs:
  - `apps/web/app/[locale]/page.tsx`
  - `apps/web/app/[locale]/(dashboard)/layout.tsx`
- Updated structured data sameAs + contact email:
  - `apps/web/lib/structured-data.ts`
- Added regression tests for social link canonicalization:
  - `apps/web/__tests__/social-links-canonical.test.ts`
  - `apps/web/__tests__/structured-data-trust-pages.test.ts`
- Synced operator docs:
  - `docs/launch-checklist.md`
  - `docs/social-media-kit.md`

## Required env var names (names only)
- `RESEND_API_KEY` (required for direct outbound sending)
- `CONTACT_INBOX_EMAIL` (optional override; defaults to `contact@autoapply.works`)
- `CONTACT_FROM_EMAIL` (optional override; defaults to `AutoApply Works <contact@autoapply.works>`)

## Validation outputs

### Local checks (post-fix)
Executed in `apps/web`:
- `npm run lint` ✅
- `npm run test` ✅ (`50` test files, `283` tests)
- `npm run build` ✅

### Production deployment
- Vercel production deploy completed and aliased:
  - `https://autoapply.works`
  - Deployment inspect URL: `https://vercel.com/matts-projects-d33e5f04/auto-apply-ai/8V8xnE4dgG2wzYfeUsNvmhb38sBx`

### Production smoke (safe payload)
- Artifact: `docs/reports/contact-incident-prod-smoke-2026-03-19.json`
- Endpoint: `POST https://autoapply.works/api/contact`
- Result: `HTTP 202`
- Response code: `CONTACT_MAIL_QUEUED_NO_TRANSPORT`
- Assertion: `containsMisconfigured=false` (legacy misconfigured error removed)

### Mail routing smoke
- Runtime behavior confirms canonical fallback messaging references `contact@autoapply.works`.
- Unit/integration assertions verify canonical routing defaults and diagnostics snapshots.

## Before / After behavior

### Before
- `POST /api/contact` returned `HTTP 503` with `{"error":"Contact endpoint misconfigured"}`.
- User had dead-end error; leads not operator-friendly.
- Legacy social identities persisted across UI/metadata.

### After
- `POST /api/contact` no longer returns misconfigured dead-end.
- On transport missing/failure, endpoint returns `HTTP 202` queued fallback with actionable message to `contact@autoapply.works`.
- Canonical social links enforced in landing, dashboard, and structured data:
  - `https://x.com/AutoApplyWorks`
  - `https://www.linkedin.com/company/autoapply-works/`

## Confirmation: official routing target
Canonical contact routing target is now enforced as:
- `contact@autoapply.works`

## Residual risk / follow-up
- `RESEND_API_KEY` is still absent in current Vercel env list; direct transactional send remains degraded to queued fallback mode until configured.
- Once `RESEND_API_KEY` is present, run one additional production contact smoke to verify direct transport path returns `HTTP 200` with non-queued send.
