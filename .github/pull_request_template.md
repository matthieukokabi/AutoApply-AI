## Summary

-

## Validation

- [ ] `npm run lint` (apps/web)
- [ ] `npm test` (apps/web)
- [ ] `npm run build` (apps/web)

## Real-DB Factual-Guard Release Gate (Required for release-sensitive changes)

Release-sensitive changes for this gate include any change that affects Tailor/webhook persistence behavior, including:

- `/api/webhooks/n8n` handling for `new_applications` or `single_tailoring_complete`
- `/api/tailor` dispatch behavior
- factual-guard logic or reason-code handling for tailored CV/cover-letter persistence
- n8n tailoring workflow callback payload mapping that affects tailored markdown persistence

For release-sensitive changes:

- [ ] I ran workflow **Webhooks n8n Real-DB Release Gate** and it passed.
- [ ] I linked the successful workflow run URL here: `https://github.com/<org>/<repo>/actions/runs/<id>`

Merge/deploy rule:

- Release-sensitive PRs must not be merged or deployed without a green run URL for this gate.
