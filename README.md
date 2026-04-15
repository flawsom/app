<div align="center">

# UNIFY

### The OS That Predicts & Improves Hiring Outcomes

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js_14-000?style=flat-square&logo=nextdotjs)](https://nextjs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB_Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![TanStack Query](https://img.shields.io/badge/TanStack_Query_v5-FF4154?style=flat-square)](https://tanstack.com/query)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

**Not a job board. Not a dashboard. A self-evolving decision engine.**

[Live Demo](https://unifies.codes) · [ER Diagram](docs/ER_DIAGRAM.md) · [Architecture](docs/CFD_DIAGRAM.md)

</div>

---

## Why UNIFY Exists

Every placement platform shows jobs. **UNIFY shows the odds of winning.**

While competitors build static dashboards, UNIFY runs a closed feedback loop:

```
Student → Action → Outcome → Model Improves → Next Student Benefits
```

After 1000 users, the model becomes data-trained **without ML infrastructure**. That's the moat.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (Vercel)                                               │
│  Next.js 14 · TypeScript · Tailwind · GSAP · Recharts           │
│  TanStack Query v5 · Zustand · PWA                               │
├──────────────────────┬──────────────────────────────────────────┤
│  BACKEND (Render)    │  AI LAYER                                 │
│  FastAPI · Motor     │  OpenAI GPT-4o (Emergent Key)             │
│  PyJWT · bcrypt      │  Jaccard fallback (no-key mode)           │
│  WeasyPrint          │  Self-learning adaptive weights           │
│  WebSockets          │  Behavioral prediction engine             │
├──────────────────────┼──────────────────────────────────────────┤
│  DATA               │  AUTH                                      │
│  MongoDB Atlas       │  JWT RS256 (1h access + 7d refresh)       │
│  Redis Cloud         │  Google OAuth (Emergent Auth)              │
│  21 collections      │  httpOnly cookies + Bearer tokens          │
│  7 indexes           │  bcrypt 12 rounds + brute force lock       │
└──────────────────────┴──────────────────────────────────────────┘
```

---

## Core Intelligence (What Competitors Don't Have)

### 1. Self-Learning Hiring Probability

Not match percentage — **actual probability of getting hired**.

```json
POST /api/hiring-probability
{
  "probability": 0.72,
  "factors": { "skills": 0.9, "experience": 0.4, "competition": 0.7, "profile": 0.8, "timing": 0.6 },
  "improvement": ["Apply within 24h of posting", "Add 1 backend project"],
  "model_version": 47
}
```

Weights adapt on every outcome. Version 1 uses defaults. Version 1000 uses battle-tested data.

### 2. Next-Action Decision Engine

User doesn't think. **System decides.**

```json
GET /api/next-action
{
  "next_action": "Apply to Backend Developer at TechCorp",
  "reason": "Highest match + lowest competition",
  "impact": "+72% hire probability",
  "urgency": "HIGH"
}
```

### 3. Student Control System

Replace dashboards with **control loops**.

```json
GET /api/control
{
  "risk": "HIGH",
  "momentum": 61,
  "action_required": "Apply to 7 jobs today",
  "deadline": "24 hours",
  "weekly": { "target": 7, "done": 2, "remaining": 5 }
}
```

### 4. Interview Prep AI

Generate company-specific interview questions with STAR framework coaching.

```json
POST /api/interview-prep
→ 8 questions (4 technical, 2 behavioral, 2 situational)
→ Company research brief
→ STAR answer examples
→ Do/Don't lists
```

### 5. Cover Letter Generator

One-click tailored cover letters per job application.

### 6. Resume AI Analyzer

ATS scoring, keyword gap analysis, bullet-point rewrite suggestions.

### 7. Employer Advantage

Employers don't read resumes. System shows **certainty**.

```json
GET /api/employer/best-candidates
{
  "candidates": [{
    "name": "Siba Prasad",
    "hire_probability": 0.78,
    "reason": "Exact skill match + Active applicant"
  }]
}
```

---

## Feature Matrix

| Feature | Status | Competitors |
|---------|--------|-------------|
| Self-learning model weights | **Shipped** | None have this |
| Hiring probability per job | **Shipped** | None have this |
| Next-action decision engine | **Shipped** | None have this |
| Behavioral obedience scoring | **Shipped** | None have this |
| Interview Prep AI | **Shipped** | LinkedIn (paid only) |
| Cover Letter Generator | **Shipped** | None have this |
| Resume AI Analyzer | **Shipped** | Basic on Internshala |
| WeasyPrint PDF certificates | **Shipped** | Basic HTML only |
| SHA256 tamper-proof certs | **Shipped** | None verify |
| 12-week activity heatmap | **Shipped** | GitHub only |
| Predictive job alerts | **Shipped** | None predict |
| Recharts analytics (radar/bar/donut) | **Shipped** | Basic charts |
| XP/Momentum gamification | **Shipped** | None |
| 5-category leaderboard | **Shipped** | None |
| Mentor approval gate | **Shipped** | Some |
| Google OAuth | **Shipped** | Standard |
| Dark/Light mode | **Shipped** | Standard |
| WebSocket real-time | **Shipped** | Standard |
| PWA installable | **Shipped** | Rare |
| Weekly email digest | **Shipped** | Some |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB (local or Atlas)

### Backend
```bash
cd backend
pip install -r requirements.txt
# Create .env with required variables (see below)
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend
```bash
cd frontend
yarn install
# Create .env with NEXT_PUBLIC_API_URL
yarn dev
```

---

## Deployment

### Backend → Render

| Setting | Value |
|---------|-------|
| **Root Directory** | `backend` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn server:app --host 0.0.0.0 --port $PORT` |

**Environment Variables:**

```env
MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true
DB_NAME=project_unify
JWT_SECRET=<random-64-char-hex>
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<strong-password>
EMERGENT_LLM_KEY=<your-key>
FRONTEND_URL=https://your-app.vercel.app
RESEND_API_KEY=<your-resend-key>
SENDER_EMAIL=noreply@yourdomain.com
```

### Frontend → Vercel

| Setting | Value |
|---------|-------|
| **Root Directory** | `frontend` |
| **Framework** | Next.js |
| **Build Command** | `next build` |

**Environment Variables:**

```env
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

### Production Notes
- Cookies auto-adjust when `FRONTEND_URL` contains `unifies.codes`: `secure=True`, `samesite=none`, `domain=.unifies.codes`
- CORS allows both `FRONTEND_URL` and `unifies.codes` origins
- Demo data seeds automatically on first startup (admin + 3 role accounts)
- `output: 'standalone'` in `next.config.js` optimizes Vercel deployment

---

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@example.com` | `admin123` |
| Student | `sibaprasadpanda56@gmail.com` | `siba-4738` |
| Mentor | `mentor@unify.com` | `mentor123` |
| Employer | `employer@unify.com` | `employer123` |
| Placement | `placement@unify.com` | `placement123` |

---

## API Reference (60+ Endpoints)

<details>
<summary><strong>Authentication (8)</strong></summary>

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | Public | Create account |
| POST | `/api/auth/login` | Public | Email/password login |
| POST | `/api/auth/google/session` | Public | Google OAuth exchange |
| POST | `/api/auth/logout` | JWT | Sign out |
| GET | `/api/auth/me` | JWT | Current user |
| POST | `/api/auth/refresh` | Cookie | Refresh JWT |
| POST | `/api/auth/forgot-password` | Public | Request reset |
| POST | `/api/auth/reset-password` | Public | Reset with token |
</details>

<details>
<summary><strong>Intelligence Layer (7)</strong></summary>

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/next-action` | JWT | Decision engine |
| GET | `/api/control` | Student | Risk + momentum |
| POST | `/api/hiring-probability` | Student | Per-job odds |
| GET | `/api/alerts` | Student | Predictive alerts |
| GET | `/api/model/weights` | JWT | Adaptive weights |
| POST | `/api/outcomes/record` | Employer+ | Feed outcome |
| GET | `/api/system-health` | Admin | System diagnostics |
</details>

<details>
<summary><strong>AI Features (5)</strong></summary>

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/interview-prep` | JWT | Interview questions |
| POST | `/api/cover-letter` | JWT | Tailored cover letter |
| POST | `/api/resume/analyze` | Student | ATS scoring |
| POST | `/api/recommendations/generate` | Student | AI job match |
| POST | `/api/chatbot` | JWT | Career advisor |
</details>

<details>
<summary><strong>Core Business (20+)</strong></summary>

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET/PUT | `/api/profile` | JWT | Profile CRUD |
| GET | `/api/profile/strength` | JWT | 7-field score |
| GET/POST | `/api/jobs` | JWT | Job listings |
| POST | `/api/applications` | Student | Apply to job |
| GET | `/api/applications` | JWT | List applications |
| PUT | `/api/applications/{id}/status` | Employer+ | Update status |
| PUT | `/api/applications/{id}/mentor-review` | Mentor | Approve/reject |
| GET | `/api/certificates` | JWT | List certs |
| GET | `/api/certificates/{id}/pdf` | Public | WeasyPrint PDF |
| GET | `/api/certificates/verify/{hash}` | Public | Verify cert |
| POST | `/api/interviews` | Employer+ | Schedule |
| POST | `/api/upload/resume` | Student | Upload resume |
| GET | `/api/resume/info` | Student | Resume metadata |
</details>

<details>
<summary><strong>Analytics & Engagement (10+)</strong></summary>

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/analytics/overview` | Admin+ | Platform stats |
| GET | `/api/analytics/charts` | Admin+ | Recharts data |
| GET | `/api/analytics/heatmap` | JWT | 12-week heatmap |
| GET | `/api/leaderboard` | JWT | 5-category ranking |
| GET | `/api/momentum` | JWT | XP + streaks |
| GET | `/api/activity-stream` | JWT | Recent actions |
| GET | `/api/user-behavior` | JWT | Behavior analysis |
| GET | `/api/skill-gap` | Student | Market gap analysis |
| GET | `/api/trending-jobs` | JWT | Hot jobs |
| GET | `/api/employer/best-candidates` | Employer+ | AI-ranked |
</details>

---

## Data Model

**21 MongoDB collections** — full ER diagram: [`docs/ER_DIAGRAM.md`](docs/ER_DIAGRAM.md)

Key relationships:
- `users` → `student_profiles` / `mentor_profiles` / `employer_profiles` (1:1)
- `employer_profiles` → `job_postings` (1:many)
- `job_postings` → `applications` (1:many)
- `applications` → `interviews` / `certificates` / `hiring_outcomes` (1:1)
- `model_weights` ← `hiring_outcomes` (self-learning loop)

---

## Documentation

| Document | Description |
|----------|-------------|
| [`docs/ER_DIAGRAM.md`](docs/ER_DIAGRAM.md) | Entity Relationship diagram (21 collections, all indexes) |
| [`docs/CFD_DIAGRAM.md`](docs/CFD_DIAGRAM.md) | Context Flow + Data Flow + State Machine diagrams |
| [`memory/PRD.md`](memory/PRD.md) | Product Requirements Document |

---

## The Moat

```
Rate of improvement > Competitors' rate of iteration
```

Every new user improves the model. Every outcome sharpens predictions. Every behavior signal refines UX. After 6 months of data, switching cost becomes infinite.

---

<div align="center">
<sub>Built with obsessive attention to compounding advantage.</sub>
</div>
