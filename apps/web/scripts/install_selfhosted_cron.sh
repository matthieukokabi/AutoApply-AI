#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${AUTOAPPLY_ENV_FILE:-/opt/autoapply/apps/web/.env.production}"
RUNNER_PATH="${AUTOAPPLY_RUNNER_PATH:-/usr/local/sbin/autoapply-cron-request}"
CRON_PATH="${AUTOAPPLY_CRON_PATH:-/etc/cron.d/autoapply}"
BASE_URL="${AUTOAPPLY_BASE_URL:-https://apply.zuerifix.tech}"
RESTART_SERVICE="${AUTOAPPLY_RESTART_SERVICE:-1}"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "AutoApply environment file not found: $ENV_FILE" >&2
    exit 1
fi

if ! grep -q '^CRON_SECRET=' "$ENV_FILE"; then
    printf '\nCRON_SECRET=%s\n' "$(openssl rand -hex 32)" >> "$ENV_FILE"
fi

install -d -m 0755 "$(dirname "$RUNNER_PATH")" "$(dirname "$CRON_PATH")"

runner_tmp="$(mktemp)"
cron_tmp="$(mktemp)"
trap 'rm -f "$runner_tmp" "$cron_tmp"' EXIT

cat > "$runner_tmp" <<EOF
#!/usr/bin/env bash
set -euo pipefail
set -a
source "$ENV_FILE"
set +a

case "\${1:-}" in
    discovery) endpoint="/api/cron/discovery-v3/dispatch-v2" ;;
    health) endpoint="/api/cron/discovery-v3/health" ;;
    weekly-digest) endpoint="/api/cron/weekly-digest" ;;
    *) echo "Unknown AutoApply cron target" >&2; exit 64 ;;
esac

curl --fail-with-body --silent --show-error \
    --max-time 120 \
    -H "Authorization: Bearer \$CRON_SECRET" \
    "$BASE_URL\$endpoint"
EOF

cat > "$cron_tmp" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Dual UTC schedules cover the fixed 07:20, 12:20 and 18:20 Europe/Zurich
# slots across daylight-saving changes. The application rejects inactive slots.
20 5,6,10,11,16,17 * * * root $RUNNER_PATH discovery >> /var/log/autoapply-discovery-cron.log 2>&1
*/30 * * * * root $RUNNER_PATH health >> /var/log/autoapply-discovery-health.log 2>&1
0 9 * * 1 root $RUNNER_PATH weekly-digest >> /var/log/autoapply-weekly-digest.log 2>&1
EOF

install -m 0750 "$runner_tmp" "$RUNNER_PATH"
install -m 0644 "$cron_tmp" "$CRON_PATH"

if [[ "$RESTART_SERVICE" == "1" ]]; then
    systemctl restart autoapply.service
fi

echo "Installed AutoApply self-hosted scheduler: $CRON_PATH"
