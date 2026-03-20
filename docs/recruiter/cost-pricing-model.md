# Recruiter Beta Cost + Pricing Model

Date: 2026-03-20 (Europe/Zurich)
Status: Draft for internal beta planning (no production pricing publish)

## 1) Scope and intent
This model estimates monthly COGS for the recruiter track at three usage bands and proposes three commercial plans:
- Starter
- Team
- Enterprise

The goal is to keep pricing competitive vs recruiter/ATS tools while preserving healthy gross margin for beta-to-GA scale.

## 2) Key assumptions (explicit)
Assumptions are intentionally conservative and should be recalibrated after local + private beta telemetry is available.

### Product usage assumptions
- Low volume (Starter-like): 500 candidate profiles/month, 2,000 candidate-to-requisition matches/month, 150 AI drafting actions/month.
- Medium volume (Team-like): 3,000 candidate profiles/month, 12,000 matches/month, 800 AI drafting actions/month.
- High volume (Enterprise-like): 15,000 candidate profiles/month, 60,000 matches/month, 5,000 AI drafting actions/month.

### AI cost assumptions (blended)
- Candidate enrichment/parsing: $0.018 per candidate profile.
- Match intelligence call: $0.0035 per match.
- AI drafting assist (message/note): $0.012 per action.

### Infra + operations assumptions
- Storage footprint: 1.2 MB avg per candidate profile.
- Effective storage+egress rate: $0.09 per GB-month.
- Search/indexing: $0.003 per candidate profile.
- Infra baseline allocation per customer/month:
  - Low: $140
  - Medium: $320
  - High: $980
- Observability/security/compliance allocation per customer/month:
  - Low: $55
  - Medium: $140
  - High: $420
- Human support allocation per customer/month:
  - Low: $40
  - Medium: $260
  - High: $980

## 3) Monthly COGS model (low / medium / high)

### Formula
`COGS = infra + observability_security + support + AI_cost + storage_and_index`

### Breakdown
| Cost component | Low | Medium | High |
|---|---:|---:|---:|
| Infra baseline | $140.00 | $320.00 | $980.00 |
| Observability/security/compliance | $55.00 | $140.00 | $420.00 |
| Support | $40.00 | $260.00 | $980.00 |
| AI usage | $17.80 | $105.60 | $540.00 |
| Storage + indexing | $1.60 | $9.30 | $46.60 |
| **Total monthly COGS** | **$254.40** | **$834.90** | **$2,966.60** |

## 4) Competitor benchmark snapshot (dated)
Benchmark snapshot date: 2026-03-20.

Important: these tools are not 1:1 products (ATS-only vs recruiter sourcing suites vs broader HR bundles), so this is directional pricing context, not strict equivalence.

| Vendor/tool | Public pricing signal | Notes |
|---|---|---|
| LinkedIn Recruiter Lite / Recruiter | LinkedIn public pages show Lite monthly/yearly billing and 30 InMails for Lite vs 150 for Recruiter; list pricing is not clearly published. Market guides commonly cite Lite around ~$170-$270 per seat/month and Recruiter Corporate as quote-based. | Strong sourcing network moat, higher enterprise quote variability. |
| Workable | Standard: $299/mo ($3,588/yr), Premier: $599/mo ($7,188/yr), Enterprise: $719/mo ($8,628/yr) for 1-20 employees view. | ATS + HR bundle framing. |
| Manatal | Annual view: $15/$35/$55 per user/month (Professional/Enterprise/Enterprise Plus). Monthly view: $19/$39/$59 per user/month. | Transparent per-seat ATS/CRM pricing. |
| Breezy HR | Startup: $157/mo annual view ($189 monthly), Growth: $273/$329, Business: $439/$529. | ATS-centric pricing with paid add-ons. |

## 5) Proposed plan packaging (beta recommendation)

### Starter — $799 / month
- Up to 3 recruiter seats
- Up to 500 candidate profiles / month
- Up to 2,000 match runs / month
- Up to 300 AI assist actions / month
- Basic dashboard + activity audit + health endpoint access

### Team — $2,390 / month
- Up to 10 recruiter seats
- Up to 3,000 candidate profiles / month
- Up to 12,000 match runs / month
- Up to 1,200 AI assist actions / month
- Team collaboration + advanced pipeline controls

### Enterprise — $8,990 / month
- Up to 30 recruiter seats
- Up to 15,000 candidate profiles / month
- Up to 60,000 match runs / month
- Up to 6,000 AI assist actions / month
- SSO-ready + priority support + rollout assistance

### Suggested overages/add-ons
- Extra seat: $95/month
- Candidate pack (1,000): $180/month
- AI assist pack (1,000 actions): $120/month

## 6) Margin view (against modeled usage bands)
| Plan | Modeled usage band | Price | Modeled COGS | Gross margin |
|---|---|---:|---:|---:|
| Starter | Low | $799.00 | $254.40 | **68.2%** |
| Team | Medium | $2,390.00 | $834.90 | **65.1%** |
| Enterprise | High | $8,990.00 | $2,966.60 | **67.0%** |

## 7) Rationale
- Starter remains above low-band COGS with enough margin to absorb support variance and onboarding friction.
- Team is positioned against mid-market ATS bundles while pricing in recruiter-specific workflow value.
- Enterprise is materially below many full-suite recruiter quote bands while preserving margin for CSM, security, and compliance overhead.

## 8) Risks and calibration triggers
Recalculate pricing if any of the following exceeds threshold for 2 consecutive months:
- AI unit cost +25% from assumption baseline.
- Support time +30% vs modeled hours.
- Enterprise average storage/index footprint +50%.
- Match operations per seat significantly above plan envelopes (sustained overage behavior).

## 9) Next calibration step (after local/private beta)
Collect and use real telemetry from:
- `/labs/recruiter` workflow event volumes
- `/api/recruiter-beta/health` failure + activity counters
- Actual support tickets/time

Then revise assumptions and publish v2 pricing model before any external pricing exposure.

## Sources (accessed 2026-03-20)
- LinkedIn Recruiter Lite product page: https://business.linkedin.com/talent-solutions/recruiter-lite
- LinkedIn Recruiter Help (billing cycle + discount language): https://www.linkedin.com/help/recruiter/answer/a6296234
- Workable pricing: https://www.workable.com/pricing
- Manatal pricing: https://www.manatal.com/pricing
- Breezy HR pricing: https://breezy.hr/pricing
- LinkedIn market estimate references (non-official, used as directional only):
  - https://juicebox.ai/blog/linkedin-recruiter-pricing
  - https://www.litespace.io/blog/linkedin-recruiter-pricing
