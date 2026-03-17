# AutoApply AI — UTM Naming Convention

Last updated: 2026-03-17 (Europe/Zurich)

## Goal

Keep campaign attribution clean and consistent across social posts, ads, Product Hunt, and partnerships.

## Required UTM fields

Every tracked marketing URL must include:

- `utm_source`
- `utm_medium`
- `utm_campaign`

Optional but recommended:

- `utm_content` (creative variant)
- `utm_term` (keyword/ad group)

## Allowed values

### `utm_source`

- `linkedin`
- `x`
- `google`
- `producthunt`
- `newsletter`
- `partner`

### `utm_medium`

- `organic_social`
- `paid_social`
- `cpc`
- `email`
- `referral`

### `utm_campaign`

Use format: `<market>_<funnel>_<theme>_<yyyymm>`

Examples:

- `fr_acq_cv-tailoring_202603`
- `en_acq_onboarding-speed_202603`
- `global_ret_beta-feedback_202603`

### `utm_content`

Use format: `<channel>-<format>-<variant>`

Examples:

- `linkedin-carousel-a`
- `x-thread-b`
- `google-rsa-v1`

## Examples

### LinkedIn organic post

```text
https://autoapply.works/fr?utm_source=linkedin&utm_medium=organic_social&utm_campaign=fr_acq_cv-tailoring_202603&utm_content=linkedin-post-a
```

### X paid campaign

```text
https://autoapply.works/en?utm_source=x&utm_medium=paid_social&utm_campaign=en_acq_onboarding-speed_202603&utm_content=x-video-a
```

### Google Ads

```text
https://autoapply.works/en?utm_source=google&utm_medium=cpc&utm_campaign=en_acq_subscription_202603&utm_term=ai+resume+tailor&utm_content=google-rsa-v1
```

### Product Hunt launch

```text
https://autoapply.works/en?utm_source=producthunt&utm_medium=referral&utm_campaign=global_acq_launch_202603&utm_content=ph-launch-day
```

## Enforcement checklist

Before publishing any campaign link:

1. Confirm all required UTM params are present.
2. Use only allowed `utm_source`/`utm_medium` values.
3. Keep campaign naming format consistent.
4. Store final URL in launch notes or campaign tracker.
