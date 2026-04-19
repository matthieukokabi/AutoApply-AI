# Production Provenance Trail

This file exists to keep deploy provenance trail updates compatible with branch
protection when required checks are path-filtered to `apps/web/**`.

Canonical production evidence remains:
- runtime snapshot endpoint: `/api/runtime/health-snapshot` (token-protected)
- release trail files at repo root: `SESSION_LOG.md`, `TODO.md`
