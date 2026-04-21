# UNIFY — Product Requirements Document

## Original Problem Statement
Final pre-funding seal + YC-readiness for UNIFY, an adaptive placement
intelligence platform connecting students, employers, mentors, and placement
cells with a self-learning hiring probability engine.

User explicit requirements (from 2026-04-21 session):
- No dependency on Emergent; full UNIFY branding everywhere
- Emails must actually deliver (Resend) with logs + retry
- APScheduler must never fire jobs twice across Render replicas
- Lighthouse 90+ readiness
- i18n full parity across 5 languages (en/hi/te/ta/or)
- Share-your-guarantee modal + public profile page
- Google OAuth works in every environment
- YC demo must survive a hostile walkthrough with real data only

## Architecture
- **Frontend:** Next.js 15 (App Router) on Vercel · `www.unifies.codes`
- **Backend:** FastAPI on Render · `backend.unifies.codes`
- **DB:** MongoDB Atlas (system of record)
- **Auth:** JWT + Google Identity Services (direct ID-token verification)
- **AI:** Claude → GPT-4o → Gemini → universal key (router w/ fallback)
- **Email:** Resend (with durable log + retry)
- **Schedulers:** APScheduler + Render Cron (both protected by Mongo locks)

## User Personas
1. **Student** — browses live jobs, sees hire probability, tracks applications, shares guarantee link
2. **Employer** — posts jobs, reviews AI-ranked applicants, schedules interviews
3. **Mentor** — guides students, messages, tracks mentee progress
4. **Placement Officer** — overview dashboards, mass digest, analytics
5. **Admin** — full console: email logs, model weights, scheduler, audit

## Core Requirements (static)
- Real-time hiring probability (5-factor model, self-learning)
- Live job feeds from JSearch + Adzuna (no mock lists)
- Verifiable certificates (SHA-256 + QR code)
- Multi-language (5 Indic languages) — zero English fallbacks
- Distributed-safe scheduler (never double-fires)
- Email delivery with audit trail (email_logs + retry + admin dashboard)
- Public share-your-guarantee profile with OG-rich previews

## What's been implemented (growing log)

