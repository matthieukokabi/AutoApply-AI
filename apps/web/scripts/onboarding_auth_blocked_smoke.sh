#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://autoapply.works}"
LOCALES="${SMOKE_LOCALES:-fr en}"
VIEWPORTS="${SMOKE_VIEWPORTS:-desktop:1280:800 mobile:390:844}"
AUTH_BLOCK_WAIT_SECONDS="${AUTH_BLOCK_WAIT_SECONDS:-10}"
REPORT_PATH="${REPORT_PATH:-/tmp/onboarding-auth-blocked-smoke-$(date +%Y%m%d_%H%M%S).jsonl}"

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
    session="onboarding-auth-blocked-${locale}-${name}-$$"
    case_id="${locale}-${name}"

    if [[ "$locale" == "en" ]]; then
      sign_up_url="${BASE_URL%/}/sign-up?upgrade=pro_monthly&from=%2Fen"
    else
      sign_up_url="${BASE_URL%/}/${locale}/sign-up?upgrade=pro_monthly&from=%2F${locale}"
    fi

    status="pass"
    reason="ok"
    signup_json='{}'

    if [[ "$status" == "pass" ]]; then
      if ! run_pw "$session" open >/dev/null; then
        status="fail"
        reason="open_browser_failed"
      fi
    fi

    if [[ "$status" == "pass" ]]; then
      if ! run_pw "$session" resize "$width" "$height" >/dev/null; then
        status="fail"
        reason="resize_failed"
      fi
    fi

    if [[ "$status" == "pass" ]]; then
      if ! run_pw "$session" route "**://clerk.autoapply.works/**" --status 503 --body '{"error":"blocked"}' --content-type "application/json" >/dev/null; then
        status="fail"
        reason="route_block_failed"
      fi
    fi

    if [[ "$status" == "pass" ]]; then
      if ! run_pw "$session" goto "$sign_up_url" >/dev/null; then
        status="fail"
        reason="goto_signup_failed"
      fi
    fi

    if [[ "$status" == "pass" ]]; then
      sleep "$AUTH_BLOCK_WAIT_SECONDS"
      if ! signup_json="$(eval_json "$session" "() => {
        const text = (document.body?.innerText || '').toLowerCase();
        return {
          url: location.href,
          hasOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          hasUnauthorizedText: text.includes('unauthorized'),
          hasRecoveryCard:
            text.includes('auth_init_blocked') ||
            text.includes('secure sign-up is currently blocked'),
          hasDiagnosticsAction:
            text.includes('run auth diagnostics') ||
            text.includes('open diagnostics')
        };
      }")"; then
        status="fail"
        reason="signup_eval_failed"
      fi
    fi

    if [[ "$status" == "pass" ]]; then
      if ! json_bool_true "$signup_json" '.url | test("/sign-up")'; then
        status="fail"
        reason="signup_route_missing"
      elif json_bool_true "$signup_json" '.hasOverflow == true'; then
        status="fail"
        reason="signup_overflow_detected"
      elif json_bool_true "$signup_json" '.hasUnauthorizedText == true'; then
        status="fail"
        reason="signup_unauthorized_text_detected"
      elif json_bool_true "$signup_json" '.hasRecoveryCard == false'; then
        status="fail"
        reason="signup_recovery_card_missing_when_auth_blocked"
      elif json_bool_true "$signup_json" '.hasDiagnosticsAction == false'; then
        status="fail"
        reason="signup_diagnostics_action_missing_when_auth_blocked"
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
      --argjson signup "$signup_json" \
      '{caseId:$caseId, locale:$locale, viewport:$viewport, status:$status, reason:$reason, signup:$signup}')"

    run_pw "$session" close >/dev/null 2>&1 || true
  done
done

echo "Onboarding auth-blocked smoke report: $REPORT_PATH"
echo "Passed: $passed"
echo "Failed: $failed"

if [[ "$failed" -gt 0 ]]; then
  exit 1
fi
