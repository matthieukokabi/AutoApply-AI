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
- [ ] Submit sitemap and re-index priority routes (`/`, `/pricing` section, `/blog`, localized roots)
- [x] Add Google Tag Manager container (keep GA4 config in one place) — completed on 2026-03-17 (env-driven GTM in `layout` + GA fallback when GTM is unset)
- [x] Standardize GA4 events: `sign_up_started`, `sign_up_completed`, `begin_checkout`, `purchase`, `onboarding_completed`, `cv_uploaded` — completed on 2026-03-17 (`cv_uploaded` added in onboarding/profile upload flows; purchase and checkout-return metadata wired)
- [ ] Mark primary GA4 conversions and link GA4 to Google Ads
- [ ] Configure Google Ads conversion actions for subscriptions (`Pro`, `Unlimited`) and one-time credit pack
- [ ] Create UTM naming convention doc and enforce campaign tags in all social/ad links
- [ ] Add consent-aware event gating for analytics/ads tags (EU-friendly behavior)

## P1 — Social + ads campaign rollout (creative + execution)

- [ ] Complete unfinished launch checklist items in `docs/launch-checklist.md` (Product Hunt, dashboard social links, GitHub public landing repo)
- [ ] Prepare 14-day launch calendar with 1 daily LinkedIn post + 2 daily X posts
- [ ] Prepare 3 creative angles for paid ads:
- [ ] Angle A: "Save 30+ minutes per application"
- [ ] Angle B: "ATS keyword optimization with zero fabrication"
- [ ] Angle C: "Compatibility score to focus only on high-fit jobs"
- [ ] Build 3 landing variants for campaign testing (pain-led, proof-led, feature-led)
- [ ] Create Product Hunt launch-day checklist owner schedule (hour-by-hour community replies)
- [ ] Add referral code campaign for first beta users and track redemption

## P1 — Vercel cost optimization (keep monthly burn controlled)

- [ ] Weekly Vercel usage review (`vercel usage`) and append summary in `SESSION_LOG.md`
- [x] Verify no unintended auto-deploy/reactivation settings were re-enabled — completed on 2026-03-17 (confirmed: `gitProviderOptions.createDeployments=disabled`, `commandForIgnoringBuildStep` active, `enableAffectedProjectsDeployments=true`, `buildMachineType=standard`)
- [x] Add deploy batching rule: one production deploy after multiple validated atomic fixes — completed on 2026-03-17 (`docs/vercel-deploy-batching-rule.md`)
- [x] Audit API routes for cacheability and short-circuit unauthenticated expensive paths — completed on 2026-03-17 (`getAuthUser` now exits early when neither auth cookie nor bearer token exists, reducing unnecessary Clerk/DB work on anonymous API traffic)
- [x] Add monthly cost budget guardrail with alert threshold and owner action playbook — completed on 2026-03-17 (`docs/vercel-cost-budget-guardrail.md`)
