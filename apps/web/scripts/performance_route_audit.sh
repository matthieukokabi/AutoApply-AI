#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-${PERF_BASE_URL:-https://autoapply.works}}"
ROUTES_CONFIG_PATH="${ROUTES_CONFIG_PATH:-./config/performance-audit-routes.json}"
REPORT_DIR="${REPORT_DIR:-../../docs/reports}"
RUN_TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
ROUTE_REPORT_PATH="${ROUTE_REPORT_PATH:-${REPORT_DIR}/wave4-performance-routes-${RUN_TIMESTAMP}.json}"

if [[ ! -f "$ROUTES_CONFIG_PATH" ]]; then
  echo "Missing routes config: $ROUTES_CONFIG_PATH"
  exit 1
fi

mkdir -p "$REPORT_DIR"

high_intent_route="$(jq -r '.highIntentRoute // ""' "$ROUTES_CONFIG_PATH")"
if [[ -z "$high_intent_route" ]]; then
  echo "Missing highIntentRoute in $ROUTES_CONFIG_PATH"
  exit 1
fi

required_routes=()
while IFS= read -r route; do
  if [[ -n "$route" ]]; then
    required_routes+=("$route")
  fi
done < <(jq -r '.requiredRoutes[]?' "$ROUTES_CONFIG_PATH")
if [[ "${#required_routes[@]}" -eq 0 ]]; then
  echo "requiredRoutes must contain at least one route in $ROUTES_CONFIG_PATH"
  exit 1
fi

if ! jq -e --arg highIntentRoute "$high_intent_route" '.requiredRoutes | index($highIntentRoute)' "$ROUTES_CONFIG_PATH" >/dev/null; then
  echo "highIntentRoute ($high_intent_route) must also be in requiredRoutes"
  exit 1
fi

route_results_file="$(mktemp /tmp/wave4-route-audit-results.XXXXXX)"
cleanup() {
  rm -f "$route_results_file"
}
trap cleanup EXIT

overall_status="pass"
failure_reason=""

for route in "${required_routes[@]}"; do
  target_url="${BASE_URL%/}/${route#/}"
  http_status="$(curl -sS -L -o /dev/null -w "%{http_code}" "$target_url" || echo "000")"
  route_slug="$(printf '%s' "$route" | sed -E 's#^/##; s#/+#-#g; s/[^A-Za-z0-9_-]/-/g')"
  if [[ -z "$route_slug" ]]; then
    route_slug="root"
  fi

  if [[ ! "$http_status" =~ ^2|^3 ]]; then
    overall_status="fail"
    failure_reason="required_route_unavailable"
    jq -nc \
      --arg route "$route" \
      --arg targetUrl "$target_url" \
      --arg status "fail" \
      --arg reason "required_route_unavailable" \
      --arg httpStatus "$http_status" \
      --arg lighthouseReportPath "" \
      --arg budgetReportPath "" \
      '{
        route: $route,
        targetUrl: $targetUrl,
        status: $status,
        reason: $reason,
        httpStatus: $httpStatus,
        lighthouseReportPath: null,
        budgetReportPath: null
      }' >> "$route_results_file"
    continue
  fi

  lighthouse_report_path="${REPORT_DIR}/wave4-lighthouse-reliability-${RUN_TIMESTAMP}-${route_slug}.json"
  budget_report_path="${REPORT_DIR}/wave4-performance-budget-${RUN_TIMESTAMP}-${route_slug}.json"

  route_status="pass"
  route_reason="ok"

  if ! REPORT_PATH="$lighthouse_report_path" npm run perf:lighthouse:reliability -- "$BASE_URL" "$route"; then
    overall_status="fail"
    route_status="fail"
    route_reason="lighthouse_failed"
  elif ! PERF_BUDGET_SOURCE_REPORT="$lighthouse_report_path" REPORT_PATH="$budget_report_path" npm run perf:budget:gate; then
    overall_status="fail"
    route_status="fail"
    route_reason="budget_gate_failed"
  fi

  jq -nc \
    --arg route "$route" \
    --arg targetUrl "$target_url" \
    --arg status "$route_status" \
    --arg reason "$route_reason" \
    --arg httpStatus "$http_status" \
    --arg lighthouseReportPath "$lighthouse_report_path" \
    --arg budgetReportPath "$budget_report_path" \
    '{
      route: $route,
      targetUrl: $targetUrl,
      status: $status,
      reason: $reason,
      httpStatus: $httpStatus,
      lighthouseReportPath: $lighthouseReportPath,
      budgetReportPath: $budgetReportPath
    }' >> "$route_results_file"
done

jq -n \
  --arg generatedAt "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  --arg baseUrl "${BASE_URL%/}" \
  --arg status "$overall_status" \
  --arg failureReason "$failure_reason" \
  --arg highIntentRoute "$high_intent_route" \
  --argjson requiredRoutes "$(printf '%s\n' "${required_routes[@]}" | jq -R -s -c 'split("\n") | map(select(length > 0))')" \
  --argjson routeResults "$(jq -s '.' "$route_results_file")" \
  '{
    generatedAt: $generatedAt,
    baseUrl: $baseUrl,
    status: $status,
    failureReason: (if $failureReason == "" then null else $failureReason end),
    highIntentRoute: $highIntentRoute,
    requiredRoutes: $requiredRoutes,
    routeResults: $routeResults
  }' > "$ROUTE_REPORT_PATH"

echo "Wave 4 deterministic route audit report: $ROUTE_REPORT_PATH"
jq '.' "$ROUTE_REPORT_PATH"

if [[ "$overall_status" != "pass" ]]; then
  exit 1
fi
