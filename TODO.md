# AutoApply AI — Production TODO

Last updated: 2026-03-19 (Europe/Zurich)

## P0 — Incident: 4h automation pipeline outage (job discovery + tailoring)

- [x] Add production diagnostics command with stage-level run visibility and per-profile health summary — completed on 2026-03-19 (`apps/web/scripts/automation_pipeline_diagnostics.js`, `npm run incident:pipeline:diagnostics`)
- [x] Patch job-discovery workflow normalization + callback/error run correlation (`runId`) and hard-fail on callback write errors — completed on 2026-03-19 (`apps/web/scripts/incident_patch_job_discovery_workflow.js`, `n8n/workflows/job-discovery-pipeline.json`, live workflow id `eddfsS251UHbmNIj`)
- [x] Add safe per-profile recovery rerun command (`dry-run` default, optional `real-run`) — completed on 2026-03-19 (`apps/web/scripts/automation_pipeline_recovery_run.js`, `npm run incident:pipeline:recovery -- --help`)
- [x] Harden scoring/tailoring response parsing with fallback-safe handling to prevent silent document drops — completed on 2026-03-19 (`apps/web/scripts/incident_patch_job_discovery_workflow.js`, `n8n/workflows/job-discovery-pipeline.json`, live workflow updated at `2026-03-19T00:57:29.606Z`)
- [x] Verify one affected real profile completes full recovery run with persisted jobs + tailored docs — completed on 2026-03-19 (`npm run incident:pipeline:recovery -- --email matthieu.kokabi@gmail.com --max-jobs 2 --real-run`, `deltaApplications=2`, `payloadTailoredCount=1`)
- [x] Add structured stage-level webhook logging with `runId` correlation across pipeline callbacks and error paths — completed on 2026-03-19 (`apps/web/app/api/webhooks/n8n/route.ts`, covered by `apps/web/__tests__/api/webhooks-n8n.test.ts`)
- [x] Add executable alert check mode for pipeline diagnostics (fails on warning/critical thresholds for scheduler misses, repeated zero-jobs, generation failures, and end-to-end failures) — completed on 2026-03-19 (`apps/web/scripts/automation_pipeline_diagnostics.js --fail-on-alert`, `npm run incident:pipeline:alerts`)
- [x] Add incident regression tests for scheduler cadence/alerts and recovery connector-dedupe-generation payload mapping (with import-safe script exports) — completed on 2026-03-19 (`apps/web/__tests__/automation-pipeline-diagnostics.test.ts`, `apps/web/__tests__/automation-pipeline-recovery.test.ts`, script helper exports)
- [x] Publish incident runbook section for 4h automation triage/recovery (`docs/automation-4h-incident-response-runbook.md`) including diagnostics, alert checks, and safe rerun workflow — completed on 2026-03-19
- [x] Patch n8n incident workflow publisher to write a new live version (`workflow_history` + `workflow_entity.versionId/activeVersionId` + `workflow_published_version`) so runtime references corrected schedule and hardened nodes — completed on 2026-03-19 (`apps/web/scripts/incident_patch_job_discovery_workflow.js`, `n8n/workflows/job-discovery-pipeline.json`)
- [x] Add in-workflow cadence gate at user-fetch stage (process jobs only on 4h slots) to mitigate minute-trigger overfiring until runtime reload — completed on 2026-03-19 (`Fetch Active Users with Prefs & CV` SQL patched via `apps/web/scripts/incident_patch_job_discovery_workflow.js`)
- [x] Publish full incident closure report with root causes, stage mapping, commit history, validation evidence, and rollback notes — completed on 2026-03-19 (`INCIDENT_AUTOAPPLY_PIPELINE_FIX_REPORT.md`)
- [x] Remove n8n DB-credential decrypt dependency from profile fetch stage by routing through signed app webhook (`fetch_active_users`) with 4h cadence gating + structured logs — completed on 2026-03-19 (`apps/web/app/api/webhooks/n8n/route.ts`, `apps/web/scripts/incident_patch_job_discovery_workflow.js`, `n8n/workflows/job-discovery-pipeline.json`, `apps/web/__tests__/api/webhooks-n8n.test.ts`)
- [x] Restart n8n Render service once to flush stale in-memory trigger registrations — completed on 2026-03-19 (Render deploy `9d2b7bd`, startup confirms `1 published workflow` and active pipeline load)
- [ ] Verify first post-restart scheduled execution uses live workflow version (`f388a6db-5bf6-44fb-bfd4-33a3b5aa448c`) and no longer emits decrypt errors at fetch stage
- [x] Improve discovery relevance for Zürich/hybrid preferences by expanding title/location query candidates, adding preference-aware location filtering fallback, and exposing explicit LinkedIn auto-source status in recovery diagnostics — completed on 2026-03-19 (`apps/web/scripts/automation_pipeline_recovery_run.js`, `apps/web/scripts/incident_patch_job_discovery_workflow.js`, `n8n/workflows/job-discovery-pipeline.json`)

