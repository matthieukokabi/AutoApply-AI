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

## PROJECT STATUS AUDIT (as of Feb 2026)

### COMPLETED (do NOT rebuild these):
- Project structure & monorepo layout
- docker-compose.yml (PostgreSQL, Redis, Next.js, n8n, Gotenberg)
- .env.example with all required variables
- Prisma schema with all models (User, MasterProfile, JobPreferences, Job, Application, WorkflowError)
- Next.js web app skeleton: landing page, dashboard layout, all route pages exist
- All 3 API routes fully implemented: /api/tailor, /api/webhooks/stripe, /api/webhooks/n8n
- Clerk auth middleware
- Stripe webhook handler with subscription + credit pack support
- shadcn/ui component library (button, badge, card)
- lib/ utilities (prisma client, stripe client, cn(), date formatting)
- Both n8n workflows fully built (job-discovery-pipeline.json, single-job-tailoring.json)
- n8n HTML templates for CV and cover letter PDFs
- packages/shared-types with all TypeScript interfaces
- Flutter app structure with routing, theme, Dio client, constants
- Dockerfile for web app
- README.md

### NOT YET IMPLEMENTED (this is where work continues):

#### Web Frontend — Data Integration (PRIORITY 1)
All dashboard pages exist as UI shells but have NO data fetching, NO form handlers, NO state management:
- `apps/web/app/(dashboard)/dashboard/page.tsx` — Stats are hardcoded to 0, Kanban columns are empty shells, no API calls
- `apps/web/app/(dashboard)/jobs/page.tsx` — Search/filter inputs exist but aren't wired, no job list rendering, "Paste Job" button is non-functional
- `apps/web/app/(dashboard)/profile/page.tsx` — CV upload UI exists but no file handler, textarea not connected, structured profile form is empty
- `apps/web/app/(dashboard)/settings/page.tsx` — Preferences form UI exists but doesn't save, automation toggle non-functional, subscription display hardcoded
- `apps/web/app/(dashboard)/documents/[id]/page.tsx` — Side-by-side viewer layout exists but shows placeholders, no PDF loading

What's needed:
- API route handlers for CRUD on: user profile, master profile, job preferences, applications, jobs list
- React hooks / server actions for data fetching on each dashboard page
- Form state management (React Hook Form or similar)
- File upload handling for CV (PDF/DOCX parsing)
- Real-time or polling updates for new applications
- Loading states, error boundaries, empty states
- PDF viewer/download integration for tailored documents

#### Flutter Mobile App (PRIORITY 2)
All pages are skeleton/placeholder with empty onPressed handlers:
- `login_page.dart` — No Clerk integration, buttons do nothing
- `dashboard_page.dart` — Stats hardcoded to 0, no data fetching
- `jobs_page.dart` — Empty state only, no API calls
- `profile_page.dart` — Upload button non-functional
- `document_viewer_page.dart` — Empty tabs, no PDF loading
- `dio_client.dart` — Auth interceptor has TODO comment, no JWT injection

What's needed:
- Clerk Flutter SDK integration for auth
- Repository layer + Riverpod providers for each feature
- API client methods using Dio for all endpoints
- Form handling and validation
- File picker and upload for CV
- PDF viewer widget
- Pull-to-refresh and pagination

#### Testing (PRIORITY 3)
Zero test files exist. Need:
- Jest/Vitest for Next.js API routes
- Component tests for key dashboard pages
- LLM output validation tests (JSON schema + hallucination detection)
- Flutter widget tests and integration tests
- n8n workflow test scenarios

#### Additional Missing Features
- Legal pages (Terms of Service, Privacy Policy) — need actual page content
- GDPR data export and deletion endpoint
- Cookie consent banner
- Stripe checkout flow integration in the frontend (pricing page → checkout)
- Email notification templates
- User onboarding flow

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
- **Database ORM**: Prisma → PostgreSQL (Supabase)
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
- **Database**: PostgreSQL via Supabase ✅
- **Storage**: Supabase Storage or AWS S3 for generated PDFs
- **Auth**: Clerk (JWT verification on all API routes) ✅

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
3. **Build Next.js web app frontend functionality** ← CURRENT PRIORITY
   a. Add API routes for CRUD operations (GET/POST/PUT/DELETE for profiles, preferences, applications, jobs)
   b. Wire dashboard page to fetch real stats and applications
   c. Build functional Kanban board with drag-drop status updates
   d. Wire job feed page with search, filters, and "Paste Job" dialog
   e. Build CV upload + parsing (PDF/DOCX → text extraction → structured JSON)
   f. Wire settings page to save preferences and toggle automation
   g. Build document viewer with PDF loading and download
   h. Add Stripe checkout button to pricing section
   i. Build onboarding flow for new users
4. ~~Build and test n8n workflows~~ ✅
5. ~~Connect web app to n8n via webhook triggers~~ ✅
6. **Build Flutter mobile app functionality**
   a. Integrate Clerk Flutter SDK
   b. Build repository + provider layer for each feature
   c. Wire all pages to real API data
   d. Implement file upload, PDF viewer, forms
7. **Write tests** for API routes, components, LLM output validation, Flutter
8. Prepare deployment (Vercel for web, Railway/DO for n8n+services)
9. Create Stripe products in dashboard and connect billing
10. Write legal pages (ToS, Privacy Policy, Cookie consent)
11. Write documentation for resale package

## GIT WORKFLOW
- Branch: `main` for stable, feature branches for new work
- Commit messages: `feat:`, `fix:`, `chore:`, `docs:` prefixes
- Always push at end of session
- Always pull at start of session
