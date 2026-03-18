# Runtime Health Snapshot Token Rotation (Wave 5)

## Scope
Endpoint: `/api/runtime/health-snapshot`

## Required environment variables
- `RUNTIME_HEALTH_SNAPSHOT_TOKEN`: current bearer-style token (sent in `x-health-snapshot-token` header)
- `RUNTIME_HEALTH_SNAPSHOT_TOKEN_ROTATED_AT`: ISO timestamp of the latest token rotation

## Rotation procedure
1. Generate a new strong random token (minimum 32 bytes entropy).
2. Update `RUNTIME_HEALTH_SNAPSHOT_TOKEN` in deployment secrets.
3. Update `RUNTIME_HEALTH_SNAPSHOT_TOKEN_ROTATED_AT` with current UTC timestamp.
4. Redeploy.
5. Validate endpoint access with the new token only.
6. Remove old token from any local scripts/notes.

## Staleness policy
- Token is considered stale after `30` days.
- Endpoint response includes `security.tokenRotation.isStale=true` with warnings when stale or misconfigured.
- Treat stale warnings as action-required operations debt.

## Security controls now enforced
- Header-token authentication
- `Cache-Control: no-store`
- `X-Robots-Tag: noindex, nofollow, noarchive`
- IP rate limiting (`30` requests / `10` minutes)
- Structured audit logs for success, unauthorized, disabled, and rate-limited access attempts
