# AutoApply AI — Production TODO

Last updated: 2026-03-17 (Europe/Zurich)

## P0 — Must complete before live payment test

- [x] Run production onboarding gate (`SMOKE_BASE_URL=https://autoapply.works npm run smoke:onboarding:cross-browser` in `apps/web`) — passed on 2026-03-17 (`/tmp/onboarding-cross-browser-smoke-20260317_115606.jsonl`)
- [x] Run production onboarding matrix (`npm run smoke:onboarding -- https://autoapply.works` in `apps/web`) — passed on 2026-03-17 (`/tmp/onboarding-smoke-20260317_120732.jsonl`)
- [x] Run production auth-blocked matrix (`npm run smoke:onboarding:auth-blocked -- https://autoapply.works` in `apps/web`) — passed on 2026-03-17 (`/tmp/onboarding-auth-blocked-smoke-20260317_124151.jsonl`)
- [x] Re-run production onboarding/auth/uptime smoke suite after checkout hardening — passed on 2026-03-17 (`/tmp/onboarding-cross-browser-smoke-20260317_165923.jsonl`, `/tmp/onboarding-smoke-20260317_165552.jsonl`, `/tmp/onboarding-auth-blocked-smoke-20260317_165818.jsonl`, `/tmp/production-uptime-check-20260317_165546.jsonl`)
- [x] Verify Vercel production env vars are present and live (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_UNLIMITED_MONTHLY`, `STRIPE_PRICE_UNLIMITED_YEARLY`, `STRIPE_PRICE_CREDIT_PACK`) — passed on 2026-03-17 (`vercel env pull` prefix checks)
- [x] Verify checkout from landing pricing cards when signed out (`Free`, `Pro monthly`, `Pro yearly`, `Unlimited`) — passed on 2026-03-17 (ad-hoc Playwright prod check: `free`, `pro_monthly`, `pro_yearly`, `unlimited`, `unlimited_yearly`; no `Unauthorized`, no checkout API calls)
- [x] Preserve signed-in checkout return path to locale settings route (safe `returnPath` handling) — completed on 2026-03-17 (`/api/checkout` sanitizes `returnPath`; settings sends `window.location.pathname`; regression tests added)
- [x] Handle checkout return status in settings (`checkout=success|cancelled`) with clear UX message + user refresh attempt — completed on 2026-03-17 (`settings/page.tsx`)
- [x] Add short polling window after checkout success return to improve subscription/credits sync visibility — completed on 2026-03-17 (`settings/page.tsx`, 5-attempt sync loop)
- [ ] Verify checkout from `/settings` subscription upgrade path when signed in (execute with `docs/live-payment-test-runbook.md`)
- [ ] Verify successful return updates dashboard/account subscription state
- [ ] Verify cancel return does not alter plan state
- [ ] Verify webhook delivery and idempotency on latest payment events in Stripe dashboard (log with `docs/live-payment-verification-log-template.md`)
- [ ] Manual family live payment test (real card, production mode) and record outcome with screenshots + Stripe event IDs (use `docs/live-payment-test-runbook.md` + `docs/live-payment-verification-log-template.md`)

## P1 — Onboarding reliability hardening right after live payment pass

- [x] Add E2E assertion that pricing CTA works before hydration on mobile WebKit — completed on 2026-03-17 (`mobile webkit pro CTA works before hydration` in `e2e/onboarding.cross-browser.smoke.spec.ts`, validated locally with JS disabled)
- [x] Add smoke assertion for localization path parity (`/en`, `/fr`, `/de`, `/es`, `/it`) on sign-up handoff — completed on 2026-03-17 (`scripts/onboarding_smoke_matrix.sh`, report: `/tmp/onboarding-smoke-20260317_163628.jsonl`)
- [x] Normalize Free-plan CTA locale preservation on non-EN landing pages (`/fr` should keep `/fr/sign-up`) — fixed in source on 2026-03-17 (landing links now use locale-aware `signUpPath`)
- [x] Add production runbook page for payment incident triage (`Unauthorized`, webhook delay, missing envs) — completed on 2026-03-17 (`docs/payment-incident-triage-runbook.md`)
- [x] Add lightweight uptime check for `/api/auth/session`, `/api/checkout`, `/api/webhooks/stripe` — completed on 2026-03-17 (`npm run smoke:uptime:prod`, report: `/tmp/production-uptime-check-20260317_141546.jsonl`)

## P1 — Google tool integration (acquisition + measurement)

- [ ] Verify Google Search Console ownership for `autoapply.works` and `www.autoapply.works`
- [x] Add HTML verification tag support for GSC via `GOOGLE_SITE_VERIFICATION` env in `<head>` — completed on 2026-03-17 (`app/layout.tsx`)
- [ ] Submit sitemap and re-index priority routes (`/`, `/pricing` section, `/blog`, localized roots)
- [x] Add Google Tag Manager container (keep GA4 config in one place) — completed on 2026-03-17 (env-driven GTM in `layout` + GA fallback when GTM is unset)
- [x] Standardize GA4 events: `sign_up_started`, `sign_up_completed`, `begin_checkout`, `purchase`, `onboarding_completed`, `cv_uploaded` — completed on 2026-03-17 (`cv_uploaded` added in onboarding/profile upload flows; purchase and checkout-return metadata wired)
- [ ] Mark primary GA4 conversions and link GA4 to Google Ads
- [ ] Configure Google Ads conversion actions for subscriptions (`Pro`, `Unlimited`) and one-time credit pack
- [x] Create UTM naming convention doc and enforce campaign tags in all social/ad links — completed on 2026-03-17 (`docs/utm-naming-convention.md`, `docs/social-media-kit.md`, `docs/paid-ads-creative-angles.md`)
- [x] Add consent-aware event gating for analytics/ads tags (EU-friendly behavior) — completed on 2026-03-17 (`analytics-consent-gate` + cookie-consent event wiring + privacy copy update)

## P1 — Social + ads campaign rollout (creative + execution)

- [ ] Complete unfinished launch checklist items in `docs/launch-checklist.md` (in progress: dashboard social links + GitHub public landing repo done on 2026-03-17; Product Hunt listing flow still pending)
- [x] Prepare 14-day launch calendar with 1 daily LinkedIn post + 2 daily X posts — completed on 2026-03-17 (`docs/launch-calendar-14-day.md`)
- [x] Prepare 3 creative angles for paid ads — completed on 2026-03-17 (`docs/paid-ads-creative-angles.md`)
- [x] Angle A: "Save 30+ minutes per application"
- [x] Angle B: "ATS keyword optimization with zero fabrication"
- [x] Angle C: "Compatibility score to focus only on high-fit jobs"
- [x] Build 3 landing variants for campaign testing (completed on 2026-03-17: `/[locale]/campaign/pain-led`, `/[locale]/campaign/proof-led`, `/[locale]/campaign/feature-led`)
- [x] Landing variant: pain-led
- [x] Landing variant: proof-led
- [x] Landing variant: feature-led
- [x] Create Product Hunt launch-day checklist owner schedule (hour-by-hour community replies) — completed on 2026-03-17 (`docs/producthunt-launch-day-schedule.md`)
- [x] Add referral code campaign for first beta users and track redemption — completed on 2026-03-17 (URL `ref` tracking added to `sign_up_started` + `sign_up_completed`; runbook: `docs/referral-campaign-beta.md`)

## P1 — Vercel cost optimization (keep monthly burn controlled)

- [x] Weekly Vercel usage review and append summary in `SESSION_LOG.md` — completed on 2026-03-17 using `vercel ls auto-apply-ai` activity snapshot fallback (`vercel usage` unavailable in CLI v50.1.6); playbook: `docs/vercel-usage-review-playbook.md`
- [x] Verify no unintended auto-deploy/reactivation settings were re-enabled — completed on 2026-03-17 (confirmed: `gitProviderOptions.createDeployments=disabled`, `commandForIgnoringBuildStep` active, `enableAffectedProjectsDeployments=true`, `buildMachineType=standard`)
- [x] Add deploy batching rule: one production deploy after multiple validated atomic fixes — completed on 2026-03-17 (`docs/vercel-deploy-batching-rule.md`)
- [x] Audit API routes for cacheability and short-circuit unauthenticated expensive paths — completed on 2026-03-17 (`getAuthUser` now exits early when neither auth cookie nor bearer token exists, reducing unnecessary Clerk/DB work on anonymous API traffic)
- [x] Add monthly cost budget guardrail with alert threshold and owner action playbook — completed on 2026-03-17 (`docs/vercel-cost-budget-guardrail.md`)

## P1 — Wave 1 SEO + security hardening

- [x] Fix SEO base URL fallback in `robots.ts` and `sitemap.ts` to `autoapply.works` (remove legacy `autoapply-ai.com` fallback) — completed on 2026-03-17 via `lib/site-url.ts`
- [x] Add canonical + hreflang (`en`, `fr`, `de`, `es`, `it`, `x-default`) on all indexable localized pages — completed on 2026-03-17 (`lib/seo.ts` + localized metadata updates, including `contact` server wrapper)
- [x] Add default `og:image` + page-level social metadata overrides for landing and blog pages — completed on 2026-03-17 (`layout.tsx` defaults + localized landing/blog metadata image overrides)
- [x] Fix broken public LinkedIn URL(s) — completed on 2026-03-17 (normalized to `https://www.linkedin.com/company/autoapply-ai/` in landing and dashboard)
- [x] Add baseline security headers in production config (`CSP`, `X-Content-Type-Options`, clickjacking policy, `Referrer-Policy`) — completed on 2026-03-17 (`next.config.js` `headers()` layer with broad-safe CSP v1)
- [x] Add anti-bot protection on public contact form (without breaking UX) — completed on 2026-03-17 (honeypot + form timing checks in `/api/contact`, client form fields, and test coverage updates)

## P1 — Wave 2 hardening + SEO precision

- [x] Add strict CSP in `Content-Security-Policy-Report-Only` mode while keeping Wave 1 enforced CSP stable — completed on 2026-03-18 (`next.config.js`)
- [x] Add `Permissions-Policy` baseline header — completed on 2026-03-18 (`next.config.js`)
- [x] Add optional COOP/CORP baseline headers (`same-origin-allow-popups`, `same-site`) — completed on 2026-03-18 (`next.config.js`)
- [x] Remove `unsafe-eval` from enforced CSP `script-src` — completed on 2026-03-18 (`next.config.js`)
- [ ] Remove `unsafe-inline` from enforced CSP via nonce/hash rollout (blocking: direct removal breaks Next inline bootstrap scripts; requires nonce/hash architecture)
- [x] Add Turnstile/hCaptcha server verification on contact endpoint (keep honeypot/timing as layer 1) — completed on 2026-03-18 (conditional Turnstile server verification + client token wiring via env keys)
- [x] Add IP + per-session throttling on contact endpoint — completed on 2026-03-18 (`/api/contact` adds session-level limiter in addition to IP limiter)
- [x] Add abuse telemetry counters on contact endpoint — completed on 2026-03-18 (`/api/contact` blocked-reason counters + structured warning logs)
- [x] Add `noindex` metadata for auth and utility pages (`sign-in`, `sign-up`, `auth-diagnostics`, dashboard surface) — completed on 2026-03-18 (`(dashboard)/layout.tsx`, `sign-in/layout.tsx`, `sign-up/layout.tsx`, `auth-diagnostics/layout.tsx`, `onboarding/layout.tsx`)
- [x] Tighten canonical handling for query-param variants — completed on 2026-03-18 (`lib/seo.ts` now strips `?query` and `#hash` before canonical/hreflang generation; covered by `__tests__/seo.test.ts`)
- [x] Re-validate hreflang reciprocity across all localized indexable pages — completed on 2026-03-18 (`__tests__/hreflang-reciprocity.test.ts` + `buildLocaleAlternates` assertions on all indexable localized routes)
- [x] Run Wave 2 validation suite (`lint`, `test`, `build`, live squirrel audit) and document score delta vs Wave 1 — completed on 2026-03-18 (`docs/wave2-validation-report-2026-03-18.md` + local/prod squirrel artifacts)
- [ ] Re-run `npm run smoke:squirrel:prod` after next batched Vercel production deploy and confirm `status: pass`

## P1 — Wave 3 SEO + security + perf hardening

- [x] Add CI guard for canonical + `og:url` parity and `/` vs `/coming-soon` metadata distinction — completed on 2026-03-18 (`lib/seo.ts` `buildCanonicalOgParity`, localized metadata migrations, `__tests__/seo-parity.test.ts`)
- [ ] Deploy + verify canonical and `og:url` parity on all indexable pages
- [ ] Confirm `/` versus `/coming-soon` metadata remains distinct in production
- [x] Add redirect regression CI assertions (max redirect hops + expected final URL) — completed on 2026-03-18 (`__tests__/redirect-regression.test.ts`)
- [ ] Add CAPTCHA telemetry (`solve`/`fail`/`error`) and abuse diagnostics dashboard hooks
- [ ] Advance CSP phase 2 toward nonce/hash strictness where feasible
- [ ] Add Organization + ContactPoint structured data on trust pages
- [ ] Run production Lighthouse + a11y benchmark and track deltas
- [ ] Publish Wave 3 validation report with evidence
