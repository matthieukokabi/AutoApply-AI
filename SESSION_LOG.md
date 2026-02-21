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

---

## Session 2 — 2026-02-20 (continued)

### Completed

**Web App — Auth & Checkout:**
- Clerk sign-in/sign-up pages at /sign-in and /sign-up
- Stripe checkout API route (POST /api/checkout) for Pro/Unlimited/Credit Pack
- Upgrade buttons wired to Stripe checkout sessions

**Web App — CV Upload Parsing:**
- Server-side PDF parsing (pdf-parse) and DOCX parsing (mammoth)
- POST /api/profile/upload accepts multipart FormData
- Extracts raw text + structured profile (name, email, phone, skills, experience)

**Web App — Onboarding:**
- /onboarding page with 3-step wizard (profile, preferences, CV upload)
- GET/POST /api/onboarding route for checking/saving progress
- Auto-redirect from dashboard for new users

**Web App — UI Polish:**
- LoadingSkeleton component (shimmer animations)
- ErrorBoundary component (catch + retry)
- Cookie consent banner (GDPR compliant, saves preference)

**Web App — Legal Pages:**
- /terms, /privacy, /contact pages with full content

**Web App — Tests:**
- 6 test files, 24 tests total (all passing):
  - stats.test.ts, profile.test.ts, preferences.test.ts
  - applications.test.ts, checkout.test.ts, llm-validation.test.ts
- vitest.config.ts + mocked Clerk/Prisma/Stripe modules

---

## Session 3 — 2026-02-21

### Completed

**Flutter Mobile App — Full Build:**
- All pages rewritten from skeleton to functional:
  - login_page.dart — email/password form, auth provider integration
  - dashboard_page.dart — real stats + application cards from API
  - jobs_page.dart — job feed, paste job dialog, tailor button
  - profile_page.dart — CV display/edit, preferences form
  - document_viewer_page.dart — tailored CV/cover letter tabs, score badge, ATS chips

- New core files:
  - models.dart — UserModel, DashboardStats, MasterProfile, JobPreferences, Job, Application
  - api_service.dart — Centralized Dio-based API service
  - auth_provider.dart — Riverpod StateNotifier auth flow with FlutterSecureStorage
  - providers.dart — FutureProviders for stats, profile, preferences, applications, jobs
  - Updated dio_client.dart with real auth interceptor
  - Updated api_constants.dart with correct endpoints
  - Updated app_router.dart with auth guard redirect

- Fixed CardTheme → CardThemeData for Flutter 3.41.x
- Downloaded Inter font files (Regular, Medium, SemiBold, Bold)
- Created assets/images/ and assets/icons/ directories
- flutter analyze: 0 issues
- flutter build web: ✓ successful
- All 24 web tests still passing

**Local Verification:**
- Next.js web app running at http://localhost:3000
- Flutter web build served at http://localhost:8080
- PostgreSQL running, schema in sync

### What's Next
- User will provide VPS access for deployment
- Deploy: Vercel (web), Railway/DO (n8n + services)
- Set up Stripe products in dashboard
- Configure production environment variables

### Blockers / Decisions
- Docker not installed on Mac (only broken symlinks remain)
- Xcode not installed — cannot build native iOS/macOS Flutter apps locally
- Flutter mobile app uses demo auth (not real Clerk Flutter SDK yet)
- Stripe keys are placeholder — need production setup
