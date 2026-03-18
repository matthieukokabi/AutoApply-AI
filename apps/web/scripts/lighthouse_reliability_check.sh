#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-${LIGHTHOUSE_BASE_URL:-https://autoapply.works}}"
TARGET_ROUTE="${2:-${LIGHTHOUSE_ROUTE:-/en}}"
REQUIRED_SUCCESSES="${LIGHTHOUSE_REQUIRED_SUCCESSES:-2}"
MAX_ATTEMPTS_PER_RUN="${LIGHTHOUSE_MAX_ATTEMPTS_PER_RUN:-3}"
WARMUP_REQUESTS="${LIGHTHOUSE_WARMUP_REQUESTS:-1}"
MAX_WAIT_FOR_LOAD_MS="${LIGHTHOUSE_MAX_WAIT_FOR_LOAD_MS:-45000}"
REPORT_PATH="${REPORT_PATH:-../../docs/reports/wave4-lighthouse-reliability-$(date +%Y%m%d_%H%M%S).json}"

if ! [[ "$REQUIRED_SUCCESSES" =~ ^[0-9]+$ ]] || [[ "$REQUIRED_SUCCESSES" -lt 1 ]]; then
  echo "LIGHTHOUSE_REQUIRED_SUCCESSES must be an integer >= 1"
  exit 1
fi

if ! [[ "$MAX_ATTEMPTS_PER_RUN" =~ ^[0-9]+$ ]] || [[ "$MAX_ATTEMPTS_PER_RUN" -lt 1 ]]; then
  echo "LIGHTHOUSE_MAX_ATTEMPTS_PER_RUN must be an integer >= 1"
  exit 1
fi

if ! [[ "$WARMUP_REQUESTS" =~ ^[0-9]+$ ]] || [[ "$WARMUP_REQUESTS" -lt 0 ]]; then
  echo "LIGHTHOUSE_WARMUP_REQUESTS must be an integer >= 0"
  exit 1
fi

TARGET_URL="${BASE_URL%/}/${TARGET_ROUTE#/}"
mkdir -p "$(dirname "$REPORT_PATH")"

attempt_log_file="$(mktemp /tmp/wave4-lighthouse-attempts.XXXXXX)"
cleanup() {
  rm -f "$attempt_log_file"
}
trap cleanup EXIT

CHROME_FLAGS="--headless=new --no-sandbox --disable-dev-shm-usage --disable-gpu --window-size=1920,1080"
LH_ARGS=(
  "--quiet"
  "--output=json"
  "--preset=desktop"
  "--form-factor=desktop"
  "--throttling-method=simulate"
  "--max-wait-for-load=${MAX_WAIT_FOR_LOAD_MS}"
  "--chrome-flags=${CHROME_FLAGS}"
)

flags_json="$(printf '%s\n' "${LH_ARGS[@]}" | jq -R -s -c 'split("\n") | map(select(length > 0))')"
LIGHTHOUSE_BIN="${LIGHTHOUSE_BIN:-./node_modules/.bin/lighthouse}"
if [[ ! -x "$LIGHTHOUSE_BIN" ]]; then
  echo "Lighthouse binary not found at $LIGHTHOUSE_BIN. Run npm install in apps/web."
  exit 1
fi

lighthouse_version="$("$LIGHTHOUSE_BIN" --version 2>/dev/null || echo "unknown")"

run_started_ms="$(node -e 'console.log(Date.now())')"
successful_runs=0
overall_status="pass"
failure_reason=""

