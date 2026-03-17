#!/usr/bin/env bash
set -euo pipefail

BROWSERS="${SMOKE_BROWSERS:-chromium firefox webkit}"
SMOKE_SPEC="${SMOKE_SPEC:-e2e/onboarding.cross-browser.smoke.spec.ts}"
SMOKE_PLAYWRIGHT_CONFIG="${SMOKE_PLAYWRIGHT_CONFIG:-playwright.smoke.config.ts}"
REPORT_PATH="${REPORT_PATH:-/tmp/onboarding-cross-browser-smoke-$(date +%Y%m%d_%H%M%S).jsonl}"

echo "" > "$REPORT_PATH"
passed=0
failed=0

for browser in $BROWSERS; do
    status="pass"
    reason="ok"

    echo "Running onboarding smoke on browser: $browser"
    if ! npx playwright test -c "$SMOKE_PLAYWRIGHT_CONFIG" "$SMOKE_SPEC" --browser="$browser" --reporter=line; then
        status="fail"
        reason="playwright_test_failed"
    fi

    if [[ "$status" == "pass" ]]; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi

    printf '{"browser":"%s","status":"%s","reason":"%s"}\n' \
        "$browser" "$status" "$reason" >> "$REPORT_PATH"
done

echo "Onboarding cross-browser smoke report: $REPORT_PATH"
echo "Passed: $passed"
echo "Failed: $failed"

if [[ "$failed" -gt 0 ]]; then
    exit 1
fi
