# UNIFY — Adaptive Placement Intelligence Platform

> Not a job board. Not a dashboard. **A self-evolving decision engine that predicts and improves hiring outcomes.**

## Architecture

| Layer | Stack |
|-------|-------|
| **Frontend** | Next.js 14 App Router, TypeScript, Tailwind CSS, GSAP, Recharts, TanStack Query v5, Zustand |
| **Backend** | FastAPI (Python 3.11), Motor (async MongoDB), PyJWT, bcrypt, WeasyPrint |
| **Database** | MongoDB 7 (Atlas), Redis 7 (planned) |
| **AI** | OpenAI GPT-4o via Emergent LLM Key |
| **Email** | Resend (transactional) |
| **Auth** | JWT (1h access + 7d refresh), httpOnly cookies + Bearer tokens, bcrypt 12 rounds |

---

## Self-Evolving System

### Layer 1 — Self-Learning Model
- Weights stored in MongoDB (`model_weights` collection), adapt on every hire/rejection
- Learning rate decays with data volume -> converges to optimal
- `GET /api/model/weights` — view weights, version, outcomes processed

### Layer 2 — Decision Engine  
- `GET /api/next-action` — tells user exactly what to do next (deadline-aware)
- `GET /api/control` — risk level, momentum score, weekly targets
- Zero cognitive load: system decides, user executes

### Layer 3 — Hiring Probability
- `POST /api/hiring-probability` — odds of getting hired per job
- Uses adaptive weights, not static scores
- 5 factors: skills, experience, competition, profile, timing

### Layer 4 — Behavioral Tracking
- `GET /api/user-behavior` — obedience score, friction detection, auto-fix suggestions
- Tracks page views, actions, recommendation follows, drop-off rates

### Layer 5 — Predictive Alerts
- `GET /api/alerts` — high-probability job alerts with deadline urgency

### Layer 6 — Interview Prep AI
- `POST /api/interview-prep` — 8 questions (technical/behavioral/situational) + STAR examples + company brief

### Layer 7 — Cover Letter Generator
- `POST /api/cover-letter` — tailored 200-word cover letter per job

### Layer 8 — Resume AI Analyzer
- `POST /api/resume/analyze` — ATS score, keyword gaps, rewrite suggestions, auto-fill

### Layer 9 — WeasyPrint PDF Certificates
- `GET /api/certificates/{id}/pdf` — branded, tamper-proof PDF with SHA256 hash

### Layer 10 — Analytics (Recharts)
- `GET /api/analytics/charts` — monthly bar, status donut, skill radar
- `GET /api/analytics/heatmap` — 12-week GitHub-style activity heatmap
- `GET /api/system-health` — conversion rates, model drift, inactive users

---

## Deployment

### Backend (Render)
1. Root directory: `backend`
2. Build: `pip install -r requirements.txt`
3. Start: `uvicorn server:app --host 0.0.0.0 --port $PORT`
4. Environment variables:
   - `MONGO_URL` — MongoDB Atlas connection string
   - `DB_NAME` — `project_unify`
   - `JWT_SECRET` — random 64-char hex
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD`
   - `EMERGENT_LLM_KEY`
   - `FRONTEND_URL` — Vercel frontend URL
   - `RESEND_API_KEY` / `SENDER_EMAIL`

### Frontend (Vercel)
1. Root directory: `frontend`
2. Framework: Next.js
3. Build: `next build`
4. Environment variables:
   - `NEXT_PUBLIC_API_URL` — Render backend URL

### Production Cookie Settings
Cookies auto-adjust when `FRONTEND_URL` contains `unifies.codes`:
- `secure=True`, `samesite=none`, `domain=.unifies.codes`

---

## Test Accounts
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@example.com | admin123 |
| Student | sibaprasadpanda56@gmail.com | siba-4738 |
| Mentor | mentor@unify.com | mentor123 |
| Employer | employer@unify.com | employer123 |
| Placement | placement@unify.com | placement123 |

---

## Complete API (60+ endpoints)

### Auth
`POST /api/auth/register` `POST /api/auth/login` `POST /api/auth/logout` `GET /api/auth/me` `POST /api/auth/refresh` `POST /api/auth/forgot-password` `POST /api/auth/reset-password`

### Intelligence
`GET /api/next-action` `GET /api/control` `POST /api/hiring-probability` `GET /api/alerts` `GET /api/model/weights` `POST /api/outcomes/record`

### AI Features
`POST /api/interview-prep` `POST /api/cover-letter` `POST /api/resume/analyze` `POST /api/chatbot` `POST /api/recommendations/generate`

### Core
`GET /api/profile` `PUT /api/profile` `GET /api/profile/strength` `GET /api/jobs` `POST /api/jobs` `POST /api/applications` `GET /api/applications` `PUT /api/applications/{id}/status` `PUT /api/applications/{id}/mentor-review` `GET /api/certificates` `GET /api/certificates/{id}/pdf` `POST /api/interviews` `GET /api/interviews`

### Analytics
`GET /api/analytics/overview` `GET /api/analytics/charts` `GET /api/analytics/heatmap` `GET /api/system-health` `GET /api/leaderboard` `GET /api/momentum` `GET /api/activity-stream` `GET /api/user-behavior` `GET /api/employer/best-candidates` `GET /api/skill-gap` `GET /api/trending-jobs`

### System
`GET /api/notifications` `PUT /api/notifications/read-all` `POST /api/behavior/track` `POST /api/upload/resume` `GET /api/resume/info` `GET /api/export/applications` `POST /api/digest/send` `POST /api/seed/demo` `GET /api/users` `WS /api/ws/{user_id}`