for run_index in $(seq 1 "$REQUIRED_SUCCESSES"); do
  run_passed="false"

  for attempt_index in $(seq 1 "$MAX_ATTEMPTS_PER_RUN"); do
    for _ in $(seq 1 "$WARMUP_REQUESTS"); do
      curl -sS -L -o /dev/null "$TARGET_URL" || true
      sleep 1
    done

    tmp_lighthouse_json="$(mktemp /tmp/wave4-lighthouse.XXXXXX)"
    attempt_started_ms="$(node -e 'console.log(Date.now())')"

    attempt_status="pass"
    attempt_reason="ok"
    command_error=""

    if ! "$LIGHTHOUSE_BIN" "$TARGET_URL" "${LH_ARGS[@]}" "--output-path=$tmp_lighthouse_json" >/tmp/wave4-lighthouse.log 2>&1; then
      attempt_status="fail"
      attempt_reason="lighthouse_command_failed"
      command_error="$(tail -n 20 /tmp/wave4-lighthouse.log | tr '\n' ' ' | sed 's/[[:space:]]\+/ /g')"
    fi

    lcp_value="null"
    cls_value="null"
    js_bytes="null"
    image_bytes="null"
    lcp_error_message=""
    lcp_error_stack=""
    performance_score="null"
    accessibility_score="null"
    best_practices_score="null"
    seo_score="null"

    if [[ "$attempt_status" == "pass" && -s "$tmp_lighthouse_json" ]]; then
      lcp_value="$(jq -r '.audits["largest-contentful-paint"].numericValue // "null"' "$tmp_lighthouse_json")"
      cls_value="$(jq -r '.audits["cumulative-layout-shift"].numericValue // "null"' "$tmp_lighthouse_json")"
      js_bytes="$(jq -r '[.audits["resource-summary"].details.items[]? | select(.resourceType == "script") | .transferSize] | add // "null"' "$tmp_lighthouse_json")"
      image_bytes="$(jq -r '[.audits["resource-summary"].details.items[]? | select(.resourceType == "image") | .transferSize] | add // "null"' "$tmp_lighthouse_json")"
      lcp_error_message="$(jq -r '.audits["largest-contentful-paint"].errorMessage // ""' "$tmp_lighthouse_json")"
      lcp_error_stack="$(jq -r '.audits["largest-contentful-paint"].errorStack // ""' "$tmp_lighthouse_json")"
      performance_score="$(jq -r '.categories.performance.score // "null"' "$tmp_lighthouse_json")"
      accessibility_score="$(jq -r '.categories.accessibility.score // "null"' "$tmp_lighthouse_json")"
      best_practices_score="$(jq -r '.categories["best-practices"].score // "null"' "$tmp_lighthouse_json")"
      seo_score="$(jq -r '.categories.seo.score // "null"' "$tmp_lighthouse_json")"

      if ! jq -e '.audits["largest-contentful-paint"].numericValue | numbers and . > 0' "$tmp_lighthouse_json" >/dev/null; then
        attempt_status="fail"
        if [[ "$lcp_error_message" == *"NO_LCP"* || "$lcp_error_stack" == *"NO_LCP"* ]]; then
          attempt_reason="missing_lcp_no_lcp"
        else
          attempt_reason="missing_lcp_numeric_value"
        fi
      fi
    elif [[ "$attempt_status" == "pass" ]]; then
      attempt_status="fail"
      attempt_reason="lighthouse_json_missing"
    fi

    attempt_finished_ms="$(node -e 'console.log(Date.now())')"
    duration_ms=$((attempt_finished_ms - attempt_started_ms))

    jq -nc \
      --arg generatedAt "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
      --arg targetUrl "$TARGET_URL" \
      --argjson runIndex "$run_index" \
      --argjson attemptIndex "$attempt_index" \
      --arg status "$attempt_status" \
      --arg reason "$attempt_reason" \
      --arg commandError "$command_error" \
      --argjson durationMs "$duration_ms" \
      --argjson lcpMs "$lcp_value" \
      --argjson cls "$cls_value" \
      --argjson jsBytes "$js_bytes" \
      --argjson imageBytes "$image_bytes" \
      --arg lcpErrorMessage "$lcp_error_message" \
      --arg lcpErrorStack "$lcp_error_stack" \
      --argjson performanceScore "$performance_score" \
      --argjson accessibilityScore "$accessibility_score" \
      --argjson bestPracticesScore "$best_practices_score" \
      --argjson seoScore "$seo_score" \
      '{
        generatedAt: $generatedAt,
        targetUrl: $targetUrl,
        runIndex: $runIndex,
        attemptIndex: $attemptIndex,
        retryIndex: ($attemptIndex - 1),
        status: $status,
        reason: $reason,
        commandError: (if $commandError == "" then null else $commandError end),
        durationMs: $durationMs,
        metrics: {
          lcpMs: $lcpMs,
          cls: $cls,
          jsBytes: $jsBytes,
          imageBytes: $imageBytes,
          performanceScore: $performanceScore,
          accessibilityScore: $accessibilityScore,
          bestPracticesScore: $bestPracticesScore,
          seoScore: $seoScore
        },
        lcpDiagnostics: {
          errorMessage: (if $lcpErrorMessage == "" then null else $lcpErrorMessage end),
          errorStack: (if $lcpErrorStack == "" then null else $lcpErrorStack end)
        }
      }' >> "$attempt_log_file"

    rm -f "$tmp_lighthouse_json"

    if [[ "$attempt_status" == "pass" ]]; then
      run_passed="true"
      successful_runs=$((successful_runs + 1))
      break
    fi
  done

  if [[ "$run_passed" != "true" ]]; then
    overall_status="fail"
    failure_reason="missing_lcp_after_retries"
    break
  fi
done

run_finished_ms="$(node -e 'console.log(Date.now())')"
total_duration_ms=$((run_finished_ms - run_started_ms))
attempt_count="$(wc -l < "$attempt_log_file" | tr -d ' ')"

jq -n \
  --arg generatedAt "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  --arg baseUrl "${BASE_URL%/}" \
  --arg route "$TARGET_ROUTE" \
  --arg targetUrl "$TARGET_URL" \
  --arg status "$overall_status" \
  --arg failureReason "$failure_reason" \
  --arg lighthouseVersion "$lighthouse_version" \
  --argjson requiredSuccesses "$REQUIRED_SUCCESSES" \
  --argjson maxAttemptsPerRun "$MAX_ATTEMPTS_PER_RUN" \
  --argjson warmupRequests "$WARMUP_REQUESTS" \
  --argjson totalDurationMs "$total_duration_ms" \
  --argjson successfulRuns "$successful_runs" \
  --argjson attemptCount "$attempt_count" \
  --argjson flags "$flags_json" \
  --argjson attempts "$(jq -s '.' "$attempt_log_file")" \
  '{
    generatedAt: $generatedAt,
    target: {
      baseUrl: $baseUrl,
      route: $route,
      url: $targetUrl
    },
    config: {
      requiredSuccessfulRuns: $requiredSuccesses,
      maxAttemptsPerRun: $maxAttemptsPerRun,
      warmupRequests: $warmupRequests,
      deterministicFlags: $flags
    },
    runtime: {
      lighthouseVersion: $lighthouseVersion,
      totalDurationMs: $totalDurationMs
    },
    summary: {
      status: $status,
      successfulRuns: $successfulRuns,
      attemptCount: $attemptCount,
      failureReason: (if $failureReason == "" then null else $failureReason end)
    },
    attempts: $attempts
  }' > "$REPORT_PATH"

echo "Wave 4 Lighthouse reliability report: $REPORT_PATH"
jq '.' "$REPORT_PATH"

if [[ "$overall_status" != "pass" ]]; then
  exit 1
fi