## P0 — Incident: contact endpoint + canonical social identity + mail routing

- [x] Restore `/api/contact` production-safe behavior when mail transport is misconfigured by queueing submissions for manual follow-up, returning actionable user-safe fallback messaging, and exposing structured reason codes/logs without secret leakage — completed on 2026-03-19 (`apps/web/app/api/contact/route.ts`, `apps/web/lib/contact-mail-health.ts`, `apps/web/__tests__/api/contact.test.ts`)
- [x] Add contact mail health snapshot (env-name preflight + recent send/queue/fail status) to diagnostics and runtime health snapshot — completed on 2026-03-19 (`apps/web/app/api/contact/diagnostics/route.ts`, `apps/web/app/api/runtime/health-snapshot/route.ts`, `apps/web/__tests__/api/contact-diagnostics.test.ts`, `apps/web/__tests__/api/runtime-health-snapshot.test.ts`)
- [x] Add Hostinger SMTP transport support for `/api/contact` (while keeping Resend compatibility + queued fallback path) and extend coverage for SMTP send path — completed on 2026-03-19 (`apps/web/app/api/contact/route.ts`, `apps/web/lib/contact-mail-health.ts`, `apps/web/__tests__/api/contact.test.ts`, `apps/web/__tests__/setup.ts`, `apps/web/package.json`)
- [x] Replace legacy social links with canonical identities everywhere (UI + SEO/structured data + docs constants) and add regression assertions — completed on 2026-03-19 (`apps/web/lib/brand-identity.ts`, `apps/web/app/[locale]/page.tsx`, `apps/web/app/[locale]/(dashboard)/layout.tsx`, `apps/web/lib/structured-data.ts`, `apps/web/__tests__/social-links-canonical.test.ts`, `apps/web/__tests__/structured-data-trust-pages.test.ts`, `docs/launch-checklist.md`, `docs/social-media-kit.md`)
- [x] Run production contact/mail smoke and publish incident closure report (`INCIDENT_AUTOAPPLY_CONTACT_SOCIAL_MAIL_FIX_2026-03-19.md`) — completed on 2026-03-19 (Vercel prod deploy alias updated to `https://autoapply.works`, initial mitigation smoke artifact `docs/reports/contact-incident-prod-smoke-2026-03-19.json`, response `202 CONTACT_MAIL_QUEUED_NO_TRANSPORT`, no `misconfigured` string)
- [x] Validate Hostinger SMTP live send path in production (non-queued) after env setup and deploy — completed on 2026-03-19 (`feat(contact): support hostinger smtp transport for contact form`, deploy `https://vercel.com/matts-projects-d33e5f04/auto-apply-ai/6YWZkwkvVdqwBZej3k3sUD6bzaJq`, smoke artifact `docs/reports/contact-incident-prod-smtp-smoke-2026-03-19.json`, response `HTTP 200 {"success":true}`)

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
- [x] Fix broken public LinkedIn URL(s) — completed on 2026-03-17 (normalized to canonical `https://www.linkedin.com/company/autoapply-works/` in landing and dashboard)
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
- [x] Deploy + verify canonical and `og:url` parity on all indexable pages — completed on 2026-03-18 (production parity sweep across `en|fr|de|es|it` marketing routes; artifact: `docs/reports/wave3-canonical-og-parity-prod-2026-03-18.txt`)
- [x] Confirm `/` versus `/coming-soon` metadata remains distinct in production — completed on 2026-03-18 (titles, descriptions, and robots tags validated live; artifact: `docs/reports/wave3-landing-vs-coming-soon-prod-2026-03-18.txt`)
- [x] Add redirect regression CI assertions (max redirect hops + expected final URL) — completed on 2026-03-18 (`__tests__/redirect-regression.test.ts`)
- [x] Add CAPTCHA telemetry (`solve`/`fail`/`error`) and abuse diagnostics dashboard hooks — completed on 2026-03-18 (`lib/contact-telemetry.ts`, `/api/contact/diagnostics`, telemetry assertions in contact API tests)
- [x] Advance CSP phase 2 toward nonce/hash strictness where feasible — completed on 2026-03-18 (hash-based allowances for GTM/GA inline bootstraps in both enforced + report-only CSP, with `__tests__/csp-analytics-hashes.test.ts`)
- [x] Production hotfix: remove hash tokens from enforced CSP `script-src` to restore page rendering (keep hashes only in report-only CSP) — completed on 2026-03-18 (`next.config.js`, `__tests__/csp-analytics-hashes.test.ts`)
- [x] Add Organization + ContactPoint structured data on trust pages — completed on 2026-03-18 (`lib/structured-data.ts` + JSON-LD on `/contact`, `/privacy`, `/terms`, covered by `__tests__/structured-data-trust-pages.test.ts`)
- [x] Run production Lighthouse + a11y benchmark and track deltas — completed on 2026-03-18 (artifacts: `docs/reports/wave3-lighthouse-prod-2026-03-18-run1.json`, `docs/reports/wave3-lighthouse-prod-2026-03-18-run2.json`)
- [x] Publish Wave 3 validation report with evidence — completed on 2026-03-18 (`docs/wave3-validation-report-2026-03-18.md`, plus post-deploy squirrel audit `docs/reports/wave3-live-squirrel-audit-prod-2026-03-18.json`)

