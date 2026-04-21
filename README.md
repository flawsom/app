# UNIFY — Adaptive Placement Intelligence

> **See your hiring probability before you apply. The system learns from every outcome.**

UNIFY is the decision engine that turns the placement process from guesswork into math. For every student × job pair, UNIFY computes a real-time hire probability, surfaces concrete skill gaps, and adapts its model the moment an outcome is recorded.

- **Frontend:** Next.js 15 (App Router) · React 18 · TypeScript · Tailwind · shadcn/ui · Framer Motion · Recharts
- **Backend:** FastAPI · Motor (async MongoDB) · APScheduler · Resend · Sentry · Pydantic
- **Data:** MongoDB Atlas (system of record) · Redis optional
- **Live data:** JSearch (RapidAPI) · Adzuna · Clearbit logos
- **Auth:** JWT (access + refresh cookies) · Google Identity Services (direct ID-token verification)
- **AI router:** Claude 3.5 Sonnet → GPT-4o → Gemini 2.0 → Universal key (graceful fallback)
- **i18n:** English · हिन्दी · తెలుగు · தமிழ் · ଓଡ଼ିଆ

---

## 1. Architecture in 90 seconds

```
Browser ─HTTPS─▶ Vercel (Next.js)  ─HTTPS─▶ Render (FastAPI) ─▶ MongoDB Atlas
                                           │               │
                                           ▼               ▼
                                  Resend (emails)    Sentry + Logs
                                           ▲
                                           │ Render Cron (curl w/ X-Cron-Secret)
```

### Key invariants
- **Resume uploads auto-fill the profile.** The backend accepts `.pdf` (via `pypdf`) and `.docx` (via `python-docx`), extracts text, heuristically splits into sections (summary / experience / education / projects / skills / certifications / achievements), then sends to the AI router to extract structured fields. Never overwrites non-empty user-set values; skills are unioned. Sections persisted for downstream matching + attribution.
- **Every application gets a tailored cover letter.** If the student doesn't provide one, `POST /api/applications` auto-generates it. `cover_letter_source` is recorded on every application so the UI can show AI / USER-WRITTEN / TEMPLATE badges.
- **Cover letters are auditable.** `POST /api/cover-letter/attribute` breaks every sentence down and shows which skill / experience / project / job requirement it came from, with the evidence quoted inline. No hallucination can hide.
- **Scheduler jobs are idempotent across replicas** via the `scheduler_locks` collection (TTL-indexed, 90s baseline, per-job overrides). APScheduler + Render Cron both converge on `run_with_lock`.
- **Every email is persisted** to `email_logs` with status (`pending → sent / permanently_failed`), attempts, Resend message id, and error. Retries use exponential backoff (0.5s → 1.5s → 4.5s).
- **All URLs are constructed from environment variables.** Zero hard-coded origins.
- **Google OAuth uses direct ID-token verification** — no third-party proxy service.
- **i18n parity is machine-enforced.** `node scripts/i18n-parity.js` fails CI on any missing key across en / hi / te / ta / or.

---

## 2. Local development

### Prerequisites
- Python 3.11+
- Node 20+ & Yarn Classic (the frontend uses `yarn`)
- MongoDB 6+ (local or Atlas)

### Setup
```bash
git clone <repo> unify && cd unify

# Backend
cd backend
cp ../.env.example .env   # or paste your own
pip install -r requirements.txt
uvicorn server:app --reload --port 8001

# Frontend (new terminal)
cd ../frontend
cp ../.env.example .env
yarn install
yarn dev   # http://localhost:3000
```

Run the i18n parity check:
```bash
node scripts/i18n-parity.js   # fails on any missing translation key
```

---

## 3. Required environment variables

### `/backend/.env`
```ini
APP_VERSION=1.0.0
ENVIRONMENT=production
FRONTEND_URL=https://www.unifies.codes
EXTRA_CORS_ORIGINS=https://unifies.codes

# ── Database ─────────────────────────
MONGO_URL=mongodb+srv://<user>:<pw>@<cluster>/?appName=unify
DB_NAME=unify_db

# ── Security ─────────────────────────
JWT_SECRET=<64-char-random>
SCHEDULER_SECRET=<32-char-random>    # required for /api/cron/* endpoints

# ── Admin + Demo ─────────────────────
ADMIN_EMAIL=admin@unifies.codes
ADMIN_PASSWORD=<change-me>
STUDENT_DEMO_PASSWORD=...
MENTOR_DEMO_PASSWORD=...
EMPLOYER_DEMO_PASSWORD=...
PLACEMENT_DEMO_PASSWORD=...

# ── UNIFY Intelligence Engine ────────
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
UNIFY_AI_KEY=
UNIFY_KEY_PROVIDER=openai
UNIFY_KEY_MODEL=gpt-4o
UNIFY_AI_TIMEOUT=45

# ── Google OAuth (UNIFY Auth) ────────
GOOGLE_CLIENT_ID=<xxx.apps.googleusercontent.com>
GOOGLE_CLIENT_SECRET=<...>

# ── Live data ────────────────────────
RAPIDAPI_KEY=
RAPIDAPI_HOST=jsearch.p.rapidapi.com
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
CLEARBIT_API_KEY=

# ── Email (Resend) ───────────────────
RESEND_API_KEY=
SENDER_EMAIL=support@unifies.codes

# ── Observability ────────────────────
SENTRY_DSN_BACKEND=
SENTRY_TRACES_SAMPLE_RATE=0.1
REDIS_URL=
UNIFY_HTTP_TIMEOUT=15
```

