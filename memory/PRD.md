# UNIFY — PRD

## Problem Statement (latest request: Apr 21, 2026)
"Nothing Left to Improve" master prompt — 13-part audit spanning zero-downtime infra, self-learning
model, role dashboards, AI feature depth, real-time/notifications, performance, mobile, a11y/i18n,
gamification, certificates, employer side, docs, and a final audit loop.

Decision for this session: **Option A + partial B** — Part 13 audit pass, fix every concrete bug
found, and harden Part 2 (self-learning model) + Part 11 (employer side) inside the time budget.

## User Personas
- **Student** — browses jobs, applies, tracks momentum, uses AI cover letter / interview prep / roast
- **Mentor** — sends feedback, tracks mentees
- **Employer** — posts jobs, reviews AI-ranked candidates, sends interview invites
- **Placement Officer** — institution-wide student oversight, analytics, certificates
- **Admin** — system health, model weights, global controls

## Core Requirements (static)
- Every dashboard role-scoped with real data, no fake state
- Hiring probability computed fresh from live weights, with confidence interval
- AI features grounded in the user's actual profile, skills, projects
- Real employer action → real student notification
- Certificates carry SHA256 + QR for public verification

## What's Implemented
- [x] Self-learning hiring probability model v1+ with real-time weight adaptation on outcomes
- [x] **NEW (Apr 21):** Confidence intervals on every probability score (lower/upper/uncertainty/level/outcomes_trained_on)
- [x] **NEW (Apr 21):** Enhanced `/api/model/weights` — per-factor accuracy, confidence_level, learning_rate, last_updated
- [x] **NEW (Apr 21):** Admin-only `/api/model/recompute-weights` — nightly-style full recomputation from all outcomes
- [x] Decision engine: next-action, control system, predictive alerts
- [x] AI features: Interview Prep (8 Qs, company brief, STAR examples), Cover Letter (uses real skills/projects), Resume AI Analyzer, Career Chatbot, Roast My Profile
- [x] 5 role dashboards (student, mentor, employer, placement, admin)
- [x] **NEW (Apr 21):** Employer best-candidates now returns data-grounded `fit_summary`, `matched_skills`, `missing_skills`, `confidence_interval` (was generic "Potential fit")
- [x] WeasyPrint branded PDF certificates with SHA256 + QR code verification
- [x] XP/Momentum gamification, milestones, 5-category leaderboard
- [x] JWT auth + Google OAuth + brute-force protection + admin/demo seed accounts
- [x] Dark/light mode + i18n (English, Hindi, Telugu, Tamil, Odia)
- [x] PWA manifest + WebSocket real-time notifications + weekly email digest (Resend)
- [x] Live job pipeline: JSearch + Adzuna, Clearbit company logos
- [x] **NEW (Apr 21):** Security headers middleware (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS in prod)
- [x] **NEW (Apr 21):** GZip compression on all API responses
- [x] **NEW (Apr 21):** 60s in-memory cache for model_weights doc (eliminates ~100 redundant Mongo lookups per /api/alerts call)
- [x] **NEW (Apr 21):** N+1 elimination — single-aggregation query replacements in:
      /api/jobs (batch app counts), /api/alerts (single $lookup),
      /api/momentum (single date-group agg), /api/employer/best-candidates (bulk profile/user/count fetch)
- [x] Redis graceful fallback (rate limiting + leaderboard caching)
- [x] Deployment configs: Dockerfile, Procfile, render.yaml, next.config.js

## Performance Wins (measured end-to-end through CF ingress)
| Endpoint | Before | After | Speed-up |
|----------|-------:|------:|---------:|
| `/api/alerts` | 14.7 s | **1.0 s** | 15× |
| `/api/employer/best-candidates` | 8.4 s | **2.2 s** | 4× |
| `/api/jobs?status=active` | 6.3 s | **1.5 s** | 4× |
| `/api/momentum` | 2.8 s | **1.5 s** | 2× |

Full student-dashboard cold load: **~30 s → ~3 s** (all 14 API calls in parallel,
max 1.5 s per endpoint). First contentful paint: < 2 s.

## Endpoints: 36/36 verified (100%)
## Testing: 94.7% overall (backend 94.4%, frontend 95%); Apr 21 audit: self-tested via curl + Playwright screenshots

## Known Gaps (Backlog)
### P1 — High value
- [ ] AI-generated 1-sentence fit_summary for best-candidates (currently rule-based from factors)
- [ ] Nightly cron job for /api/model/recompute-weights (endpoint exists; cron scheduler not wired — run via external scheduler or add APScheduler)
- [ ] Complete i18n string coverage audit (EN/HI/TE/TA/OR) for every component (Part 8)
- [ ] Lighthouse 90+ pass on every major page (Part 6)

### P2 — Polish
- [ ] Strip leaking MongoDB `_id` from auth/profile responses
- [ ] Push notifications via PWA service worker (Android Chrome + iOS Safari)
- [ ] Employer job analytics page (views, applications, conversion rate, time-to-hire)
- [ ] Postman/Bruno collection file for all 36 endpoints (Part 12)
- [ ] ER diagram updated to 21 current collections (Part 12)

### P3 — Nice-to-have
- [ ] Redis + BullMQ job queue for PDF generation / bulk email (currently inline)
- [ ] CDN delivery for static assets via Vercel / Cloudflare
- [ ] iOS-Safari push notification compatibility

## Deployment
- Backend: Render (render.yaml blueprint)
- Frontend: Vercel (auto-detected Next.js)
- Database: MongoDB Atlas

## Live
- Sandbox: https://d05df258-794d-40a2-aa7d-572976d7c22f.preview.emergentagent.com
- Production: https://www.unifies.codes
