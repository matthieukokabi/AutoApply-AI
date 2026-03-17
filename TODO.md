# AutoApply AI — Production TODO

Last updated: 2026-03-17 (Europe/Zurich)

## P0 — Must complete before live payment test

- [x] Run production onboarding gate (`SMOKE_BASE_URL=https://autoapply.works npm run smoke:onboarding:cross-browser` in `apps/web`) — passed on 2026-03-17 (`/tmp/onboarding-cross-browser-smoke-20260317_115606.jsonl`)
- [x] Run production onboarding matrix (`npm run smoke:onboarding -- https://autoapply.works` in `apps/web`) — passed on 2026-03-17 (`/tmp/onboarding-smoke-20260317_120732.jsonl`)
- [x] Run production auth-blocked matrix (`npm run smoke:onboarding:auth-blocked -- https://autoapply.works` in `apps/web`) — passed on 2026-03-17 (`/tmp/onboarding-auth-blocked-smoke-20260317_124151.jsonl`)
- [x] Verify Vercel production env vars are present and live (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_UNLIMITED_MONTHLY`, `STRIPE_PRICE_UNLIMITED_YEARLY`, `STRIPE_PRICE_CREDIT_PACK`) — passed on 2026-03-17 (`vercel env pull` prefix checks)
- [x] Verify checkout from landing pricing cards when signed out (`Free`, `Pro monthly`, `Pro yearly`, `Unlimited`) — passed on 2026-03-17 (ad-hoc Playwright prod check: `free`, `pro_monthly`, `pro_yearly`, `unlimited`, `unlimited_yearly`; no `Unauthorized`, no checkout API calls)
- [ ] Verify checkout from `/settings` subscription upgrade path when signed in (execute with `docs/live-payment-test-runbook.md`)
- [ ] Verify successful return updates dashboard/account subscription state
- [ ] Verify cancel return does not alter plan state
- [ ] Verify webhook delivery and idempotency on latest payment events in Stripe dashboard (log with `docs/live-payment-verification-log-template.md`)
- [ ] Manual family live payment test (real card, production mode) and record outcome with screenshots + Stripe event IDs (use `docs/live-payment-test-runbook.md` + `docs/live-payment-verification-log-template.md`)

## P1 — Onboarding reliability hardening right after live payment pass

- [ ] Add E2E assertion that pricing CTA works before hydration on mobile WebKit
- [ ] Add smoke assertion for localization path parity (`/en`, `/fr`, `/de`, `/es`, `/it`) on sign-up handoff
- [x] Normalize Free-plan CTA locale preservation on non-EN landing pages (`/fr` should keep `/fr/sign-up`) — fixed in source on 2026-03-17 (landing links now use locale-aware `signUpPath`)
- [x] Add production runbook page for payment incident triage (`Unauthorized`, webhook delay, missing envs) — completed on 2026-03-17 (`docs/payment-incident-triage-runbook.md`)
- [x] Add lightweight uptime check for `/api/auth/session`, `/api/checkout`, `/api/webhooks/stripe` — completed on 2026-03-17 (`npm run smoke:uptime:prod`, report: `/tmp/production-uptime-check-20260317_141546.jsonl`)

## P1 — Google tool integration (acquisition + measurement)

- [ ] Verify Google Search Console ownership for `autoapply.works` and `www.autoapply.works`
- [ ] Submit sitemap and re-index priority routes (`/`, `/pricing` section, `/blog`, localized roots)
- [x] Add Google Tag Manager container (keep GA4 config in one place) — completed on 2026-03-17 (env-driven GTM in `layout` + GA fallback when GTM is unset)
- [ ] Standardize GA4 events: `sign_up_started`, `sign_up_completed`, `begin_checkout`, `purchase`, `onboarding_completed`, `cv_uploaded` (in progress: `begin_checkout` + `sign_up_started` + `sign_up_completed` + `onboarding_completed` wired on 2026-03-17)
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
- [ ] Add deploy batching rule: one production deploy after multiple validated atomic fixes
- [ ] Audit API routes for cacheability and short-circuit unauthenticated expensive paths
- [ ] Add monthly cost budget guardrail with alert threshold and owner action playbook
