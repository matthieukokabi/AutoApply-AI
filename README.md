# AutoApply AI — Autonomous Career Assistant Platform

An AI-powered career assistant that aggregates job listings from official APIs, scores job-candidate compatibility using LLM analysis, and generates ATS-optimized tailored resumes and cover letters.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Next.js    │────▶│  PostgreSQL  │◀────│     n8n      │
│   Web App    │     │  (Supabase)  │     │  Workflows   │
│   :3000      │     │   :5432      │     │   :5678      │
└──────┬───────┘     └──────────────┘     └──────┬───────┘
       │                                         │
       │             ┌──────────────┐             │
       │             │    Redis     │             │
       └────────────▶│   :6379      │◀────────────┘
                     └──────────────┘
                                          ┌──────────────┐
                                          │  Gotenberg   │
                                          │  PDF Engine  │
                                          │   :3001      │
                                          └──────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend (Web) | Next.js 14, Tailwind CSS, shadcn/ui |
| Frontend (Mobile) | Flutter, Riverpod, Clean Architecture |
| Auth | Clerk |
| Payments | Stripe |
| Database | PostgreSQL 16 via Prisma |
| Automation | n8n (self-hosted) |
| PDF Generation | Gotenberg |
| LLM | Claude Sonnet / GPT-4o |
| Job APIs | Adzuna, The Muse, Remotive, Arbeitnow |

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- pnpm (recommended) or npm

### Setup

```bash
# 1. Clone the repo
git clone <repo-url> autoapply-ai
cd autoapply-ai

# 2. Copy environment variables
cp .env.example .env
# Fill in all required values in .env

# 3. Start all services
docker compose up -d

# 4. Run database migrations
cd apps/web
npx prisma migrate dev

# 5. Start the dev server
npm run dev
```

### Services

| Service | URL | Description |
|---------|-----|-------------|
| Web App | http://localhost:3000 | Main application |
| n8n | http://localhost:5678 | Workflow automation |
| Gotenberg | http://localhost:3001 | PDF generation |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Cache & queues |

## Project Structure

```
├── apps/
│   ├── web/              # Next.js 14 application
│   │   ├── app/          # App Router pages & API routes
│   │   ├── components/   # UI components (shadcn/ui)
│   │   ├── lib/          # Utilities, clients, helpers
│   │   └── prisma/       # Schema & migrations
│   └── mobile/           # Flutter application
│       └── lib/
│           ├── core/     # Theme, constants, DI
│           ├── features/ # Feature modules (Clean Arch)
│           └── shared/   # Shared widgets
├── packages/
│   └── shared-types/     # Shared TypeScript types
├── n8n/
│   ├── workflows/        # Exported n8n workflow JSONs
│   └── templates/        # HTML templates for PDF gen
├── docker-compose.yml
├── .env.example
└── README.md
```

## Pricing

| Plan | Price | Features |
|------|-------|----------|
| Free | $0 | 3 tailored docs/month, manual paste only |
| Pro | $29/mo or $249/yr | 50 docs/month, automated discovery |
| Unlimited | $79/mo | Unlimited tailoring, priority processing |
| Credit Pack | $19 one-time | 10 additional documents |

## Legal & Compliance

- **GDPR-compliant** data handling with explicit consent
- **No credential storage** for third-party platforms
- **No automated login** to external services
- All job data from official APIs or user input only
- Anti-hallucination guardrails on all LLM outputs
- One-click data deletion

## License

Proprietary — All rights reserved.
