# UNIFY — PRD

## Problem Statement (latest request: Apr 21, 2026)
"Nothing Left to Improve" master prompt — 13-part audit spanning zero-downtime infra, self-learning
model, role dashboards, AI feature depth, real-time/notifications, performance, mobile, a11y/i18n,
gamification, certificates, employer side, docs, and a final audit loop.

Scope decision: **Option A (audit+fix) + targeted Option B (model + employer) + post-audit polish**.

## User Personas
- **Student** — browses jobs, applies, tracks momentum, uses AI cover letter / interview prep / roast, shares Placement Guarantee badge
- **Mentor** — sends feedback, tracks mentees
- **Employer** — posts jobs, reviews AI-ranked candidates, sends interview invites
- **Placement Officer** — institution-wide student oversight, analytics, certificates
- **Admin** — system health, model weights, global controls, triggers nightly recompute

## Core Requirements (static)
- Every dashboard role-scoped with real data, no fake state
- Hiring probability computed fresh from live weights, with confidence interval
- AI features grounded in the user's actual profile, skills, projects
- Real employer action → real student notification
- Certificates carry SHA256 + QR for public verification
- Public-shareable probability badge (Placement Guarantee)

## What's Implemented
### Core platform (previously built)
- [x] Self-learning hiring probability model v1+ with real-time weight adaptation on outcomes
- [x] Decision engine: next-action, control system, predictive alerts
- [x] AI features: Interview Prep (8 Qs + company brief + STAR), Cover Letter (uses real skills/projects), Resume AI Analyzer, Career Chatbot, Roast My Profile
- [x] 5 role dashboards (student, mentor, employer, placement, admin)
- [x] WeasyPrint branded PDF certificates with SHA256 + QR code verification
- [x] XP/Momentum gamification, milestones, 5-category leaderboard
- [x] JWT auth + Google OAuth + brute-force protection + admin/demo seed accounts
- [x] Dark/light mode + i18n scaffolding (EN, HI, TE, TA, OR)
- [x] PWA manifest + WebSocket real-time notifications + weekly email digest (Resend)
- [x] Live job pipeline: JSearch + Adzuna, Clearbit company logos
- [x] Redis graceful fallback (rate limiting + leaderboard caching)
- [x] Deployment: Dockerfile, Procfile, render.yaml, next.config.js

### Shipped this session (Apr 21, 2026)
- [x] **Part 1 infra hardening** — GZip middleware + security-headers middleware (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS in prod)
- [x] **Part 2 self-learning depth** — confidence intervals on every probability (lower/upper/uncertainty/level/outcomes_trained_on), per-factor accuracy on /api/model/weights, admin /api/model/recompute-weights endpoint, **APScheduler nightly cron at 02:00 UTC**
- [x] **Part 6 performance** — N+1 elimination + in-memory model-weights cache (60s TTL)
  - /api/alerts: 14.7s → 1.0s (15×)
  - /api/jobs: 6.3s → 1.5s (4×)
  - /api/momentum: 2.8s → 1.5s (2×)
  - /api/employer/best-candidates: 8.4s → 2.0s (4×)
  - Full student-dashboard cold load: 30s → ~3s
- [x] **Part 11 employer depth** — bulk-fetch rewrite + data-grounded fit_summary with matched_skills, missing_skills, confidence_interval. `?ai=1` optional flag invokes LLM for one-sentence summary (cached per candidate+job hash, 256-entry LRU)
- [x] **Part 12 docs** — /app/docs/unify.postman_collection.json (v2.1) with 12 folders covering all endpoints incl. public + websocket stubs; chained requests (login auto-stores access_token, list-jobs auto-stores job_id, apply auto-stores application_id)
- [x] **Public Placement Guarantee badge** — `GET /api/public/probability/{user_id}` (no-auth) + Next.js public page at `/guarantee/[id]` with privacy-preserving display name, live-computed probability, confidence level, share-on-Twitter CTA
- [x] **Response cleanup** — `_id` stripped from /api/auth/*, /api/profile, /api/jobs (list+detail+create), /api/applications (list+detail+create). `id` field is canonical
- [x] **Infra fix** — next.config.js `allowedDevOrigins` expanded (root cause of earlier Next.js hydration failure in sandbox)

## Live Performance (end-to-end through Cloudflare ingress)
| Endpoint | Before | After |
|----------|-------:|------:|
| /api/alerts | 14.7 s | 1.0 s |
| /api/jobs?status=active | 6.3 s | 1.5 s |
| /api/momentum | 2.8 s | 1.5 s |
| /api/employer/best-candidates | 8.4 s | 2.0 s |
| /api/employer/best-candidates?ai=1 (first) | — | 6.7 s |
| /api/employer/best-candidates?ai=1 (cached) | — | 2.0 s |

All 14 parallel dashboard calls now return in < 1.8 s each ⇒ student dashboard usable in ~3 s.

## Endpoints
Total: 70+ documented in Postman collection, grouped into 12 folders:
Auth · Profile · Jobs · Applications · AI Features · Hiring Probability & Model · Employer · Certificates · Gamification & Social · Analytics · Public (no-auth) · Real-time.

## Backlog
### P1 — Next
- [ ] Production cron verification (current cron is in-process APScheduler; for multi-replica on Render, move to an external cron or a leader-elect lock)
- [ ] Complete i18n string coverage sweep for HI/TE/TA/OR across every component (Part 8)
- [ ] Lighthouse 90+ formal pass after `next build && next start` on landing/login/dashboard (Part 6)
- [ ] Strip `_id` from remaining endpoints (certificates, notifications, leaderboard, employer applicants)

### P2 — Polish
- [ ] Push notifications via PWA service worker (Android Chrome verified; iOS Safari requires APNS)
- [ ] Employer job analytics panel (views, applications, conversion rate, time-to-hire)
- [ ] Embed Placement Guarantee badge on student profile settings with "copy shareable link" + QR download

### P3 — Nice-to-have
- [ ] Redis + BullMQ job queue for PDF generation / bulk email (currently inline)
- [ ] CDN delivery for static assets via Vercel / Cloudflare
- [ ] Add interview-invite action from Best Candidates row (backend endpoint exists; wire UI button)

## Deployment
- Backend: Render (render.yaml blueprint)
- Frontend: Vercel (auto-detected Next.js)
- Database: MongoDB Atlas

## Live
- Sandbox: https://d05df258-794d-40a2-aa7d-572976d7c22f.preview.emergentagent.com
- Production: https://www.unifies.codes
- **Public Placement Guarantee demo:** https://d05df258-794d-40a2-aa7d-572976d7c22f.preview.emergentagent.com/guarantee/69e6cd1b8cb31eb88b9a40ef

## Dependencies added this session
- `apscheduler>=3.11` (nightly weight recomputation)