### `/frontend/.env`
```ini
NEXT_PUBLIC_API_URL=https://backend.unifies.codes
REACT_APP_BACKEND_URL=https://backend.unifies.codes

NEXT_PUBLIC_GOOGLE_CLIENT_ID=<xxx.apps.googleusercontent.com>

NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENV=production

NEXT_PUBLIC_APP_NAME=UNIFY
NEXT_PUBLIC_APP_URL=https://www.unifies.codes
```

---

## 4. Google OAuth — authorise every environment

In the [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials), open your OAuth 2.0 Client ID and set:

**Authorized JavaScript origins**
- `https://www.unifies.codes`
- `https://backend.unifies.codes`
- `https://unifies.codes`
- `http://localhost:3000`
- `http://localhost:8001`
- `https://<project>.vercel.app` (for each Vercel preview you want Google sign-in on)

**Authorized redirect URIs**
- Same list as above (Google requires them).

> Google does not support wildcard preview URLs — for every Vercel preview deployment you need, you must add the exact URL. For day-to-day PR previews, use a password-protected preview with ad-hoc fallbacks rather than adding dozens of origins.

If a user sees "Google sign-in failed" in production, check `Origin` in dev-tools Network tab against this list.

---

## 5. Deploy to Render + Vercel + MongoDB Atlas

### A. MongoDB Atlas
1. Create a free M0 cluster, allow access from `0.0.0.0/0` (or Render egress IPs).
2. Grab `mongodb+srv://...` → put in `MONGO_URL`.

### B. Render — backend + 4 cron jobs
1. New → Blueprint → point to this repo → select `render.yaml`.
2. Render creates:
   - `unify-api` web service (FastAPI)
   - `unify-cron-nightly-weights` (daily 02:00 UTC)
   - `unify-cron-weekly-digest` (Mondays 09:00 UTC)
   - `unify-cron-trending-refresh` (hourly :15)
   - `unify-cron-streak-resets` (daily 00:05 UTC)
3. Fill in every `sync: false` key in the dashboard. Both the web service and each cron job need `SCHEDULER_SECRET` set to the **same** value.

> Render scales `unify-api` horizontally when needed. Scheduled jobs remain safe because every `/api/cron/*` handler calls `run_with_lock(...)` against `scheduler_locks` — only one replica ever executes.

### C. Vercel — frontend
1. Import repo → framework = Next.js → root directory = `frontend`.
2. Set `NEXT_PUBLIC_API_URL` = `https://backend.unifies.codes`.
3. Add every other `NEXT_PUBLIC_*` variable from `/frontend/.env`.
4. Point `www.unifies.codes` → Vercel. Vercel handles SSL.

### D. Smoke test the full stack
```bash
# Health check
curl -s https://backend.unifies.codes/api/health | jq

# Public placement guarantee (no auth)
curl -s https://backend.unifies.codes/api/public/probability/<student_user_id> | jq

# Manual cron trigger (requires SCHEDULER_SECRET)
curl -X POST -H "X-Cron-Secret: $SCHEDULER_SECRET" \
  https://backend.unifies.codes/api/cron/trending-refresh
```

---

## 6. Observability & health dashboards

- **`GET /api/health`** — Mongo ping, AI provider status, integrations status
- **`GET /api/admin/email-logs`** (admin only) — sent / failed / retrying counts, last 50 rows
- **`POST /api/admin/email-logs/retry/:id`** — requeue a failed email
- **`POST /api/admin/email-test`** — fire any transactional email template on demand (demo safety net)
- **`POST /api/admin/model/seed-synthetic-outcomes`** — seed N plausible outcomes from real profile×job pairs and trigger weight recompute (live "the model learns" moment for demos)
- **`GET /api/model/weights`** — live weights, version, outcome count, per-factor accuracy
- **Sentry** — both frontend and backend are wired via DSN env vars

## 7. Resume → profile auto-fill + per-job cover letters

