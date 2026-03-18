#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://autoapply.works}"
LOCALE="${2:-en}"
REPORT_PATH="${REPORT_PATH:-/tmp/live-squirrel-audit-$(date +%Y%m%d_%H%M%S).json}"

TARGET_URL="${BASE_URL%/}/${LOCALE}"
AUTH_URL="${BASE_URL%/}/${LOCALE}/sign-in"

tmp_headers="$(mktemp /tmp/live-audit-headers.XXXXXX)"
tmp_html="$(mktemp /tmp/live-audit-html.XXXXXX)"
tmp_auth_headers="$(mktemp /tmp/live-audit-auth-headers.XXXXXX)"
tmp_auth_html="$(mktemp /tmp/live-audit-auth-html.XXXXXX)"

cleanup() {
  rm -f "$tmp_headers" "$tmp_html" "$tmp_auth_headers" "$tmp_auth_html"
}
trap cleanup EXIT

curl -sS -L -D "$tmp_headers" -o "$tmp_html" "$TARGET_URL"
curl -sS -L -D "$tmp_auth_headers" -o "$tmp_auth_html" "$AUTH_URL"

header_value() {
  local header_name="$1"
  local header_file="$2"
  awk -v key="$header_name" '
    BEGIN { IGNORECASE = 1 }
    {
      line = $0;
      gsub("\r", "", line);
      split(line, parts, ":");
      current_key = parts[1];
    }
    tolower(current_key) == tolower(key) {
      sub(/^[^:]+:[[:space:]]*/, "", line);
      print line;
      exit;
    }
  ' "$header_file"
}

extract_head_value() {
  local pattern="$1"
  local html_file="$2"
  tr '\n' ' ' < "$html_file" | grep -o "$pattern" | head -n1 || true
}

extract_href() {
  sed -E 's/.*href="([^"]+)".*/\1/'
}

extract_content() {
  sed -E 's/.*content="([^"]+)".*/\1/'
}

canonical_raw="$(extract_head_value '<link rel="canonical" href="[^"]*"' "$tmp_html")"
canonical_url="$(printf '%s' "$canonical_raw" | extract_href)"

robots_raw="$(extract_head_value '<meta name="robots" content="[^"]*"' "$tmp_html")"
robots_value="$(printf '%s' "$robots_raw" | extract_content | tr '[:upper:]' '[:lower:]')"

auth_robots_raw="$(extract_head_value '<meta name="robots" content="[^"]*"' "$tmp_auth_html")"
auth_robots_value="$(printf '%s' "$auth_robots_raw" | extract_content | tr '[:upper:]' '[:lower:]')"

expected_hreflang_codes=("en" "fr" "de" "es" "it" "x-default")
missing_hreflang=()
for code in "${expected_hreflang_codes[@]}"; do
  if ! grep -q "hrefLang=\"$code\"" "$tmp_html"; then
    missing_hreflang+=("$code")
  fi
done

check_headers=(
  "Content-Security-Policy"
  "Content-Security-Policy-Report-Only"
  "X-Frame-Options"
  "X-Content-Type-Options"
  "Referrer-Policy"
  "Permissions-Policy"
  "Cross-Origin-Opener-Policy"
  "Cross-Origin-Resource-Policy"
)

missing_headers=()
for header_name in "${check_headers[@]}"; do
  value="$(header_value "$header_name" "$tmp_headers")"
  if [[ -z "$value" ]]; then
    missing_headers+=("$header_name")
  fi
done

canonical_has_query_or_hash="false"
if [[ "$canonical_url" == *"?"* || "$canonical_url" == *"#"* ]]; then
  canonical_has_query_or_hash="true"
fi

status="pass"
if [[ "${#missing_headers[@]}" -gt 0 ]]; then
  status="fail"
fi
if [[ -z "$canonical_url" || "$canonical_has_query_or_hash" == "true" ]]; then
  status="fail"
fi
if [[ "${#missing_hreflang[@]}" -gt 0 ]]; then
  status="fail"
fi
if [[ "$robots_value" != *"index"* || "$robots_value" != *"follow"* ]]; then
  status="fail"
fi
if [[ "$auth_robots_value" != *"noindex"* ]]; then
  status="fail"
fi

jq -n \
  --arg generatedAt "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  --arg baseUrl "$BASE_URL" \
  --arg locale "$LOCALE" \
  --arg targetUrl "$TARGET_URL" \
  --arg authUrl "$AUTH_URL" \
  --arg status "$status" \
  --arg canonical "$canonical_url" \
  --arg canonicalHasQueryOrHash "$canonical_has_query_or_hash" \
  --arg robots "$robots_value" \
  --arg authRobots "$auth_robots_value" \
  --arg csp "$(header_value "Content-Security-Policy" "$tmp_headers")" \
  --arg cspReportOnly "$(header_value "Content-Security-Policy-Report-Only" "$tmp_headers")" \
  --arg permissionsPolicy "$(header_value "Permissions-Policy" "$tmp_headers")" \
  --arg xContentTypeOptions "$(header_value "X-Content-Type-Options" "$tmp_headers")" \
  --arg referrerPolicy "$(header_value "Referrer-Policy" "$tmp_headers")" \
  --arg xFrameOptions "$(header_value "X-Frame-Options" "$tmp_headers")" \
  --arg coop "$(header_value "Cross-Origin-Opener-Policy" "$tmp_headers")" \
  --arg corp "$(header_value "Cross-Origin-Resource-Policy" "$tmp_headers")" \
  --argjson missingHeaders "$(printf '%s\n' "${missing_headers[@]-}" | jq -R -s -c 'split("\n") | map(select(length > 0))')" \
  --argjson missingHreflang "$(printf '%s\n' "${missing_hreflang[@]-}" | jq -R -s -c 'split("\n") | map(select(length > 0))')" \
  '{
    generatedAt: $generatedAt,
    baseUrl: $baseUrl,
    locale: $locale,
    targetUrl: $targetUrl,
    authUrl: $authUrl,
    status: $status,
    metadata: {
      canonical: $canonical,
      canonicalHasQueryOrHash: ($canonicalHasQueryOrHash == "true"),
      robots: $robots,
      authRobots: $authRobots,
      missingHreflang: $missingHreflang
    },
    headers: {
      csp: $csp,
      cspReportOnly: $cspReportOnly,
      permissionsPolicy: $permissionsPolicy,
      xContentTypeOptions: $xContentTypeOptions,
      referrerPolicy: $referrerPolicy,
      xFrameOptions: $xFrameOptions,
      coop: $coop,
      corp: $corp,
      missingHeaders: $missingHeaders
    }
  }' > "$REPORT_PATH"

echo "Live squirrel audit report: $REPORT_PATH"
jq '.' "$REPORT_PATH"

if [[ "$status" != "pass" ]]; then
  exit 1
fi
