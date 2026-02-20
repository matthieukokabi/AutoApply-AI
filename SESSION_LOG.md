# AutoApply AI — Session Log

## Session 1 — 2026-02-20

### Completed

**Step 3a: Backend CRUD API routes** — All created and type-checked:
- `apps/web/app/api/profile/route.ts` — GET/POST for master profile
- `apps/web/app/api/profile/upload/route.ts` — POST for CV file upload
- `apps/web/app/api/preferences/route.ts` — GET/PUT for job preferences
- `apps/web/app/api/applications/route.ts` — GET list with status filter
- `apps/web/app/api/applications/[id]/route.ts` — GET single + PATCH status update
- `apps/web/app/api/jobs/route.ts` — GET with search/source/minScore filters
- `apps/web/app/api/stats/route.ts` — GET dashboard stats (counts, averages, by-status)
- `apps/web/app/api/user/route.ts` — GET user info + PATCH automation toggle
- `apps/web/app/api/account/route.ts` — GET data export + DELETE GDPR deletion
- `apps/web/lib/auth.ts` — Shared auth helper (getAuthUser)

**Step 3b: Dashboard page wired:**
- Server Component fetches real stats and applications from Prisma
- Created `components/kanban-board.tsx` — client component with @hello-pangea/dnd
- Drag-drop moves cards between columns, PATCH to /api/applications/[id]
- Optimistic updates with revert on failure

**Step 3c: Jobs page wired:**
- Client component with search, source filter, min score filter
- Debounced search with 300ms delay
- "Paste Job" inline dialog (title, company, URL, description) → POST /api/tailor
- "Tailor CV" button per job card → POST /api/tailor
- Job cards show match score, ATS keywords, source badge
- Links to document viewer for completed applications

**Step 3d: Profile page wired:**
- Client component with file upload (drag-drop + file picker)
- Raw text paste with "Save & Parse"
- Structured profile editor (contact, summary, skills)
- Loading spinner, success/error messages

**Step 3e: Settings page wired:**
- Fetches user info + preferences on mount
- Job preferences form (titles, locations, remote, salary, industries) → PUT /api/preferences
- Automation toggle → PATCH /api/user
- Real subscription status and credits display
- Export data → GET /api/account → JSON download
- Delete account with two-click confirmation → DELETE /api/account

**Step 3f: Document viewer wired:**
- Server Component fetches application + job + master profile
- Shows compatibility score, ATS keywords, strengths, gaps
- Side-by-side: original CV (raw text) vs tailored CV (Markdown rendered)
- Cover letter section with Markdown rendering
- Download buttons for PDF URLs when available

### What's Next
- Step 4: Build Flutter mobile app functionality (Clerk SDK, Riverpod providers, API calls)
- OR continue web refinements:
  - Stripe checkout integration on pricing/upgrade buttons
  - Onboarding flow for new users
  - Loading skeletons (shimmer) instead of spinner
  - Error boundaries

### Blockers / Decisions
- CV upload currently only accepts .txt files (client-side text extraction). For PDF/DOCX parsing, need to either add server-side deps (pdf-parse, mammoth) or use an external service.
- Stripe checkout buttons (Upgrade, Buy Credits) are present but not yet linked to Stripe checkout sessions.
- The `@clerk/nextjs@4.29` has a peer dep conflict with `next@14.1.0` — installed with `--legacy-peer-deps`. Consider upgrading Clerk or Next.js.
