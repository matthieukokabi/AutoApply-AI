#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://autoapply.works}"
LOCALES="${SMOKE_LOCALES:-en fr de es it}"
VIEWPORTS="${SMOKE_VIEWPORTS:-desktop:1280:800 mobile:390:844}"
PLAYWRIGHT_TIMEOUT_MS="${PLAYWRIGHT_TIMEOUT_MS:-15000}"
REPORT_PATH="${REPORT_PATH:-/tmp/onboarding-smoke-$(date +%Y%m%d_%H%M%S).jsonl}"

find_cached_pwcli_node_bin() {
  find "$HOME/.npm/_npx" -maxdepth 5 -type f -path '*/node_modules/@playwright/cli/playwright-cli.js' 2>/dev/null | head -n 1
}

PWCLI_NODE_BIN="${PWCLI_NODE_BIN:-$(find_cached_pwcli_node_bin)}"
PWCLI_WRAPPER="${PWCLI_WRAPPER:-${CODEX_HOME:-$HOME/.codex}/skills/playwright/scripts/playwright_cli.sh}"

run_pw() {
  local session="$1"
  shift
  if [[ -n "$PWCLI_NODE_BIN" && -f "$PWCLI_NODE_BIN" ]]; then
    node "$PWCLI_NODE_BIN" -s="$session" "$@"
  elif [[ -x "$PWCLI_WRAPPER" ]]; then
    "$PWCLI_WRAPPER" -s="$session" "$@"
  else
    echo "Playwright CLI not found. Install cache with: npx --yes --package @playwright/cli playwright-cli --help" >&2
    return 127
  fi
}

extract_result_json() {
  awk '
    /^### Result$/ { capture=1; next }
    /^### Ran Playwright code$/ { capture=0 }
    capture { print }
  '
}

eval_json() {
  local session="$1"
  local expression="$2"
  local raw
  raw="$(run_pw "$session" eval "$expression")"
  printf "%s" "$raw" | extract_result_json
}

json_bool_true() {
  local json="$1"
  local expr="$2"
  jq -e "$expr" >/dev/null <<<"$json"
}

open_case() {
  local session="$1"
  local url="$2"
  run_pw "$session" open "$url" >/dev/null
}

click_upgrade_cta() {
  local session="$1"
  local click_json
  if ! click_json="$(eval_json "$session" "() => {
    const getText = (el) => (el?.textContent || '').trim();
    // Simulate stale session-cookie scenarios reported on some devices.
    document.cookie = '__session=qa_stale_session_cookie; Path=/; SameSite=Lax';
    window.name = 'qaCheckoutCalls:0';
    if (!(window).__qaCheckoutFetchWrapped) {
      const originalFetch = window.fetch.bind(window);
      let checkoutCalls = 0;
      window.fetch = (...args) => {
        const firstArg = args[0];
        const requestUrl =
          typeof firstArg === 'string'
            ? firstArg
            : (firstArg && typeof firstArg.url === 'string' ? firstArg.url : '');
        if (requestUrl.includes('/api/checkout')) {
          checkoutCalls += 1;
          window.name = 'qaCheckoutCalls:' + checkoutCalls;
        }
        return originalFetch(...args);
      };
      (window).__qaCheckoutFetchWrapped = true;
    }

    const ctas = Array.from(document.querySelectorAll('#pricing a, #pricing button'));
    const target = ctas.find((cta) => {
      const text = getText(cta).toLowerCase();
      return text.includes('pro') && text.includes('29');
    });

    if (!target) {
      return { clicked: false };
    }

    target.click();
    return { clicked: true, label: getText(target) };
  }")"; then
    return 1
  fi

  json_bool_true "$click_json" '.clicked == true'
}

write_report_line() {
  local line="$1"
  printf "%s\n" "$line" >> "$REPORT_PATH"
}

echo "" > "$REPORT_PATH"
passed=0
failed=0

