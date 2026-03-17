# AutoApply AI — Live Payment Verification Log Template

Last updated: 2026-03-17 (Europe/Zurich)

Use this template during the production payment run. Fill one section per test case.

## Case Metadata

- Date/time (timezone):
- Tester:
- Device:
- Browser + version:
- Mode: normal / private
- VPN: on / off
- Locale URL tested (for example `/fr`):
- Plan tested: `pro_monthly` / `pro_yearly` / `unlimited` / `unlimited_yearly`
- Scenario: success / cancel

## Flow Results

- Landing pricing click result: pass / fail
- Sign-up page shown without `Unauthorized`: pass / fail
- Checkout page opened: pass / fail
- Return to AutoApply after checkout/cancel: pass / fail
- Subscription state after return:
- Subscription state after hard refresh:
- Unexpected errors seen (if any):

## Stripe Event Evidence

- `checkout.session.completed` event ID:
- `invoice.payment_succeeded` event ID (if success flow):
- `invoice.payment_failed` event ID (if failed attempt):
- Webhook endpoint response code for each event:
- Webhook retries observed: yes / no

## Idempotency Verification

For each event ID above, check that duplicate delivery does not duplicate business effects.

- Event ID:
  - Initial delivery status:
  - Retry delivery status (if retried):
  - User plan before event:
  - User plan after event:
  - Credit count before event:
  - Credit count after event:
  - Duplicate side effects observed: yes / no

## Final Case Status

- Overall case: pass / fail
- Blocking issue for launch: yes / no
- Notes:
- Screenshot links/paths:
