# UNIFY — PRD (Product Requirements Document)

## Original Problem
Fix 401 Unauthorized errors, then evolve into a self-learning placement intelligence platform.

## Core Requirements
- JWT auth with Bearer tokens + httpOnly cookies
- 5 user roles: student, mentor, employer, placement, admin
- Self-learning hiring probability model
- AI-powered recommendations, interview prep, cover letters, resume analysis
- Real-time WebSocket notifications
- Recharts analytics dashboards
- Light/dark mode toggle
- WeasyPrint branded PDF certificates

## What's Been Implemented (2026-04-15)
- [x] Full auth system (JWT + cookies, dynamic production settings)
- [x] 5 role dashboards with URL-driven sidebar navigation
- [x] Self-learning model weights (adapt on outcomes)
- [x] Decision engine (next-action, control system)
- [x] Hiring probability with adaptive weights
- [x] Behavioral tracking + obedience scoring
- [x] Predictive alerts engine
- [x] Interview Prep AI (8 questions + STAR + company brief)
- [x] Cover Letter Generator (per job)
- [x] Resume AI Analyzer (ATS score, keyword gaps, rewrite suggestions)
- [x] WeasyPrint PDF certificates with UNIFY branding
- [x] Recharts: monthly bar, status donut, skill radar
- [x] 12-week activity heatmap
- [x] System health monitor
- [x] TanStack Query v5 + Zustand state management
- [x] GSAP animations on landing page
- [x] Light/dark mode with CSS variables
- [x] PWA manifest
- [x] Leaderboard (5 categories)
- [x] Momentum/XP system with milestones
- [x] AI Chatbot (GPT-4o)
- [x] Resume upload + viewer modal
- [x] CSV export
- [x] Weekly email digest via Resend
- [x] Deployment configs (Render Dockerfile + Vercel next.config.js)

## Testing Results
- Backend: 93.5% (29/31 endpoints)
- Frontend: 100%
- Overall: 96%

## Backlog
### P1
- [ ] Redis integration (rate limiting, leaderboard cache, token blacklist)
- [ ] MongoDB Atlas Search (semantic job search)
- [ ] Google OAuth
- [ ] Multi-language (i18n)

### P2
- [ ] Auto-apply with confirmation
- [ ] Employer bulk status actions
- [ ] Sentry error tracking
- [ ] GitHub Actions CI
- [ ] A/B testing system
