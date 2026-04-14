# UNIFY — Adaptive Placement Intelligence Platform

> Not a job board. Not a dashboard. **A self-evolving decision engine that predicts and improves hiring outcomes.**

## Architecture

- **Backend:** FastAPI (Python) + MongoDB — `backend/server.py`
- **Frontend:** Next.js 14 (React 19, TypeScript, Tailwind CSS) — `frontend/src/`
- **Intelligence:** Self-learning model weights, behavioral tracking, predictive alerts

## Self-Evolving System (Unicorn Stack)

### Layer 1 — Self-Learning Model
- Weights stored in MongoDB (`model_weights` collection)
- Adapts on every hire/rejection outcome
- Learning rate decays as more data arrives → converges to optimal
- `GET /api/model/weights` — view current weights + version

### Layer 2 — Decision Engine
- `GET /api/next-action` — tells user exactly what to do next
- `GET /api/control` — risk level, momentum score, weekly targets
- System decides, user executes → zero cognitive load

### Layer 3 — Hiring Probability
- `POST /api/hiring-probability` — odds of getting hired per job
- Uses adaptive weights, not static scores
- Factors: skills, experience, competition, profile, timing
- Competitors show jobs. We show **odds of winning.**

### Layer 4 — Behavioral Tracking
- `GET /api/user-behavior` — obedience score, friction points, auto-fix suggestions
- Tracks: page views, actions, recommendation follows, drop-off rates
- System improves UX based on behavior — not opinion

### Layer 5 — Predictive Alerts
- `GET /api/alerts` — auto-generated high-probability job alerts
- Triggers when hire_probability > 35% and user hasn't applied
- Urgency levels based on deadline proximity

### Layer 6 — System Health Monitor
- `GET /api/system-health` — conversion rates, inactive users, model drift
- Admin/placement view of the entire system's health

### Layer 7 — Employer Advantage
- `GET /api/employer/best-candidates` — AI-ranked candidates with hire probability
- Employers don't read resumes. System shows certainty.

### Layer 8 — Feedback Loop
Every outcome (selected/rejected) auto-triggers weight adaptation:
```
User → Action → Outcome → Model Improves → Next User Benefits
```

## Deployment

### Backend (Render)
1. Set environment variables in Render dashboard:
   - `MONGO_URL` — your MongoDB Atlas connection string
   - `DB_NAME` — `project_unify`
   - `JWT_SECRET` — random 64-char hex
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`
   - `EMERGENT_LLM_KEY` — for AI features
   - `FRONTEND_URL` — your Vercel frontend URL (e.g. `https://unifies.codes`)
2. Build command: `pip install -r requirements.txt`
3. Start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
4. Root directory: `backend`

### Frontend (Vercel)
1. Set environment variable:
   - `NEXT_PUBLIC_API_URL` — your Render backend URL (e.g. `https://your-app.onrender.com`)
2. Framework: Next.js
3. Root directory: `frontend`
4. Build command: `next build`
5. Output directory: `.next`

### Key Notes for Production
- Set `FRONTEND_URL` on backend to your actual frontend domain
- Cookie settings auto-adjust: `secure=True, samesite=none, domain=.unifies.codes` when FRONTEND_URL contains `unifies.codes`
- CORS is configured to allow both `unifies.codes` and the explicit `FRONTEND_URL`

## Test Accounts
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@example.com | admin123 |
| Student | sibaprasadpanda56@gmail.com | siba-4738 |
| Mentor | mentor@unify.com | mentor123 |
| Employer | employer@unify.com | employer123 |
| Placement | placement@unify.com | placement123 |

## API Endpoints Summary
- Auth: `/api/auth/login`, `/register`, `/me`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`
- Profile: `/api/profile`, `/api/profile/strength`
- Jobs: `/api/jobs` (CRUD)
- Applications: `/api/applications` (CRUD + status + mentor-review + feedback)
- Intelligence: `/api/next-action`, `/api/control`, `/api/hiring-probability`, `/api/alerts`
- Self-Learning: `/api/model/weights`, `/api/outcomes/record`
- Behavior: `/api/user-behavior`, `/api/behavior/track`
- System: `/api/system-health`, `/api/analytics/overview`
- Employer: `/api/employer/best-candidates`
- Other: `/api/recommendations`, `/api/skill-gap`, `/api/leaderboard`, `/api/momentum`, `/api/chatbot`, `/api/certificates`, `/api/interviews`