for locale in $LOCALES; do
  for viewport in $VIEWPORTS; do
    name="${viewport%%:*}"
    rest="${viewport#*:}"
    width="${rest%%:*}"
    height="${rest##*:}"
    session="onboarding-${locale}-${name}-$$"
    case_id="${locale}-${name}"
    landing_url="${BASE_URL%/}/${locale}"
    sign_in_url="${BASE_URL%/}/${locale}/sign-in"
    sign_up_intent_url="${BASE_URL%/}/${locale}/sign-up?upgrade=pro_monthly&from=%2F${locale}"

    status="pass"
    reason="ok"

    if ! open_case "$session" "$landing_url"; then
      status="fail"
      reason="open_landing_failed"
    fi

    if [[ "$status" == "pass" ]]; then
      if ! run_pw "$session" resize "$width" "$height" >/dev/null; then
        status="fail"
        reason="resize_failed"
      fi
    fi

    landing_json='{}'
    signup_json='{}'
    signin_json='{}'

    if [[ "$status" == "pass" ]]; then
      if ! landing_json="$(eval_json "$session" "() => ({ url: location.href, hasOverflow: document.documentElement.scrollWidth > window.innerWidth + 1, hasUnauthorizedText: document.body.innerText.toLowerCase().includes('unauthorized'), hasUpgradeCta: Boolean(document.querySelector('#pricing a, #pricing button')) })")"; then
        status="fail"
        reason="landing_eval_failed"
      fi
    fi

    if [[ "$status" == "pass" ]]; then
      if ! click_upgrade_cta "$session"; then
        status="fail"
        reason="click_upgrade_cta_failed"
      fi
    fi

    if [[ "$status" == "pass" ]]; then
      sleep 2
      if ! signup_json="$(eval_json "$session" "() => {
        const marker = String(window.name || '');
        const match = marker.match(/^qaCheckoutCalls:(\\d+)$/);
        const checkoutCallsFromLanding = match ? Number(match[1]) : null;
        const parsed = new URL(location.href);
        return {
          url: location.href,
          path: parsed.pathname,
          upgradeParam: parsed.searchParams.get('upgrade'),
          fromParam: parsed.searchParams.get('from'),
          hasOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          hasUnauthorizedText: document.body.innerText.toLowerCase().includes('unauthorized'),
          hasAuthSurface:
            Boolean(document.querySelector('input[type=email], button[type=submit], .cl-card, [data-clerk-component]')) ||
            document.body.innerText.toLowerCase().includes('loading secure sign-up') ||
            document.body.innerText.toLowerCase().includes('open diagnostics'),
          checkoutCallsFromLanding
        };
      }")"; then
        status="fail"
        reason="signup_eval_failed"
      fi
    fi

    if [[ "$status" == "pass" ]]; then
      if ! run_pw "$session" goto "$sign_in_url" >/dev/null; then
        status="fail"
        reason="goto_signin_failed"
      fi
    fi

    if [[ "$status" == "pass" ]]; then
      if ! signin_json="$(eval_json "$session" "() => ({ url: location.href, hasOverflow: document.documentElement.scrollWidth > window.innerWidth + 1, hasUnauthorizedText: document.body.innerText.toLowerCase().includes('unauthorized'), hasAuthSurface: Boolean(document.querySelector('input[type=email], button[type=submit], .cl-card, [data-clerk-component]')) || document.body.innerText.toLowerCase().includes('loading secure sign-in') || document.body.innerText.toLowerCase().includes('open diagnostics') })")"; then
        status="fail"
        reason="signin_eval_failed"
      fi
    fi

    if [[ "$status" == "pass" ]]; then
      if json_bool_true "$landing_json" '.hasOverflow == true'; then
        status="fail"
        reason="landing_overflow_detected"
      elif json_bool_true "$landing_json" '.hasUnauthorizedText == true'; then
        status="fail"
        reason="landing_unauthorized_text_detected"
      elif json_bool_true "$landing_json" '.hasUpgradeCta == false'; then
        status="fail"
        reason="landing_upgrade_cta_missing"
      elif ! json_bool_true "$signup_json" ".path == \"/${locale}/sign-up\""; then
        status="fail"
        reason="signup_locale_path_mismatch"
      elif ! json_bool_true "$signup_json" '.upgradeParam == "pro_monthly"'; then
        status="fail"
        reason="signup_upgrade_param_mismatch"
      elif ! json_bool_true "$signup_json" ".fromParam == \"/${locale}\""; then
        status="fail"
        reason="signup_from_param_mismatch"
      elif json_bool_true "$signup_json" '.hasOverflow == true'; then
        status="fail"
        reason="signup_overflow_detected"
      elif json_bool_true "$signup_json" '.hasUnauthorizedText == true'; then
        status="fail"
        reason="signup_unauthorized_text_detected"
      elif json_bool_true "$signup_json" '.checkoutCallsFromLanding != 0'; then
        status="fail"
        reason="signup_checkout_call_detected_for_anonymous_user"
      elif json_bool_true "$signup_json" '.hasAuthSurface == false'; then
        status="fail"
        reason="signup_no_auth_surface"
      elif json_bool_true "$signin_json" '.hasOverflow == true'; then
        status="fail"
        reason="signin_overflow_detected"
      elif json_bool_true "$signin_json" '.hasUnauthorizedText == true'; then
        status="fail"
        reason="signin_unauthorized_text_detected"
      elif json_bool_true "$signin_json" '.hasAuthSurface == false'; then
        status="fail"
        reason="signin_no_auth_surface"
      fi
    fi

    if [[ "$status" == "pass" ]]; then
      passed=$((passed + 1))
    else
      failed=$((failed + 1))
    fi

    write_report_line "$(jq -nc \
      --arg caseId "$case_id" \
      --arg locale "$locale" \
      --arg viewport "$name" \
      --arg status "$status" \
      --arg reason "$reason" \
      --argjson landing "$landing_json" \
      --argjson signup "$signup_json" \
      --argjson signin "$signin_json" \
      '{caseId:$caseId, locale:$locale, viewport:$viewport, status:$status, reason:$reason, landing:$landing, signup:$signup, signin:$signin}')"

    run_pw "$session" close >/dev/null 2>&1 || true
  done
done

echo "Onboarding smoke matrix report: $REPORT_PATH"
echo "Passed: $passed"
echo "Failed: $failed"

if [[ "$failed" -gt 0 ]]; then
  exit 1
fi