### Resume upload
- **Endpoint:** `POST /api/upload/resume` — body: `{file_data: base64, file_name: string}`
- **Formats:** `.pdf` (via `pypdf`) **and** `.docx` (via `python-docx`). Auto-detected by magic bytes + file extension. Plain text also works as a last-resort.
- **Flow:** store file → extract text → heuristic section splitter (summary / experience / education / projects / skills / certifications / achievements) → AI router extracts structured fields → merged into `student_profiles` without clobbering user-set values.
- **Response:** `{parsed_fields, parsed, auto_filled, sections_found, sections, text_length, file_type}` so the frontend can show a "Profile auto-filled from resume" toast listing exactly what was changed.
- **Fields extracted:** `first_name`, `last_name`, `skills[]`, `bio`, `phone`, `linkedin_url`, `github_url`, `cgpa`, `department`, `experience_years`.
- **Resume sections** are persisted to `student_profiles.resume_sections` so the matcher, attribution engine, and future semantic-search layer can use typed context.

### Cover letters — tailored per job, with proof
- **`POST /api/applications`** — if `cover_letter` is omitted, the backend auto-generates one via the AI router using the student's parsed profile + the full job description. Stored on the application with `cover_letter_source` (`user_provided`, `ai:<provider>`, `fallback_heuristic`).
- **`POST /api/cover-letter`** — on-demand generation from the dashboard. Rate-limited.
- **`POST /api/applications/{id}/regenerate-cover-letter`** — rewrite the stored letter from scratch. Sets `cover_letter_source` to `ai:<provider>:regenerated`. Student-only; must own the application.
- **`POST /api/cover-letter/attribute`** — per-sentence factor attribution. Returns `{sentences: [{text, sources:[{type, value, evidence}]}]}` where `type` is one of `skill`, `experience`, `education`, `project`, `job_requirement`, `company`, `greeting`, `generic`. **Students can audit exactly why the AI said what it said** — every claim is tied back to a line in their resume, their parsed skills, or the job posting, with the evidence quoted inline.
- Frontend applications tab exposes:
  - `AI` badge (cyan) / `USER-WRITTEN` badge / `TEMPLATE` badge next to every application
  - `COVER LETTER` expand/collapse button (view the stored letter)
  - `REGENERATE` button (rewrite with AI)
  - `ATTRIBUTE` button (per-sentence source breakdown with colour-coded chips)
- **No generic letters.** System prompt explicitly bans placeholders, brackets, and filler phrases. Every line references concrete skills, the role, or the company by name.

---

## 8. Lighthouse targets

Run on production (`next build && next start`) — not the dev server — and target the three hero pages:

| Page | Performance | Accessibility | Best Practices | SEO |
|------|-------------|---------------|----------------|-----|
| `/` (landing)         | 90+ | 90+ | 90+ | 90+ |
| `/login`              | 90+ | 90+ | 90+ | 90+ |
| `/dashboard/student`  | 90+ | 90+ | 90+ | 90+ |

Key practices baked in:
- `next/image` for all above-the-fold images with explicit width/height
- `next/dynamic` for heavy components (charts, PDF viewer)
- Skeleton loaders instead of spinners (`@/components/ui/Skeleton`)
- `metadata` + `viewport` on every route (see `app/layout.tsx`)
- Sitemap + robots.txt in `/frontend/public`
- CSP + HSTS + `X-Frame-Options` set by `SecurityHeadersMiddleware`

---

## 9. i18n — 100% coverage guaranteed

Five locales live in `/frontend/src/i18n/{en,hi,te,ta,or}.json`. The parity script enforces zero fallbacks to English:

```bash
node scripts/i18n-parity.js
# → OK — full parity across all locales.
```

Wire it into CI:
```yaml
# .github/workflows/ci.yml
- run: node scripts/i18n-parity.js
```

Locale persists to `localStorage` and is available through `useI18n()` — the language switcher applies it across sessions.

---

## 10. Y Combinator pitch — one paragraph

> **Every year 10M+ students in India apply to jobs they have no chance of getting.** The result: 6-month placement cycles, exhausted career cells, and hiring teams drowning in unfit applications. UNIFY replaces hope with math — a probability score for every student × job pair, built on a self-learning model that adapts on every outcome. Students apply where they can win. Employers see pre-ranked candidates with confidence intervals and transparent factor breakdowns. Placement cells finally get a CRM that doesn't just track — it steers. We ship the full stack today: AI match engine, verifiable certificates, public share-your-guarantee profile, live job feeds, weekly digest automation — in 5 Indic languages, on a stack that scales horizontally from day one.

**The wedge:** India's 45,000 colleges × 3× placement attempts per student per year × $3 SaaS seat = a TAM that funds itself in year one.

---

## 11. Licence & contact

- **Legal:** UNIFY · unifies.codes · support@unifies.codes
- **Copyright:** © UNIFY 2026
