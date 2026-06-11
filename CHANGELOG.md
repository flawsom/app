# Changelog

All notable changes to UNIFY are documented here.

## [1.0.0] — Master Rebrand + Security Hardening

### Security
- **Rotated `JWT_SECRET`** to a fresh 64-char hex value.
- **Removed all exposed credentials** (MongoDB password, JWT secret, admin/test passwords, Resend API key, legacy LLM key) from the README and committed `.env` files in the working tree.
- **Deduped `.gitignore`** — previously had 6 duplicated `.env` blocks caused by repeated appends; now a single clean ignore list covering every secret pattern.
- **Explicit CORS allow-list** — no `*` wildcards; configurable via `EXTRA_CORS_ORIGINS`.
- **MongoDB connection timeout** added (`serverSelectionTimeoutMS=8000`) so health checks fail fast instead of hanging.
- **Global FastAPI exception handler** — logs unhandled errors and returns a safe JSON 500 with a correlation ID instead of leaking stack traces.
- **Deprecated legacy OAuth session endpoint** — returns `HTTP 410 Gone` with migration guidance.
- **Demo accounts refuse empty/weak passwords** — admin seed no-ops if `ADMIN_PASSWORD` < 6 chars.
- **Git history rewrite**: documented in README (platform-restricted; must be run by repo owner).

### Rebrand (Emergent → UNIFY)
- **Zero user-visible Emergent references** remaining in the shipped product.
- Renamed env var `EMERGENT_LLM_KEY` → `UNIFY_AI_KEY` (back-compat accepted during migration).
- Replaced the "Made with Emergent" floating badge in legacy CRA `public/index.html`.
- Rewrote the legacy CRA `App.js` to an inert UNIFY placeholder.
- Updated `public/index.html` title + meta description.
- Removed the hardcoded third-party PostHog key that shipped in the CRA template.
- Rebranded `render.yaml` comments and env-var names.
- Renamed "UNIFY Auth" from a proxy on `auth.emergentagent.com` to direct Google OAuth.
- Updated README top-to-bottom; removed all references to Emergent branding.
- Kept the dev-only ` @/visual-edits` npm package (per user decision Q1-a) — it is inert in production builds.

### UNIFY Intelligence Engine (Multi-provider AI router)
- New module `backend/unify_ai.py` with automatic failover across Anthropic Claude → OpenAI GPT-4o → Google Gemini → universal `UNIFY_AI_KEY`.
- Every AI endpoint now routes through `ai_generate()`; no feature calls a single provider directly.
- Router logs `{provider, model, latency_ms, prompt_chars, response_chars}` for every call.
- Graceful degradation: if a provider fails, the next one is tried; if all fail, a deterministic heuristic fallback returns a useful response (or a clean error).
- `/api/health` exposes live provider status.
- Endpoints migrated: `/api/recommendations/generate`, `/api/chatbot`, `/api/interview-prep`, `/api/cover-letter`, `/api/resume/analyze`, new `/api/roast-profile`.

### UNIFY Auth (direct Google OAuth)
- Replaced `POST /api/auth/google/session` (third-party proxy) with `POST /api/auth/google/verify`.
- Backend verifies Google-issued ID tokens using `google-auth` against `GOOGLE_CLIENT_ID`.
- New frontend component `<GoogleSignInButton />` renders Google Identity Services UI and posts the `credential` to the backend.
- `layout.tsx` loads the Google Identity Services script once (`afterInteractive`).
- `login` and `register` pages now use the direct button; the old redirect was removed.
- Legacy session endpoint returns `410 Gone` with instructions.

### Live data (no more demo / seeded data)
- New `backend/unify_integrations.py` with JSearch (RapidAPI) + Adzuna + Clearbit logo adapters.
- `GET /api/jobs` auto-syncs fresh live jobs from JSearch/Adzuna when the DB is thin for a student-facing query.
- `POST /api/jobs/sync-live` — admin/placement trigger to bulk-ingest live jobs on demand.
- `POST /api/seed/demo` — replaces the old hardcoded-job seeder with a live JSearch pull.
- `GET /api/trending-jobs` — augments thin DB trending with live hot postings.
- Company logos auto-filled via Clearbit's free logo endpoint when missing.
- Live results are cached in-memory with TTL (900s) to respect API quotas.

