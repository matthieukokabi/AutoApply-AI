# AutoApply AI — Payment Incident Triage Runbook (Production)

Last updated: 2026-03-17 (Europe/Zurich)

## Scope

Use this runbook when users report billing/onboarding issues in production, especially:

- `Unauthorized` during sign-up or upgrade
- Checkout success but subscription not updated in app
- Missing/incorrect Stripe webhook processing
- Suspected missing production env vars

## Incident intake checklist

Collect first:

- Timestamp + timezone
- User email (or Clerk user ID)
- Browser/device/VPN/private mode
- URL where failure happened
- Screenshot/video
- Stripe Checkout Session ID or Event ID (if available)

## Fast classification

1. `Unauthorized` appears before reaching Stripe
2. Stripe checkout opened, payment succeeded, but app still shows old plan
3. Stripe webhook shows failures/retries
4. Deployment/config drift suspected

## A) `Unauthorized` before Stripe

### Checks

1. Confirm user was routed to sign-up/sign-in first for anonymous flow.
2. Confirm no direct anonymous `/api/checkout` dependency from landing click.
3. Re-run production smoke gates:
   - `SMOKE_BASE_URL=https://autoapply.works npm run smoke:onboarding:cross-browser`
   - `npm run smoke:onboarding -- https://autoapply.works`
   - `npm run smoke:onboarding:auth-blocked -- https://autoapply.works`
4. Validate locale/auth URL path for affected locale (`/fr/sign-up`, etc.).

### If still failing

- Capture HAR/screenshot and open P0 incident note in `SESSION_LOG.md`.
- Keep deploys batched; do not hot-deploy multiple speculative fixes.

## B) Payment succeeded but plan not updated

### Checks

1. In Stripe dashboard, find `checkout.session.completed` and related invoice/subscription events.
2. Confirm webhook endpoint delivery status is `2xx`.
3. Check if event was delayed/retried and when last successful delivery occurred.
4. Verify app state after:
   - soft refresh
   - hard refresh

### Expected mapping

- Pro plan purchase updates subscription to `pro` and monthly credits
- Unlimited plan purchase updates subscription to `unlimited`
- Credit pack purchase increments credits without plan downgrade

## C) Webhook delay/retry/idempotency concerns

### Checks

1. Confirm `STRIPE_WEBHOOK_SECRET` matches current production endpoint configuration.
2. Confirm Stripe event IDs are unique in processing (idempotency guard active).
3. For retried events, verify no duplicate side effects:
   - no double plan upgrade
   - no double credit increment
4. Log evidence in:
   - `docs/live-payment-verification-log-template.md`

## D) Missing env variable suspicion

### Checks

1. Pull production envs safely:
   - `vercel env pull <tmp-file> --environment=production`
2. Verify required Stripe keys exist and match expected prefix families:
   - `STRIPE_SECRET_KEY` -> `sk_live_`
   - `STRIPE_WEBHOOK_SECRET` -> `whsec_`
   - price IDs -> `price_`
3. Confirm both unlimited keys exist:
   - `STRIPE_PRICE_UNLIMITED_MONTHLY`
   - `STRIPE_PRICE_UNLIMITED_YEARLY`

## Resolution criteria

Incident can be closed when:

- Repro is no longer present in production smoke checks
- Impacted user flow succeeds end-to-end
- Stripe webhook delivery is healthy (`2xx`) for current events
- No idempotency side effects are observed
- Evidence is logged in `SESSION_LOG.md` and verification template

## Post-incident follow-up

- Add a regression check (test/script/doc) for the exact failure mode.
- Update `TODO.md` if preventive work is still pending.
- Only schedule production deploy when bundled with other validated atomic fixes.
