# AutoApply AI — Live Payment Test Runbook (Production)

Last updated: 2026-03-17 (Europe/Zurich)

## Goal

Validate the real production billing onboarding flow end-to-end before wider user onboarding.

## Production URLs

- Landing: https://autoapply.works/fr
- Sign-up: https://autoapply.works/fr/sign-up
- Settings: https://autoapply.works/fr/settings

## Manual test matrix (owner/family)

Run these cases one by one:

1. Desktop Chrome (normal mode, no VPN)
2. Desktop Chrome (private mode, no VPN)
3. Android Chrome (normal mode, no VPN)
4. Android Samsung Internet (normal mode, no VPN)
5. One repeat case with VPN enabled

Use this logging sheet while executing:

- `docs/live-payment-verification-log-template.md`

## Test steps per case

1. Open landing page and go to pricing section.
2. Click `Commencer gratuitement` (Free CTA).
3. Confirm you arrive on sign-up page (no `Unauthorized` popup/message).
4. Create a fresh account.
5. Open `Settings` then `Subscription`.
6. Click upgrade (`Pro monthly` first, then optionally `Pro yearly` on another fresh account).
7. Complete real Stripe payment.
8. Confirm redirect returns to AutoApply successfully.
9. Confirm plan is updated in UI (`Pro` or `Unlimited` depending on tested plan).
10. Refresh page once and confirm plan remains correct.

## Cancel-path check

Do one run where you open Stripe checkout and cancel instead of paying.

Expected:

- Return to app without error.
- Plan stays unchanged.
- No `Unauthorized` message.

## Evidence to capture

For each run, save:

- Browser + device + VPN/private mode state.
- Screenshot of pricing click target.
- Screenshot of Stripe checkout page loaded.
- Screenshot after return to app (`Settings > Subscription`).
- Stripe event IDs in dashboard:
  - `checkout.session.completed`
  - `invoice.payment_succeeded` (for subscription)
- Webhook delivery status (2xx) and retry status if any.
- Idempotency notes for retried events using:
  - `docs/live-payment-verification-log-template.md`

## Pass criteria

- No `Unauthorized` message at any step.
- Checkout opens consistently.
- Successful payment updates subscription correctly.
- Cancel flow does not modify subscription.
- Stripe webhook events are delivered and processed.

## Failure logging template

If any case fails, record:

- Exact timestamp (with timezone)
- Exact URL where failure happened
- Browser/device/version
- Screenshot/video
- Stripe event ID (if checkout reached Stripe)
- Short error summary (for example: `Unauthorized popup after pricing click`)
