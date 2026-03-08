# AutoApply AI — Claude Code Project Instructions

## ROLE
You are a senior full-stack engineer and n8n workflow architect building a production-grade SaaS platform. Follow every instruction precisely. Ask clarifying questions before proceeding if any specification is ambiguous.

## SESSION WORKFLOW — READ THIS FIRST
This project is developed across multiple devices and sessions. At the START of every session:
1. Run `git pull origin main` to get the latest changes
2. Check `SESSION_LOG.md` in the project root for the last completed step
3. Continue from where the previous session left off

At the END of every session:
1. Update `SESSION_LOG.md` with what was completed, what's next, and any blockers
2. Run `git add -A && git commit -m "session: <brief summary>" && git push origin main`

---

## PROJECT STATUS AUDIT (as of March 2026)

### ALL CORE FEATURES ARE BUILT ✅

**IMPORTANT**: This project is feature-complete for MVP. Do NOT rebuild anything below unless fixing a bug.

#### Infrastructure & Deployment ✅
- Vercel: Next.js app deployed at https://autoapply.works (project: prj_ZwPbDeUdQnmzk8doa2AHyhsZ7Y7n, team: team_jN9KQ610Y5MyVq41fvUu0Wn7)
- Neon PostgreSQL: `ep-morning-meadow-ag8qe5hq-pooler.c-2.eu-central-1.aws.neon.tech` (Frankfurt)
- Render n8n: https://autoapply-n8n.onrender.com (srv-d6gt94d6ubrc73dqk9ag)
- Render Gotenberg: https://autoapply-gotenberg.onrender.com (srv-d6gt2uruibrs739k2j40)
- Domain: autoapply.works with SSL, Clerk CNAME, MX records
- Hostinger Business Email: contact@autoapply.works

#### Backend API — 20+ Routes ✅
- `GET/POST /api/profile` + `POST /api/profile/upload` — CV management with PDF/DOCX/TXT parsing
- `GET/PUT /api/preferences` — Job preferences CRUD
- `GET /api/applications` + `GET/PATCH /api/applications/[id]` — Applications with filters
- `GET /api/jobs` — Job feed with search/source/minScore filters
- `GET /api/stats` — Dashboard statistics
- `POST /api/tailor` — User-initiated job tailoring (triggers n8n webhook)
- `POST /api/checkout` — Stripe checkout sessions (all plans)
- `GET/PATCH /api/user` — User info + automation toggle
- `GET/DELETE /api/account` — GDPR data export + deletion
- `POST /api/auth/mobile` — Mobile JWT auth (sign-in/sign-up)
- `POST /api/webhooks/stripe` — 6 Stripe events handled
- `POST /api/webhooks/n8n` — new_applications, single_tailoring_complete, workflow_error
- `POST /api/contact` — Contact form (Resend email)
- `GET /api/cron/weekly-digest` — Weekly email digest
- `GET /api/onboarding` — Onboarding status check
- Dual auth: Clerk sessions (web) + Bearer JWT (mobile) via `lib/auth.ts`

#### Web Frontend — All Pages Wired ✅
- **Landing page** (`app/[locale]/page.tsx`) — Hero, features, pricing with CheckoutButton, footer, i18n (5 languages), JSON-LD
- **Dashboard** (`app/[locale]/(dashboard)/dashboard/page.tsx`) — Server component with real Prisma queries, stats cards, KanbanBoard
- **Jobs** (`app/[locale]/(dashboard)/jobs/page.tsx`) — Client component with debounced search, source/score filters, Paste Job dialog, Tailor CV button
- **Profile** (`app/[locale]/(dashboard)/profile/page.tsx`) — File upload (drag-drop), text paste, structured profile editor
- **Settings** (`app/[locale]/(dashboard)/settings/page.tsx`) — Preferences form, automation toggle, 14 currencies, export data, delete account
- **Documents** (`app/[locale]/(dashboard)/documents/[id]/page.tsx`) — Side-by-side original vs tailored CV (ReactMarkdown), cover letter, download buttons
- **Onboarding** (`app/[locale]/onboarding/page.tsx`) — 3-step wizard (welcome → CV upload → preferences → done)
- **Blog** (`app/[locale]/blog/`) — 6 articles × 5 languages = 30 posts, Markdown-based
- **Legal** — Terms of Service, Privacy Policy, Contact form
- **Auth** — Clerk sign-in/sign-up pages
- **KanbanBoard** (`components/kanban-board.tsx`) — @hello-pangea/dnd, drag-drop with optimistic updates + API PATCH
- **CheckoutButton** (`components/checkout-button.tsx`) — Calls /api/checkout, redirects to Stripe
- **Error boundaries** — Global, locale-level, dashboard-level
- **Cookie consent** banner
- **Theme toggle** — Dark/light mode via next-themes
- **Language switcher** — 5 languages (EN, FR, DE, ES, IT)

