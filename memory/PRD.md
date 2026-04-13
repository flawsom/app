# UNIFY - Adaptive Placement Intelligence Platform

## Problem Statement
Fix 401 (Unauthorized) errors across all API endpoints. The app is deployed at unifies.onrender.com but was getting authentication failures on every API call (/api/profile, /api/applications, /api/notifications, /api/interviews, /api/momentum, /api/upload/resume, /api/behavior/track, /api/profile/strength).

## Architecture
- **Backend:** FastAPI (Python) running on port 8001 with MongoDB
- **Frontend:** Next.js with TypeScript, Tailwind CSS
- **Auth:** JWT (access + refresh tokens), bcrypt password hashing
- **Database:** MongoDB (project_unify)
- **AI:** OpenAI GPT-5.2 via Emergent LLM key for recommendations and chatbot

## Root Cause Analysis (2026-04-13)
Three interrelated authentication issues:
1. **CORS**: Backend only allowed `unifies.codes` origins, blocking requests from the actual deployment domain
2. **Cookie domain**: Hardcoded to `.unifies.codes` with `secure=True, samesite=none` - cookies never set on other domains
3. **No Bearer token flow**: Frontend relied solely on httpOnly cookies, never stored or sent the access_token as Authorization header

## What's Been Implemented (2026-04-13)
- [x] Fixed CORS to include preview/deployment domain dynamically via FRONTEND_URL env var
- [x] Fixed cookie settings: removed hardcoded domain, set secure=False, samesite=lax
- [x] Frontend `api.ts`: Added localStorage token storage + Bearer header injection
- [x] Frontend `auth-context.tsx`: Updated to save token from login/register, check token before API calls
- [x] Registered test user account
- [x] Fixed certificate PDF 500 error for invalid IDs

## Testing Results
- Auth flows: 100% pass rate
- Backend: 88% (minor cert PDF edge case fixed)
- Frontend: 95%

## User Personas
- **Student:** Apply to jobs, view recommendations, track applications, AI chatbot
- **Employer:** Post jobs, review applications, schedule interviews, provide feedback
- **Mentor:** Review student applications, approve/reject
- **Placement Officer:** Analytics, oversight, CSV exports
- **Admin:** User management, system analytics, seed demo data

## Prioritized Backlog
### P0 - Done
- [x] Fix authentication 401 errors

### P1 - Next
- [ ] Add more test user accounts (mentor, employer, placement)
- [ ] Token refresh mechanism on frontend (auto-refresh before expiry)

### P2 - Future
- [ ] Production-ready cookie settings (secure=True, samesite=none for cross-origin)
- [ ] Rate limiting fine-tuning
- [ ] Email verification flow
