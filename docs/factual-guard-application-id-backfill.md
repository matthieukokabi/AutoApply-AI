# Factual Guard `applicationId` Backfill (Recent Legacy Rows)

Purpose: backfill `payload.applicationId` on historical `WorkflowError` rows with `errorType=FACTUAL_GUARD_BLOCKED` where a single owning application can be resolved safely.

Safety rules:
- Dry-run is default.
- Window is bounded to recent rows (`--days`, default `90`).
- Only unambiguous matches are updated.
- Existing payload fields are preserved.
- Ambiguous and unresolved rows are skipped.

## Commands

Dry-run (recommended first):

```bash
cd apps/web
npm run maintenance:factual-guard:backfill-application-id -- --dry-run --days 90
```

Live run (after dry-run review):

```bash
cd apps/web
npm run maintenance:factual-guard:backfill-application-id -- --apply --days 90
```

Optional bounded row cap:

```bash
cd apps/web
npm run maintenance:factual-guard:backfill-application-id -- --dry-run --days 90 --max-rows 500
```