#### Stripe — Live Mode ✅
- All 5 products with live price IDs configured
- Webhook endpoint active (6 events)
- Customer Portal configured
- CheckoutButton components wired on pricing section

#### Flutter Mobile App — Wired ✅
- Auth: Custom JWT via /api/auth/mobile, FlutterSecureStorage
- All 5 pages wired to real API: login, dashboard, jobs, profile, document viewer
- Dio client with auth interceptor (auto-logout on 401)
- File picker for CV upload
- Riverpod state management

#### n8n Workflows — Built ✅
- Job Discovery Pipeline (7 sources: Adzuna, The Muse, Remotive, Arbeitnow, JSearch, Jooble, Reed)
- Single Job Tailoring (webhook-triggered)
- HTML templates for CV/cover letter PDFs

#### Testing — 121 Tests ✅
- 20 test files across API routes, integrations, and workflows
- Vitest + mocked Clerk/Prisma/Stripe/Resend
- All passing

#### Email System ✅
- Resend SDK: welcome, job match, tailoring complete, weekly digest, credits low
- Contact form via /api/contact

#### Branding & Social ✅
- OG images, Twitter cards, app icons, logo component
- Twitter @AutoApplyWorks, LinkedIn company page, ProductHunt maker account, GitHub org

### REMAINING WORK:

#### Operations (PRIORITY 1)
- Import n8n workflow JSON files into running Render n8n instance
- Get remaining job API keys: JSearch (RapidAPI), Jooble, Reed
- End-to-end test: paste job → n8n tailors → view documents
- Adzuna API key already configured (App ID: e2af75b6)

#### Launch Preparation (PRIORITY 2)
- ProductHunt product listing with screenshots + demo video
- Flutter native builds (iOS/Android testing)
- Monitor Stripe live payments
- Set up production monitoring/logging

#### Nice-to-Have Enhancements
- Loading skeletons (shimmer) instead of spinners
- Real-time updates via WebSocket or SSE for new applications
- Component tests for key UI components
- Flutter widget tests
- Cookie consent banner improvements

---

## PROJECT OVERVIEW
Build an AI-powered career assistant that:
1. Aggregates job listings from OFFICIAL APIs and RSS feeds (no scraping)
2. Scores job-candidate compatibility using LLM analysis
3. Generates ATS-optimized, tailored resumes and cover letters per job
4. Provides a tracking dashboard for application management
5. Optionally assists (but does NOT autonomously execute) application submission

## HARD CONSTRAINTS — NON-NEGOTIABLE
- **NO** automated login to third-party platforms (LinkedIn, Indeed, etc.)
- **NO** credential storage for third-party platforms
- **NO** CAPTCHA bypassing or anti-detect browser tooling
- **NO** headless browser automation that submits forms on external sites
- **NO** violation of any platform's Terms of Service
- **ALL** job data must come from official APIs, RSS feeds, or user-pasted content
- **GDPR-compliant** data handling with explicit consent flows and data deletion
- The platform must pass App Store review **honestly** — no disguised functionality
- Anti-hallucination guardrails on ALL LLM outputs — zero tolerance for fabricated CV content

## TECH STACK

### Frontend — Web
- **Framework**: Next.js 14 (App Router)
- **Auth**: Clerk
- **Payments**: Stripe (subscription + one-time credit packs)
- **Database ORM**: Prisma → PostgreSQL (Neon)
- **UI**: Tailwind CSS + shadcn/ui components
- **Key Pages**:
  - Landing page with value proposition + pricing ✅
  - Dashboard: Kanban board (Discovered → Tailored → Applied → Interview → Offer → Rejected)
  - CV Upload + Master Profile editor (structured JSON)
  - Job Feed browser with match scores
  - Document viewer: side-by-side original CV vs. tailored version
  - Settings: job preferences (titles, locations, salary floor, remote/hybrid/onsite)

