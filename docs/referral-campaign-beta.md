# AutoApply AI — Beta Referral Campaign (Code + Tracking)

Last updated: 2026-03-17 (Europe/Zurich)

## Goal

Run a first beta referral loop with trackable sign-up attribution using referral codes in URL query params.

## Referral URL format

```text
https://autoapply.works/en/sign-up?ref=<REF_CODE>&utm_source=referral&utm_medium=referral&utm_campaign=global_acq_beta-referral_202603&utm_content=<REF_CODE>
```

Example:

```text
https://autoapply.works/en/sign-up?ref=BETA_MAD01&utm_source=referral&utm_medium=referral&utm_campaign=global_acq_beta-referral_202603&utm_content=BETA_MAD01
```

## Code format

- Recommended pattern: `BETA_<ALIAS><NN>`
- Allowed characters in tracking flow: `A-Z`, `0-9`, `_`, `-`
- Length: 3-32 chars

## What is tracked in analytics

When `ref` exists on sign-up URL, the frontend now sends:

- `sign_up_started` with `referral_code`
- `sign_up_completed` with `referral_code`

This enables GA4 reporting by referral code without touching checkout logic.

## GA4 report setup

1. Register `referral_code` as an event-scoped custom dimension.
2. Build an exploration filtered on:
   - event name in (`sign_up_started`, `sign_up_completed`)
   - `utm_source = referral`
3. Breakdown by `referral_code` to measure starts vs completions.

## Operational checklist

1. Generate 5-20 beta referral codes.
2. Share each unique URL with one referrer.
3. Review `sign_up_started` and `sign_up_completed` counts per `referral_code` every 48h.
4. Pause codes with low-quality traffic; keep top-converting referrers active.