## P1 — Wave 4 performance reliability + observability hardening

- [x] Stabilize Lighthouse reliability run (`NO_LCP` mitigation) with warm-up, retries, deterministic flags, and explicit fail reason — completed on 2026-03-18 (`apps/web/scripts/lighthouse_reliability_check.sh`, npm script `perf:lighthouse:reliability`)
- [x] Add performance budget hard gates (LCP, CLS, JS bytes, image bytes) with CI fail-on-regression and emergency override path — completed on 2026-03-18 (`apps/web/config/performance-budgets.json`, `apps/web/scripts/performance_budget_gate.js`, `.github/workflows/web-ci.yml`, `docs/performance-budget-emergency-override.md`)
- [x] Pin deterministic audited routes (including one high-intent route) and fail when a required route is unavailable — completed on 2026-03-18 (`apps/web/config/performance-audit-routes.json`, `apps/web/scripts/performance_route_audit.sh`, `.github/workflows/web-ci.yml`)
- [x] Expand conversion telemetry funnel (`page_view` → `cta_click` → `form_start` → `captcha_pass|fail` → `submit_result`) with daily artifact + anomaly detection — completed on 2026-03-18 (`lib/contact-telemetry.ts`, `/api/contact/telemetry`, contact client instrumentation, `scripts/conversion_telemetry_daily_report.js`)
- [x] Add protected runtime health snapshot endpoint (latest perf gate, funnel telemetry, parity status), non-indexable + auth-protected — completed on 2026-03-18 (`/api/runtime/health-snapshot`, token header auth + `X-Robots-Tag: noindex`)
- [x] Publish Wave 4 validation report with reliability proof, perf gate outcome, telemetry baseline, and SEO/security non-regression evidence — completed on 2026-03-18 (`docs/wave4-validation-report-2026-03-18.md`)

## P1 — Wave 5 conversion optimization + operational resilience

- [x] Add funnel stage diagnostics with drop-off attribution + route/campaign conversion segmentation, and introduce weekly conversion trend report artifact generator — completed on 2026-03-18 (`lib/contact-telemetry.ts`, `/api/contact`, `/api/contact/telemetry`, `contact-page-client.tsx`, `scripts/conversion_telemetry_weekly_report.js`)
- [x] Add conversion regression sentinel gate for CI/release with explicit audited emergency override path — completed on 2026-03-18 (`scripts/conversion_regression_sentinel.js`, `config/conversion-regression-sentinel.json`, `.github/workflows/web-ci.yml`, `docs/conversion-regression-emergency-override.md`)
- [x] Add mission-control runtime ops summary artifact (perf gate + lighthouse reliability + funnel + parity/squirrel) — completed on 2026-03-18 (`scripts/ops_summary_report.js`, `npm run ops:summary`, `docs/reports/wave5-ops-summary-20260318_200801.json`)
- [x] Harden runtime health snapshot v2 (token rotation guidance, stale-token warning, rate limiting, audit logging) — completed on 2026-03-18 (`/api/runtime/health-snapshot`, `__tests__/api/runtime-health-snapshot.test.ts`, `docs/runtime-health-snapshot-token-rotation.md`)
- [x] Evolve performance budget checks with percentile trends + per-route regression deltas — completed on 2026-03-18 (`scripts/performance_budget_gate.js`, `scripts/performance_trend_report.js`, `__tests__/performance-budget-trend.test.ts`, `docs/reports/wave5-perf-trend-20260318_201625.json`)
- [x] Add low-risk trust/content CRO on high-intent pages with no SEO metadata or CLS regressions — completed on 2026-03-18 (`contact-page-client.tsx`, `campaign/pain-led`, `campaign/proof-led`, `campaign/feature-led`)
- [x] Publish Wave 5 validation report + required `docs/reports/wave5-*` artifacts and final Wave 6 candidate list — completed on 2026-03-18 (`docs/wave5-validation-report-2026-03-18.md`, refreshed `wave5-*` reports)

## P1 — Wave 6 live telemetry + anomaly automation

- [x] Activate live conversion trend pipeline with explicit `sourceMode` (`live` vs `seeded`) markers, freshness checks, and fallback-window failure policy — completed on 2026-03-18 (`scripts/conversion_telemetry_weekly_report.js`, `config/conversion-telemetry-source.json`)
- [x] Add conversion data-integrity pre-checks (required events, route/campaign completeness, freshness window) and compute telemetry quality score — completed on 2026-03-18 (`scripts/conversion_telemetry_weekly_report.js`, `scripts/ops_summary_report.js`, `config/conversion-telemetry-source.json`)
- [x] Harden conversion sentinel v2 (rolling baseline window tuning, anomaly confidence tiers, cooldown/dedupe) — completed on 2026-03-18 (`scripts/conversion_regression_sentinel.js`, `config/conversion-regression-sentinel.json`, `__tests__/conversion-regression-sentinel.test.ts`)
- [x] Add sentinel failure-code runbook mapping for rapid remediation — completed on 2026-03-18 (`scripts/conversion_regression_sentinel.js`, `docs/conversion-sentinel-failure-runbook.md`)
- [x] Extend runtime health snapshot v3 with conversion freshness, source mode, sentinel last status, and data-quality score — completed on 2026-03-18 (`app/api/runtime/health-snapshot/route.ts`, `__tests__/api/runtime-health-snapshot.test.ts`)
- [x] Add perf-vs-conversion correlation report and flag co-occurring perf + conversion regressions — completed on 2026-03-18 (`scripts/perf_conversion_correlation_report.js`, `config/perf-conversion-correlation.json`, `__tests__/perf-conversion-correlation.test.ts`)
- [x] Produce Wave 6 mission-control payload + Wave 6 validation report/artifacts with seeded-to-live transition proof — completed on 2026-03-18 (`docs/reports/wave6-conversion-trend-live-20260318_221719.json`, `docs/reports/wave6-conversion-sentinel-20260318_221732.json`, `docs/reports/wave6-perf-conversion-correlation-20260318_221740.json`, `docs/reports/wave6-ops-summary-20260318_221749.json`, `docs/wave6-validation-report-2026-03-18.md`)

