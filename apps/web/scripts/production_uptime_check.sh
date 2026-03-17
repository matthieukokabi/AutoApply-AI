#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://autoapply.works}"
REPORT_PATH="${REPORT_PATH:-/tmp/production-uptime-check-$(date +%Y%m%d_%H%M%S).jsonl}"
EXPECT_AUTH_SESSION_CODES="${EXPECT_AUTH_SESSION_CODES:-200,401,404}"
EXPECT_AUTH_DIAGNOSTICS_CODES="${EXPECT_AUTH_DIAGNOSTICS_CODES:-200}"
EXPECT_CHECKOUT_CODES="${EXPECT_CHECKOUT_CODES:-401}"
EXPECT_WEBHOOK_CODES="${EXPECT_WEBHOOK_CODES:-400}"

passed=0
failed=0

status_in_list() {
  local status="$1"
  local csv="$2"
  IFS=',' read -r -a codes <<< "$csv"
  for code in "${codes[@]}"; do
    if [[ "$status" == "$code" ]]; then
      return 0
    fi
  done
  return 1
}

write_report_line() {
  local line="$1"
  printf "%s\n" "$line" >> "$REPORT_PATH"
}

run_check() {
  local id="$1"
  local method="$2"
  local url="$3"
  local expected_codes="$4"
  local request_body="${5:-}"

  local body_file
  local header_file
  body_file="$(mktemp /tmp/uptime-body.XXXXXX)"
  header_file="$(mktemp /tmp/uptime-headers.XXXXXX)"

  local curl_out
  if [[ "$method" == "GET" ]]; then
    curl_out="$(curl -sS -o "$body_file" -D "$header_file" -w "%{http_code} %{time_total}" "$url")"
  else
    curl_out="$(curl -sS -o "$body_file" -D "$header_file" -w "%{http_code} %{time_total}" -X "$method" -H 'Content-Type: application/json' --data "$request_body" "$url")"
  fi

  local status
  local duration_seconds
  status="${curl_out%% *}"
  duration_seconds="${curl_out##* }"

  local duration_ms
  duration_ms="$(awk -v s="$duration_seconds" 'BEGIN { printf("%.0f", s * 1000) }')"

  local body_preview
  body_preview="$(tr '\n' ' ' < "$body_file" | sed 's/[[:space:]]\+/ /g' | cut -c1-200)"

  local result="fail"
  local reason="unexpected_status"

  if status_in_list "$status" "$expected_codes"; then
    result="pass"
    reason="ok"
  elif [[ "$status" =~ ^5[0-9][0-9]$ ]]; then
    reason="server_error"
  fi

  if [[ "$result" == "pass" ]]; then
    passed=$((passed + 1))
  else
    failed=$((failed + 1))
  fi

  write_report_line "$(jq -nc \
    --arg id "$id" \
    --arg method "$method" \
    --arg url "$url" \
    --arg expectedCodes "$expected_codes" \
    --arg status "$status" \
    --arg result "$result" \
    --arg reason "$reason" \
    --arg bodyPreview "$body_preview" \
    --argjson durationMs "$duration_ms" \
    '{id:$id, method:$method, url:$url, expectedCodes:$expectedCodes, status:$status, result:$result, reason:$reason, durationMs:$durationMs, bodyPreview:$bodyPreview}')"

  rm -f "$body_file" "$header_file"
}

printf "" > "$REPORT_PATH"

run_check "auth_session_route" "GET" "${BASE_URL%/}/api/auth/session" "$EXPECT_AUTH_SESSION_CODES"
run_check "auth_diagnostics" "GET" "${BASE_URL%/}/api/auth/diagnostics" "$EXPECT_AUTH_DIAGNOSTICS_CODES"
run_check "checkout_unauth_guard" "POST" "${BASE_URL%/}/api/checkout" "$EXPECT_CHECKOUT_CODES" '{"plan":"pro_monthly"}'
run_check "stripe_webhook_signature_guard" "POST" "${BASE_URL%/}/api/webhooks/stripe" "$EXPECT_WEBHOOK_CODES" '{}'

echo "Production uptime check report: $REPORT_PATH"
echo "Passed: $passed"
echo "Failed: $failed"

if [[ "$failed" -gt 0 ]]; then
  exit 1
fi
