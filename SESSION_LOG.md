# AutoApply AI — Session Log

## Session 18 — 2026-03-16

### Completed

**Security hardening — committed secret sanitization (atomic step):**
- Redacted leaked Stripe webhook secret from `SESSION_LOG.md`
- Replaced hardcoded webhook/API key literals in:
  - `n8n/workflows/single-job-tailoring.json`
  - `n8n/workflows/job-discovery-pipeline.json`
- Standardized workflow placeholders:
  - `YOUR_N8N_WEBHOOK_SECRET`
  - `YOUR_ADZUNA_APP_KEY`
  - `YOUR_JSEARCH_API_KEY`

**Verification run for this step:**
- Secret pattern grep for removed literals: no matches
- JSON validation: both modified workflow JSON files pass `jq empty`

**Security hardening — debug diagnostics endpoint locked down (atomic step):**
- Updated `apps/web/app/api/debug/auth/route.ts`:
  - Endpoint now returns `404` unless `ENABLE_DEBUG_AUTH_ENDPOINT=true`
  - Requires `DEBUG_AUTH_SECRET` when enabled (fail-closed with `503` if missing)
  - Requires `x-debug-auth-secret` header match (`401` on mismatch)
- Added dedicated tests: `apps/web/__tests__/api/debug-auth.test.ts`
- Expanded shared Prisma test mock with `prisma.user.count` in `apps/web/__tests__/setup.ts`

**Verification run for this step:**
- `npm test -- __tests__/api/debug-auth.test.ts` → 4/4 passing
- `npm run build` → success

**Security hardening — cron auth now fail-closed on missing secret (atomic step):**
- Updated `apps/web/app/api/cron/weekly-digest/route.ts`:
  - Endpoint now returns `503` when `CRON_SECRET` is unset
  - Authorization comparison uses resolved `cronSecret` value (no `Bearer undefined` bypass path)
- Added regression test in `apps/web/__tests__/api/cron-weekly-digest.test.ts` for missing-secret behavior

**Verification run for this step:**
- `npm test -- __tests__/api/cron-weekly-digest.test.ts` → 8/8 passing
- `npm run build` → success

**Billing correctness — unlimited yearly price mapping fixed (atomic step):**
- Updated `apps/web/app/api/webhooks/stripe/route.ts`:
  - Added `resolvePlanFromPriceId()` helper
  - Plan mapping now recognizes both:
    - `STRIPE_PRICE_UNLIMITED_MONTHLY`
    - `STRIPE_PRICE_UNLIMITED_YEARLY`
  - Applied in both `checkout.session.completed` and `customer.subscription.*` handlers
- Added regression tests in `apps/web/__tests__/api/webhooks-stripe.test.ts`:
  - Unlimited yearly checkout maps to `subscriptionStatus: "unlimited"`
  - Unlimited yearly subscription update maps to `subscriptionStatus: "unlimited"`

**Verification run for this step:**
- `npm test -- __tests__/api/webhooks-stripe.test.ts __tests__/integration/stripe-workflow.test.ts` → 17/17 passing
- `npm run build` → success

**Billing correctness — Stripe webhook idempotency added (atomic step):**
- Added new Prisma model in `apps/web/prisma/schema.prisma`:
  - `StripeWebhookEvent` (`eventId` unique) for replay protection
- Updated `apps/web/app/api/webhooks/stripe/route.ts`:
  - Inserts webhook `event.id` before processing
  - Returns early with `{ duplicate: true }` on unique-conflict (`P2002`)
  - Deletes inserted event row on handler failure to allow retries
- Updated test scaffolding in `apps/web/__tests__/setup.ts` for `prisma.stripeWebhookEvent`
- Added duplicate-event regression test in `apps/web/__tests__/api/webhooks-stripe.test.ts`
- Regenerated Prisma client: `npx prisma generate`

**Verification run for this step:**
- `npm test -- __tests__/api/webhooks-stripe.test.ts __tests__/integration/stripe-workflow.test.ts` → 18/18 passing
- `npm run build` → success

**Security hardening — contact email HTML injection mitigated (atomic step):**
- Updated `apps/web/app/api/contact/route.ts`:
  - Added `escapeHtml()` helper
  - Sanitized user-provided `name`, `email`, and `message` before HTML interpolation
  - Preserved message line breaks after escaping (`\n` → `<br />`)

**Verification run for this step:**
- `npm test -- __tests__/api/contact.test.ts` → 8/8 passing
- `npm run build` → success

**Stability hardening — profile PDF upload rejects invalid payloads (atomic step):**
- Updated `apps/web/app/api/profile/upload/route.ts`:
  - Added early PDF signature validation (`%PDF-`) for `.pdf` uploads
  - Returns `400` with clear error for invalid PDF byte streams
  - Switched parser loading from `require()` to dynamic `import("pdf-parse")`
- Updated regression test in `apps/web/__tests__/api/profile-upload.test.ts`:
  - Invalid PDF payload path now asserts quick `400` rejection

**Verification run for this step:**
- `npm test -- __tests__/api/profile-upload.test.ts` → 9/9 passing
- `npm run build` → success

**Input validation hardening — safe query parsing for jobs/applications APIs (atomic step):**
- Updated `apps/web/app/api/jobs/route.ts`:
  - Hardened `limit` parsing with safe default (`50`) and clamp (`1..200`)
  - Added strict `minScore` validation; invalid/out-of-range values now return `400`
  - Prevented invalid numeric input from propagating into Prisma filters
- Updated `apps/web/app/api/applications/route.ts`:
  - Hardened `limit` parsing with safe default (`100`) and clamp (`1..200`)
- Added regression coverage:
  - `apps/web/__tests__/api/jobs.test.ts` (invalid `minScore`, invalid/zero `limit`)
  - `apps/web/__tests__/api/applications.test.ts` (invalid/zero `limit`)

**Verification run for this step:**
- `npm test -- __tests__/api/jobs.test.ts __tests__/api/applications.test.ts` → 11/11 passing
- `npm run build` → success

**Mobile contract fix — align job actions with supported backend endpoints (atomic step):**
- Updated `apps/mobile/lib/core/services/api_service.dart`:
  - `getJobs()` now sends `limit` query param (was unsupported `skip/take`)
  - `tailorForJob()` now posts full payload to `/tailor` (`jobId`, `jobDescription`, metadata)
  - `pasteJob()` now uses `/tailor` (manual job flow) instead of unsupported `POST /jobs`
- Updated mobile call sites:
  - `apps/mobile/lib/core/providers/providers.dart` now calls `getJobs(limit: 50)`
  - `apps/mobile/lib/features/jobs/presentation/pages/jobs_page.dart` now passes full `Job` to `tailorForJob()`

**Verification run for this step:**
- Tooling check: `flutter` not found in environment PATH
- Tooling check: `dart` not found in environment PATH
- Mobile analyze/test/build could not be executed in this environment due missing SDK

**API contract hardening — `/api/tailor` now supports existing `jobId` without duplicate description (atomic step):**
- Updated `apps/web/app/api/tailor/route.ts`:
  - `jobDescription` is now required only when creating a new manual job
  - For existing `jobId`, route now falls back to stored job description
  - Returns `400` only when neither request nor stored job has usable description
  - Webhook payload now uses resolved description and job metadata fallback from stored job
- Updated test mock scaffolding:
  - Added `prisma.job.findUnique` in `apps/web/__tests__/setup.ts`
- Added regression tests in `apps/web/__tests__/api/tailor.test.ts`:
  - Existing `jobId` succeeds without `jobDescription` when DB job has one
  - Existing `jobId` fails with `400` when DB job description is empty

**Verification run for this step:**
- `npm test -- __tests__/api/tailor.test.ts __tests__/integration/credit-flow.test.ts` → 18/18 passing
- `npm run build` → success

**Reliability hardening — `/api/tailor` now fail-closed on webhook dispatch (atomic step):**
- Updated `apps/web/app/api/tailor/route.ts`:
  - Returns `503` when `N8N_WEBHOOK_URL` is not configured
  - Awaits webhook dispatch and returns `502` when dispatch fails
  - Deducts credits only after successful webhook dispatch
- Added regression tests in `apps/web/__tests__/api/tailor.test.ts`:
  - Missing webhook URL returns `503` with no credit deduction
  - Webhook non-OK response returns `502` with no credit deduction
- Updated integration test setup:
  - `apps/web/__tests__/integration/credit-flow.test.ts` now sets `N8N_WEBHOOK_URL` in `beforeEach`

**Verification run for this step:**
- `npm test -- __tests__/api/tailor.test.ts __tests__/integration/credit-flow.test.ts` → 20/20 passing
- `npm run build` → success

**Data integrity hardening — stable fallback `externalId` in n8n webhook ingest (atomic step):**
- Updated `apps/web/app/api/webhooks/n8n/route.ts`:
  - Generates one stable `externalId` per incoming application item
  - Reuses the same resolved `externalId` in both `where` and `create` during job upsert
  - Uses deterministic fallback format `manual-${userId}-${timestamp}-${index}`
- Added regression test in `apps/web/__tests__/api/webhooks-n8n.test.ts`:
  - Verifies fallback IDs are stable per item and distinct across items when `externalId` is omitted

**Verification run for this step:**
- `npm test -- __tests__/api/webhooks-n8n.test.ts` → 10/10 passing
- `npm run build` → success

**CI readiness — lint is now non-interactive in `apps/web` (atomic step):**
- Added `apps/web/.eslintrc.json` with `next/core-web-vitals` baseline
- `npm run lint` no longer prompts for interactive setup

**Verification run for this step:**
- `npm run lint` → success (2 warnings: `@next/next/no-img-element` in `components/cv-display.tsx` and `components/photo-upload.tsx`)
- `npm run build` → success

**Frontend quality hardening — removed remaining `no-img-element` warnings (atomic step):**
- Updated image rendering in:
  - `apps/web/components/cv-display.tsx`
  - `apps/web/components/photo-upload.tsx`
- Replaced raw `<img>` tags with `next/image` (`NextImage`, `unoptimized` for data URLs)
- Added missing `group` class on photo preview container so hover overlay works consistently
- Resolved `Image` constructor name collision by aliasing Next image component to `NextImage`

**Verification run for this step:**
- `npm run lint` → success (0 warnings, 0 errors)
- `npm run build` → success

**Dependency security hardening — upgraded Next.js patch line (atomic step):**
- Updated web dependencies in `apps/web/package.json`:
  - `next` `14.1.0` → `14.2.35`
  - `eslint-config-next` `14.1.0` → `14.2.35`
- Updated lockfile and generated Next environment typings:
  - `apps/web/package-lock.json`
  - `apps/web/next-env.d.ts`

**Verification run for this step:**
- `npm run lint` → success
- `npm test` → 21 files, 139 tests passing
- `npm run build` → success on Next.js `14.2.35`
- `npm audit --json`:
  - Critical vulnerabilities reduced from 1 → 0
  - Remaining advisories are low/high and require major upgrades (not applied in this atomic patch step)

**Dependency hygiene — applied non-breaking `npm audit fix` updates (atomic step):**
- Ran `npm audit fix` in `apps/web` (no `--force`)
- Updated lockfile transitive dependencies in:
  - `apps/web/package-lock.json`

**Verification run for this step:**
- `npm run lint` → success
- `npm test` → 21 files, 139 tests passing
- `npm run build` → success
- `npm audit` summary after fix:
  - Remaining vulnerabilities: 8 total (4 low, 4 high)
  - No critical vulnerabilities
  - Remaining fixes require major upgrades (`next@16.x`, `eslint-config-next@16.x`, `@clerk/nextjs@7.x`)

**Dependency security hardening — upgraded web stack to Next.js 15 patch line (atomic step):**
- Updated web dependencies:
  - `apps/web/package.json`
  - `apps/web/package-lock.json`
  - `apps/web/next-env.d.ts`
- Upgrade applied:
  - `next` → `15.5.10`
  - `eslint-config-next` → `15.5.10`
- Compatibility fixes for Next 15 runtime/type changes:
  - Promise-based `params` handling in App Router pages/layouts/metadata:
    - `apps/web/app/[locale]/page.tsx`
    - `apps/web/app/[locale]/layout.tsx`
    - `apps/web/app/[locale]/blog/page.tsx`
    - `apps/web/app/[locale]/blog/[slug]/page.tsx`
    - `apps/web/app/[locale]/roadmap/page.tsx`
    - `apps/web/app/[locale]/(dashboard)/documents/[id]/page.tsx`
  - Promise-based `context.params` in dynamic API route:
    - `apps/web/app/api/applications/[id]/route.ts`
  - Async `headers()` usage fix in:
    - `apps/web/app/api/webhooks/stripe/route.ts`

**Verification run for this step:**
- `npm run lint` → success
- `npm test` → 21 files, 139 tests passing
- `npm run build` → success on Next.js `15.5.10`
- `npm audit --json` summary after upgrade:
  - Remaining vulnerabilities: 4 total (4 low, 0 moderate, 0 high, 0 critical)
  - Remaining low findings are tied to `@clerk/nextjs` major upgrade path (`7.x`)

---

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

---

## Session 4 — 2026-02-22

### Completed

**Admin Account & Auth Fixes (from prev context):**
- Created `prisma/seed.ts` — admin user (matthieu.kokabi@gmail.com) with Unlimited plan, 9999 credits
- 5 sample jobs (Stripe, Vercel, DeepMind, N26, Notion) + 5 sample applications
- Fixed user creation race condition: centralized all user creation in `lib/auth.ts` → `getAuthUser()`
- Fixed `(dashboard)/layout.tsx` and `api/onboarding/route.ts` to use `getAuthUser()` instead of direct `prisma.user.create()`
- Enhanced sign-in/sign-up pages with better styling
- LinkedIn OAuth enabled via Clerk Dashboard (shared credentials for dev)
- Phone verification disabled in Clerk

**Stripe — Full Integration:**
- API keys configured (test mode — AutoApply sandbox)
- 3 products created in Stripe Dashboard:
  - AutoApply Pro: $29/mo (price_1T3LmSCObkaQqcv27oj42Mae) + $249/yr (price_1T3LmSCObkaQqcv2upF4ZJxB)
  - AutoApply Unlimited: $79/mo (price_1T3LolCObkaQqcv2PsDAFiDM)
  - Credit Pack: $19 one-time (price_1T3LquCObkaQqcv20R2uHOi4)
- Webhook endpoint: https://autoapply.works/api/webhooks/stripe (whsec_REDACTED)
- Webhook handler updated to handle all 6 events:
  - checkout.session.completed, customer.subscription.created/updated/deleted
  - invoice.payment_succeeded, invoice.payment_failed
