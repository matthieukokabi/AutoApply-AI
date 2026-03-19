# INCIDENT — AutoApply Contact/Social/Mail Fix (2026-03-19)

## Scope
Production P0 incident for `https://autoapply.works`:
- Contact endpoint returned `Contact endpoint misconfigured`.
- Official contact/social identity needed canonical enforcement.

## Root cause (ranked)
1. Primary: Contact API previously required `RESEND_API_KEY`; when absent in production it returned a hard `503` misconfiguration response.
2. Secondary: Contact routing identity was not aligned with official mailbox (`contact@autoapply.works`) across sender/destination defaults.
3. Secondary: Legacy social links remained in key UI/SEO surfaces.

## Affected stages
- `Contact form submit -> API route (/api/contact)`
- `Mail transport routing + health visibility`
- `Public social identity surfaces (landing/footer/dashboard/structured-data)`

## Fixes applied

### Commit `e3136a3` — incident mitigation + diagnostics
- Added mail routing/health helper and operational reason codes.
- Hardened `/api/contact` to queue fallback submissions instead of dead-end `503` where transport is unavailable.
- Extended diagnostics/runtime snapshot with contact mail health.

Files:
- `apps/web/lib/contact-mail-health.ts`
- `apps/web/app/api/contact/route.ts`
- `apps/web/app/api/contact/diagnostics/route.ts`
- `apps/web/app/api/runtime/health-snapshot/route.ts`
- `apps/web/__tests__/api/contact.test.ts`
- `apps/web/__tests__/api/contact-diagnostics.test.ts`
- `apps/web/__tests__/api/runtime-health-snapshot.test.ts`
- `apps/web/__tests__/setup.ts`

### Commit `fd2fe7b` — canonical social identity lock
- Added canonical identity constants and replaced legacy links in landing/dashboard/structured data.
- Added regression tests to prevent reintroduction.

Files:
- `apps/web/lib/brand-identity.ts`
- `apps/web/app/[locale]/page.tsx`
- `apps/web/app/[locale]/(dashboard)/layout.tsx`
- `apps/web/lib/structured-data.ts`
- `apps/web/__tests__/social-links-canonical.test.ts`
- `apps/web/__tests__/structured-data-trust-pages.test.ts`
- `docs/launch-checklist.md`
- `docs/social-media-kit.md`

### Commit `b687311` — Hostinger SMTP production transport
- Added SMTP transport support for contact emails (Hostinger-compatible) while preserving Resend compatibility and queued fallback path.
- Added SMTP send-path test coverage and mail-config preflight expansion.

Files:
- `apps/web/app/api/contact/route.ts`
- `apps/web/lib/contact-mail-health.ts`
- `apps/web/__tests__/api/contact.test.ts`
- `apps/web/__tests__/api/contact-diagnostics.test.ts`
- `apps/web/__tests__/api/runtime-health-snapshot.test.ts`
- `apps/web/__tests__/setup.ts`
- `apps/web/package.json`
- `apps/web/package-lock.json`
- `TODO.md`

## Required env var names (names only)
Primary SMTP path (active):
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `CONTACT_INBOX_EMAIL`
- `CONTACT_FROM_EMAIL`

Optional fallback/alternate transport:
- `RESEND_API_KEY`

## Validation outputs

### Local checks
Executed in `apps/web`:
- `npm run lint` ✅
- `npm run test` ✅ (`50` test files, `284` tests)
- `npm run build` ✅

### Production deployments
- Mitigation deploy: `https://vercel.com/matts-projects-d33e5f04/auto-apply-ai/8V8xnE4dgG2wzYfeUsNvmhb38sBx`
- SMTP transport deploy: `https://vercel.com/matts-projects-d33e5f04/auto-apply-ai/6YWZkwkvVdqwBZej3k3sUD6bzaJq`
- Current production alias: `https://autoapply.works`

### Production contact smoke evidence
1. Mitigation smoke (no misconfigured dead-end):
- Artifact: `docs/reports/contact-incident-prod-smoke-2026-03-19.json`
- Result: `HTTP 202`
- Response code: `CONTACT_MAIL_QUEUED_NO_TRANSPORT`
- Assertion: `containsMisconfigured=false`

2. SMTP live-send smoke (post SMTP env + deploy):
- Artifact: `docs/reports/contact-incident-prod-smtp-smoke-2026-03-19.json`
- Result: `HTTP 200`
- Response: `{"success":true}`
- Assertions: `isQueuedFallback=false`, `containsMisconfigured=false`

## Before / After behavior

### Before
- `POST /api/contact` => `HTTP 503` with `{"error":"Contact endpoint misconfigured"}`.
- Lead capture blocked.
- Social identity mismatch across UI/SEO.

### After
- `/api/contact` no longer returns misconfigured dead-end.
- Production now validates direct transport path with `HTTP 200` success.
- Canonical social links enforced across key UI and structured data:
  - `https://x.com/AutoApplyWorks`
  - `https://www.linkedin.com/company/autoapply-works/`
- Official contact routing target is active:
  - `contact@autoapply.works`

## Remaining risks / mitigations
- SMTP credentials lifecycle: rotate mailbox password periodically and update `SMTP_PASS` in Vercel.
- Keep queued fallback monitoring enabled in `/api/contact/diagnostics` and `/api/runtime/health-snapshot` to catch future transport regressions quickly.