### Frontend — Mobile
- **Framework**: Flutter
- **Architecture**: Clean Architecture (presentation / domain / data layers)
- **State Management**: Riverpod
- **Key Screens**: Mirror web dashboard
- **API Layer**: REST, same backend as web

### Backend — API
- **Runtime**: Next.js API routes (auth-gated) ✅
- **Database**: PostgreSQL via Neon (Frankfurt) ✅
- **Storage**: Generated PDFs via Gotenberg on Render
- **Auth**: Clerk sessions (web) + Bearer JWT (mobile) on all API routes ✅

### Backend — Automation Engine (n8n)
- **Hosting**: Self-hosted n8n on Docker ✅
- **Purpose**: Orchestrates job aggregation, LLM tailoring, PDF generation ✅
- **Trigger**: Scheduled (every 4 hours per user, with jitter) ✅

## n8n WORKFLOW SPECIFICATION (ALREADY BUILT — reference only)

### Workflow: "Job Discovery & Tailoring Pipeline"
- Schedule Trigger → Fetch Active Users → Aggregate Jobs (Adzuna, The Muse, Remotive, Arbeitnow) → Deduplicate → LLM Scoring (Claude) → Route (>=75 → tailor, <75 → skip) → LLM CV Tailoring → Gotenberg PDF → Store → Update DB → Notify User
- Full error handling with workflow_errors table logging

### Workflow: "User-Initiated Single Job Tailoring"
- Webhook trigger → LLM Scoring → LLM Tailoring → PDF Gen → DB Upsert → Return results

### LLM Scoring System Prompt:
```
Expert ATS analyst. Score 0-100 based on: skills match (40%), experience years (25%), education (15%), industry relevance (20%). Return JSON with compatibility_score, ats_keywords, matching_strengths, gaps, recommendation (apply/stretch/skip).
```

### LLM Tailoring System Prompt:
```
Expert ATS resume writer. NEVER fabricate experience/skills/credentials. ONLY use info from master_cv. MAY reorder, rephrase with ATS keywords, adjust summary. Output single-column Markdown CV + 250-350 word cover letter. Return JSON with tailored_cv_markdown and motivation_letter_markdown.
```

## DATABASE SCHEMA (Prisma — ALREADY BUILT)
Models: User, MasterProfile, JobPreferences, Job, Application, WorkflowError
See `apps/web/prisma/schema.prisma` for full definitions.

## STRIPE PRICING (webhook handler ALREADY BUILT)
- **Free**: 3 tailored docs/month, manual job paste only
- **Pro** ($29/mo or $249/yr): 50 docs/month, automated discovery, full dashboard
- **Unlimited** ($79/mo): Unlimited tailoring, priority processing, API access
- **Credit Pack** ($19 one-time): 10 additional documents

## REMAINING EXECUTION ORDER
1. ~~Set up monorepo structure and Docker compose~~ ✅
2. ~~Deploy database schema via Prisma~~ ✅
3. ~~Build Next.js web app frontend functionality~~ ✅ (all pages wired, all API routes built)
4. ~~Build and test n8n workflows~~ ✅
5. ~~Connect web app to n8n via webhook triggers~~ ✅
6. ~~Build Flutter mobile app functionality~~ ✅ (auth, all pages, API layer)
7. ~~Write tests~~ ✅ (121 tests, 20 files, all passing)
8. ~~Deploy to production~~ ✅ (Vercel + Render n8n + Render Gotenberg + Neon DB)
9. ~~Create Stripe products and connect billing~~ ✅ (live mode, 5 products)
10. ~~Write legal pages~~ ✅ (ToS, Privacy Policy, Contact, Cookie consent)
11. **Import n8n workflows into running Render instance** ← CURRENT PRIORITY
12. **Get remaining job API keys** (JSearch, Jooble, Reed)
13. **End-to-end test** (paste job → n8n tailors → view documents)
14. **Launch preparation** (ProductHunt, demo video, monitoring)

## GIT WORKFLOW
- Branch: `main` for stable, feature branches for new work
- Commit messages: `feat:`, `fix:`, `chore:`, `docs:` prefixes
- Always push at end of session
- Always pull at start of session