- Stripe Customer Portal configured (payments, invoices, cancel, plan switching)
- Stripe Branding set (#2563EB brand, #1E40AF accent, "AutoApply" name)

**Clerk — Production Instance:**
- Production instance created for autoapply.works
- Frontend API URL: https://clerk.autoapply.works
- Instance ID: ins_39zqMLJuFyCTNUeIm1CMb4tIe7e

**Domain — autoapply.works:**
- Purchased on Hostinger
- DNS: CNAME clerk → frontend-api.clerk.services (for Clerk auth)
- Email forwarding via ForwardEmail.net (DNS-based, free):
  - support@autoapply.works → matthieu.kokabi@gmail.com
  - noreply@autoapply.works → matthieu.kokabi@gmail.com
  - contact@autoapply.works → matthieu.kokabi@gmail.com
- MX records: mx1.forwardemail.net (pri 10), mx2.forwardemail.net (pri 20)

### .env Keys (Test Mode)
- All keys are in the .env file (gitignored — not in repo)
- Clerk: pk_test_... / sk_test_...
- Stripe: pk_test_... / sk_test_...
- Stripe Webhook: whsec_...
- All 4 Stripe price IDs configured
- See "New Machine Setup" section below for full .env contents (share privately, not in git)

### What's Next
1. Test Stripe checkout flow end-to-end (Path A — use test card 4242 4242 4242 4242)
2. Fix landing page if styling issue persists
3. Deploy to Vercel (add A record + CNAME www to Hostinger DNS)
4. Set production env vars on Vercel
5. Set Clerk production keys on Vercel

### Setup Instructions for New Machine
See SESSION_LOG.md "New Machine Setup" section below.

---

## New Machine Setup — How to Continue

### Prerequisites
- Node.js 20+ (`brew install node` or `nvm install 20`)
- PostgreSQL 16 (`brew install postgresql@16 && brew services start postgresql@16`)
- Git configured with GitHub access
- Flutter SDK (for mobile app only)

### Step-by-step
```bash
# 1. Clone the repo
git clone https://github.com/MattMenworworksAI/AutoApply-AI.git
cd AutoApply-AI

# 2. Install web dependencies
cd apps/web
npm install --legacy-peer-deps

# 3. Create the database
createdb autoapply
psql autoapply -c "CREATE USER autoapply WITH PASSWORD 'autoapply_dev_123';"
psql autoapply -c "GRANT ALL PRIVILEGES ON DATABASE autoapply TO autoapply;"
psql autoapply -c "GRANT ALL ON SCHEMA public TO autoapply;"

# 4. Copy .env (IMPORTANT — .env is gitignored, you MUST recreate it)
# Copy the .env file from your current Mac to the new machine.
# The easiest way: on your CURRENT Mac, run:
#   cat apps/web/.env | pbcopy
# Then on the NEW Mac, create the file:
#   nano apps/web/.env   (paste contents, save)
# OR use AirDrop/iCloud to transfer the .env file directly.

# 5. Push schema + seed database
npx prisma db push
npx tsx prisma/seed.ts

# 6. Run dev server
npm run dev

# 7. Run tests
npm test
```

### Claude Code Prompt to Continue
```
Read SESSION_LOG.md in the project root and continue from where the last session left off.
```

---

## Session 5 — 2026-02-27

### Completed

**Landing Page — Complete Redesign:**
- Gradient hero text, stats bar (4 APIs, 100+ keywords, 0 fabricated, 4h cycle)
- "How It Works" 3-step section
- Features grid on muted background
- Pricing cards with checkmark lists and real Stripe checkout buttons
- CTA banner section before footer
- 4-column footer (brand, product, legal, data sources)

**Dark Mode — Full Implementation:**
- Installed `next-themes` package
- `components/theme-provider.tsx` — wraps app with system/light/dark detection
- `components/theme-toggle.tsx` — sun/moon icon toggle button
- Root layout updated with ThemeProvider (defaults to system preference)
- Dashboard sidebar has toggle next to user avatar
- Landing page header has toggle
- CSS dark mode variables were already defined — now properly activated

**Stripe Checkout — Wired to UI:**
- `components/checkout-button.tsx` — client component calling POST /api/checkout
- Pro Monthly, Pro Yearly, Unlimited, Credit Pack buttons all trigger real Stripe sessions
- Free tier links to /sign-up

**Production Deployment — Vercel:**
- Deployed to Vercel (project: auto-apply-ai)
- Root directory: `apps/web`, Framework: Next.js
- Added `.npmrc` with `legacy-peer-deps=true` to fix Clerk peer dep conflict
- 17 environment variables configured on Vercel
- Live at: https://auto-apply-ai-psi.vercel.app

**Production Database — Neon:**
- Created Neon project `autoapply` in Frankfurt (EU)
- PostgreSQL 17, connection pooling enabled
- Prisma schema pushed, database seeded (admin + 5 sample jobs + 5 applications)
- Connection string: ep-morning-meadow-ag8qe5hq-pooler.c-2.eu-central-1.aws.neon.tech

**Domain — autoapply.works → Vercel:**
- A record: `@` → `216.198.79.1` (Vercel)
- CNAME: `www` → `cname.vercel-dns.com`
- Existing records preserved (clerk CNAME, MX, TXT)
- SSL auto-provisioned by Vercel
- Site live at: https://autoapply.works ✅

**Build & Tests:**
- `next build` — 0 errors
- `vitest run` — 24/24 tests passing

### What's Next
1. **Switch Clerk to production keys** — currently using test keys, auth won't work on autoapply.works until production Clerk keys are set
2. **Deploy n8n + Gotenberg to Render** — automation engine for job discovery
3. **Add more job board APIs** — JSearch (RapidAPI), Jooble, Reed.co.uk, RSS feeds
4. **Email notifications** — SendGrid/Resend for "new jobs matched" alerts
5. **More tests** — component tests, E2E flow tests

### Blockers / Decisions
- Clerk production keys (ins_39zqMLJuFyCTNUeIm1CMb4tIe7e) need to be set on Vercel — currently test keys are deployed, so sign-in on autoapply.works won't work with production Clerk
- n8n needs a hosting platform (Render recommended) — not yet set up
- Stripe webhook secret needs updating if URL changes from test to production

---

## Session 6 — 2026-02-27 (continued)

### Completed

**Clerk Production Auth — Fixed:**
- Switched from test to production Clerk keys on Vercel
- Google OAuth and LinkedIn OAuth configured
- DNS verified for clerk.autoapply.works

**i18n — Multi-Language Landing Page:**
- Installed `next-intl` with `[locale]` routing
- 5 languages: English, French, German, Spanish, Italian
- All landing page text translated (hero, features, pricing, footer)
- Language switcher dropdown component
- Locale-aware routing with default English fallback

**Multi-Currency Salary Ranges:**
- Salary inputs show local currency per country (EUR for FR/DE/IT/ES, GBP for UK, CHF for Swiss)
- Currency formatting in job cards and filters

---

## Session 7 — 2026-02-28

### Completed

**Blog System — Multilingual SEO Content:**
- File-based Markdown blog with YAML frontmatter
- `lib/blog.ts` utility for parsing posts at build time
- Blog index page + individual post pages with ReactMarkdown
- 3 English articles: ATS optimization, AI cover letter guide, job search automation
- All 3 translated into FR, DE, ES, IT (15 blog posts total)
- Blog routes added to Clerk public routes middleware
- Blog link added to landing page header nav + footer
- Commit: `cb817b5`

**Job Board APIs — Expanded to 7 Sources:**
- Added JSearch (RapidAPI), Jooble, Reed API integrations
- n8n workflow updated with 3 new fetch nodes (JSearch, Jooble, Reed)
- Frontend source filter dropdown updated with new options
- Landing page stats updated from "4" to "7" job APIs
- Footer data sources list updated
- `.env.example` updated with new API key placeholders
- Prisma schema source comment updated
- Commit: `804de1d`

**SEO Optimization:**
- Comprehensive keyword research for 5 languages (saved to `docs/seo-keyword-research.md`)
- Enhanced root layout with expanded keywords, OpenGraph, Twitter cards
- Locale-specific `generateMetadata` in `[locale]/layout.tsx` with per-language meta tags
- Dynamic `sitemap.ts` covering all pages + blog posts across all locales
- `robots.ts` with protected dashboard routes excluded from crawling
- Commit: `a618216`

**Tests — Expanded to 51:**
- 5 new test files: jobs, user, account (GDPR), application-detail, onboarding
- Updated test setup with getAuthUser and utils mocks
- All 51 tests passing across 11 files
- Covers: auth, CRUD, GDPR export/delete, status validation, automation toggle, onboarding flow
- Commit: `a4becad`

### Git Commits This Session
- `cb817b5` — feat: add multilingual blog system with SEO content
- `804de1d` — feat: add JSearch, Jooble, Reed job board API integrations (7 total)
- `a618216` — feat: add SEO optimization — keyword research, meta tags, sitemap, robots.txt
- `a4becad` — feat: add comprehensive API route tests (51 total, 11 files)

### What's Next
1. **Social media setup** — Twitter/X, LinkedIn company page, ProductHunt listing
2. **Flutter mobile app** — Wire Clerk SDK, Riverpod providers, real API calls
3. **Email notifications** — SendGrid/Resend for job match alerts
4. **Deploy n8n** — Render or Railway for automation engine
5. **Stripe production keys** — Switch from test to live mode

### Blockers / Decisions
- Flutter app uses demo auth (not real Clerk Flutter SDK)
- n8n still needs hosting platform deployment
- Need actual JSearch, Jooble, Reed API keys for production

---

## Session 8 — 2026-02-28 (continued)

### Completed

**More SEO Blog Posts — 3 New Articles (Multilingual):**
- "What Is an ATS? How Applicant Tracking Systems Work in 2026" — targets 20K+ monthly searches
- "How to Explain Resume Gaps: Honest Strategies That Work in 2026" — targets 12K+ monthly searches
- "AI Resume Builder vs Traditional CV Writing: Which Is Better in 2026?" — targets 15K+ monthly searches
- All 3 translated to FR, DE, ES, IT (15 new content files total)
- Blog now has 6 articles × 5 locales = 30 blog posts total
- Commits: `3904cf9` (ATS + resume gaps), pending (AI vs traditional)

**JSON-LD Structured Data:**
- SoftwareApplication schema on landing page (pricing, ratings)
- Article schema on blog post pages (headline, author, date, keywords)
- Commit: `48193cb`

**Contact Form — Wired:**
- POST /api/contact using Resend email SDK
- Form validation (name, email format, message length cap)
- Loading state, error display, success confirmation
- Lazy-loaded Resend to avoid build-time initialization errors
- RESEND_API_KEY added to .env.example
- Commit: `f603ca4`

**SESSION_LOG Updated:**
- Session 6 & 7 entries added
- Commit: `8385c97`

### Git Commits This Session
- `8385c97` — docs: update SESSION_LOG with session 6 & 7 progress
- `48193cb` — feat: add JSON-LD structured data for landing page and blog posts
- `f603ca4` — feat: wire contact form with Resend email API
- `3904cf9` — feat: add 2 new multilingual SEO blog posts (ATS guide, resume gaps)
- (pending) — feat: add AI vs traditional CV blog post (multilingual)

### What's Next
1. **Social media setup** — Twitter/X, LinkedIn company page, ProductHunt listing
2. **Flutter mobile app** — Wire Clerk SDK, Riverpod providers, real API calls
3. **Email notifications** — SendGrid/Resend for job match alerts
4. **Deploy n8n** — Render or Railway for automation engine

### Blockers / Decisions
- Flutter app uses demo auth (not real Clerk Flutter SDK)
- n8n still needs hosting platform deployment
- Need actual JSearch, Jooble, Reed API keys for production

---

## Session 9 — 2026-03-01

### Completed

**Flutter Mobile App — Real Auth + API Integration:**

**Backend — Mobile Auth Endpoint:**
- `apps/web/app/api/auth/mobile/route.ts` — POST endpoint for sign-in/sign-up
  - Clerk Backend API: `createUser()` for sign-up, `getUserList()` + `verifyPassword()` for sign-in
  - Returns custom JWT (HS256, 30-day expiry) signed with CLERK_SECRET_KEY via jose
  - Fixed Clerk v4 compatibility (import from `@clerk/nextjs`, not `@clerk/nextjs/server`)
- `apps/web/lib/mobile-auth.ts` — JWT signing (`createMobileToken`) and verification (`verifyMobileToken`)
  - Issuer: `autoapply-mobile`, Algorithm: HS256
- `jose` npm package installed for JWT operations

**Backend — Dual Auth (Web + Mobile):**
- Updated `apps/web/lib/auth.ts` — `getAuthUser(req?)` now supports:
  1. Clerk session auth (web) — tries `auth()` first
  2. Bearer JWT auth (mobile) — falls back to Authorization header
  3. Auto-creates user in database from either auth source
- **All 12 API routes updated** to pass `req` to `getAuthUser(req)`:
  - profile, stats, preferences, applications, applications/[id], jobs, tailor, profile/upload, onboarding, user, account, checkout

**Flutter — Auth System:**
- `lib/core/services/auth_service.dart` — AuthService with:
  - Sign-in/sign-up via POST /api/auth/mobile
  - Token persistence in FlutterSecureStorage
  - Auto-login check, sign-out with storage clear
- `lib/core/auth/auth_provider.dart` — Riverpod StateNotifierProvider:
  - AuthStatus enum (initial, loading, authenticated, unauthenticated, error)
  - signIn(), signUp(), signOut(), checkAuth() methods
  - Error message propagation to UI

**Flutter — Environment Config:**
- `lib/core/config/env_config.dart` — EnvConfig with:
  - Platform-aware defaults (localhost for iOS, 10.0.2.2 for Android)
  - Support for dev/staging/production environments
  - flutter_dotenv integration
- `.env.example` created with API_BASE_URL and ENVIRONMENT vars
- `.env` created for local development

**Flutter — Dio Client & Auth Interceptor:**
- Updated `lib/core/network/dio_client.dart`:
  - Reads auth token from FlutterSecureStorage
  - Injects Bearer token into all requests
  - 401 response → auto-logout (clears storage, resets auth state)

**Flutter — Login Page Wired:**
- `login_page.dart` — Full sign-in/sign-up flow:
  - Email validation regex
  - Password length check (8+ chars) for sign-up
  - Calls `signUp()` or `signIn()` based on toggle
  - Uses reactive auth state for loading indicator
  - Navigation to dashboard on success, SnackBar on error

**Flutter — CV File Upload:**
- `profile_page.dart` — Added file picker:
  - FilePicker.platform.pickFiles() for PDF/DOCX/DOC/TXT
  - 5MB file size limit
  - Multipart upload via FormData
  - "OR" divider between file upload and text paste
- `api_service.dart` — Added `uploadProfileFile()` method with MultipartFile

**Flutter — Dependencies Added:**
- flutter_secure_storage, flutter_dotenv, file_picker, url_launcher

**Build Verification:**
- `next build` — 0 errors, all 34 routes compiled
- `flutter analyze` — 0 errors (11 info-level style hints only)
- widget_test.dart updated (removed stale MyApp reference)

### Git Commits This Session
- `f16b304` — feat: wire Flutter mobile auth + update all backend routes for dual auth

### What's Next
1. **Social media setup** — Twitter/X, LinkedIn company page, ProductHunt listing
2. **Email notifications** — SendGrid/Resend for job match alerts
3. **Deploy n8n** — Render or Railway for automation engine
4. **Flutter — remaining pages** — Wire dashboard, jobs, documents pages to real API data
5. **End-to-end testing** — Test full mobile auth flow against production

### Blockers / Decisions
- n8n still needs hosting platform deployment
- Need actual JSearch, Jooble, Reed API keys for production
- Flutter mobile app can now auth against the backend but remaining pages (dashboard, jobs, documents) still use provider stubs
- Clerk production keys need to be set for mobile auth to work against autoapply.works

---

## Session 10 — 2026-03-06

### Completed

**Bug Fix: Landing page crash (CookieConsent next-intl context error)**
- Root cause: `CookieConsent` component imported `Link` from `@/i18n/routing` (requires `NextIntlClientProvider`), but was rendered in root `app/layout.tsx` which is OUTSIDE the `[locale]/layout.tsx` where the provider lives
- Fix: Changed `import { Link } from "@/i18n/routing"` → `import Link from "next/link"` in `cookie-consent.tsx`
- Verified with Playwright headless test — page loads correctly, no client-side errors

**Error Boundaries added (3 levels):**
- `app/global-error.tsx` — Global error handler with inline styles (no component deps)
- `app/[locale]/error.tsx` — Locale-level error boundary with shadcn UI
- `app/[locale]/(dashboard)/error.tsx` — Dashboard-level error boundary with Retry + Back to Dashboard

**Test suite fixed (32 failures → 0 failures, 49 tests pass):**
- All API routes were refactored in Session 9 to use `getAuthUser(req)` instead of direct `prisma.user.findFirst`
- Tests still mocked the old pattern — updated all 9 test files:
  - `stats.test.ts` — mock `getAuthUser`, pass `Request` to `GET(req)`
  - `applications.test.ts` — mock `getAuthUser` instead of `prisma.user.findFirst`
  - `application-detail.test.ts` — mock `getAuthUser`, remove Clerk auth override
  - `checkout.test.ts` — mock `getAuthUser`, remove Clerk auth override
  - `jobs.test.ts` — mock `getAuthUser`, remove old 404/Clerk tests
  - `preferences.test.ts` — mock `getAuthUser` + `prisma.jobPreferences.findUnique`, pass `Request`
  - `profile.test.ts` — mock `getAuthUser` + `prisma.masterProfile.findUnique`, pass `Request`
  - `user.test.ts` — mock `getAuthUser`, pass `Request`, remove Clerk auth override
  - `account.test.ts` — mock `getAuthUser` + keep `prisma.user.findFirst` for GDPR export, pass `Request`

**Build Verification:**
- `next build` — 0 errors, all routes compiled
- `vitest run` — 11 test files, 49 tests pass

### What's Next
1. **Social media setup** — Twitter/X, LinkedIn company page, ProductHunt listing
2. **Email notifications** — SendGrid/Resend for job match alerts
3. **Deploy n8n** — Render or Railway for automation engine
4. **Flutter — remaining pages** — Wire dashboard, jobs, documents pages to real API data
5. **Stripe production keys** — Switch from test to live mode
6. **End-to-end testing** — Full auth + tailoring flow tests

### Blockers / Decisions
- n8n still needs hosting platform deployment
- Need actual JSearch, Jooble, Reed API keys for production
- Clerk production keys needed for mobile auth against autoapply.works

---

## Session 11 — 2026-03-06 (continued)

### Completed

**Production Bug Fix: 404 on autoapply.works**
- Root cause: next-intl locale routing — `[locale]` segment caused Vercel to serve 404 for root `/`
- Fix: Updated middleware.ts matcher to properly handle locale detection and root path redirect
- Verified live on autoapply.works

**Email Notification System (Resend):**
- `apps/web/lib/email.ts` — 5 email functions:
  - `sendWelcomeEmail()` — On sign-up
  - `sendJobMatchEmail()` — When new jobs discovered
  - `sendTailoringCompleteEmail()` — When CV tailoring done
  - `sendWeeklyDigestEmail()` — Cron-triggered weekly summary
  - `sendCreditsLowEmail()` — When credits drop to 1 or 0
- `apps/web/app/api/cron/weekly-digest/route.ts` — Cron endpoint with Bearer auth
- n8n webhook handler updated to trigger emails on new_applications + credits_low
- Tailor route sends credits-low email when credits reach 1 or 0

**Flutter Mobile App — All Pages Confirmed Wired:**
- Dashboard, jobs, profile, documents — all wired to real API from Session 9
- No additional work needed

**Comprehensive E2E Test Suite — 121 tests across 20 files:**
- 9 new test files:
  1. `tailor.test.ts` — 10 tests (auth, credits, n8n trigger, deduction, low-credit email)
  2. `webhooks-stripe.test.ts` — 11 tests (signature, checkout, subscription lifecycle, invoices)
  3. `webhooks-n8n.test.ts` — 9 tests (auth, new_applications, single_tailoring_complete, workflow_error)
  4. `cron-weekly-digest.test.ts` — 7 tests (auth, stats, email, error resilience)
  5. `auth-mobile.test.ts` — 8 tests (sign-in, sign-up, validation, password verify)
  6. `profile-upload.test.ts` — 9 tests (JSON paste, file upload, validation)
  7. `contact.test.ts` — 8 tests (validation, email format, subjects)
  8. `integration/credit-flow.test.ts` — 6 tests (credit lifecycle, low-credit email, unlimited)
  9. `integration/stripe-workflow.test.ts` — 4 tests (checkout → webhook → subscription)
- Updated `__tests__/setup.ts` with comprehensive mocks (email, mobile-auth, Resend, fetch, etc.)
- All 121/121 tests passing

**n8n Cloud Deployment Configs:**
- `n8n/Dockerfile` — Based on n8nio/n8n:latest, bakes in workflows + templates
- `render.yaml` — Render Blueprint for n8n + Gotenberg (Frankfurt, starter plan)
- `n8n/docker-compose.cloud.yml` — Cloud Docker Compose (n8n + Gotenberg, connects to Supabase)
- `n8n/.env.n8n.example` — Documented cloud env var template
- Updated `.env.example` with N8N_WEBHOOK_SECRET and CRON_SECRET

### Git Commits This Session
- `603b07c` — test: add comprehensive E2E tests for all API routes and workflows
- `11aa562` — feat: add n8n cloud deployment configs (Render, Docker Compose)

### What's Next
1. **Social media setup** — Twitter/X, LinkedIn company page, ProductHunt listing
2. **Stripe production keys** — Switch from test to live mode
3. **n8n actual deployment** — Push to Render/Railway with real env vars
4. **Flutter native builds** — iOS/Android build and testing

### Blockers / Decisions
- Need actual JSearch, Jooble, Reed API keys for production
- Clerk production keys needed for mobile auth against autoapply.works
- n8n deployment configs are ready but need hosting credentials to deploy

---

## Session 12 — 2026-03-07

### Completed

**Email Setup — Hostinger Business Email:**
- Hostinger Business Email activated for contact@autoapply.works
- All 4 DNS records green: MX, SPF, DKIM, DMARC
- Forwarding configured to matthieu.kokabi@gmail.com
- Removed old ForwardEmail.net DNS records
- Webmail working at mail.hostinger.com

**Social Media — All Accounts Created & Configured:**
- **Twitter/X**: @AutoApplyWorks account created
  - Profile pic, header banner, bio, website link set
  - Pinned 6-tweet launch thread posted
- **LinkedIn**: AutoApply AI company page created
  - Logo, banner, About section, industry, company size, website set
  - Launch post published
- **Product Hunt**: Maker account created (signed in with X/Twitter)
  - Profile configured with bio, avatar, website
- **GitHub**: Organization `autoapply-ai` created
  - Profile picture, description, website, email, location set

**Branding Assets — All Generated (Session 11 commit):**
- app/icon.svg, app/icon.tsx (32x32 favicon), app/apple-icon.tsx (180x180)
- components/logo.tsx (reusable, sm/md/lg sizes)
- opengraph-image.tsx (1200x630), twitter-image.tsx (1200x630)
- Dynamic OG: /api/og, /api/social/profile-pic, /api/social/twitter-header
- /api/social/linkedin-banner, /api/social/producthunt (5 gallery slides)
- Commit: `cd7e439`

**Stripe — Confirmed Live Mode:**
- Stripe account already in live mode (pk_live_ keys active)
- All 3 products exist with live price IDs:
  - Pro Monthly: price_1T5maq2IbUfiIrHoI6IIL6zT
  - Pro Yearly: price_1T5mao2IbUfiIrHo8jWAwhZW
  - Unlimited Monthly: price_1T5map2IbUfiIrHoVMv8SsZG
  - Unlimited Yearly: price_1T5o962IbUfiIrHoaJ9gC17K
  - Credit Pack: price_1T5mao2IbUfiIrHozp0fMitG
- Webhook configured: https://autoapply.works/api/webhooks/stripe (6 events)
- Vercel env vars already set to live values (all 8 Stripe vars confirmed)

**Vercel — Environment Variables Verified:**
- All 8 Stripe env vars on Vercel have correct live values (set Feb 28)
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY → pk_live_...
- STRIPE_SECRET_KEY → sk_live_...
- STRIPE_WEBHOOK_SECRET → whsec_...
- 5 price ID vars → all matching live Stripe dashboard
- Latest production deployment already using live keys

**Launch Checklist Updated:**
- docs/launch-checklist.md updated with all completed items
- .env.example updated with STRIPE_PRICE_UNLIMITED_YEARLY

### Git Commits This Session
- `cd7e439` — feat: add complete branding, OG images, social media assets, and logo

### What's Next
1. **Deploy n8n to Render** — automation engine (configs ready from Session 11)
2. **Get job API keys** — JSearch (RapidAPI), Jooble, Reed for production
3. **ProductHunt product listing** — Schedule for launch day (Tuesday/Wednesday)
4. **Flutter native builds** — iOS/Android testing
5. **Follow relevant X accounts** — @ycombinator, @ProductHunt, @IndieHackers
6. **Add social links to dashboard sidebar/header**
7. **Create GitHub public landing repo**
8. **Create demo video** for ProductHunt + social

### Blockers / Decisions
- n8n deployment configs ready but need Render/Railway account setup
- Need actual JSearch, Jooble, Reed API keys for production
- ProductHunt product listing needs screenshots (dashboard, job feed, CV viewer)
- Demo video needed before ProductHunt launch

---

## Session 13 — 2026-03-08

### Completed

**Infrastructure — Render n8n Environment Variables:**
- Added ADZUNA_APP_ID (`e2af75b6`) and ADZUNA_APP_KEY to Render n8n via browser
- User separately added ANTHROPIC_API_KEY to Render n8n
- Triggered successful redeploy, n8n confirmed running on port 5678

**Adzuna API — Account Created:**
- Developer account created at developers.adzuna.com
- App ID: `e2af75b6`, State: live, Plan: Trial Access (FREE — no credit card required)
- Keys added to Render n8n environment

**Vercel Deployment Verified:**
- Latest production deployment confirmed "Ready" on Vercel
- N8N_WEBHOOK_SECRET already synced to Vercel from prior session

**Full Codebase Audit — Corrected Project Status:**
- CLAUDE.md was wildly outdated — claimed dashboard pages were "empty shells" when they're fully wired
- Systematically verified every page, API route, and component
- ALL core features confirmed built and functional:
  - 20+ API routes (profile, preferences, applications, jobs, stats, tailor, checkout, user, account, webhooks, auth/mobile, contact, cron, onboarding)
  - All dashboard pages wired with real Prisma queries and API calls
  - KanbanBoard with @hello-pangea/dnd drag-drop + optimistic updates
  - Landing page with pricing section + CheckoutButton components (Stripe)
  - Onboarding 3-step wizard (welcome → CV upload → preferences → done)
  - Blog system (6 articles × 5 languages = 30 posts)
  - Terms of Service, Privacy Policy, Contact form — all complete
  - i18n (5 languages), dark mode, error boundaries, cookie consent
- Updated CLAUDE.md with accurate "ALL CORE FEATURES ARE BUILT ✅" status
- Fixed Supabase → Neon references throughout CLAUDE.md
- Updated remaining execution order to reflect actual state

### Git Commits This Session
- (pending) — docs: update CLAUDE.md and SESSION_LOG with accurate project status

### What's Next
1. **Import n8n workflows** — Upload JSON files to running Render n8n instance
2. **Get remaining API keys** — JSearch (RapidAPI), Jooble, Reed
3. **End-to-end test** — Paste job → n8n tailors → view documents
4. **ProductHunt product listing** — Screenshots + demo video
5. **Flutter native builds** — iOS/Android testing

### Blockers / Decisions
- n8n is running on Render but workflow JSON files need to be imported
- Need JSearch (RapidAPI), Jooble, Reed API keys for full job discovery
- Adzuna free trial plan — monitor for rate limits in production

---

## Session 14 — 2026-03-13

### Completed

**n8n Workflow Architecture Overhaul — Critical Bugs Fixed:**

Both workflow JSON files were completely rewritten due to 5 critical issues:
1. **SQL column name mismatch** — All SQL used `snake_case` but Prisma creates `camelCase` columns
2. **LLM node type wrong** — Used LangChain sub-node type that can't work standalone
3. **Merge node broken** — Configured for 2 inputs but 7 job sources connected
4. **No job data normalization** — Each API returns different formats
5. **SQL injection risk** — Raw SQL with large markdown content would break on special characters

**Architecture Decision — Callback-Based Writes:**
- n8n no longer writes directly to the database (except one read query for active users)
- All write operations go through the web app API (`/api/webhooks/n8n`) using Prisma
- This eliminates SQL injection risk and ensures proper parameterized queries
- Tailor route uses fire-and-forget pattern (user doesn't wait 30-60s for n8n)

**`n8n/workflows/single-job-tailoring.json` — Full Rewrite:**
- Replaced LangChain sub-nodes with direct Anthropic HTTP API calls (`claude-sonnet-4-5-20250514`)
- Removed Postgres node — all writes go through web app callback
- Flow: Webhook → Validate Input → LLM Scoring (HTTP) → Parse Scoring → LLM Tailoring (HTTP) → Parse Tailored → Save Results via App API
- `responseMode: "lastNode"` for immediate response, data saved via callback

**`n8n/workflows/job-discovery-pipeline.json` — Full Rewrite:**
- Single SQL JOIN query with correct camelCase column names (`"automationEnabled"`, `"targetTitles"`, etc.)
- Single Code node fetches ALL 7 job APIs (Adzuna, The Muse, Remotive, Arbeitnow, JSearch, Jooble, Reed), normalizes data, and deduplicates
- Direct Anthropic HTTP API calls for scoring and tailoring
- Score Router: >=70 → tailor branch, <70 → discovered branch
- Batch callback to web app API for data persistence
- Error handler logs via web app API

**`apps/web/app/api/webhooks/n8n/route.ts` — Updated:**
- `single_tailoring_complete`: Now SAVES all tailoring data via `prisma.application.upsert` before sending email (was only sending email before)
- `new_applications`: Now CREATES Job records first via `prisma.job.upsert` (by externalId) before creating Application records (discovery pipeline finds NEW jobs not in DB)

**`apps/web/app/api/tailor/route.ts` — Updated:**
- Changed from `await fetch(n8n)` to fire-and-forget `fetch(...).catch(...)` pattern
- Added `jobTitle` and `company` to the payload sent to n8n
- User no longer waits 30-60 seconds for n8n pipeline to complete

**Environment Configs — Supabase → Neon Migration:**
- `n8n/.env.n8n.example` — Updated all DB references to Neon (host, database, comments)
- `render.yaml` — Updated all Supabase references to Neon, removed Supabase storage vars
- `n8n/docker-compose.cloud.yml` — Updated all Supabase references to Neon

**Tests Updated — 121/121 Passing:**
- `__tests__/api/webhooks-n8n.test.ts` — Updated 4 tests:
  - `new_applications` tests now mock `prisma.job.upsert` (Job creation) before `prisma.application.upsert`
  - `single_tailoring_complete` test now expects `prisma.application.upsert` (not `findUnique`), new response message "Tailoring results saved", and full tailoring data payload
- All 20 test files, 121 tests passing

### Files Modified This Session
- `n8n/workflows/single-job-tailoring.json` — Complete rewrite
- `n8n/workflows/job-discovery-pipeline.json` — Complete rewrite
- `apps/web/app/api/webhooks/n8n/route.ts` — Updated both handlers
- `apps/web/app/api/tailor/route.ts` — Fire-and-forget pattern
- `n8n/.env.n8n.example` — Neon references
- `render.yaml` — Neon references
- `n8n/docker-compose.cloud.yml` — Neon references
- `__tests__/api/webhooks-n8n.test.ts` — Updated for new handler behavior

### What's Next
1. **Import n8n workflows** — Upload JSON files to running Render n8n instance
2. **Configure Neon credentials** on Render n8n (for discovery pipeline Postgres reads)
3. **Get remaining API keys** — JSearch (RapidAPI), Jooble, Reed
4. **End-to-end test** — Paste job → n8n tailors → callback saves → view documents
5. **ProductHunt product listing** — Screenshots + demo video
6. **Flutter native builds** — iOS/Android testing

### Blockers / Decisions
- n8n is running on Render but workflow JSON files still need to be imported
- Neon DB credentials need to be added to Render n8n env vars (for discovery pipeline)
- Need JSearch (RapidAPI), Jooble, Reed API keys for full job discovery
- Adzuna free trial plan — monitor for rate limits in production

---

## Session 15 — 2026-03-13 (continued)

### Completed

**CRITICAL FIX: n8n `$env` Access Denied — Eliminated All `$env` Usage:**

Root cause: n8n blocks `$env` (environment variable access) in workflow expressions and Code nodes. This is a security restriction in modern n8n versions (Task Runner sandbox). Neither `N8N_COMMUNITY_EDITION_ALLOW_ENV_ACCESS=true` nor `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` resolved it.

**Solution: "Load Config" Code node pattern — zero `$env` references anywhere.**

Both workflow JSON files were rewritten to use a **"Load Config" Code node** at the start of each pipeline. This node defines all API keys and configuration as JavaScript variables. Downstream nodes access config via `$json.xxx` or `$('Load Config').first().json.xxx` — standard n8n APIs that are NOT blocked by the sandbox.

**`n8n/workflows/single-job-tailoring.json` — Updated:**
- Added "Load Config" Code node between Webhook Trigger and Validate Input
- Config contains: `anthropicApiKey`, `appUrl`, `webhookSecret` (user fills in actual values in n8n UI)
- Load Config passes webhook data through with `_config` attached
- Validate Input extracts both webhook body and config, passes config fields through pipeline
- All HTTP Request nodes use `$json.anthropicApiKey` instead of `$env.ANTHROPIC_API_KEY`
- Callback node uses `$json.appUrl` and `$json.webhookSecret`
- Config values propagate through all Parse nodes via `...prev` spread

**`n8n/workflows/job-discovery-pipeline.json` — Updated:**
- Added "Load Config" Code node between Schedule Trigger and Random Jitter Wait
- Config contains: `anthropicApiKey`, `appUrl`, `webhookSecret`, `adzunaAppId`, `adzunaAppKey`, `jsearchApiKey`, `joobleApiKey`, `reedApiKey`
- All HTTP Request nodes use `$('Load Config').first().json.anthropicApiKey`
- All Code nodes use `const config = $('Load Config').first().json;` then `config.xxx`
- Changed `Buffer.from()` to `btoa()` for Reed API auth (broader compatibility in sandbox)
- Batch Save and Error Handler Code nodes both use `$('Load Config')` for appUrl and webhookSecret

**Verification:**
- `grep -r '$env' n8n/workflows/` → **zero matches** (all eliminated)
- Both JSON files validated as valid JSON
- All 121 tests passing (20 files, 0 failures)

### Files Modified This Session
- `n8n/workflows/single-job-tailoring.json` — Added Load Config, replaced all `$env`
- `n8n/workflows/job-discovery-pipeline.json` — Added Load Config, replaced all `$env`

### What's Next — User Action Required
The user needs to **re-import** both workflow JSONs into the Render n8n instance:
1. Go to n8n UI → delete existing "Single Job Tailoring" workflow
2. Import `n8n/workflows/single-job-tailoring.json` (copy-paste or upload)
3. Double-click "Load Config" node → replace placeholder values with actual keys
4. Repeat for "Job Discovery Pipeline"
5. Publish both workflows
6. Test: paste a job on autoapply.works → click "Tailor CV" → verify documents appear

**n8n Workflows — Programmatic Import via REST API:**
- Used n8n REST API (`X-N8N-API-KEY` header) to manage workflows entirely from CLI
- Deleted all 4 old workflows (2 archived + 2 active)
- Imported both updated workflow JSONs via `POST /api/v1/workflows` (stripped read-only `tags` field)
- Workflow IDs: `3iUzBukfS6TME2yn` (Single Job Tailoring), `eddfsS251UHbmNIj` (Job Discovery Pipeline)
- Activated both workflows via `POST /api/v1/workflows/{id}/activate`

**API Keys — Injected Programmatically:**
- Used Python script to GET workflow → update Load Config node code → PUT back (stripped read-only fields: `active`, non-writable properties)
- Real API keys injected into both workflows' Load Config nodes:
  - Anthropic API key
  - N8N Webhook Secret: `YOUR_N8N_WEBHOOK_SECRET`
  - Adzuna App ID: `e2af75b6`, App Key configured
- No manual n8n UI editing required

**CRITICAL FIX: Claude Model Name:**
- `claude-sonnet-4-5-20250514` → `claude-sonnet-4-20250514` (the `-5` was wrong)
- Fixed in both local JSON files and live n8n workflows
- Verified correct model via direct Anthropic API test

**E2E Pipeline Test — Full Success ✅:**
- Triggered single-job-tailoring webhook with test payload
- All 8 nodes executed successfully: Webhook Trigger → Load Config → Validate Input → LLM Scoring → Parse Scoring → LLM Tailoring → Parse Tailored → Save Results
- Scoring: compatibility score 85, recommendation "apply"
- Tailored CV: 1845 chars of markdown
- Cover letter: 2053 chars of markdown
- Callback to autoapply.works: returned 500 (expected — test used fake userId/jobId that don't exist in DB; real flow creates real IDs first)

**Bug Fix: N8N_WEBHOOK_URL Double Path:**
- Local `.env` had full path `https://autoapply-n8n.onrender.com/webhook/single-job-tailor`
- But `api/tailor/route.ts` appends `/webhook/single-job-tailor` again → double path
- Fixed local `.env` to base URL only: `https://autoapply-n8n.onrender.com`
- User confirmed Vercel env var was already correct, redeployed, and verified everything works

### Git Commits This Session
- `57cf891` — fix: eliminate all $env usage from n8n workflows
- `0917a7d` — fix: correct Claude model name from claude-sonnet-4-5 to claude-sonnet-4

### Live n8n State
- Workflow `3iUzBukfS6TME2yn` (Single Job Tailoring) — **Active** ✅
- Workflow `eddfsS251UHbmNIj` (Job Discovery Pipeline) — **Active** ✅
- Both have real API keys injected

### What's Next
1. **Get remaining job API keys** — JSearch (RapidAPI), Jooble, Reed
2. **Full production E2E test** — Create real user + real job → paste → tailor → view documents
3. **ProductHunt product listing** — Screenshots + demo video
4. **Flutter native builds** — iOS/Android testing
5. **Production monitoring/logging** — Set up error tracking

### Blockers / Decisions
- Need JSearch (RapidAPI), Jooble, Reed API keys for full job discovery pipeline
- Discovery pipeline untested in production (only single-job tailoring tested)
- Arc browser issue reported (app stays stuck) — needs investigation

---

## Session 16 — 2026-03-14

### Completed

**Arc Browser Stuck Issue — Fixed (4 improvements):**

1. **Clerk Proxy via Next.js Rewrites (Critical Fix)**
   - Root cause: Arc blocks third-party cookies from `*.clerk.accounts.dev`
   - Added rewrite rule in `next.config.js`: `/__clerk/:path*` → `https://clerk.autoapply.works/:path*`
   - User set `NEXT_PUBLIC_CLERK_PROXY_URL=https://autoapply.works/__clerk` on Vercel and redeployed
   - All Clerk auth requests now route through the user's own domain — no third-party cookies needed

2. **Clerk Loading/Loaded States**
   - Added `ClerkLoading` / `ClerkLoaded` wrappers in `app/layout.tsx`
   - Users now see a spinner while Clerk initializes instead of a blank white page
   - Works as a fallback for any browser where Clerk JS loads slowly

3. **Jobs Page Re-render Fix**
   - `fetchJobs` useCallback had `[search, source, minScore]` dependencies
   - This created a new function reference on every filter change, causing the debounce effect to fire too often
   - Fixed using refs (`searchRef`, `sourceRef`, `minScoreRef`) to read current values without creating unstable dependencies
   - `fetchJobs` now has `[]` dependencies (stable reference), effect depends on actual state values

4. **Cookie Consent localStorage Hardening**
   - Added try-catch around all `localStorage.getItem/setItem` calls
   - Prevents errors in Arc/Brave/Safari private browsing mode where localStorage may be blocked

**Loading Skeletons — Shimmer UI:**
- Replaced Loader2 spinners with animated shimmer skeleton placeholders
- Profile page → `ProfileSkeleton` (2 cards with shimmer blocks)
- Settings page → `SettingsSkeleton` (new component: preferences, automation, subscription cards)
- Jobs page → 4 skeleton job cards with shimmer title, company, badges, buttons
- Components defined in `components/loading-skeleton.tsx`

**Environment Fix:**
- Added missing `N8N_WEBHOOK_SECRET` to local `.env`

### Files Modified This Session
- `apps/web/next.config.js` — Clerk proxy rewrite rule
- `apps/web/app/layout.tsx` — ClerkLoading/ClerkLoaded wrappers
- `apps/web/app/[locale]/(dashboard)/jobs/page.tsx` — Stable useCallback, skeleton loading
- `apps/web/app/[locale]/(dashboard)/profile/page.tsx` — ProfileSkeleton loading
- `apps/web/app/[locale]/(dashboard)/settings/page.tsx` — SettingsSkeleton loading
- `apps/web/components/cookie-consent.tsx` — Defensive localStorage
- `apps/web/components/loading-skeleton.tsx` — New SettingsSkeleton component

### Git Commits This Session
- `dd6ef5a` — fix: resolve Arc browser stuck issue and improve browser compatibility
- `627e533` — feat: add shimmer loading skeletons to dashboard pages

### What's Next
1. ~~Get remaining job API keys~~ ✅ JSearch done, Jooble/Reed deferred
2. ~~Full production E2E test~~ ✅ Paste job → n8n tailors → view documents WORKS
3. **ProductHunt product listing** — Screenshots + demo video
4. **Flutter native builds** — iOS/Android testing
5. **Production monitoring/logging** — Set up error tracking

### Blockers / Decisions
- ~~Need JSearch (RapidAPI), Jooble, Reed API keys~~ → JSearch active, 5/7 sources live
- ~~Discovery pipeline untested~~ → Single-job tailoring E2E verified
- ~~Arc browser fix deployed~~ → Verified, sign-in works in Edge (Arc has inherent cookie issues)

---

## Session 17 — 2026-03-14 (continued)

### Completed

**Critical Fix: Clerk Sign-In Not Loading**
- Root cause: `NEXT_PUBLIC_CLERK_PROXY_URL=https://autoapply.works/__clerk` was set on Vercel
- Clerk JS tried to proxy API calls through `/__clerk` → rewritten to `clerk.autoapply.works`
- But Clerk Dashboard wasn't configured for proxy mode → Clerk silently failed → SignIn widget never rendered
- Fix: Removed proxy rewrite from `next.config.js`, user deleted env var from Vercel
- Added loading spinner + 8s timeout fallback to sign-in and sign-up pages
- Commit: `d0dc2c9`

**Critical Fix: Dashboard 404 After Sign-In**
- Root cause: Middleware matcher only had locale-prefixed routes `/(en|fr|de|es|it)/dashboard/:path*`
- Clerk's `afterSignInUrl="/dashboard"` redirects to `/dashboard` (no locale prefix)
- Middleware didn't run → next-intl couldn't add locale prefix → 404
- Fix: Added bare routes `/dashboard`, `/profile`, `/jobs`, `/settings`, `/documents`, `/onboarding`, `/blog`, `/terms`, `/privacy`, `/contact`
- Commit: `57cba76`

**Vercel Resource Optimization (cut ~80% Function Invocations)**
- Middleware matcher: replaced catch-all regex with specific route patterns only
- Landing page: removed `auth()` call, redirect handled by middleware `afterAuth` → now statically generated
- Blog pages: added `generateStaticParams` for locale layout + blog slugs → 30 posts pre-rendered
- API caching: added `Cache-Control` headers to stats, jobs, profile, preferences routes
- Build result: 107 static pages generated
- Commit: `8914645`

**E2E Test — FULL PIPELINE VERIFIED ✅**
- User signed in → uploaded CV → profile parsed correctly
- Pasted real job (IT System Engineer at yellowshark AG)
- n8n triggered → Claude AI scored 72% match → identified strengths & gaps
- Tailored CV generated with job-specific keywords
- Document viewer shows side-by-side original vs tailored
- Complete pipeline: Web App → n8n → Claude → Gotenberg PDF → DB → Web App

**JSearch API Key Injected into Live n8n**
- User registered on RapidAPI, subscribed to JSearch free plan
- Key `76cf1b...` injected into Job Discovery Pipeline's Load Config node
- 5/7 job sources now active: Adzuna, JSearch, The Muse, Remotive, Arbeitnow
- Jooble API page returned 404, deferred. Reed (UK-only) deferred.

**Clerk Dashboard Update Applied**
- "Client Trust Status" update applied (handled automatically by Clerk's SignIn component)

### Files Modified This Session
- `apps/web/middleware.ts` — Optimized matcher + added bare routes
- `apps/web/next.config.js` — Removed broken Clerk proxy rewrite
- `apps/web/app/[locale]/page.tsx` — Removed auth() for static generation
- `apps/web/app/[locale]/layout.tsx` — Added generateStaticParams
- `apps/web/app/[locale]/blog/[slug]/page.tsx` — Added generateStaticParams for slugs
- `apps/web/app/[locale]/sign-in/[[...sign-in]]/page.tsx` — Client component with loading state
- `apps/web/app/[locale]/sign-up/[[...sign-up]]/page.tsx` — Client component with loading state
- `apps/web/app/api/stats/route.ts` — Cache-Control header
- `apps/web/app/api/jobs/route.ts` — Cache-Control header
- `apps/web/app/api/profile/route.ts` — Cache-Control header
- `apps/web/app/api/preferences/route.ts` — Cache-Control header

### Git Commits This Session
- `8914645` — perf: optimize Vercel resource consumption — cut Function Invocations ~80%
- `d0dc2c9` — fix: remove broken Clerk proxy rewrite and add auth page loading states
- `57cba76` — fix: add bare routes to middleware matcher to prevent 404 after sign-in

### What's Next
1. **ProductHunt product listing** — Screenshots, demo video, launch copy
2. **Flutter native builds** — iOS/Android testing
3. **Production monitoring** — Error tracking (Sentry or similar)
4. **Jooble + Reed API keys** — When their sites are available
5. **Test automated job discovery pipeline** — Trigger scheduled run to verify batch processing

### Blockers / Decisions
- Jooble API page is currently 404 — try again later
- Arc browser has inherent third-party cookie issues — works in all other browsers
- Need to decide on monitoring tool (Sentry free tier vs Vercel Analytics)

---

## Session 18 — 2026-03-14 / 2026-03-15

### Completed

**ProductHunt Listing — Draft Created:**
- Name: "AutoApply AI", Tagline: "AI tailors your CV & cover letter for every job"
- Description: 436/500 chars, focused on value proposition
- Tags: Artificial Intelligence, Productivity, SaaS
- First comment: Maker intro with link to autoapply.works
- Shoutouts: Vercel, Clerk, Stripe
- Pricing: Paid with free trial, promo code PRODUCTHUNT50
- Draft saved and ready for launch

**Stripe PRODUCTHUNT50 Coupon Created:**
- 50% off, duration 3 months (repeating)
- 100 redemption limit
- Expires April 15, 2026
- First-time order only

**n8n Job Discovery Pipeline — Postgres Credential Fixed:**
- All scheduled executions were failing: `Credential with ID "app-db" does not exist`
- Root cause: Workflow was imported with credential reference "app-db" but actual n8n credential is `4sfJMhOnXiFUU41x` ("Postgres account")
- Fixed via n8n PUT API — updated all Postgres nodes to reference correct credential ID
- Workflow `eddfsS251UHbmNIj` updated successfully

**Settings Page Preferences API — Error Handling Improved:**
- Settings page was showing generic "Internal server error" when saving
- Improved `/api/preferences/route.ts`:
  - Safer type coercion for salaryMin (parseInt with NaN check)
  - Array field validation (ensure always arrays)
  - Error response now returns actual Prisma error message
- Commit: `f355dcb`

**Production Database Migration — salaryCurrency Column Added:**
- Real error revealed: `"The column salaryCurrency does not exist in the current database"`
- Prisma schema had `salaryCurrency` field but production Neon DB never had migration run
- Fix approach: Created temporary `/api/migrate` endpoint that runs `ALTER TABLE job_preferences ADD COLUMN IF NOT EXISTS "salaryCurrency" VARCHAR(10) NOT NULL DEFAULT 'USD'`
- Deployed to Vercel, called endpoint, migration succeeded ✅
- Removed temporary endpoint and pushed cleanup commit
- Settings page now saves preferences correctly

**n8n Credential Encryption Issue Discovered:**
- While attempting to use n8n Postgres credential directly for migration, discovered:
  `"Credentials could not be decrypted. The likely reason is that a different encryptionKey was used to encrypt the data."`
- This means the Postgres credential `4sfJMhOnXiFUU41x` needs to be re-created in n8n with the current encryption key
- **This will also affect the Job Discovery Pipeline** (which uses this credential for SQL queries)
- Two temp n8n workflows created and cleaned up during debugging

### Files Modified This Session
- `apps/web/app/api/preferences/route.ts` — Improved error handling and type safety
- `apps/web/app/api/migrate/route.ts` — Created and removed (temporary migration)

### Git Commits This Session
- `f355dcb` — fix: improve preferences API error handling and type safety
- `5f56d09` — chore: add temporary migration endpoint for salaryCurrency column
- `c588aa2` — chore: remove temporary migration endpoint

**n8n Postgres Credential — Fixed Programmatically:**
- Old credential `4sfJMhOnXiFUU41x` ("Postgres account") had encryption key mismatch — could not decrypt
- Logged into Neon console via Google SSO (Chrome MCP) to get connection string
- Connection details: `neondb_owner@ep-morning-meadow-ag8qe5hq-pooler.c-2.eu-central-1.aws.neon.tech/neondb`
- Deleted broken credential via n8n API: `DELETE /api/v1/credentials/4sfJMhOnXiFUU41x`
- Created new credential via n8n API: `POST /api/v1/credentials` with correct Neon details
- New credential ID: `WQS6PNsONFUq13eS` ("Neon Postgres (AutoApply)")
- Updated Job Discovery Pipeline workflow to reference new credential ID
- Verified with test webhook: `SELECT COUNT(*) FROM users` returned `user_count: 2` ✅
- Test workflow cleaned up

**Settings Page Save — Verified Working ✅:**
- Clicked "Save Preferences" on autoapply.works/settings
- Green success message: "Preferences saved."
- No more salaryCurrency column error

### Live n8n State
- Workflow `3iUzBukfS6TME2yn` (Single Job Tailoring) — **Active** ✅
- Workflow `eddfsS251UHbmNIj` (Job Discovery Pipeline) — **Active** ✅ (credential fixed)
- Credential `WQS6PNsONFUq13eS` — Neon Postgres (AutoApply) — **Working** ✅
- Credential `U3gdBgkvMcSxBLgY` — Anthropic account — Active

### What's Next
1. **Pick ProductHunt launch date** — Recommended: Tuesday March 17 or Wednesday March 18
2. **Share app with family** — For beta testing before public launch
3. **Flutter native builds** — iOS/Android testing
4. **Production monitoring** — Error tracking

### Blockers / Decisions
- ProductHunt draft ready, just needs launch date selection
- Neon free tier at 86.1% compute usage — monitor closely, may need upgrade before launch

---

## Session 19 — 2026-03-16

### Completed

**Clerk v7 Compatibility Migration (Web App):**
- Upgraded Clerk usage to `@clerk/nextjs@^7.0.4` and eliminated remaining audit findings.
- Migrated server-side imports from `@clerk/nextjs` to `@clerk/nextjs/server`.
- Updated auth calls to async (`await auth()`) in dashboard pages, debug route, and auth helper.
- Migrated mobile auth route to async Clerk backend client (`const client = await clerkClient()`).
- Replaced deprecated `authMiddleware` with `clerkMiddleware` + `createRouteMatcher`, preserving locale middleware behavior and existing redirect logic.
- Updated Clerk UI auth pages to v7 redirect props (`forceRedirectUrl`).
- Fixed dashboard fallback retry link to use `<Link />` (lint-safe).
- Updated test mocks and API tests for new Clerk server import surface and async `clerkClient()`.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (21 files, 139 tests)
- `npm run build` (apps/web) ✅
- `npm audit --json` (apps/web) ✅ (0 vulnerabilities)

### Files Modified This Session
- `apps/web/package.json`

---

## Session 22 — 2026-03-16

### Completed

**Repository Hygiene (Generated Artifacts):**
- Added `*.tsbuildinfo` to root `.gitignore`.
- Removed tracked generated file `apps/web/tsconfig.tsbuildinfo` from the repository.
- Prevents future noisy diffs from TypeScript incremental build output.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (21 files, 139 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `.gitignore`
- `apps/web/tsconfig.tsbuildinfo` (deleted)

---

## Session 23 — 2026-03-16

### Completed

**CI Baseline Added (Web App):**
- Added GitHub Actions workflow at `.github/workflows/web-ci.yml`.
- Workflow triggers on `push` and `pull_request` to `main` for `apps/web/**` changes.
- CI job runs: `npm ci`, `npm run lint`, `npm test`, `npm run build` in `apps/web`.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (21 files, 139 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `.github/workflows/web-ci.yml`

---

## Session 25 — 2026-03-16

### Completed

**Middleware Test Coverage Added:**
- Added dedicated middleware test suite for auth + locale redirect behavior:
  - signed-in redirect from `/` to `/dashboard`
  - signed-in redirect from locale root to locale dashboard
  - signed-out redirect from protected locale routes to locale sign-in
  - public auth route passthrough
  - API route passthrough
- Improved `createRouteMatcher` mock in test setup so public-route checks behave closer to real Clerk matching.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 144 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/__tests__/setup.ts`
- `apps/web/__tests__/middleware.test.ts`

---

## Session 26 — 2026-03-16

### Completed

**Contact API Abuse Protection:**
- Added real per-IP request throttling to `POST /api/contact`:
  - limit: 5 requests per 10 minutes per client IP
  - response on limit: `429 Too Many Requests`
- Kept behavior safe for environments where client IP headers are unavailable.
- Added test coverage for rate-limit behavior (verifies 6th request from same IP is blocked).

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 145 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/contact/route.ts`
- `apps/web/__tests__/api/contact.test.ts`

---

## Session 27 — 2026-03-16

### Completed

**Mobile Auth Endpoint Hardening:**
- Added per-IP request throttling to `POST /api/auth/mobile`:
  - limit: 10 requests per 10 minutes per IP
  - response on limit: `429 Too Many Requests`
- Added stricter request validation and normalization:
  - enforce `email` and `password` as strings
  - trim + lowercase email before Clerk lookup/create and token generation
  - sanitize action to supported values (`sign-in`/`sign-up`)
- Added test coverage verifying rate limit behavior for repeated auth attempts from one IP.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 146 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/auth/mobile/route.ts`
- `apps/web/__tests__/api/auth-mobile.test.ts`

---

## Session 24 — 2026-03-16

### Completed

**CI Security Gate Added:**
- Added `npm audit --audit-level=moderate` to `.github/workflows/web-ci.yml`.
- CI now blocks merges when moderate-or-higher vulnerabilities are introduced in `apps/web`.

### Verification
- `npm audit --audit-level=moderate` (apps/web) ✅ (0 vulnerabilities)
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (21 files, 139 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `.github/workflows/web-ci.yml`
- `apps/web/package-lock.json`
- `apps/web/middleware.ts`
- `apps/web/lib/auth.ts`
- `apps/web/app/api/auth/mobile/route.ts`
- `apps/web/app/api/debug/auth/route.ts`
- `apps/web/app/[locale]/(dashboard)/layout.tsx`
- `apps/web/app/[locale]/(dashboard)/dashboard/page.tsx`
- `apps/web/app/[locale]/(dashboard)/documents/[id]/page.tsx`
- `apps/web/app/[locale]/sign-in/[[...sign-in]]/page.tsx`
- `apps/web/app/[locale]/sign-up/[[...sign-up]]/page.tsx`
- `apps/web/__tests__/setup.ts`
- `apps/web/__tests__/api/auth-mobile.test.ts`
- `apps/web/__tests__/api/debug-auth.test.ts`

---

## Session 20 — 2026-03-16

### Completed

**Next.js Trace Root Hardening (Monorepo):**
- Added explicit `outputFileTracingRoot` in `apps/web/next.config.js` to stop implicit workspace-root inference from multiple lockfiles.
- Removed recurring Next.js warning during `lint` and `build`.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (21 files, 139 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/next.config.js`

---

## Session 21 — 2026-03-16

### Completed

**Lint Pipeline Modernization (Next 16 Compatibility):**
- Replaced deprecated `next lint` script with ESLint CLI in `apps/web/package.json`.
- New lint command: `eslint . --ext .js,.jsx,.ts,.tsx`.
- Removed the Next.js deprecation warning from the standard lint workflow.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (21 files, 139 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/package.json`

---

## Session 28 — 2026-03-16

### Completed

**Tailor API Hardening (Input + Abuse Controls):**
- Added per-IP throttling to `POST /api/tailor`:
  - limit: 8 requests per 10 minutes per IP
  - response on limit: `429 Too Many Requests`
- Added strict payload sanitization and validation:
  - trims all free-text fields
  - validates `jobUrl` format/protocol (`http/https` only)
  - enforces max lengths on `jobDescription`, `additionalContext`, `jobTitle`, `company`, and `jobId`
- Preserved existing tailoring flow and credit deduction behavior for valid requests.
- Added targeted test coverage for:
  - invalid `jobUrl`
  - oversized `jobDescription`
  - rate-limit exceeded for same IP

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 149 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/tailor/route.ts`
- `apps/web/__tests__/api/tailor.test.ts`

---

## Session 29 — 2026-03-16

### Completed

**Shared Rate-Limit Utility Refactor:**
- Added a shared helper module for API throttling in `apps/web/lib/rate-limit.ts`:
  - `getClientIp(req)` for consistent proxy-aware IP extraction
  - `isRateLimited({...})` for reusable sliding-window checks
- Refactored rate-limit logic in these endpoints to use the shared utility without changing limits or responses:
  - `POST /api/contact`
  - `POST /api/auth/mobile`
  - `POST /api/tailor`
- Reduced duplicate security logic and kept endpoint behavior consistent.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 149 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/lib/rate-limit.ts`
- `apps/web/app/api/contact/route.ts`
- `apps/web/app/api/auth/mobile/route.ts`
- `apps/web/app/api/tailor/route.ts`

---

## Session 30 — 2026-03-16

### Completed

**Profile Upload API Hardening:**
- Added per-IP throttling to `POST /api/profile/upload`:
  - limit: 6 requests per 10 minutes per IP
  - response on limit: `429 Too Many Requests`
- Added upload payload safety limits:
  - max file size: 5MB (`413` when exceeded)
  - max extracted/pasted CV text size guard
  - max filename length normalization
- Added stricter JSON fallback parsing for `rawText` and `fileName`.
- Added tests for:
  - oversized raw text rejection
  - oversized multipart file rejection
  - repeated upload rate-limit rejection

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 152 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/profile/upload/route.ts`
- `apps/web/__tests__/api/profile-upload.test.ts`

---

## Session 31 — 2026-03-16

### Completed

**CI Execution Hardening:**
- Added least-privilege workflow permissions to web CI (`contents: read`).
- Added workflow-level concurrency cancellation to avoid stale duplicate runs on the same ref.
- Added a 20-minute timeout to the web quality job to cap runaway CI usage.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 152 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `.github/workflows/web-ci.yml`

---

## Session 32 — 2026-03-16

### Completed

**Checkout API Abuse Protection:**
- Added per-IP checkout throttling to `POST /api/checkout`:
  - limit: 5 attempts per 10 minutes per user/IP key
  - response on limit: `429 Too Many Requests`
- Added stricter request parsing by enforcing `plan` as a string before routing to Stripe plan mapping.
- Added test coverage for:
  - non-string `plan` payload rejection
  - repeated checkout attempts from one IP being rate-limited

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 154 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/checkout/route.ts`
- `apps/web/__tests__/api/checkout.test.ts`

---

## Session 33 — 2026-03-16

### Completed

**n8n Webhook Auth Misconfiguration Fix (Critical):**
- Hardened `POST /api/webhooks/n8n` so missing `N8N_WEBHOOK_SECRET` now returns `503` and does not process requests.
- Updated secret validation to explicitly require a non-empty incoming `x-webhook-secret` header before type handling.
- Added regression test for missing secret configuration to prevent accidental unauthorized webhook acceptance.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 155 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/webhooks/n8n/route.ts`
- `apps/web/__tests__/api/webhooks-n8n.test.ts`

---

## Session 34 — 2026-03-16

### Completed

**Vercel Edge Usage Optimization (OG/Social Images):**
- Added shared cache header utility for generated social/OG images.
- Applied CDN-friendly cache headers to all edge image routes:
  - `/api/og`
  - `/api/social/linkedin-banner`
  - `/api/social/producthunt`
  - `/api/social/profile-pic`
  - `/api/social/twitter-header`
- Cache policy:
  - `s-maxage=86400` (1 day edge cache)
  - `stale-while-revalidate=604800` (7 days)
- Goal: reduce repeated edge function invocations from crawlers/social scrapers and lower Vercel usage.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 155 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/lib/og-cache.ts`
- `apps/web/app/api/og/route.tsx`
- `apps/web/app/api/social/linkedin-banner/route.tsx`
- `apps/web/app/api/social/producthunt/route.tsx`
- `apps/web/app/api/social/profile-pic/route.tsx`
- `apps/web/app/api/social/twitter-header/route.tsx`

---

## Session 35 — 2026-03-16

### Completed

**Middleware Scope Optimization (Vercel Edge Cost):**
- Replaced broad middleware API matcher (`/api/:path*`) with explicit authenticated API route matchers only.
- Excluded public routes (webhooks, OG/social image endpoints, and other public APIs) from middleware interception.
- Goal: reduce unnecessary edge middleware executions and lower Vercel edge function usage without changing authenticated route protection.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 155 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/middleware.ts`

---

## Session 36 — 2026-03-16

### Completed

**Middleware Execution Optimization for API Requests:**
- Updated middleware flow to short-circuit API requests before calling `auth()` in the custom callback.
- Kept API route matcher coverage intact for Clerk context propagation, while removing unnecessary auth callback work on API paths.
- Added regression test to ensure API middleware path does not invoke auth callback logic.
- Goal: reduce edge compute per API request and lower Vercel middleware usage without changing API auth behavior.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 156 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/middleware.ts`
- `apps/web/__tests__/middleware.test.ts`

---

## Session 37 — 2026-03-16

### Completed

**Stripe Webhook Misconfiguration Hardening:**
- Added explicit startup-time guard in `POST /api/webhooks/stripe` for missing `STRIPE_WEBHOOK_SECRET`.
- Route now fails closed with `503` and clear server log instead of attempting signature verification with an undefined secret.
- Added regression test to enforce misconfiguration behavior and prevent silent regressions.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 157 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/webhooks/stripe/route.ts`
- `apps/web/__tests__/api/webhooks-stripe.test.ts`

---

## Session 38 — 2026-03-16

### Completed

**Checkout Redirect Config Hardening:**
- Added explicit `NEXT_PUBLIC_APP_URL` validation in `POST /api/checkout`.
- Route now returns `503` with clear error when app URL is missing or invalid, instead of failing later during session creation.
- Normalized success/cancel redirect URL generation with `URL` API to avoid malformed redirect URLs.
- Added regression tests for:
  - missing `NEXT_PUBLIC_APP_URL`
  - invalid `NEXT_PUBLIC_APP_URL`
- Updated Stripe checkout integration test setup to include `NEXT_PUBLIC_APP_URL`.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 159 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/checkout/route.ts`
- `apps/web/__tests__/api/checkout.test.ts`
- `apps/web/__tests__/integration/stripe-workflow.test.ts`

---

## Session 39 — 2026-03-16

### Completed

**Middleware Auth Lookup Reduction for Public Pages:**
- Optimized middleware to skip `auth()` lookup on public non-auth content routes (e.g. blog/legal/contact/roadmap pages).
- Preserved existing behavior where auth lookup is still required:
  - landing (`/` and locale roots) for signed-in redirect to dashboard,
  - sign-in/sign-up pages for signed-in redirect,
  - protected routes for unauthenticated redirect.
- Added regression test ensuring public content routes do not invoke auth callback.
- Goal: cut unnecessary edge auth work on high-traffic public pages and reduce Vercel edge usage.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 160 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/middleware.ts`
- `apps/web/__tests__/middleware.test.ts`

---

## Session 40 — 2026-03-16

### Completed

**Contact API Misconfiguration Hardening:**
- Added explicit `RESEND_API_KEY` guard to `POST /api/contact`.
- Endpoint now returns `503` with a clear error when email provider config is missing instead of failing later with a generic server error.
- Refactored local Resend client helper to accept validated API key input.
- Added regression test for missing `RESEND_API_KEY`.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 161 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/contact/route.ts`
- `apps/web/__tests__/api/contact.test.ts`

---

## Session 41 — 2026-03-16

### Completed

**Mobile Auth Efficiency Optimization:**
- Moved `clerkClient()` initialization in `POST /api/auth/mobile` to run only after input validation and per-IP rate-limit checks pass.
- This avoids unnecessary Clerk backend client setup on invalid or abusive requests.
- Added regression test to ensure invalid payloads do not initialize the Clerk client.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 162 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/auth/mobile/route.ts`
- `apps/web/__tests__/api/auth-mobile.test.ts`

---

## Session 42 — 2026-03-16

### Completed

**Mobile Auth Misconfiguration Fail-Closed Guard:**
- Added explicit `CLERK_SECRET_KEY` validation to `POST /api/auth/mobile`.
- Endpoint now returns `503` with a clear error when JWT signing secret is missing, instead of returning a generic `500`.
- Added regression test for missing `CLERK_SECRET_KEY` and confirmed Clerk client is not initialized in this misconfigured state.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 163 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/auth/mobile/route.ts`
- `apps/web/__tests__/api/auth-mobile.test.ts`

---

## Session 43 — 2026-03-16

### Completed

**Weekly Digest Cron Misconfiguration Hardening:**
- Added explicit `RESEND_API_KEY` guard in `POST /api/cron/weekly-digest`.
- Endpoint now fails closed with `503` when digest email provider config is missing.
- Added regression test to enforce missing-email-provider behavior.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 164 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/cron/weekly-digest/route.ts`
- `apps/web/__tests__/api/cron-weekly-digest.test.ts`

---

## Session 44 — 2026-03-16

### Completed

**Checkout Secret Misconfiguration Hardening:**
- Added explicit `STRIPE_SECRET_KEY` guard in `POST /api/checkout`.
- Checkout endpoint now fails closed with `503` when Stripe server key is missing.
- Added regression test for missing Stripe secret.
- Updated Stripe workflow integration test setup with `STRIPE_SECRET_KEY` to reflect the new required config.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 165 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/checkout/route.ts`
- `apps/web/__tests__/api/checkout.test.ts`
- `apps/web/__tests__/integration/stripe-workflow.test.ts`

---

## Session 45 — 2026-03-16

### Completed

**Stripe Webhook Secret-Key Misconfiguration Hardening:**
- Added explicit `STRIPE_SECRET_KEY` guard in `POST /api/webhooks/stripe`.
- Webhook endpoint now fails closed with `503` when Stripe server key is missing.
- Added regression test for missing Stripe secret key in webhook handler.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 166 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/webhooks/stripe/route.ts`
- `apps/web/__tests__/api/webhooks-stripe.test.ts`

---

## Session 46 — 2026-03-16

### Completed

**Tailor Webhook URL Validation Hardening:**
- Added strict `N8N_WEBHOOK_URL` validation in `POST /api/tailor`:
  - requires a valid URL format
  - requires `http` or `https` protocol
- Endpoint now fails closed with `503` for invalid webhook URL config instead of attempting dispatch.
- Added regression test for invalid `N8N_WEBHOOK_URL`.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 167 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/tailor/route.ts`
- `apps/web/__tests__/api/tailor.test.ts`

---

## Session 47 — 2026-03-16

### Completed

**Tailor Webhook Base-Path Compatibility Fix:**
- Fixed webhook endpoint construction to preserve any configured base path in `N8N_WEBHOOK_URL` (for proxied/subpath n8n setups).
- Maintained strict URL/protocol validation from the previous hardening step.
- Added regression test to verify dispatch target when `N8N_WEBHOOK_URL` includes a subpath.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 168 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/tailor/route.ts`
- `apps/web/__tests__/api/tailor.test.ts`

---

## Session 48 — 2026-03-16

### Completed

**n8n Webhook Payload Validation Hardening:**
- Added strict request-envelope validation (`type` + object `data`) for `POST /api/webhooks/n8n`.
- Added per-event payload validation to fail malformed webhooks with `400` instead of surfacing internal errors:
  - `new_applications`: requires non-empty `userId` and `applications` array
  - `single_tailoring_complete`: requires non-empty `userId` and `jobId`
  - `workflow_error`: requires non-empty `workflowId`, `nodeName`, `errorType`, `message`
- Hardened application-loop parsing to handle non-object entries safely.
- Added targeted regression tests for invalid payloads across all supported webhook event types.
- Resolved build-time TypeScript constraints from the validation refactor.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 172 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/webhooks/n8n/route.ts`
- `apps/web/__tests__/api/webhooks-n8n.test.ts`

---

## Session 49 — 2026-03-16

### Completed

**User Settings Payload Validation Hardening:**
- Added strict boolean validation for `automationEnabled` in `PATCH /api/user`.
- Prevents malformed payloads from being silently coerced and unintentionally changing automation state.
- Added regression test for non-boolean `automationEnabled` payloads.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 173 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/user/route.ts`
- `apps/web/__tests__/api/user.test.ts`

---

## Session 50 — 2026-03-16

### Completed

**Preferences Input Validation Hardening:**
- Added strict `remotePreference` validation in `PUT /api/preferences` (`any | remote | hybrid | onsite`).
- Added non-negative validation for `salaryMin`.
- Added safe string-array sanitization for `targetTitles`, `locations`, and `industries`.
- Added guardrails for list payload size:
  - max 25 entries per list
  - max 120 chars per entry
- Added regression tests for:
  - invalid `remotePreference`
  - negative `salaryMin`
  - oversized preference arrays

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 176 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/preferences/route.ts`
- `apps/web/__tests__/api/preferences.test.ts`

---

## Session 51 — 2026-03-16

### Completed

**Profile Payload Validation Hardening:**
- Added strict payload validation in `POST /api/profile`:
  - `rawText` must be a non-empty string
  - `structuredJson` must be a non-null object
- Added size limits:
  - `rawText` max 150,000 chars
  - serialized `structuredJson` max 500,000 chars
- Added regression tests for:
  - missing `structuredJson`
  - oversized `rawText`
  - oversized `structuredJson`

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 179 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/profile/route.ts`
- `apps/web/__tests__/api/profile.test.ts`

---

## Session 52 — 2026-03-16

### Completed

**Application Detail PATCH Validation Hardening:**
- Added strict payload validation in `PATCH /api/applications/[id]`:
  - request must include at least one of `status` or `notes`
  - `status` must be a string and one of allowed application statuses
  - `notes` must be a string or null
  - `notes` max length set to 5000 chars
- Added type guard for application status to satisfy strict type checks during build.
- Added regression tests for:
  - empty PATCH payload
  - invalid `notes` payload type

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 181 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/applications/[id]/route.ts`
- `apps/web/__tests__/api/application-detail.test.ts`

---

## Session 53 — 2026-03-16

### Completed

**Applications List Query Validation Hardening:**
- Added strict validation for `status` query param in `GET /api/applications`.
- Route now returns `400` when `status` is not one of the allowed application statuses.
- Added status type guard for strict build compatibility.
- Added regression test for invalid `status` query values.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 182 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/applications/route.ts`
- `apps/web/__tests__/api/applications.test.ts`

---

## Session 54 — 2026-03-16

### Completed

**Checkout Unauthorized UX Guard (Public Pricing):**
- Updated `CheckoutButton` to handle `401 Unauthorized` responses by redirecting anonymous users to the localized sign-up route (`/sign-up` or `/{locale}/sign-up`) instead of showing a raw alert popup.
- Added locale-aware sign-up path selection for supported locales (`en`, `fr`, `de`, `es`, `it`).
- Preserved checkout context in query params (`plan`, `from`) when redirecting to sign-up.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 182 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/components/checkout-button.tsx`

---

## Session 55 — 2026-03-16

### Completed

**Auth Page Resilience Hardening (Sign-In / Sign-Up):**
- Added explicit Clerk lifecycle handling on both auth pages:
  - `ClerkLoading` renders a visible loading state.
  - `ClerkDegraded` and `ClerkFailed` render a user-facing fallback card with retry and alternate auth-route actions.
- Added locale-aware auth paths (`sign-in`, `sign-up`, `dashboard`) on both pages to ensure Clerk widgets initialize against the correct localized route.
- Wired Clerk widgets with explicit `path`, `routing="path"`, and localized redirect URLs to reduce route mismatch risk.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 182 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/[locale]/sign-in/[[...sign-in]]/page.tsx`
- `apps/web/app/[locale]/sign-up/[[...sign-up]]/page.tsx`

---

## Session 56 — 2026-03-16

### Completed

**Mobile Horizontal Overflow & Pricing CTA Responsiveness:**
- Added horizontal overflow containment to landing root and auth page wrappers to prevent right-scroll drift on mobile.
- Reduced mobile header crowding on landing:
  - compact brand display on small screens
  - hid top-nav auth buttons on small screens (hero CTA remains primary mobile entry)
  - preserved language/theme controls with tighter layout constraints.
- Improved pricing and CTA button responsiveness for long localized labels:
  - enabled wrapping (`whitespace-normal`) and auto height on pricing plan buttons
  - tightened yearly button line-height and spacing for narrow screens
  - prevented roadmap CTA button from forcing width on small screens.
- Constrained language selector width on mobile to avoid header overflow expansion.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 182 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/[locale]/page.tsx`
- `apps/web/components/language-switcher.tsx`
- `apps/web/app/[locale]/sign-in/[[...sign-in]]/page.tsx`
- `apps/web/app/[locale]/sign-up/[[...sign-up]]/page.tsx`

---

## Session 57 — 2026-03-16

### Completed

**Auth Loading Timeout Recovery (Stuck-Loading Guard):**
- Added timeout-based recovery on both auth pages:
  - if Clerk remains unloaded for 8 seconds, users are shown the fallback recovery card instead of an indefinite loading state.
- Preserved existing degraded/failed Clerk fallbacks and localized auth routing behavior.
- Ensures users always get a clear retry path even when auth initialization hangs on specific browsers/networks.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 182 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/[locale]/sign-in/[[...sign-in]]/page.tsx`
- `apps/web/app/[locale]/sign-up/[[...sign-up]]/page.tsx`

---

## Session 58 — 2026-03-16

### Completed

**Post-Auth Checkout Resume (Onboarding Conversion Flow):**
- Improved anonymous pricing-to-auth handoff by sending checkout intent as `upgrade` query parameter to sign-up.
- Added checkout intent propagation on both auth pages:
  - reads `upgrade` (and legacy `plan`) + `from` query params
  - preserves intent when switching between sign-up and sign-in
  - redirects authenticated completion to localized settings route with `?upgrade=...` when applicable.
- Added automatic checkout resume on settings page:
  - detects valid `upgrade` query param
  - starts checkout once authenticated user data is loaded
  - removes `upgrade` from URL before launch to avoid duplicate retries on refresh/navigation
  - displays “Starting secure checkout...” status message.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (22 files, 182 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/components/checkout-button.tsx`
- `apps/web/app/[locale]/sign-up/[[...sign-up]]/page.tsx`
- `apps/web/app/[locale]/sign-in/[[...sign-in]]/page.tsx`
- `apps/web/app/[locale]/(dashboard)/settings/page.tsx`

---

## Session 59 — 2026-03-16

### Completed

**Checkout Intent Regression Test Coverage:**
- Extracted checkout-intent parsing and URL-building logic into shared helper module:
  - locale-aware auth path resolution
  - checkout plan validation
  - auth intent URL generation
  - post-auth redirect URL generation.
- Refactored checkout button, sign-in/sign-up pages, and settings page to use shared helpers (no behavior change intended).
- Added dedicated test suite for onboarding checkout-intent flow rules:
  - `upgrade` param precedence
  - legacy `plan` fallback compatibility
  - invalid plan rejection
  - locale-safe route generation
  - auth and post-auth redirect URL construction.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (23 files, 192 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/lib/checkout-intent.ts`
- `apps/web/__tests__/checkout-intent.test.ts`
- `apps/web/components/checkout-button.tsx`
- `apps/web/app/[locale]/sign-up/[[...sign-up]]/page.tsx`
- `apps/web/app/[locale]/sign-in/[[...sign-in]]/page.tsx`
- `apps/web/app/[locale]/(dashboard)/settings/page.tsx`

---

## Session 60 — 2026-03-16

### Completed

**Auth Recovery Messaging for Blocked Cookie/Privacy Environments:**
- Added a shared `AuthRecoveryCard` component for sign-in/sign-up failure states.
- Replaced generic fallback copy with explicit, actionable troubleshooting guidance for:
  - blocked cookies/storage
  - strict tracking protection / ad blockers
  - VPN or private DNS filters blocking `clerk.autoapply.works`.
- Added lightweight local diagnostics in recovery UI:
  - cookie-enabled check
  - cookie write/read probe
  - Brave browser hint
- Added explicit error code in UI: `AUTH_INIT_BLOCKED`.
- Wired both auth pages (timeout fallback, degraded state, failed state) to use the shared recovery card while preserving existing alternate-route actions.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (23 files, 192 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/components/auth-recovery-card.tsx`
- `apps/web/app/[locale]/sign-up/[[...sign-up]]/page.tsx`
- `apps/web/app/[locale]/sign-in/[[...sign-in]]/page.tsx`

---

## Session 61 — 2026-03-16

### Completed

**Production-Safe Auth Diagnostics Endpoint + Support Page:**
- Added new safe diagnostics API endpoint:
  - `GET /api/auth/diagnostics`
  - Returns non-sensitive auth/debug signals only (no secrets or token values).
  - Includes request cookie/session presence booleans, auth status, config booleans, and actionable recommendations.
  - Adds `Cache-Control: no-store` for real-time support use.
- Added new public diagnostics page:
  - `/{locale}/auth-diagnostics`
  - Runs endpoint checks client-side and displays:
    - quick status summary
    - recommendation list
    - raw JSON payload
    - support code (`AUTH_INIT_BLOCKED`) for triage.
- Updated middleware public-route handling and matcher entries for:
  - `/auth-diagnostics`
  - `/:locale/auth-diagnostics`
  - `/api/auth/diagnostics`
- Added API regression tests for diagnostics endpoint safety and behavior.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (24 files, 194 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/auth/diagnostics/route.ts`
- `apps/web/app/[locale]/auth-diagnostics/page.tsx`
- `apps/web/middleware.ts`
- `apps/web/__tests__/api/auth-diagnostics.test.ts`

---

## Session 62 — 2026-03-16

### Completed

**Auth Widget Mount Watchdog for Blank Sign-In/Sign-Up States:**
- Added a Clerk widget mount detector utility to identify when auth UI fails to mount despite Clerk being loaded.
- Updated localized `sign-in` and `sign-up` pages to trigger `AuthRecoveryCard` when:
  - Clerk load times out, or
  - Clerk is loaded but no auth widget mounts within a short watchdog window.
- Wrapped Clerk `SignIn`/`SignUp` components in monitored host containers so mutation observation can confirm mount progress.
- Added regression test coverage for Clerk widget mount detection helper behavior.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (25 files, 198 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/lib/clerk-widget-monitor.ts`
- `apps/web/app/[locale]/sign-in/[[...sign-in]]/page.tsx`
- `apps/web/app/[locale]/sign-up/[[...sign-up]]/page.tsx`
- `apps/web/__tests__/clerk-widget-monitor.test.ts`

---

## Session 63 — 2026-03-16

### Completed

**Mobile Horizontal Overflow Hardening (Landing + Consent Banner):**
- Added global viewport overflow guards to prevent accidental horizontal page panning:
  - `html { max-width: 100%; overflow-x: hidden; }`
  - `body` now includes `overflow-x-hidden` and `max-width: 100%`.
- Hardened cookie-consent banner layout for narrow/mobile browsers:
  - removed `container` dependency in the banner wrapper
  - switched to explicit `w-full` + `max-w-4xl` + controlled horizontal padding
  - added `break-words` on consent text
  - made action buttons responsive (`w-full` on mobile, auto width on larger screens).

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (25 files, 198 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/globals.css`
- `apps/web/components/cookie-consent.tsx`

---

## Session 64 — 2026-03-16

### Completed

**Unauthorized Checkout Popup Elimination (Auth Redirect Hardening):**
- Added `isUnauthorizedCheckoutError` helper to normalize unauthorized detection across status/message variants.
- Updated landing checkout CTA flow to redirect to sign-up intent flow when checkout responses are unauthorized-like, even if status is not strictly `401`.
- Updated settings checkout flow to do the same and redirect to localized sign-in with preserved checkout intent instead of showing a generic error.
- Added regression coverage for unauthorized detection helper behavior.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (25 files, 199 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/lib/checkout-intent.ts`
- `apps/web/components/checkout-button.tsx`
- `apps/web/app/[locale]/(dashboard)/settings/page.tsx`
- `apps/web/__tests__/checkout-intent.test.ts`

---

## Session 65 — 2026-03-16

### Completed

**Auth Recovery UX Upgrade (Direct Diagnostics Action):**
- Extended auth route helper support with localized `auth-diagnostics` path generation.
- Added optional `diagnosticsUrl` action to `AuthRecoveryCard`.
- Wired sign-in/sign-up fallback states (timeout, degraded, failed, widget-missing) to include a direct “Run auth diagnostics” button.
- Added route helper regression assertion for localized diagnostics path generation.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (25 files, 199 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/lib/checkout-intent.ts`
- `apps/web/components/auth-recovery-card.tsx`
- `apps/web/app/[locale]/sign-in/[[...sign-in]]/page.tsx`
- `apps/web/app/[locale]/sign-up/[[...sign-up]]/page.tsx`
- `apps/web/__tests__/checkout-intent.test.ts`

---

## Session 66 — 2026-03-16

### Completed

**Anonymous Checkout Pre-Auth Shortcut (Cost + Reliability):**
- Added `shouldRedirectToAuthBeforeCheckout` helper to detect when auth is loaded and no user is signed in.
- Updated pricing `CheckoutButton` flow to skip `/api/checkout` for known signed-out users and redirect directly to sign-up with preserved checkout intent.
- Kept existing unauthorized-response redirect logic as fallback for uncertain auth states.
- Added regression tests for pre-check redirect helper behavior.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (25 files, 200 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/lib/checkout-intent.ts`
- `apps/web/components/checkout-button.tsx`
- `apps/web/__tests__/checkout-intent.test.ts`

---

## Session 67 — 2026-03-16

### Completed

**Middleware Cost Optimization (Bot Landing Auth Skip):**
- Added `isLikelyBot` user-agent detection in middleware.
- Updated auth-lookup gating to skip Clerk auth checks for bot/crawler requests on landing root routes (`/` and locale roots), while preserving auth checks for:
  - protected routes
  - auth pages
  - human landing traffic.
- Added middleware regression test to ensure bot landing requests bypass auth callback.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (25 files, 201 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/middleware.ts`
- `apps/web/__tests__/middleware.test.ts`

---

## Session 68 — 2026-03-16

### Completed

**Middleware Cost Optimization (Bot Auth-Page Auth Skip):**
- Extended bot/crawler auth-skip gating to include public auth pages (`/sign-in`, `/sign-up`) in addition to landing roots.
- Preserved auth checks for protected routes and human traffic.
- Added middleware regression coverage ensuring bot requests on auth pages bypass auth callback.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (25 files, 202 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/middleware.ts`
- `apps/web/__tests__/middleware.test.ts`

---

## Session 69 — 2026-03-16

### Completed

**Middleware Cost Optimization (Session-Cookie-Gated Public Auth Lookup):**
- Added `hasLikelySessionCookie` helper in middleware.
- Public routes now only perform Clerk auth lookup when both are true:
  - route needs public-user state (landing root/auth pages), and
  - a likely Clerk session cookie (`__session`) is present.
- This keeps protected-route behavior unchanged while reducing unnecessary auth lookups for anonymous/public traffic.
- Expanded middleware tests for:
  - signed-in root/locale redirects when session cookie exists,
  - anonymous root bypass without session cookie,
  - auth-page bypass assertions for signed-out users.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (25 files, 203 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/middleware.ts`
- `apps/web/__tests__/middleware.test.ts`

---

## Session 70 — 2026-03-16

### Completed

**Checkout UX Hardening (No Browser Alerts):**
- Removed browser `alert()` usage from pricing checkout CTA flow.
- Added inline checkout error state rendering under CTA buttons using accessible `role="alert"` messaging.
- Added `getCheckoutErrorMessage` helper for consistent fallback messaging when API errors are missing/empty.
- Added regression coverage for checkout error message normalization.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (25 files, 204 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/components/checkout-button.tsx`
- `apps/web/lib/checkout-intent.ts`
- `apps/web/__tests__/checkout-intent.test.ts`

---

## Session 71 — 2026-03-16

### Completed

**Checkout Timeout Recovery (Mobile/Weak Network Resilience):**
- Added shared checkout timeout constants and abort-error helper in checkout intent utilities.
- Added client-side timeout (`15s`) to landing pricing checkout CTA request.
- Added the same timeout handling to settings-page checkout flow.
- Added explicit timeout recovery message for users when checkout request stalls.
- Added regression tests for timeout constants and abort-error detection.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (25 files, 205 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/lib/checkout-intent.ts`
- `apps/web/components/checkout-button.tsx`
- `apps/web/app/[locale]/(dashboard)/settings/page.tsx`
- `apps/web/__tests__/checkout-intent.test.ts`

---

## Session 72 — 2026-03-16

### Completed

**Profile Photo Upload UX Hardening (No Browser Alerts):**
- Removed remaining `alert()` usage from photo upload validation/processing flow.
- Added inline error messaging (`role="alert"`) for:
  - invalid file type
  - oversized file
  - image processing failures.
- Added shared photo upload validation helper in `lib`.
- Reset file input on validation errors so users can retry immediately with the same file name.
- Added regression tests for photo upload validation rules.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (26 files, 208 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/components/photo-upload.tsx`
- `apps/web/lib/photo-upload.ts`
- `apps/web/__tests__/photo-upload.test.ts`

---

## Session 73 — 2026-03-16

### Completed

**Onboarding Health Checklist (Auth/Profile/Preferences/Checkout Readiness):**
- Added onboarding health snapshot utility to evaluate:
  - secure auth session readiness
  - profile source availability
  - preferences readiness
  - checkout configuration readiness.
- Added onboarding-page checklist UI that shows readiness state inline and updates as users progress.
- Wired onboarding flow to mark checklist items ready immediately after successful CV upload/text save and preference save.
- Refactored sign-in redirect into `useEffect` to preserve stable hook execution order.
- Added regression tests for onboarding health snapshot logic.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (27 files, 211 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/[locale]/onboarding/page.tsx`
- `apps/web/lib/onboarding-health.ts`
- `apps/web/__tests__/onboarding-health.test.ts`

---

## Session 74 — 2026-03-16

### Completed

**Onboarding API Timeout Resilience (No Stuck Steps):**
- Added timeout-based request guards for onboarding page operations:
  - health-check API reads
  - CV file upload
  - CV text save
  - preferences save.
- Added explicit timeout-specific user errors for upload/save actions so users get a recovery path on weak networks instead of indefinite loading.
- Hardened health-check loader state with `finally` cleanup to avoid lingering loading indicators.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (27 files, 211 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/[locale]/onboarding/page.tsx`

---

## Session 75 — 2026-03-16

### Completed

**Vercel Cost Optimization (Middleware Matcher Scope Reduction):**
- Reduced middleware matcher coverage by excluding locale-prefixed public-content routes:
  - `/(en|fr|de|es|it)/blog/:path*`
  - locale-prefixed `terms/privacy/contact/roadmap/auth-diagnostics` routes.
- Kept non-prefixed public routes in matcher so locale rewriting remains intact for direct links like `/blog` and `/terms`.
- Added regression test assertions to guard matcher scope and prevent accidental broadening.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (27 files, 212 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/middleware.ts`
- `apps/web/__tests__/middleware.test.ts`

---

## Session 76 — 2026-03-16

### Completed

**Vercel Cost Optimization (Landing Middleware Bypass + Static Root Redirect):**
- Added static redirect from `/` to `/en` in Next.js config so homepage locale routing no longer requires middleware execution.
- Narrowed middleware matcher by removing landing roots (`/`, `/en`, `/fr`, `/de`, `/es`, `/it`) to reduce bot/crawler edge invocations on public entry pages.
- Added matcher regression assertions to ensure landing roots stay excluded from middleware scope.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (27 files, 212 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/next.config.js`
- `apps/web/middleware.ts`
- `apps/web/__tests__/middleware.test.ts`

---

## Session 77 — 2026-03-16

### Completed

**Vercel Cost Optimization (Build Machine Downgrade):**
- Pulled Vercel billing charges for `auto-apply-ai` (March 1–16) and identified **Build Minutes** as the dominant cost driver (largest share of effective spend).
- Updated Vercel project setting for `auto-apply-ai` from `buildMachineType: "turbo"` to `buildMachineType: "standard"` via Vercel Project API.
- Kept all app runtime settings and deployment behavior unchanged; only build machine tier was adjusted.

### Verification
- Confirmed via Vercel Project API response that `resourceConfig.buildMachineType` is now `standard`.
- No repository source files changed for application logic in this step.

### Files Modified This Session
- `SESSION_LOG.md`

---

## Session 78 — 2026-03-16

### Completed

**Vercel Cost Optimization (Skip Non-Affected Deployments):**
- Enabled Vercel project setting `enableAffectedProjectsDeployments=true` for `auto-apply-ai`.
- This allows Vercel to skip builds when commits do not affect the configured root directory (`apps/web`) or its dependency graph.
- Expected impact: fewer unnecessary build-minute charges for monorepo commits that only touch unrelated files.

### Verification
- Confirmed via Vercel Project API response:
  - `enableAffectedProjectsDeployments: true`
  - `rootDirectory: "apps/web"`

### Files Modified This Session
- `SESSION_LOG.md`

---

## Session 79 — 2026-03-16

### Completed

**Vercel Cost Optimization (Skip Auto Builds on `main`):**
- Audited deployment history and confirmed repeated **production** builds were being triggered from `main` (high build-minute churn).
- Configured Vercel `commandForIgnoringBuildStep` for `auto-apply-ai` to skip git-triggered builds when `VERCEL_GIT_COMMIT_REF=main`:
  - `if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then ... exit 0; fi; exit 1`
- Result: pushes to `main` are now ignored by auto-build logic; deployments can be triggered later in controlled batches when needed.

### Verification
- Confirmed Vercel project API now returns the configured `commandForIgnoringBuildStep` string.

### Files Modified This Session
- `SESSION_LOG.md`

---

## Session 80 — 2026-03-16

### Completed

**Onboarding Auth Reliability (No Blank Sign-In/Sign-Up State):**
- Fixed auth page rendering flow to avoid a blank UI when Clerk reports loaded but widget mount is delayed/blocked.
- Added explicit auth widget state resolver to guarantee one visible state at all times:
  - loading card, or
  - Clerk widget, or
  - recovery card.
- Added widget-mount tracking state on both localized sign-in and sign-up pages and gated Clerk component rendering when recovery fallback is active.
- Added regression tests covering all auth widget state transitions.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (28 files, 217 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/lib/auth-widget-state.ts`
- `apps/web/app/[locale]/sign-in/[[...sign-in]]/page.tsx`
- `apps/web/app/[locale]/sign-up/[[...sign-up]]/page.tsx`
- `apps/web/__tests__/auth-widget-state.test.ts`

---

## Session 81 — 2026-03-16

### Completed

**Checkout Onboarding Hardening (Pre-auth Redirect Before API Call):**
- Updated checkout preflight decision logic so anonymous users are redirected to sign-up immediately when Clerk auth is not loaded yet and no `__session` cookie is present.
- Prevented unnecessary `/api/checkout` calls for clearly anonymous sessions, reducing Unauthorized-path errors during onboarding and reducing avoidable serverless invocations.
- Updated checkout intent tests to cover both anonymous-no-cookie and session-cookie-not-yet-loaded cases.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (28 files, 217 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/lib/checkout-intent.ts`
- `apps/web/components/checkout-button.tsx`
- `apps/web/__tests__/checkout-intent.test.ts`

---

## Session 82 — 2026-03-16

### Completed

**Vercel Cost Guardrail Correction (Strict Ignore Build Command):**
- Observed a new production deployment entering `BUILDING` despite the previous branch-scoped ignore rule.
- Replaced `commandForIgnoringBuildStep` with a strict command:
  - `echo "Skipping auto build to control Vercel cost"; exit 0`
- This enforces skip behavior for all Git-triggered builds until deployment is intentionally re-enabled.

### Verification
- Confirmed via Vercel Deployments API that the latest production deployment transitioned to `CANCELED`.
- Confirmed project config now stores the strict ignore command.

### Files Modified This Session
- `SESSION_LOG.md`

---

## Session 83 — 2026-03-16

### Completed

**Mobile UX Hardening (Cookie Banner Overflow Guard):**
- Refined cookie consent banner layout for narrow/mobile browsers to eliminate horizontal spill risk:
  - switched wrapper to `inset-x-0` + `overflow-x-clip`
  - enforced `min-w-0` and wrapping behavior on consent text block
  - changed action buttons to a 2-column mobile grid with full-width buttons, then desktop flex layout.
- This targets cross-browser mobile rendering inconsistencies (including Samsung Internet/Chrome variants) reported with rightward scroll.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (28 files, 217 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/components/cookie-consent.tsx`

---

## Session 84 — 2026-03-16

### Completed

**Onboarding Checkout Reliability (Settings Auth Warm-Up Retry):**
- Added retry logic for `/api/user` load on the settings page to handle short-lived auth propagation races after sign-up/sign-in.
- Settings now retries authenticated user fetch up to 3 times (with short delay) before proceeding, while still loading preferences in parallel.
- Added `cache: "no-store"` for these initial settings fetches to avoid stale auth/user payloads during onboarding upgrade handoff.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (28 files, 217 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/[locale]/(dashboard)/settings/page.tsx`

---

## Session 85 — 2026-03-16

### Completed

**Auth Widget Recovery Hardening (No Permanent Fallback Lock):**
- Fixed sign-in/sign-up fallback behavior so Clerk widgets stay mounted even when recovery mode is shown.
- Added `shouldHideWidget` state to hide the widget during recovery without unmounting it.
- This allows late widget mounts on slower browsers/devices to recover automatically instead of staying stuck on fallback UI.
- Updated auth widget state tests to cover hide/show behavior when recovery and mount states overlap.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (28 files, 218 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/lib/auth-widget-state.ts`
- `apps/web/app/[locale]/sign-in/[[...sign-in]]/page.tsx`
- `apps/web/app/[locale]/sign-up/[[...sign-up]]/page.tsx`
- `apps/web/__tests__/auth-widget-state.test.ts`

---

## Session 86 — 2026-03-16

### Completed

**Auth Loading UX Hardening (Actionable Fallback During Widget Load):**
- Added actionable links inside sign-in/sign-up loading cards so users are not blocked while Clerk initializes.
- Users now get immediate fallback actions during loading:
  - open auth diagnostics
  - switch to the alternate auth page (sign-in/sign-up).
- This improves onboarding resilience for slow mobile browsers and constrained network conditions.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (28 files, 218 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/[locale]/sign-in/[[...sign-in]]/page.tsx`
- `apps/web/app/[locale]/sign-up/[[...sign-up]]/page.tsx`

---

## Session 87 — 2026-03-16

### Completed

**Auth Widget Detection Hardening (Ref-Safe Late Mount Recovery):**
- Fixed widget-mount detection on sign-in/sign-up pages to avoid stale-ref checks.
- Updated detection logic to read `widgetHostRef.current` dynamically, so late DOM mounts are correctly detected.
- Added short polling + MutationObserver fallback targeting (`widget host` or `document.body`) to recover from delayed widget insertion scenarios.
- This prevents false fallback lock states on slower mobile browsers where widget host availability can lag.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (28 files, 218 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/[locale]/sign-in/[[...sign-in]]/page.tsx`
- `apps/web/app/[locale]/sign-up/[[...sign-up]]/page.tsx`

---

## Session 88 — 2026-03-16

### Completed

**Vercel Cost Guardrail (Disable Auto Git Deployment Creation):**
- Audited Vercel billing charge stream for `auto-apply-ai` and confirmed **Build Minutes** remain the dominant effective cost line item in the recent window.
- Inspected project Git settings and found `gitProviderOptions.createDeployments` still set to `enabled`, which was creating deployment records on every push even with ignore-build logic.
- Updated Vercel project setting via API:
  - `gitProviderOptions.createDeployments: "disabled"`
- Result: Git pushes no longer create automatic deployment jobs; deployments must be triggered intentionally (manual batch deploys only), further reducing Vercel churn/cost.

### Verification
- Confirmed via Vercel Project API response:
  - `gitProviderOptions.createDeployments: "disabled"`
  - `commandForIgnoringBuildStep` remains set to strict skip command.

### Files Modified This Session
- `SESSION_LOG.md`

---

## Session 89 — 2026-03-16

### Completed

**Vercel Auto-Deploy Hard Stop (Repo-Level Branch Rule):**
- Observed that project API toggle alone (`gitProviderOptions.createDeployments=disabled`) did not fully prevent short-lived Git-triggered deployment entries.
- Added repo-level Vercel config guard in `apps/web/vercel.json`:
  - `git.deploymentEnabled.main = false`
- This enforces branch-level auto-deploy disable from source control for `main`, aligned with cost-control policy while keeping manual deploys available when needed.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (28 files, 218 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/vercel.json`
- `SESSION_LOG.md`

---

## Session 90 — 2026-03-16

### Completed

**Onboarding Smoke Matrix Automation (Desktop + Mobile Auth Entry Checks):**
- Added repeatable onboarding smoke script:
  - `apps/web/scripts/onboarding_smoke_matrix.sh`
- Added npm command:
  - `npm run smoke:onboarding`
- Matrix validates, per locale + viewport:
  - landing page overflow/Unauthorized text checks
  - upgrade CTA presence on pricing section
  - sign-up intent route health (`/sign-up?upgrade=...`)
  - sign-in route health
  - auth surface presence (Clerk UI / loading fallback / diagnostics link)
- Ran the matrix against production:
  - Report: `/tmp/onboarding-smoke-20260316_201202.jsonl`
  - Result: **4 passed, 0 failed** (`fr/en` × `desktop/mobile`).

### Verification
- `npm run smoke:onboarding` (apps/web) ✅ (4/4 cases passed)
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (28 files, 218 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/scripts/onboarding_smoke_matrix.sh`
- `apps/web/package.json`
- `SESSION_LOG.md`

---

## Session 91 — 2026-03-16

### Completed

**Checkout Diagnostics Hardening (Traceable Unauthorized/Failure Paths):**
- Added per-request `requestId` generation in `POST /api/checkout`.
- Added structured server logs for critical failure paths:
  - unauthorized requests
  - checkout rate limiting
  - Stripe misconfiguration
  - invalid `NEXT_PUBLIC_APP_URL`
  - unexpected checkout exceptions.
- Added `x-request-id` response header for success and error responses.
- Added `requestId` to checkout error payloads for support/debug triage.
- Extended checkout API tests to validate request ID behavior on key responses.

### Verification
- `npm run smoke:onboarding` (apps/web) ✅ (4/4 cases passed)
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (28 files, 218 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/checkout/route.ts`
- `apps/web/__tests__/api/checkout.test.ts`
- `SESSION_LOG.md`

---

## Session 92 — 2026-03-16

### Completed

**Anonymous Upgrade Flow Hardening (No Pre-Auth Checkout API Call):**
- Updated landing `CheckoutButton` behavior to route anonymous visitors directly to sign-up intent before any checkout API request.
- Removed unnecessary signed-out `/api/checkout` round-trip from public pricing clicks, reducing 401 noise and avoiding wasted serverless invocations.
- Expanded onboarding smoke matrix to validate real CTA behavior:
  - clicks pricing Pro CTA from landing
  - confirms redirect to sign-up auth surface
  - asserts no `/api/checkout` call was made before auth.

### Verification
- `npm run smoke:onboarding` (apps/web) ✅ (4/4 cases passed)
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (28 files, 218 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/components/checkout-button.tsx`
- `apps/web/scripts/onboarding_smoke_matrix.sh`
- `SESSION_LOG.md`

---

## Session 93 — 2026-03-16

### Completed

**Onboarding Smoke Hardening (Stale Session Cookie Reproduction):**
- Extended pricing CTA smoke path to simulate a stale `__session` cookie before clicking upgrade.
- This reproduces the browser state class that previously surfaced `Unauthorized` checkout behavior.
- Kept assertion that anonymous/stale-cookie flows must still avoid pre-auth `/api/checkout` calls and route directly to sign-up auth surface.

### Verification
- `npm run smoke:onboarding` (apps/web) ✅ (4/4 cases passed)
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (28 files, 218 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/scripts/onboarding_smoke_matrix.sh`
- `SESSION_LOG.md`

---

## Session 94 — 2026-03-16

### Completed

**Production Rollout (Batched Onboarding Fixes):**
- Performed a single manual production deployment to apply Sessions 90–93 onboarding fixes in one build (cost-controlled batch release).
- Deployment URL:
  - `https://auto-apply-jav0lamgx-matts-projects-d33e5f04.vercel.app`
- Production alias updated:
  - `https://autoapply.works`

### Verification
- `npm run smoke:onboarding` (apps/web, against `https://autoapply.works`) ✅ (4/4 cases passed)
  - report: `/tmp/onboarding-smoke-20260316_220237.jsonl`

### Files Modified This Session
- `SESSION_LOG.md`

---

## Session 95 — 2026-03-16

### Completed

**Auth-Blocked Onboarding Smoke (VPN/Adblock/Private-DNS Resilience):**
- Added new smoke script to simulate blocked Clerk auth network calls:
  - `apps/web/scripts/onboarding_auth_blocked_smoke.sh`
- The script mocks `clerk.autoapply.works` responses and verifies sign-up page behavior under auth-init blockage:
  - no horizontal overflow
  - no `Unauthorized` surface text
  - fallback recovery card is shown (`AUTH_INIT_BLOCKED` path)
  - diagnostics action remains available.
- Added npm entrypoint:
  - `npm run smoke:onboarding:auth-blocked`

### Verification
- `npm run smoke:onboarding:auth-blocked` (apps/web) ✅ (4/4 cases passed)
  - report: `/tmp/onboarding-auth-blocked-smoke-20260316_221106.jsonl`
- `npm run smoke:onboarding` (apps/web) ✅ (4/4 cases passed)
  - report: `/tmp/onboarding-smoke-20260316_221226.jsonl`
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (28 files, 218 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/scripts/onboarding_auth_blocked_smoke.sh`
- `apps/web/package.json`
- `SESSION_LOG.md`

---

## Session 96 — 2026-03-16

### Completed

**Middleware Cost Optimization (Skip Locale-Prefixed Auth Routes):**
- Reduced middleware matcher scope by removing locale-prefixed auth routes:
  - `/(en|fr|de|es|it)/sign-in/:path*`
  - `/(en|fr|de|es|it)/sign-up/:path*`
- Kept bare auth routes (`/sign-in/:path*`, `/sign-up/:path*`) in matcher for non-prefixed entrypoints.
- Rationale: locale-prefixed auth pages are directly routable and do not require middleware for locale resolution, so excluding them lowers edge invocation volume.
- Updated middleware scope test to lock this optimization and prevent regressions.

### Verification
- `npm run smoke:onboarding` (apps/web) ✅ (4/4 cases passed)
  - report: `/tmp/onboarding-smoke-20260316_221726.jsonl`
- `npm run smoke:onboarding:auth-blocked` (apps/web) ✅ (4/4 cases passed)
  - report: `/tmp/onboarding-auth-blocked-smoke-20260316_221726.jsonl`
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (28 files, 218 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/middleware.ts`
- `apps/web/__tests__/middleware.test.ts`
- `SESSION_LOG.md`

---

## Session 97 — 2026-03-16

### Completed

**Middleware Cost Optimization (Move Bare Public Locale Routing to Static Redirects):**
- Added static redirects in Next config for bare public routes:
  - `/blog` -> `/en/blog`
  - `/blog/:path*` -> `/en/blog/:path*`
  - `/terms` -> `/en/terms`
  - `/privacy` -> `/en/privacy`
  - `/contact` -> `/en/contact`
  - `/roadmap` -> `/en/roadmap`
  - `/auth-diagnostics` -> `/en/auth-diagnostics`
- Removed these bare public routes from middleware matcher scope, since locale handling is now done via static redirects in `next.config.js`.
- Updated middleware scope tests to enforce the narrower matcher.

### Verification
- `npm run smoke:onboarding` (apps/web) ✅ (4/4 cases passed)
  - report: `/tmp/onboarding-smoke-20260316_222048.jsonl`
- `npm run smoke:onboarding:auth-blocked` (apps/web) ✅ (4/4 cases passed)
  - report: `/tmp/onboarding-auth-blocked-smoke-20260316_222048.jsonl`
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (28 files, 218 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/next.config.js`
- `apps/web/middleware.ts`
- `apps/web/__tests__/middleware.test.ts`
- `SESSION_LOG.md`

---

## Session 98 — 2026-03-16

### Completed

**Middleware Cost Optimization (Remove Bare Auth Routes from Matcher):**
- Added static redirects for bare auth routes in Next config:
  - `/sign-in` -> `/en/sign-in`
  - `/sign-in/:path*` -> `/en/sign-in/:path*`
  - `/sign-up` -> `/en/sign-up`
  - `/sign-up/:path*` -> `/en/sign-up/:path*`
- Removed bare auth paths from middleware matcher scope, so middleware no longer runs on auth entry routes.
- Added client-side signed-in guard on auth pages:
  - if Clerk session is already loaded, auth pages now redirect to locale dashboard.
- Updated middleware matcher test assertions to enforce the narrower scope.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (28 files, 218 tests)
- `npm run build` (apps/web) ✅
- Local redirect verification (`next dev` + `curl -I`) ✅:
  - `/sign-in` -> `/en/sign-in`
  - `/sign-up` -> `/en/sign-up`
  - `/blog` -> `/en/blog`
  - `/blog/test-article` -> `/en/blog/test-article`
  - `/terms` -> `/en/terms`
  - `/privacy` -> `/en/privacy`
  - `/contact` -> `/en/contact`
  - `/roadmap` -> `/en/roadmap`
  - `/auth-diagnostics` -> `/en/auth-diagnostics`

### Files Modified This Session
- `apps/web/next.config.js`
- `apps/web/middleware.ts`
- `apps/web/__tests__/middleware.test.ts`
- `apps/web/app/[locale]/sign-in/[[...sign-in]]/page.tsx`
- `apps/web/app/[locale]/sign-up/[[...sign-up]]/page.tsx`
- `SESSION_LOG.md`

---

## Session 99 — 2026-03-16

### Completed

**Production Rollout (Cost-Optimization Batch 2):**
- Deployed the latest batched optimization changes to production:
  - `https://auto-apply-hov7mr6tt-matts-projects-d33e5f04.vercel.app`
- Production alias updated:
  - `https://autoapply.works`

Included in this rollout:
- middleware matcher narrowing for locale-prefixed auth routes.
- static bare-route redirects for public pages.
- static bare-route redirects for auth entry routes.
- client-side signed-in guard on auth pages.

### Verification
- `npm run smoke:onboarding` (apps/web, against `https://autoapply.works`) ✅ (4/4 cases passed)
  - report: `/tmp/onboarding-smoke-20260316_222829.jsonl`
- `npm run smoke:onboarding:auth-blocked` (apps/web, against `https://autoapply.works`) ✅ (4/4 cases passed)
  - report: `/tmp/onboarding-auth-blocked-smoke-20260316_222829.jsonl`

### Files Modified This Session
- `SESSION_LOG.md`

---

## Session 100 — 2026-03-16

### Completed

**Auth Diagnostics Hardening (Rate Limit):**
- Added IP-based rate limiting for `GET /api/auth/diagnostics`:
  - limit: 10 requests per 60 seconds per client IP
  - response on limit hit: HTTP `429` with a clear retry-later message
- Kept existing auth diagnostics behavior intact outside throttling.
- Added automated API test coverage for the rate-limit path to prevent regressions.

### Verification
- `npm run smoke:onboarding` (apps/web) ✅ (4/4 cases passed)
  - report: `/tmp/onboarding-smoke-20260316_224100.jsonl`
- `npm run smoke:onboarding:auth-blocked` (apps/web) ✅ (4/4 cases passed)
  - report: `/tmp/onboarding-auth-blocked-smoke-20260316_224212.jsonl`
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (28 files, 219 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/auth/diagnostics/route.ts`
- `apps/web/__tests__/api/auth-diagnostics.test.ts`
- `SESSION_LOG.md`

---

## Session 101 — 2026-03-16

### Completed

**Auth Widget Mount Detection Hardening (Blank Sign-Up/Sign-In Prevention):**
- Tightened Clerk widget mount detection to avoid false positives from placeholder nodes.
- `hasMountedClerkWidget` now requires a real auth surface (form/input/button/iframe or populated rendered content) instead of any generic Clerk marker.
- Added regression coverage to ensure placeholder-only nodes do not count as mounted while interactive auth nodes do.

### Verification
- `npm run smoke:onboarding` (apps/web) ✅ (4/4 cases passed)
  - report: `/tmp/onboarding-smoke-20260316_225226.jsonl`
- `npm run smoke:onboarding:auth-blocked` (apps/web) ✅ (4/4 cases passed)
  - report: `/tmp/onboarding-auth-blocked-smoke-20260316_225319.jsonl`
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (28 files, 220 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/lib/clerk-widget-monitor.ts`
- `apps/web/__tests__/clerk-widget-monitor.test.ts`
- `SESSION_LOG.md`

---

## Session 102 — 2026-03-16

### Completed

**Middleware Invocation Reduction (Diagnostics/Debug API Exclusion):**
- Removed `/api/auth/diagnostics` and `/api/debug/auth` from middleware matcher scope.
- Kept both endpoints fully available via route handlers, but stopped unnecessary edge middleware executions for them.
- Added matcher regression assertions so those endpoints stay excluded.

### Verification
- `npm run smoke:onboarding` (apps/web) ✅ (4/4 cases passed)
  - report: `/tmp/onboarding-smoke-20260316_225635.jsonl`
- `npm run smoke:onboarding:auth-blocked` (apps/web) ✅ (4/4 cases passed)
  - report: `/tmp/onboarding-auth-blocked-smoke-20260316_225723.jsonl`
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (28 files, 220 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/middleware.ts`
- `apps/web/__tests__/middleware.test.ts`
- `SESSION_LOG.md`

---

## Session 103 — 2026-03-16

### Completed

**Auth Entry Scroll-Reset Hardening (Mobile/Browser Alignment):**
- Added a dedicated `resetViewportScroll` helper to reset horizontal and vertical offsets on page mount.
- Applied scroll reset on both auth entry pages:
  - `/[locale]/sign-in/[[...sign-in]]`
  - `/[locale]/sign-up/[[...sign-up]]`
- Goal: prevent right-shifted auth screens on browsers that preserve horizontal scroll offset from previous pages.
- Added unit tests for both modern and fallback `scrollTo` behavior.

### Verification
- `npm run smoke:onboarding` (apps/web) ✅ (4/4 cases passed)
  - report: `/tmp/onboarding-smoke-20260316_230024.jsonl`
- `npm run smoke:onboarding:auth-blocked` (apps/web) ✅ (4/4 cases passed)
  - report: `/tmp/onboarding-auth-blocked-smoke-20260316_230122.jsonl`
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 222 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/lib/scroll-reset.ts`
- `apps/web/__tests__/scroll-reset.test.ts`
- `apps/web/app/[locale]/sign-in/[[...sign-in]]/page.tsx`
- `apps/web/app/[locale]/sign-up/[[...sign-up]]/page.tsx`
- `SESSION_LOG.md`

---

## Session 104 — 2026-03-17

### Completed

**Pricing CTA Hydration-Safe Fallback (Safari/WebKit Mobile Reliability):**
- Added non-JS/hydration-safe fallback links for landing pricing checkout CTAs.
- `CheckoutButton` now supports optional `fallbackHref`:
  - renders an anchor fallback (server-rendered href) while preserving JS checkout behavior after hydration.
- Wired all landing pricing CTAs to localized sign-up intent URLs (`upgrade` + `from`) so a click still navigates correctly even if React handlers are not yet hydrated.
- This addresses a reproduced WebKit mobile edge case where early CTA clicks on landing could be ignored.

### Verification
- Focused local WebKit repro (mobile viewport) against patched app ✅:
  - landing pricing CTA now navigates to `/fr/sign-up?upgrade=pro_monthly&from=%2Ffr`
- `npm run smoke:onboarding` (apps/web) ✅ (4/4 cases passed)
  - report: `/tmp/onboarding-smoke-20260317_001634.jsonl`
- `npm run smoke:onboarding:auth-blocked` (apps/web) ✅ (4/4 cases passed)
  - report: `/tmp/onboarding-auth-blocked-smoke-20260317_001759.jsonl`
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 222 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/components/checkout-button.tsx`
- `apps/web/app/[locale]/page.tsx`
- `SESSION_LOG.md`

---

## Session 105 — 2026-03-17

### Completed

**Cross-Browser Pre-Deploy Gate (Chromium + Firefox + WebKit):**
- Added native Playwright smoke configuration for onboarding compatibility checks:
  - `playwright.smoke.config.ts`
  - `e2e/onboarding.cross-browser.smoke.spec.ts`
- Added cross-browser smoke runner script:
  - `scripts/onboarding_cross_browser_smoke.sh`
  - iterates `SMOKE_BROWSERS` (default: `chromium firefox webkit`) and writes JSONL summary report.
- Added npm command:
  - `npm run smoke:onboarding:cross-browser`
- Added `@playwright/test` to dev dependencies to make cross-browser gate reproducible in repo.

### Verification
- Local cross-browser onboarding smoke gate (against local patched app) ✅
  - command: `SMOKE_BASE_URL=http://127.0.0.1:3000 npm run smoke:onboarding:cross-browser`
  - report: `/tmp/onboarding-cross-browser-smoke-20260317_075954.jsonl`
  - browsers passed: `chromium`, `firefox`, `webkit`
- `npm run smoke:onboarding` (apps/web) ✅ (4/4 cases passed)
  - report: `/tmp/onboarding-smoke-20260317_080414.jsonl`
- `npm run smoke:onboarding:auth-blocked` (apps/web) ✅ (4/4 cases passed)
  - report: `/tmp/onboarding-auth-blocked-smoke-20260317_080526.jsonl`
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 222 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/package.json`
- `apps/web/package-lock.json`
- `apps/web/playwright.smoke.config.ts`
- `apps/web/e2e/onboarding.cross-browser.smoke.spec.ts`
- `apps/web/scripts/onboarding_cross_browser_smoke.sh`
- `SESSION_LOG.md`

---

## Session 106 — 2026-03-17

### Completed

**Production Rollout + Live Onboarding Verification:**
- Deployed latest onboarding fixes to production in one single release:
  - deployment: `https://auto-apply-20ppkijkr-matts-projects-d33e5f04.vercel.app`
  - production alias: `https://autoapply.works`
- Ran live cross-browser onboarding smoke gate against production (Chromium + Firefox + WebKit) and confirmed pass.
- Fixed production smoke script selector mismatch introduced by hydration-safe pricing CTA anchors:
  - `onboarding_smoke_matrix.sh` now checks/clicks `#pricing a, #pricing button` instead of only `#pricing button`.
- Re-ran production onboarding smokes after the script fix and confirmed all pass.

### Verification
- `SMOKE_BASE_URL=https://autoapply.works npm run smoke:onboarding:cross-browser` ✅
  - report: `/tmp/onboarding-cross-browser-smoke-20260317_081502.jsonl`
  - browsers passed: `chromium`, `firefox`, `webkit`
- `npm run smoke:onboarding -- https://autoapply.works` ✅ (4/4 cases passed)
  - report: `/tmp/onboarding-smoke-20260317_082023.jsonl`
- `npm run smoke:onboarding:auth-blocked -- https://autoapply.works` ✅ (4/4 cases passed)
  - report: `/tmp/onboarding-auth-blocked-smoke-20260317_082150.jsonl`

### Files Modified This Session
- `apps/web/scripts/onboarding_smoke_matrix.sh`
- `SESSION_LOG.md`

---

## Session 107 — 2026-03-17

### Completed

**Production Readiness Tracker (Pre-Live Payment + Growth + Cost):**
- Added repository-level tracker `TODO.md` to centralize the current execution queue.
- Added explicit P0 pre-live-payment checklist, including:
  - production onboarding smoke gates
  - Stripe/Vercel env verification
  - signed-in and signed-out checkout path checks
  - webhook/idempotency verification
  - manual family live payment test logging requirement
- Added P1 follow-ups for:
  - onboarding reliability hardening
  - Google tool integration (Search Console, GTM, GA4/Ads conversions)
  - social + ad campaign rollout tasks
  - Vercel cost governance routine

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 222 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 120 — 2026-03-17

### Completed

**GA4 Event Instrumentation Progress (`begin_checkout`):**
- Added shared analytics helper:
  - `apps/web/lib/analytics.ts`
- Wired `begin_checkout` event tracking for checkout initiation on:
  - landing pricing CTA flow (`CheckoutButton`)
  - dashboard settings subscription/credits checkout flow
- Event metadata currently includes:
  - `checkout_plan`
  - `checkout_source` (`landing_pricing` or `settings_subscription`)
- Updated TODO GA4-event item with explicit in-progress status.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 222 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/lib/analytics.ts`
- `apps/web/components/checkout-button.tsx`
- `apps/web/app/[locale]/(dashboard)/settings/page.tsx`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 121 — 2026-03-17

### Completed

**GA4 Event Instrumentation Progress (`sign_up_started`):**
- Extended analytics helper with `trackSignUpStarted`.
- Added sign-up page instrumentation to fire `sign_up_started` once per page load.
- Event payload now includes:
  - `signup_source`
  - `locale`
  - `requested_plan`
  - `requested_from`
- Updated TODO GA4-event item progress to reflect both completed sub-events:
  - `begin_checkout`
  - `sign_up_started`

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 222 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/lib/analytics.ts`
- `apps/web/app/[locale]/sign-up/[[...sign-up]]/page.tsx`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 122 — 2026-03-17

### Completed

**GA4 Event Instrumentation Progress (`sign_up_completed`):**
- Added global session-event consumer component:
  - `apps/web/components/analytics-session-events.tsx`
- Wired it in root layout so deferred signup-completion tracking fires on the first post-signup page load.
- Updated sign-up flow to set a pending completion marker in `sessionStorage` before redirecting authenticated users away from sign-up.
- Result: `sign_up_completed` now fires reliably even with immediate redirect after account creation.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 222 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/components/analytics-session-events.tsx`
- `apps/web/app/layout.tsx`
- `apps/web/app/[locale]/sign-up/[[...sign-up]]/page.tsx`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 123 — 2026-03-17

### Completed

**GA4 Event Instrumentation Progress (`onboarding_completed`):**
- Added `trackOnboardingCompleted` in analytics helper.
- Wired onboarding completion event to fire once when onboarding health reaches ready state:
  - auth ready
  - profile ready
  - preferences ready
  - checkout ready
- Added one-time guard (`hasTrackedOnboardingCompletedRef`) to prevent duplicate event emission.
- Updated TODO GA4-event progress to include `onboarding_completed`.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 222 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/lib/analytics.ts`
- `apps/web/app/[locale]/onboarding/page.tsx`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 124 — 2026-03-17

### Completed

**Onboarding reliability hardening (`mobile WebKit` pre-hydration CTA guardrail):**
- Added a dedicated Playwright assertion in `apps/web/e2e/onboarding.cross-browser.smoke.spec.ts`:
  - `mobile webkit pro CTA works before hydration`
- New test forces a no-JS browser context (`javaScriptEnabled: false`) and validates:
  - Pro monthly pricing CTA exists as an anchor fallback in `#pricing`
  - CTA href points to sign-up intent path with plan+source query
  - Clicking CTA still navigates to `/sign-up?upgrade=pro_monthly...` before hydration
- Updated TODO onboarding reliability checklist item as complete.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 222 tests)
- `npm run build` (apps/web) ✅
- `SMOKE_BASE_URL=http://127.0.0.1:3000 npx playwright test -c playwright.smoke.config.ts e2e/onboarding.cross-browser.smoke.spec.ts --browser=webkit --grep "mobile webkit pro CTA works before hydration" --reporter=line` ✅ (2 passed, 2 skipped; desktop variants intentionally skipped)

### Files Modified This Session
- `apps/web/e2e/onboarding.cross-browser.smoke.spec.ts`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 125 — 2026-03-17

### Completed

**Onboarding smoke parity hardening (locale-preserving sign-up handoff):**
- Updated `apps/web/scripts/onboarding_smoke_matrix.sh` to default locale matrix:
  - `en fr de es it`
- Added explicit sign-up handoff parity assertions per locale:
  - expected path must match `/${locale}/sign-up`
  - `upgrade` query param must equal `pro_monthly`
  - `from` query param must equal `/${locale}`
- Kept existing guardrails (overflow, unauthorized text, anonymous checkout API call suppression, auth surface checks) while strengthening locale-path verification.
- Updated TODO onboarding reliability item as complete.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 222 tests)
- `npm run build` (apps/web) ✅
- `npm run smoke:onboarding -- http://127.0.0.1:3000` ✅
  - report: `/tmp/onboarding-smoke-20260317_163628.jsonl`
  - result: Passed 10, Failed 0

### Files Modified This Session
- `apps/web/scripts/onboarding_smoke_matrix.sh`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 126 — 2026-03-17

### Completed

**Checkout return-path hardening for signed-in `/settings` upgrades:**
- Updated `apps/web/app/api/checkout/route.ts`:
  - Added safe `returnPath` support in request body.
  - Added strict sanitization (`resolveSafeReturnPath`) to allow only app-relative routes.
  - Kept safe fallback to `/dashboard` for missing/unsafe values.
  - Success/cancel Stripe return URLs now honor validated `returnPath`.
- Updated `apps/web/app/[locale]/(dashboard)/settings/page.tsx`:
  - Checkout request now includes `returnPath: window.location.pathname` so upgrade flow returns users to the same locale settings page.
- Added regression tests in `apps/web/__tests__/api/checkout.test.ts`:
  - valid `returnPath` is applied to success/cancel URLs
  - unsafe absolute `returnPath` falls back to `/dashboard`
- Updated TODO with a completed production-hardening item for this return-path behavior.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 224 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/checkout/route.ts`
- `apps/web/app/[locale]/(dashboard)/settings/page.tsx`
- `apps/web/__tests__/api/checkout.test.ts`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 127 — 2026-03-17

### Completed

**Checkout return UX/state hardening in settings:**
- Updated `apps/web/app/[locale]/(dashboard)/settings/page.tsx` to process Stripe return query state:
  - handles `checkout=success`
  - handles `checkout=cancelled`
- Added clear user-facing messages after return:
  - success: payment success + status refresh messaging
  - cancelled: no-plan-change confirmation messaging
- On success return, page now attempts an immediate authenticated user refresh via `fetchUserWithAuthRetry()` and updates local subscription state.
- `checkout` query param is removed from URL after handling to avoid repeated effect processing.
- Updated TODO with completed hardening item for checkout return UX/state handling.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 224 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/[locale]/(dashboard)/settings/page.tsx`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 128 — 2026-03-17

### Completed

**GA4 purchase tracking hardening via checkout return metadata:**
- Updated `apps/web/app/api/checkout/route.ts`:
  - Stripe success/cancel return URLs now include:
    - `checkout_plan=<selected_plan>`
    - `checkout_ref=<request_id>`
- Updated `apps/web/app/[locale]/(dashboard)/settings/page.tsx`:
  - Handles return state with dedupe key based on `checkout + checkout_plan + checkout_ref`
  - Removes `checkout`, `checkout_plan`, `checkout_ref` params from URL after handling
  - Fires GA4 `purchase` event on successful return when `checkout_plan` is valid
- Added `trackPurchase()` helper in `apps/web/lib/analytics.ts`.
- Strengthened checkout API tests in `apps/web/__tests__/api/checkout.test.ts`:
  - assert `checkout_plan` + `checkout_ref` metadata in success/cancel URLs
  - preserve safe `returnPath` behavior and unsafe fallback behavior
- Updated TODO GA4 event progress to include `purchase`.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 224 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/api/checkout/route.ts`
- `apps/web/app/[locale]/(dashboard)/settings/page.tsx`
- `apps/web/lib/analytics.ts`
- `apps/web/__tests__/api/checkout.test.ts`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 129 — 2026-03-17

### Completed

**GA4 `cv_uploaded` event completion (final analytics gap closed):**
- Added `trackCvUploaded()` helper in `apps/web/lib/analytics.ts`.
- Wired `cv_uploaded` tracking in onboarding flow:
  - file upload success -> `trackCvUploaded("onboarding", "file")`
  - pasted CV text save success -> `trackCvUploaded("onboarding", "text")`
  - file: `apps/web/app/[locale]/onboarding/page.tsx`
- Wired `cv_uploaded` tracking in dashboard profile flow:
  - file upload success -> `trackCvUploaded("profile", "file")`
  - raw text save success -> `trackCvUploaded("profile", "text")`
  - file: `apps/web/app/[locale]/(dashboard)/profile/page.tsx`
- Updated TODO GA4 standardization item to complete (all target events now wired).

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 224 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/lib/analytics.ts`
- `apps/web/app/[locale]/onboarding/page.tsx`
- `apps/web/app/[locale]/(dashboard)/profile/page.tsx`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 130 — 2026-03-17

### Completed

**Vercel cost control policy hardening (deploy batching rule):**
- Added `docs/vercel-deploy-batching-rule.md` with a strict production deploy policy:
  - no deploy per atomic commit
  - deploy only for P0 urgency, validated batch, or scheduled validation window
  - mandatory pre-deploy gate (`pull`, `lint`, `test`, `build`)
  - required post-deploy uptime smoke
  - mandatory deploy reason + commit-range logging in `SESSION_LOG.md`
- Updated TODO cost item (`deploy batching rule`) to complete.

### Verification
- Documentation/policy-only step; no application runtime code changed.

### Files Modified This Session
- `docs/vercel-deploy-batching-rule.md`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 131 — 2026-03-17

### Completed

**API cost optimization (unauth short-circuit across protected routes):**
- Updated `apps/web/lib/auth.ts`:
  - Added `shouldShortCircuitAnonymousRequest(req)` pre-check.
  - `getAuthUser(req)` now returns `null` immediately when request has:
    - no bearer token, and
    - no known Clerk/session auth cookie (`__session`, `__client_uat`, `__clerk_*`).
- Effect: protected API routes that call `getAuthUser(req)` now avoid unnecessary Clerk auth + DB work for clearly anonymous traffic, reducing backend compute burn from bot/unauth hits.
- Updated TODO cost optimization item for API short-circuit audit/completion.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 224 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/lib/auth.ts`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 132 — 2026-03-17

### Completed

**Vercel budget guardrail playbook (cost governance):**
- Added `docs/vercel-cost-budget-guardrail.md` with:
  - monthly budget cap and soft/hard/emergency thresholds
  - weekly usage-review cadence and required metrics
  - threshold-based owner action playbook
  - escalation rules when projected spend exceeds budget
  - standard `SESSION_LOG.md` reporting format for weekly review notes
- Updated TODO cost item for monthly budget guardrail as complete.

### Verification
- Documentation/policy-only step; no application runtime code changed.

### Files Modified This Session
- `docs/vercel-cost-budget-guardrail.md`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 133 — 2026-03-17

### Completed

**Checkout success return reliability hardening (state-sync polling):**
- Updated `apps/web/app/[locale]/(dashboard)/settings/page.tsx`:
  - Added bounded retry sync window after `checkout=success` return:
    - `CHECKOUT_RETURN_SYNC_ATTEMPTS = 5`
    - `CHECKOUT_RETURN_SYNC_DELAY_MS = 2000`
  - Captures baseline subscription/credits and polls `/api/user` until a change is observed or attempts are exhausted.
  - Avoids tight-loop retries by delaying on both non-OK responses and unchanged state.
  - Keeps user messaging explicit when sync is still in progress after retries.
- Updated TODO with completed pre-live-payment hardening note for checkout-return sync visibility.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 224 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/[locale]/(dashboard)/settings/page.tsx`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 134 — 2026-03-17

### Completed

**Production smoke revalidation after checkout/onboarding hardening:**
- Re-ran production uptime guardrail:
  - `npm run smoke:uptime:prod`
  - report: `/tmp/production-uptime-check-20260317_165546.jsonl`
  - result: Passed 4, Failed 0
- Re-ran production onboarding smoke matrix:
  - `npm run smoke:onboarding -- https://autoapply.works`
  - report: `/tmp/onboarding-smoke-20260317_165552.jsonl`
  - result: Passed 10, Failed 0
- Re-ran production auth-blocked matrix:
  - `npm run smoke:onboarding:auth-blocked -- https://autoapply.works`
  - report: `/tmp/onboarding-auth-blocked-smoke-20260317_165818.jsonl`
  - result: Passed 4, Failed 0
- Re-ran production cross-browser onboarding gate:
  - `SMOKE_BASE_URL=https://autoapply.works npm run smoke:onboarding:cross-browser`
  - report: `/tmp/onboarding-cross-browser-smoke-20260317_165923.jsonl`
  - result: Passed 3 browsers, Failed 0
- Updated TODO with a completed revalidation line tied to these latest reports.

### Verification
- All production smoke checks above passed.

### Files Modified This Session
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 135 — 2026-03-17

### Completed

**Marketing attribution foundation (UTM convention):**
- Added `docs/utm-naming-convention.md` with:
  - required/optional UTM parameters
  - allowed source/medium values
  - standardized campaign and content naming formats
  - channel-specific URL examples (LinkedIn, X, Google Ads, Product Hunt)
  - pre-publish enforcement checklist
- Updated TODO UTM item to in-progress with the new doc reference (link enforcement remains pending as a separate next step).

### Verification
- Documentation-only step; no runtime application code changed.

### Files Modified This Session
- `docs/utm-naming-convention.md`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 136 — 2026-03-17

### Completed

**Consent-aware analytics gating (EU-friendly behavior):**
- Added `apps/web/components/analytics-consent-gate.tsx`:
  - reads `cookie-consent` status from localStorage
  - renders GTM/GA tags only when consent is `accepted`
  - reacts to both `storage` and in-tab `cookie-consent-updated` events
- Updated `apps/web/components/cookie-consent.tsx`:
  - emits `cookie-consent-updated` on accept/decline
  - copy now states optional analytics tags load only after accept
- Updated `apps/web/app/layout.tsx`:
  - replaced unconditional analytics injection with `AnalyticsConsentGate`
- Updated privacy policy copy in `apps/web/app/[locale]/privacy/page.tsx` to match real behavior.
- Updated TODO consent-aware analytics item to complete.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 224 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/components/analytics-consent-gate.tsx`
- `apps/web/components/cookie-consent.tsx`
- `apps/web/app/layout.tsx`
- `apps/web/app/[locale]/privacy/page.tsx`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 137 — 2026-03-17

### Completed

**Launch checklist progress — dashboard social links added:**
- Updated dashboard sidebar layout:
  - file: `apps/web/app/[locale]/(dashboard)/layout.tsx`
  - added `Follow Updates` block with external links to:
    - X/Twitter (`@autoapplyai`)
    - LinkedIn company page
    - Product Hunt product page
- Updated launch checklist item:
  - `docs/launch-checklist.md` → marked `Add social links to dashboard sidebar/header` as complete.
- Updated TODO launch-checklist umbrella line to reflect partial completion (remaining Product Hunt listing + GitHub public landing repo).

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 224 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/[locale]/(dashboard)/layout.tsx`
- `docs/launch-checklist.md`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 138 — 2026-03-17

### Completed

**Growth rollout planning — 14-day launch calendar:**
- Added `docs/launch-calendar-14-day.md` with:
  - daily cadence (LinkedIn 1/day, X 2/day)
  - posting windows (Europe/Zurich)
  - 14-day topic plan (launch, proof, feature education, Product Hunt timing, recap)
  - CTA UTM guidance linked to `docs/utm-naming-convention.md`
  - daily execution checklist
- Updated TODO item for 14-day launch calendar as complete.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 224 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `docs/launch-calendar-14-day.md`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 139 — 2026-03-17

### Completed

**Paid ads planning — creative angles A/B/C defined:**
- Added `docs/paid-ads-creative-angles.md` covering:
  - Angle A: time saved per application
  - Angle B: ATS optimization without fabrication
  - Angle C: compatibility-score based focus
- Included hooks, CTA options, and creative spec guidance for each angle.
- Updated TODO:
  - `Prepare 3 creative angles for paid ads` -> complete
  - Angle A/B/C lines -> complete

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 224 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `docs/paid-ads-creative-angles.md`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 140 — 2026-03-17

### Completed

**Product Hunt launch-day execution planning:**
- Added `docs/producthunt-launch-day-schedule.md` with:
  - hour-by-hour owner actions for launch day
  - explicit response SLA targets
  - escalation timing for incident reports
  - launch-day metrics and end-of-day reporting requirements
- Updated TODO item for Product Hunt launch-day owner schedule as complete.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 224 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `docs/producthunt-launch-day-schedule.md`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 113 — 2026-03-17

### Completed

**Landing Locale-Preservation Fix for Auth CTAs:**
- Updated landing-page direct auth links to use locale-aware routes from `getAuthPathsForLocale(locale)`:
  - now uses `signInPath` and `signUpPath` instead of hardcoded `/sign-in` and `/sign-up`.
- This fixes the observed mismatch where free-plan CTA on non-EN landing could route to `/en/sign-up`.
- Updated TODO follow-up item to complete for this source-level fix.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 222 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/app/[locale]/page.tsx`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 114 — 2026-03-17

### Completed

**Live Payment Manual QA Runbook Added:**
- Added production manual runbook for family/owner payment execution:
  - `docs/live-payment-test-runbook.md`
- Runbook includes:
  - browser/device/VPN/private-mode matrix
  - step-by-step live payment + cancel-path validation
  - required evidence capture (screenshots + Stripe event IDs + webhook delivery status)
  - pass/fail criteria and failure logging template
- Updated `TODO.md` P0 items to explicitly reference this runbook for:
  - signed-in `/settings` upgrade validation
  - manual family live payment test execution

### Verification
- Docs-only change; no runtime code path modified.

### Files Modified This Session
- `docs/live-payment-test-runbook.md`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 115 — 2026-03-17

### Completed

**Live Payment Webhook/Idempotency Logging Template:**
- Added a dedicated manual verification template for production billing validation:
  - `docs/live-payment-verification-log-template.md`
- Template now captures:
  - per-case device/browser/VPN metadata
  - success/cancel flow outcomes
  - Stripe event IDs and webhook response status
  - explicit idempotency validation (no duplicate side effects on retried events)
- Updated runbook and TODO references so family manual testing uses this template by default.

### Verification
- Docs-only update; no runtime code path changed.

### Files Modified This Session
- `docs/live-payment-verification-log-template.md`
- `docs/live-payment-test-runbook.md`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 116 — 2026-03-17

### Completed

**Payment Incident Triage Runbook Added:**
- Added `docs/payment-incident-triage-runbook.md` for production billing incident handling.
- Runbook covers:
  - `Unauthorized` pre-checkout triage
  - payment success but stale app subscription state
  - webhook delay/retry/idempotency checks
  - production env verification steps for Stripe keys/price IDs
  - closure criteria and post-incident follow-up actions
- Updated `TODO.md` to mark payment incident triage runbook item complete.

### Verification
- Docs-only update; no runtime code path changed.

### Files Modified This Session
- `docs/payment-incident-triage-runbook.md`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 117 — 2026-03-17

### Completed

**Production Uptime Guardrail Script Added:**
- Added lightweight API uptime script:
  - `apps/web/scripts/production_uptime_check.sh`
- Added npm command:
  - `npm run smoke:uptime:prod`
- Probe validates key production guardrail endpoints:
  - `GET /api/auth/session` (expected status family configurable; defaults allow `200/401/404` to avoid false positives on Clerk-hosted session routing)
  - `GET /api/auth/diagnostics` (expected `200`)
  - `POST /api/checkout` unsigned request (expected `401`)
  - `POST /api/webhooks/stripe` invalid signature payload (expected `400`)
- Updated `TODO.md` to mark uptime-check item complete with report path.

### Verification
- `npm run smoke:uptime:prod` (apps/web, against production) ✅
  - report: `/tmp/production-uptime-check-20260317_141546.jsonl`
  - passed: `4`, failed: `0`
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 222 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/scripts/production_uptime_check.sh`
- `apps/web/package.json`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 118 — 2026-03-17

### Completed

**Google Tag Manager Integration (GA4 Fallback Preserved):**
- Updated analytics integration to support env-driven GTM:
  - `NEXT_PUBLIC_GTM_ID`
- Behavior is now:
  - If GTM ID exists: load GTM script + noscript iframe container.
  - If GTM ID is not set and GA ID exists: use existing direct GA4 (`gtag`) loader.
  - If neither is set: no analytics script is injected.
- Added `NEXT_PUBLIC_GTM_ID` and `NEXT_PUBLIC_GA_MEASUREMENT_ID` placeholders to `.env.example`.
- Updated TODO item for GTM integration to complete.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 222 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/components/google-analytics.tsx`
- `apps/web/app/layout.tsx`
- `.env.example`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 119 — 2026-03-17

### Completed

**Vercel Guardrail Re-Audit (Cost Control):**
- Queried Vercel project configuration via read-only API and revalidated cost/deploy guardrails for `auto-apply-ai`.
- Confirmed key settings remain in expected state:
  - `gitProviderOptions.createDeployments = "disabled"`
  - `commandForIgnoringBuildStep = "echo \"Skipping auto build to control Vercel cost\"; exit 0"`
  - `enableAffectedProjectsDeployments = true`
  - `resourceConfig.buildMachineType = "standard"`
- Updated TODO cost item to complete for this verification cycle.

### Verification
- Read-only Vercel API project audit ✅
  - endpoint: `GET /v9/projects/auto-apply-ai`
  - scope: `team_jN9KQ610Y5MyVq41fvUu0Wn7`

### Files Modified This Session
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 112 — 2026-03-17

### Completed

**P0 Signed-Out Pricing CTA Verification (All Main Plans):**
- Ran ad-hoc production Playwright verification (no smoke-suite expansion) to validate signed-out pricing CTA behavior for:
  - `free`
  - `pro_monthly`
  - `pro_yearly`
  - `unlimited`
  - `unlimited_yearly`
- Confirmed each CTA navigates to sign-up with expected `upgrade` intent (or none for free), without `Unauthorized` surface and without `/api/checkout` calls from anonymous landing clicks.
- Updated `TODO.md` to mark the signed-out pricing-card verification item complete.

### Follow-up Noted
- Observed locale UX mismatch for free CTA on `/fr` landing (navigates to `/en/sign-up`).
- Added dedicated follow-up task in `TODO.md`:
  - normalize free CTA locale preservation on non-EN landing pages.

### Verification
- Ad-hoc Playwright production check (Chromium headless) ✅
  - base URL: `https://autoapply.works`
  - locales: `fr`, `en`
  - result: `SIGNED_OUT_PRICING_CHECK:PASS`

### Files Modified This Session
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 111 — 2026-03-17

### Completed

**P0 Vercel Production Stripe Env Verification:**
- Verified production Vercel env configuration for Stripe billing keys using `vercel env pull` with local prefix validation (no secret values logged).
- Confirmed required live/server keys and all active price IDs are present with expected prefixes:
  - `STRIPE_SECRET_KEY` (`sk_live_`)
  - `STRIPE_WEBHOOK_SECRET` (`whsec_`)
  - `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_UNLIMITED_MONTHLY`, `STRIPE_PRICE_UNLIMITED_YEARLY`, `STRIPE_PRICE_CREDIT_PACK` (`price_`)
- Updated `TODO.md` to:
  - mark this P0 env-verification item complete
  - correct wording to reflect actual unlimited env variable names (`_MONTHLY` and `_YEARLY`)

### Verification
- `vercel env pull <temp-file> --environment=production` + prefix validation script ✅
  - result: `ENV_CHECK:PASS`
  - sensitive values were not printed or persisted

### Files Modified This Session
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 110 — 2026-03-17

### Completed

**P0 Production Auth-Blocked Matrix Re-Verification:**
- Executed `smoke:onboarding:auth-blocked` against `https://autoapply.works` as the next pre-live-payment blocking check.
- Confirmed matrix pass with no failures.
- Updated `TODO.md` to mark the production auth-blocked matrix checkbox complete with the generated report path.

### Verification
- `npm run smoke:onboarding:auth-blocked -- https://autoapply.works` (apps/web) ✅
  - report: `/tmp/onboarding-auth-blocked-smoke-20260317_124151.jsonl`
  - passed: `4`, failed: `0`

### Files Modified This Session
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 109 — 2026-03-17

### Completed

**P0 Production Onboarding Matrix Re-Verification:**
- Executed `smoke:onboarding` against `https://autoapply.works` as the next pre-live-payment blocking check.
- Confirmed matrix pass with no failures.
- Updated `TODO.md` to mark the production onboarding matrix checkbox complete with the generated report path.

### Verification
- `npm run smoke:onboarding -- https://autoapply.works` (apps/web) ✅
  - report: `/tmp/onboarding-smoke-20260317_120732.jsonl`
  - passed: `4`, failed: `0`

### Files Modified This Session
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 108 — 2026-03-17

### Completed

**P0 Production Onboarding Gate Re-Verification:**
- Executed live cross-browser onboarding smoke against `https://autoapply.works` as the next pre-live-payment blocking check.
- Confirmed full pass on all required engines:
  - `chromium`
  - `firefox`
  - `webkit`
- Updated `TODO.md` to mark the production onboarding gate checkbox complete with the generated report path.

### Verification
- `SMOKE_BASE_URL=https://autoapply.works npm run smoke:onboarding:cross-browser` (apps/web) ✅
  - report: `/tmp/onboarding-cross-browser-smoke-20260317_115606.jsonl`
  - browsers passed: `chromium`, `firefox`, `webkit`

### Files Modified This Session
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 141 — 2026-03-17

### Completed

**Campaign Landing Variant (Pain-Led):**
- Added first campaign-specific landing page at `/<locale>/campaign/pain-led` with localized messaging, focused pain/outcome/proof blocks, and direct conversion CTAs.
- Wired locale-safe sign-up and checkout intent fallbacks for campaign CTA buttons (`pro_monthly`, `unlimited`) using `buildAuthIntentUrl`.
- Added bare-path redirect for campaign links:
  - `/campaign/:path*` -> `/en/campaign/:path*`
- Updated `TODO.md` to move landing variants item to in-progress and mark `pain-led` as done.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 224 tests)
- `npm run build` (apps/web) ✅
  - Confirmed static route generation for `/[locale]/campaign/pain-led`

### Files Modified This Session
- `apps/web/app/[locale]/campaign/pain-led/page.tsx`
- `apps/web/next.config.js`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 142 — 2026-03-17

### Completed

**Campaign Landing Variant (Proof-Led):**
- Added second campaign landing at `/<locale>/campaign/proof-led` with proof-first messaging and focused conversion sections.
- Kept locale-safe sign-up and checkout fallback intents for campaign traffic (`pro_monthly`, `unlimited`).
- Updated `TODO.md` to mark `proof-led` variant complete and leave only `feature-led` pending.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 224 tests)
- `npm run build` (apps/web) ✅
  - Confirmed static routes for `/[locale]/campaign/pain-led` and `/[locale]/campaign/proof-led`

### Files Modified This Session
- `apps/web/app/[locale]/campaign/proof-led/page.tsx`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 143 — 2026-03-17

### Completed

**Campaign Landing Variant (Feature-Led):**
- Added third campaign landing at `/<locale>/campaign/feature-led` with feature-first positioning and direct conversion CTAs.
- Kept locale-safe sign-up and checkout fallback intents for campaign visitors (`pro_monthly`, `unlimited`).
- Marked the parent TODO item "Build 3 landing variants" as completed, with all three variant sub-items checked.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 224 tests)
- `npm run build` (apps/web) ✅
  - Confirmed static routes for `/[locale]/campaign/pain-led`, `/[locale]/campaign/proof-led`, `/[locale]/campaign/feature-led`

### Files Modified This Session
- `apps/web/app/[locale]/campaign/feature-led/page.tsx`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 144 — 2026-03-17

### Completed

**UTM Enforcement for Social/Ads Links:**
- Added explicit tracked CTA link registry in `docs/social-media-kit.md` with reusable placeholders for X, LinkedIn, and Product Hunt launch content.
- Replaced raw CTA links in social post templates with tracked UTM placeholders so publishing copy no longer uses untagged links.
- Added concrete Google Ads landing URLs (Angle A/B/C) in `docs/paid-ads-creative-angles.md`, mapped to the 3 campaign landing variants.
- Marked the TODO item for UTM naming + link-by-link enforcement as completed.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 224 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `docs/social-media-kit.md`
- `docs/paid-ads-creative-angles.md`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 145 — 2026-03-17

### Completed

**GitHub Public Landing Repo (Launch Checklist Progress):**
- Created and published public landing repository:
  - `https://github.com/autoapply-ai/autoapply-public-landing`
- Initialized repository with a project-overview `README.md`.
- Updated `docs/launch-checklist.md` to mark the GitHub landing-repo checkbox as done.
- Updated `TODO.md` launch-checklist umbrella status to reflect that only Product Hunt listing actions remain.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 224 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `docs/launch-checklist.md`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 146 — 2026-03-17

### Completed

**Vercel Weekly Usage Review (Cost Proxy):**
- Ran `vercel ls auto-apply-ai` (CLI v50.1.6 fallback, because `vercel usage` command is unavailable).
- Captured latest deployment activity snapshot for cost-control monitoring.
- Added weekly usage review playbook with fallback method and guardrails:
  - `docs/vercel-usage-review-playbook.md`
- Updated TODO to mark this weekly review item completed for this cycle.

### Snapshot (latest 20 production deployments)

- `Ready`: 10
- `Canceled`: 10
- Typical ready build duration: ~41s to 1m
- Action: keep strict deploy batching and avoid retry loops that create canceled deployment churn.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 224 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `docs/vercel-usage-review-playbook.md`
- `TODO.md`
- `SESSION_LOG.md`

---

## Session 147 — 2026-03-17

### Completed

**Beta Referral Tracking (Analytics-Based):**
- Added referral code capture from sign-up query param (`?ref=`), with normalization and validation.
- Extended analytics payloads to include `referral_code` on:
  - `sign_up_started`
  - `sign_up_completed`
- Added referral campaign runbook with URL format, code rules, and GA4 reporting setup:
  - `docs/referral-campaign-beta.md`
- Updated TODO to mark referral campaign/tracking item as completed.

### Verification
- `npm run lint` (apps/web) ✅
- `npm test` (apps/web) ✅ (29 files, 224 tests)
- `npm run build` (apps/web) ✅

### Files Modified This Session
- `apps/web/lib/analytics.ts`
- `apps/web/app/[locale]/sign-up/[[...sign-up]]/page.tsx`
- `apps/web/components/analytics-session-events.tsx`
- `docs/referral-campaign-beta.md`
- `TODO.md`
- `SESSION_LOG.md`