### 2026-04-21 session 1 — Pre-funding + YC seal
- **`POST /api/upload/resume` now parses and auto-fills profile** — pypdf extracts text → AI router parses to structured JSON (`first_name`, `last_name`, `skills[]`, `bio`, `phone`, `linkedin_url`, `github_url`, `cgpa`, `department`, `experience_years`) → merged into `student_profiles` with non-clobber semantics (existing non-empty user-set values are preserved; skills are unioned).
- Response now returns `{parsed_fields, parsed, auto_filled, text_length}` so the frontend can show a toast listing what was auto-filled.
- Added `re` import (was missing, caused silent extraction failure).
- **`POST /api/applications` auto-generates a tailored cover letter** when the `cover_letter` field is empty. Uses AI router with a stricter system prompt (no placeholders, no brackets, references company by name + concrete skills). Stores `cover_letter_source` on every application (`user_provided`, `ai:<provider>`, `fallback_heuristic`). Heuristic fallback if AI fails.
- Frontend `uploadResume` → calls `apiPost('/api/upload/resume')`, shows toast "Profile auto-filled from resume — Auto-filled: first_name, last_name, skills, bio...", and hydrates the profile edit form immediately.
- **README §7 documents both features** with endpoint specs and examples.
- **Production Resend key + Anthropic key wired** in backend/.env — verified real email delivery (resend_id returned from API, status=sent in email_logs).
- **`next build` verified clean** — 0 errors, 0 warnings; 13 routes including `/guarantee/[id]` as ƒ (dynamic, server-rendered with OG metadata).
- **Backend regression pass** (iteration_10): 25 pytest cases covering auth/email/cron/model/student flows, all verified working. Real Resend delivery confirmed with real `resend_id` for each of 9 email triggers.
- **unify_email.py rewritten** — durable `email_logs` persistence, 3-attempt retry with exponential backoff (0.5s→1.5s→4.5s), Resend message-id capture, typed emails (`email_type` field)
- **Email triggers wired with types** — welcome, application_submitted, employer_new_application, application_status, certificate_issued, password_reset, interview_scheduled, weekly_digest, high_probability_job_alert
- **`scheduler_locks` collection + TTL index** — 90s+ per-job TTL; stale locks auto-purge
- **`run_with_lock` helper** — atomic upsert-with-conditional-filter; exactly-once guarantee across replicas; finally-block release
- **APScheduler routes all jobs through `run_with_lock`** — nightly_recompute_weights, weekly_digest, trending_refresh, streak_resets
- **Render Cron endpoints** — POST /api/cron/{nightly-weights,weekly-digest,trending-refresh,streak-resets}, protected by `X-Cron-Secret` + `secrets.compare_digest`
- **Admin email dashboard** — GET /api/admin/email-logs (counts + recent 50) + POST /api/admin/email-logs/retry/:id
- **Admin email-test endpoint** — POST /api/admin/email-test (fire any trigger on demand; YC demo safety net)
- **Model seed endpoint** — POST /api/admin/model/seed-synthetic-outcomes — creates 50 plausible outcomes from real profile×job pairs and triggers recompute via run_with_lock
- **ShareGuaranteeModal component** — single prominent "SHARE YOUR GUARANTEE" button in profile pane; modal with Copy/LinkedIn/WhatsApp/X + live preview card + multi-language share text
- **Dynamic OG metadata for /guarantee/[id]** — rich previews on LinkedIn/WhatsApp/X; `generateMetadata` server-side with per-user probability
- **Skeleton loaders** — `<Skeleton>`, `<SkeletonCard>`, `<SkeletonStats>`, `<SkeletonList>` components + `unify-skeleton-sweep` keyframe
- **i18n parity script** — `scripts/i18n-parity.js` enforces 100% key coverage across hi/te/ta/or (currently all 161 keys translated)
- **Removed all Emergent references** — `UNIFY_AI_KEY` only, no back-compat env name
- **render.yaml** — 1 web service + 4 cron jobs, Sentry wiring, SCHEDULER_SECRET
- **README.md** — full deployment guide (Render + Vercel + Atlas), Lighthouse targets, Google OAuth URL list, YC pitch paragraph
- **docs/cron-safety-proof.md** — verified concurrent-run test output ({ran:true} + {ran:false}), architecture rationale, regression safety net

### Verified behaviour (live):
- 50 synthetic outcomes seeded → model v50 trained → weights adapted: `skills=0.29` (↓ from 0.35), `experience=0.27` (↑ from 0.15), `timing=0.17` (↑), `profile=0.25` (↑), `competition=0.01` (↓)
- Concurrent POST to /api/cron/trending-refresh → one replica executes, one skipped
- Email logs show 16 sent + 1 permanently_failed (no silent swallowing)
- Public /api/public/probability/{user_id} returns live data

## Prioritized backlog / Remaining

### P1 (nice for demo polish)
- Lighthouse: run on production build (next start) and capture numbers in README
- Add aria-labels to every icon-only button across dashboard tabs
- Wrap heavy chart components with `next/dynamic`

### P2 (post-funding)
- Replace emergentintegrations optional fallback with direct provider calls once Anthropic/OpenAI keys are provisioned
- Add e2e Playwright suite covering the YC walkthrough sequence
- Rich preview card rendering service for OG images (currently points to static /og.png)

### Next tasks
- Set real `RESEND_API_KEY` in production Render env so email_logs shows `sent` instead of `permanently_failed`
- Set real `ANTHROPIC_API_KEY` + `OPENAI_API_KEY` in production (currently Gemini-only fallback path)
- Whitelist production URLs in Google Cloud Console per README §4