### Resume ATS scoring (real parsing)
- Server-side PDF text extraction via `pypdf` — no more "analyze the concept of a resume" against freeform text.
- Extracted text is cached on the student profile to avoid re-parsing on every analyze call.

### Rate limiting (cost protection)
- New `backend/unify_ratelimit.py` — per-user, per-endpoint, per-day quotas persisted in MongoDB.
- Enforced at the API layer (not just the frontend) for every AI endpoint.
- Admin = unlimited, Pro (is_pro flag) = moderate+, default student = low.
- Returns structured `HTTP 429` with `{used, limit, reset_at, message}` when exceeded.
- New `GET /api/ai-usage/me` returns the caller's current daily usage per endpoint.

### Observability
- New `backend/unify_logger.py` — JSON structured logging; replaces bare `print` statements.
- **Sentry** (backend + frontend) wired in opt-in mode; activates when `SENTRY_DSN_BACKEND` / `NEXT_PUBLIC_SENTRY_DSN` is set.
- **PostHog** wired on the frontend via `AnalyticsProvider`; opt-in via `NEXT_PUBLIC_POSTHOG_KEY`.
- **`/api/health`** expanded: pings MongoDB (with latency), returns AI + integration provider status, version, environment, Sentry status.
- **Database indexes** added on every hot-path field:
  - `users`: `email` (unique), `role`, `is_active`
  - `job_postings`: `status`, `employer_id`, `created_at`, `(status, created_at)`, `source`, `source_id`
  - `applications`: `(student_id, job_id)` unique, `status`, `applied_at`, `(student_id, applied_at)`, `(job_id, applied_at)`, `mentor_id`
  - `notifications`: `user_id`, `(user_id, read, created_at)`
  - `ai_usage`: `(user_id, endpoint, date)` unique, `date`
  - `behavior_events`: `user_id`, `(user_id, created_at)`
  - Plus `user_momentum`, `recommendations_cache`, `probability_predictions`, `hiring_outcomes`
- **External API timeouts** — every HTTP client call is timeout-bounded (15s default, configurable via `UNIFY_HTTP_TIMEOUT`).

### Branding
- `layout.tsx` — comprehensive metadata: title template `%s | UNIFY`, OG tags for WhatsApp/LinkedIn shares, Twitter card, PWA theme color `#010104`, Apple web-app name, robots directive.
- `manifest.json` — full PWA manifest with UNIFY branding, icons, theme color `#00E5FF`, categories.
- `public/icon.svg` — UNIFY monogram icon.
- `public/robots.txt` — allow public pages, block `/dashboard/` and `/api/`.
- New `src/app/not-found.tsx` — branded 404 page.
- New `src/app/error.tsx` — branded per-route error page.
- New `src/app/global-error.tsx` — branded fatal error page (root-level).
- New `src/components/GlobalErrorBoundary.tsx` — catches React component errors and reports to Sentry if loaded.

### Deployment
- `render.yaml` rewritten: full env-var catalog with `sync: false` for every secret, `healthCheckPath: /api/health`, `generateValue: true` for JWT.
- New `frontend/vercel.json` — security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy).
- New `backend/.env.example` and `frontend/.env.example` (safe to commit).

### Developer experience
- `CHANGELOG.md` (this file) — every change documented.
- `README.md` rewritten — clear setup + deploy guide for Render + Vercel.
- `memory/test_credentials.md` updated with new demo passwords.

### Dependencies added
- `anthropic>=0.39.0` (backend) — Claude primary provider
- `pypdf>=5.1.0` (backend) — resume PDF extraction
- `sentry-sdk[fastapi]>=2.20.0` (backend) — error tracking
- `posthog-js` (frontend) — product analytics
- `@sentry/nextjs` (frontend) — error tracking

### Breaking changes
- `EMERGENT_LLM_KEY` env var renamed to `UNIFY_AI_KEY`. Old name still accepted during migration; will be removed in v1.1.
- `POST /api/auth/google/session` returns `410 Gone`. Clients must migrate to `POST /api/auth/google/verify` + Google Identity Services.
- `DB_NAME` default changed from `project_unify` → `unify_db` (set explicitly if upgrading).
