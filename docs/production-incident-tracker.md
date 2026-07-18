# Production incident tracker

## 2026-07-18 — n8n tailoring model retirement

- [x] Confirm the production discovery and single-job tailoring workflows call retired model `claude-sonnet-4-20250514`.
- [x] Update both v3 workflow templates to Anthropic's recommended replacement, `claude-sonnet-4-6`.
- [x] Publish the live workflow revisions and verify recovery: both workflows now have active revisions containing `claude-sonnet-4-6`; controlled discovery execution `5239` completed successfully, persisted both user branches, and produced no diagnostics alerts; a minimal Anthropic request returned `200` for the replacement model.