## P1 — Wave 7 telemetry reliability + decision quality

- [x] Add persistent historical store for conversion/sentinel/perf windows with retention+compaction and rolling 7/14/30-day comparisons — completed on 2026-03-18 (`apps/web/scripts/telemetry_history_store.js`, `apps/web/config/telemetry-history-store.json`, `apps/web/__tests__/telemetry-history-store.test.ts`)
- [x] Harden organic baseline calibration (`organic` vs `paid`/`direct`) with min-sample + seasonality-aware guardrails — completed on 2026-03-18 (`scripts/conversion_telemetry_weekly_report.js`, `scripts/conversion_regression_sentinel.js`, `config/conversion-regression-sentinel.json`, `__tests__/conversion-regression-sentinel.test.ts`, `__tests__/conversion-telemetry-weekly-report.test.ts`)
- [x] Add optional alert transport v1 (webhook/email-style sink) with retries + dedupe/cooldown and severity routing — completed on 2026-03-18 (`apps/web/scripts/alert_transport_dispatch.js`, `apps/web/config/alert-transport.json`, `apps/web/__tests__/alert-transport-dispatch.test.ts`)
- [x] Extend mission-control ops summary v2 with organic baseline health, history-store freshness, alert transport delivery status, anomaly confidence-tier trend — completed on 2026-03-18 (`apps/web/scripts/ops_summary_report.js`, `apps/web/__tests__/ops-summary-report.test.ts`)
- [x] Run full Wave 7 validation (`lint`, `test`, `build`) and publish `docs/wave7-validation-report-2026-03-18.md` + `docs/reports/wave7-*` artifacts — completed on 2026-03-18 (`docs/wave7-validation-report-2026-03-18.md`, `docs/reports/wave7-telemetry-history-20260318_224817.json`, `docs/reports/wave7-organic-baseline-20260318_224817.json`, `docs/reports/wave7-alert-transport-20260318_224817.json`, `docs/reports/wave7-ops-summary-v2-20260318_224817.json`)

## P1 — Wave 7.1 prod closeout only

- [x] Validate `CONTACT_DIAGNOSTICS_TOKEN` is active in production runtime and accepts authenticated diagnostics requests — completed on 2026-03-18 (`/api/contact/diagnostics` token-auth checks returned `HTTP 200`)
- [x] Run one production-grade telemetry cycle using live source mode (seeded fallback disabled) and publish Wave 7.1 live artifacts — completed on 2026-03-18 (`docs/reports/wave7_1-telemetry-live-20260318_234850.json`, `docs/reports/wave7_1-ops-summary-live-20260318_234850.json`)
- [x] Re-run local validation gate (`lint`, `test`, `build`) after closeout artifact publication — completed on 2026-03-19 (`apps/web`)
- [x] Publish closeout proof with timestamp + commit SHA + source marker and move phase to observation — completed on 2026-03-19 (`docs/reports/wave7_1-closeout-2026-03-19.md`)
