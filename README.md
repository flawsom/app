<div align="center">

# UNIFY

### Stop Wasting Applications. Apply Where You Can Win.

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js_14-000?style=flat-square&logo=nextdotjs)](https://nextjs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB_Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Recharts](https://img.shields.io/badge/Recharts-FF6384?style=flat-square)](https://recharts.org)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

**A self-evolving placement intelligence engine that predicts your hiring probability before you apply.**

[Live Demo](https://unifies.codes) · [ER Diagram](docs/ER_DIAGRAM.md) · [Architecture](docs/CFD_DIAGRAM.md)

</div>

---

## What Makes UNIFY Different

| Feature | Internshala | LinkedIn | UNIFY |
|---------|:-----------:|:--------:|:-----:|
| Hiring probability per job | - | - | **72%** |
| Self-learning model | - | - | **v47** |
| Next-action AI | - | - | **Live** |
| Interview prep per company | - | Paid | **Free** |
| Cover letter generator | - | - | **1-click** |
| Resume ATS scoring | Basic | Basic | **AI + gaps** |
| "Roast My Profile" | - | - | **Viral** |
| Behavioral obedience score | - | - | **Tracked** |

---

## Deployment Guide

### Backend → Render

#### Option A: Blueprint (Recommended)
1. Fork this repo to your GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click **New → Blueprint** → Connect your repo
4. Render reads `render.yaml` and auto-configures everything
5. Fill in the secret env vars when prompted

#### Option B: Manual
1. **New Web Service** → Connect GitHub repo
2. Configure:

| Setting | Value |
|---------|-------|
| **Root Directory** | `backend` |
| **Runtime** | Python 3 |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn server:app --host 0.0.0.0 --port $PORT` |

3. **Environment Variables** (add all):

```
MONGO_URL=mongodb+srv://siba4738:Siba-4738@unify.9syusec.mongodb.net/?appName=unify
DB_NAME=project_unify
JWT_SECRET=a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
EMERGENT_LLM_KEY=<your-emergent-key>
FRONTEND_URL=https://your-vercel-app.vercel.app
RESEND_API_KEY=<your-resend-key>
SENDER_EMAIL=onboarding@resend.dev
```

4. Click **Create Web Service** → Wait for deploy
5. Your backend URL will be: `https://unifies.onrender.com`

> **Important:** After Vercel deploy, come back and update `FRONTEND_URL` to your actual Vercel URL.

---

### Frontend → Vercel

1. Go to [vercel.com/new](https://vercel.com/new) → Import your GitHub repo
2. Configure:

| Setting | Value |
|---------|-------|
| **Root Directory** | `frontend` |
| **Framework** | Next.js (auto-detected) |
| **Build Command** | `next build` |
| **Output Directory** | `.next` |

3. **Environment Variables**:

```
NEXT_PUBLIC_API_URL=https://unifies.onrender.com
```

4. Click **Deploy**

> **After deploy:** Go back to Render and set `FRONTEND_URL` to your Vercel URL.

---

### Post-Deployment Checklist

- [ ] Backend health: `curl https://unifies.onrender.com/api/health`
- [ ] Login works: `curl -X POST https://unifies.onrender.com/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"admin123"}'`
- [ ] Frontend loads at your Vercel URL
- [ ] Google OAuth: Click "Continue with Google" on login page
- [ ] Update `FRONTEND_URL` on Render to match your Vercel URL

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  FRONTEND (Vercel)                                   │
│  Next.js 14 · TypeScript · Tailwind · GSAP          │
│  Recharts · TanStack Query v5 · Zustand · PWA       │
├─────────────────────┬───────────────────────────────┤
│  BACKEND (Render)   │  AI LAYER                      │
│  FastAPI · Motor    │  OpenAI GPT-4o                  │
│  PyJWT · bcrypt     │  Self-learning weights          │
│  WeasyPrint         │  Behavioral prediction          │
│  WebSockets         │  Jaccard fallback               │
├─────────────────────┼───────────────────────────────┤
│  DATA              │  AUTH                            │
│  MongoDB Atlas     │  JWT (1h + 7d refresh)           │
│  Redis (optional)  │  Google OAuth (Emergent Auth)    │
│  21 collections    │  httpOnly cookies + Bearer       │
└─────────────────────┴───────────────────────────────┘
```

---

## Features

### Intelligence Layer
- **Hiring Probability** — Per-job odds with 5-factor breakdown
- **Self-Learning Model** — Weights adapt on every hire/rejection outcome
- **Decision Engine** — "Apply to X at Y" with urgency + impact
- **Control System** — Risk level, momentum, weekly targets
- **Predictive Alerts** — High-probability job notifications
- **Behavioral Analytics** — Obedience score, friction detection

### AI Features
- **Interview Prep** — 8 company-specific questions + STAR coaching
- **Cover Letter** — 1-click tailored letter per job
- **Resume Analyzer** — ATS score, keyword gaps, rewrite suggestions
- **Career Chatbot** — Context-aware GPT-4o advisor
- **Smart Recommendations** — AI-matched jobs with transparent scoring

### Platform
- **5 Role Dashboards** — Student, Mentor, Employer, Placement, Admin
- **Recharts Analytics** — Bar, donut, radar charts + 12-week heatmap
- **WeasyPrint Certificates** — Branded PDF with SHA256 verification
- **Gamification** — XP, streaks, milestones, 5-category leaderboard
- **Dark/Light Mode** — Full theme toggle with CSS variables
- **i18n** — English, Hindi, Telugu, Tamil, Odia
- **Google OAuth** — One-click social login
- **PWA** — Installable on mobile

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

## API (36+ verified endpoints)

<details><summary><strong>All Endpoints — 100% passing</strong></summary>

| Status | Endpoint | Method |
|--------|----------|--------|
| OK | `/api/health` | GET |
| OK | `/api/auth/login` | POST |
| OK | `/api/auth/register` | POST |
| OK | `/api/auth/me` | GET |
| OK | `/api/auth/google/session` | POST |
| OK | `/api/auth/refresh` | POST |
| OK | `/api/auth/logout` | POST |
| OK | `/api/profile` | GET/PUT |
| OK | `/api/profile/strength` | GET |
| OK | `/api/jobs` | GET/POST |
| OK | `/api/applications` | GET/POST |
| OK | `/api/next-action` | GET |
| OK | `/api/control` | GET |
| OK | `/api/hiring-probability` | POST |
| OK | `/api/model/weights` | GET |
| OK | `/api/alerts` | GET |
| OK | `/api/interview-prep` | POST |
| OK | `/api/cover-letter` | POST |
| OK | `/api/resume/analyze` | POST |
| OK | `/api/chatbot` | POST |
| OK | `/api/recommendations` | GET |
| OK | `/api/certificates` | GET |
| OK | `/api/certificates/{id}/pdf` | GET |
| OK | `/api/interviews` | GET/POST |
| OK | `/api/leaderboard` | GET |
| OK | `/api/momentum` | GET |
| OK | `/api/activity-stream` | GET |
| OK | `/api/skill-gap` | GET |
| OK | `/api/user-behavior` | GET |
| OK | `/api/analytics/overview` | GET |
| OK | `/api/analytics/charts` | GET |
| OK | `/api/analytics/heatmap` | GET |
| OK | `/api/system-health` | GET |
| OK | `/api/employer/best-candidates` | GET |
| OK | `/api/trending-jobs` | GET |
| OK | `/api/notifications` | GET |

</details>

---

## Documentation

| Document | Description |
|----------|-------------|
| [ER Diagram](docs/ER_DIAGRAM.md) | 21 collections, all relationships, index strategy |
| [CFD/DFD](docs/CFD_DIAGRAM.md) | Context flow, data flow, state machine, deployment arch |
| [render.yaml](render.yaml) | One-click Render blueprint |

---

<div align="center">
<sub>Built to compound. Every user improves the model. Every outcome sharpens predictions.</sub>
</div>
