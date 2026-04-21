# server.py — UNIFY: Adaptive Placement Intelligence Platform
from fastapi import FastAPI, Request, Response, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from contextlib import asynccontextmanager
from typing import Optional, List
from bson import ObjectId
from dotenv import load_dotenv
import os, jwt, bcrypt, hashlib, secrets, json, asyncio, csv, io, base64, traceback

# Load .env BEFORE importing unify_* modules (they read env at import time)
load_dotenv()

from unify_logger import setup_logger
from unify_ai import generate as ai_generate, extract_json as ai_extract_json, providers_status as ai_providers_status, UnifyAIError
from unify_ratelimit import check_and_increment, record_tokens
from unify_integrations import search_jobs_live, jsearch_search, company_logo_url, providers_status as integrations_status

logger = setup_logger("unify")

APP_VERSION = os.getenv("APP_VERSION", "1.0.0")
MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME", "unify_db")
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET or len(JWT_SECRET) < 32:
    logger.warning("weak_jwt_secret", extra={"hint": "Set a 64-char JWT_SECRET in .env"})
    JWT_SECRET = JWT_SECRET or "CHANGE_ME_INSECURE_DEFAULT_DO_NOT_USE_IN_PROD"
JWT_ALGORITHM = "HS256"
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@unifies.codes")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
# Back-compat: accept either name during migration from EMERGENT_LLM_KEY
UNIFY_AI_KEY = (os.getenv("UNIFY_AI_KEY") or os.getenv("EMERGENT_LLM_KEY") or "").strip()
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
REDIS_URL = os.getenv("REDIS_URL", "")
SENTRY_DSN_BACKEND = os.getenv("SENTRY_DSN_BACKEND", "").strip()
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# ─── Sentry (opt-in) ──────────────────────────────────────────────
if SENTRY_DSN_BACKEND:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration
        sentry_sdk.init(
            dsn=SENTRY_DSN_BACKEND,
            environment=ENVIRONMENT,
            release=f"unify-backend@{APP_VERSION}",
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
            integrations=[FastApiIntegration(), StarletteIntegration()],
            send_default_pii=False,
        )
        logger.info("sentry_initialized", extra={"env": ENVIRONMENT})
    except Exception as _e:  # pragma: no cover
        logger.warning("sentry_init_failed", extra={"error": str(_e)[:200]})

client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=8000)
db = client[DB_NAME]

# ─── Redis Graceful Fallback ──────────────────────────────────────
class RedisCache:
    """Redis wrapper with graceful fallback to in-memory dict."""
    def __init__(self):
        self._redis = None
        self._memory: dict = {}
        self._connected = False

    async def connect(self):
        if not REDIS_URL:
            logger.info("Redis: No REDIS_URL configured, using in-memory fallback")
            return
        try:
            import redis.asyncio as aioredis
            self._redis = aioredis.from_url(REDIS_URL, decode_responses=True, socket_timeout=3)
            await self._redis.ping()
            self._connected = True
            logger.info("Redis: Connected successfully")
        except Exception as e:
            logger.warning(f"Redis: Connection failed ({e}), using in-memory fallback")
            self._redis = None
            self._connected = False

    async def get(self, key: str) -> Optional[str]:
        if self._connected:
            try: return await self._redis.get(key)
            except: pass
        return self._memory.get(key)

    async def set(self, key: str, value: str, ex: int = 300):
        if self._connected:
            try: await self._redis.set(key, value, ex=ex); return
            except: pass
        self._memory[key] = value

    async def delete(self, key: str):
        if self._connected:
            try: await self._redis.delete(key); return
            except: pass
        self._memory.pop(key, None)

    async def incr(self, key: str) -> int:
        if self._connected:
            try: return await self._redis.incr(key)
            except: pass
        self._memory[key] = self._memory.get(key, 0) + 1
        return self._memory[key]

    async def expire(self, key: str, seconds: int):
        if self._connected:
            try: await self._redis.expire(key, seconds)
            except: pass

    async def ttl(self, key: str) -> int:
        if self._connected:
            try: return await self._redis.ttl(key)
            except: pass
        return -1

cache = RedisCache()

# ─── Pydantic Models ──────────────────────────────────────────────
class LoginReq(BaseModel):
    email: str
    password: str
class RegisterReq(BaseModel):
    email: str; password: str; name: str; role: str
class ProfileUpdate(BaseModel):
    first_name: Optional[str] = None; last_name: Optional[str] = None
    department: Optional[str] = None; semester: Optional[int] = None
    cgpa: Optional[float] = None; phone: Optional[str] = None
    linkedin_url: Optional[str] = None; github_url: Optional[str] = None
    resume_text: Optional[str] = None; skills: Optional[List[str]] = None
    bio: Optional[str] = None; company_name: Optional[str] = None
    company_website: Optional[str] = None; industry: Optional[str] = None
    contact_person: Optional[str] = None; contact_email: Optional[str] = None
    contact_phone: Optional[str] = None; address: Optional[str] = None
    designation: Optional[str] = None; specialization: Optional[List[str]] = None
    office_location: Optional[str] = None
class JobCreate(BaseModel):
    title: str; description: str; job_type: str = "internship"
    location: Optional[str] = None; is_remote: bool = False
    stipend_min: Optional[int] = None; stipend_max: Optional[int] = None
    duration_months: Optional[int] = None; required_skills: List[str] = []
    application_deadline: Optional[str] = None; status: str = "active"
class ApplicationCreate(BaseModel):
    job_id: str; cover_letter: Optional[str] = None
class CertificateCreate(BaseModel):
    student_id: str; application_id: Optional[str] = None
    certificate_type: str = "internship_completion"; title: str
    description: Optional[str] = None; issuer_name: Optional[str] = None
class FeedbackReq(BaseModel):
    feedback: str; rating: Optional[int] = None
class InterviewCreate(BaseModel):
    application_id: str; interview_type: str = "video"
    scheduled_date: str; duration_minutes: int = 60
    location: Optional[str] = None; meeting_link: Optional[str] = None

# ─── Auth Utilities ───────────────────────────────────────────────
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())
def create_access_token(uid: str, email: str) -> str:
    return jwt.encode({"sub": uid, "email": email, "exp": datetime.now(timezone.utc) + timedelta(hours=1), "type": "access"}, JWT_SECRET, algorithm=JWT_ALGORITHM)
def create_refresh_token(uid: str) -> str:
    return jwt.encode({"sub": uid, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}, JWT_SECRET, algorithm=JWT_ALGORITHM)
def clean_user(u):
    if not u: return None
    u["_id"] = str(u["_id"]); u["id"] = u["_id"]; u.pop("password_hash", None); return u

IS_PRODUCTION = "unifies.codes" in FRONTEND_URL
COOKIE_KW = {"httponly": True, "secure": IS_PRODUCTION, "samesite": "none" if IS_PRODUCTION else "lax", "path": "/"}
if IS_PRODUCTION: COOKIE_KW["domain"] = ".unifies.codes"

def set_auth_cookies(resp, access, refresh):
    resp.set_cookie("access_token", access, max_age=3600, **COOKIE_KW)
    resp.set_cookie("refresh_token", refresh, max_age=604800, **COOKIE_KW)
def clear_auth_cookies(resp):
    kw = {"path": "/"}
    if IS_PRODUCTION: kw["domain"] = ".unifies.codes"
    resp.delete_cookie("access_token", **kw); resp.delete_cookie("refresh_token", **kw)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "): token = auth[7:]
    if not token: raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access": raise HTTPException(401, "Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user: raise HTTPException(401, "User not found")
        return clean_user(user)
    except jwt.ExpiredSignatureError: raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError: raise HTTPException(401, "Invalid token")

def require_role(*roles):
    async def checker(request: Request):
        user = await get_current_user(request)
        if user["role"] not in roles: raise HTTPException(403, "Insufficient permissions")
        return user
    return checker

# ─── Helpers ──────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self): self.connections: dict = {}
    async def connect(self, ws, uid): await ws.accept(); self.connections.setdefault(uid, []).append(ws)
    def disconnect(self, ws, uid):
        if uid in self.connections: self.connections[uid] = [c for c in self.connections[uid] if c != ws]
    async def send_to_user(self, uid, msg):
        for ws in self.connections.get(uid, []):
            try: await ws.send_json(msg)
            except: pass
    async def broadcast(self, msg):
        for conns in self.connections.values():
            for ws in conns:
                try: await ws.send_json(msg)
                except: pass
ws_manager = ConnectionManager()

async def create_notification(uid, title, message, ntype="info", action_url=None):
    notif = {"user_id": uid, "title": title, "message": message, "type": ntype, "read": False, "action_url": action_url, "created_at": datetime.now(timezone.utc).isoformat()}
    r = await db.notifications.insert_one(notif); notif["_id"] = str(r.inserted_id); notif["id"] = notif["_id"]
    await ws_manager.send_to_user(uid, {"type": "notification", "data": notif}); return notif

async def audit_log(uid, action, details=None, ip=None):
    await db.audit_logs.insert_one({"user_id": uid, "action": action, "details": details or {}, "ip_address": ip, "created_at": datetime.now(timezone.utc).isoformat()})

# ─── Seed ─────────────────────────────────────────────────────────
# Demo accounts pull passwords from env (with sensible fallbacks). These are
# meant for local/dev demos only — rotate in production via env.
DEMO_ACCOUNTS = [
    {"email": "mentor@unifies.codes",    "password_env": "MENTOR_DEMO_PASSWORD",    "password_default": "mentor-demo-2026", "name": "Dr. Sarah Mitchell",    "role": "mentor"},
    {"email": "employer@unifies.codes",  "password_env": "EMPLOYER_DEMO_PASSWORD",  "password_default": "employer-demo-2026", "name": "TechCorp Solutions", "role": "employer"},
    {"email": "placement@unifies.codes", "password_env": "PLACEMENT_DEMO_PASSWORD", "password_default": "placement-demo-2026", "name": "Placement Officer", "role": "placement"},
    {"email": "student@unifies.codes",   "password_env": "STUDENT_DEMO_PASSWORD",   "password_default": "student-demo-2026", "name": "Demo Student",       "role": "student"},
]

async def seed_database():
    now = datetime.now(timezone.utc).isoformat()
    # Admin — requires ADMIN_PASSWORD in env; refuses to seed weak/empty.
    if not ADMIN_PASSWORD or len(ADMIN_PASSWORD) < 6:
        logger.warning("admin_seed_skipped", extra={"hint": "Set ADMIN_PASSWORD in .env"})
    else:
        admin = await db.users.find_one({"email": ADMIN_EMAIL})
        if not admin:
            await db.users.insert_one({
                "email": ADMIN_EMAIL, "password_hash": hash_password(ADMIN_PASSWORD),
                "name": "System Admin", "role": "admin", "is_active": True,
                "created_at": now, "updated_at": now,
            })
            logger.info("admin_seeded", extra={"email": ADMIN_EMAIL})
        elif not verify_password(ADMIN_PASSWORD, admin["password_hash"]):
            await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}})
            logger.info("admin_password_rotated")

    for acct in DEMO_ACCOUNTS:
        password = os.getenv(acct["password_env"], acct["password_default"])
        existing = await db.users.find_one({"email": acct["email"]})
        if existing:
            if not verify_password(password, existing["password_hash"]):
                await db.users.update_one(
                    {"email": acct["email"]},
                    {"$set": {"password_hash": hash_password(password)}},
                )
            continue
        doc = {"email": acct["email"], "password_hash": hash_password(password),
               "name": acct["name"], "role": acct["role"], "is_active": True,
               "created_at": now, "updated_at": now}
        r = await db.users.insert_one(doc); uid = str(r.inserted_id)
        if acct["role"] == "mentor":
            await db.mentor_profiles.update_one({"user_id": uid}, {"$set": {"user_id": uid, "first_name": "Sarah", "last_name": "Mitchell", "department": "Computer Science", "designation": "Professor", "created_at": now}}, upsert=True)
        elif acct["role"] == "employer":
            await db.employer_profiles.update_one({"user_id": uid}, {"$set": {"user_id": uid, "company_name": "TechCorp Solutions", "industry": "Technology", "verification_status": "verified", "created_at": now}}, upsert=True)
        elif acct["role"] == "student":
            await db.student_profiles.update_one({"user_id": uid}, {"$set": {"user_id": uid, "first_name": "Demo", "last_name": "Student", "department": "Computer Science", "skills": ["Python", "React", "Node.js"], "created_at": now}}, upsert=True)

async def create_indexes():
    # Users
    await db.users.create_index("email", unique=True)
    await db.users.create_index("role")
    await db.users.create_index("is_active")
    # Profiles
    for col in ["student_profiles", "mentor_profiles", "employer_profiles"]:
        await db[col].create_index("user_id", unique=True)
    # Jobs
    await db.job_postings.create_index("status")
    await db.job_postings.create_index("employer_id")
    await db.job_postings.create_index("created_at")
    await db.job_postings.create_index([("status", 1), ("created_at", -1)])
    await db.job_postings.create_index("job_type")
    await db.job_postings.create_index("source")
    await db.job_postings.create_index("source_id")
    # Applications
    await db.applications.create_index([("student_id", 1), ("job_id", 1)], unique=True)
    await db.applications.create_index("status")
    await db.applications.create_index("applied_at")
    await db.applications.create_index([("student_id", 1), ("applied_at", -1)])
    await db.applications.create_index([("job_id", 1), ("applied_at", -1)])
    await db.applications.create_index("mentor_id")
    # Certificates
    await db.certificates.create_index("blockchain_hash")
    await db.certificates.create_index("student_id")
    # Notifications
    await db.notifications.create_index("user_id")
    await db.notifications.create_index([("user_id", 1), ("read", 1), ("created_at", -1)])
    # Audit + security
    await db.audit_logs.create_index("user_id")
    await db.audit_logs.create_index("created_at")
    await db.login_attempts.create_index("identifier")
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    # AI & behavior
    await db.ai_usage.create_index([("user_id", 1), ("endpoint", 1), ("date", 1)], unique=True)
    await db.ai_usage.create_index("date")
    await db.behavior_events.create_index("user_id")
    await db.behavior_events.create_index([("user_id", 1), ("created_at", -1)])
    await db.user_momentum.create_index("user_id", unique=True)
    await db.recommendations_cache.create_index("user_id")
    await db.probability_predictions.create_index([("user_id", 1), ("job_id", 1)])
    await db.hiring_outcomes.create_index("application_id", unique=True)

@asynccontextmanager
async def lifespan(app):
    logger.info("startup_begin", extra={"env": ENVIRONMENT, "version": APP_VERSION})
    await cache.connect()
    try:
        await create_indexes()
    except Exception as e:  # noqa: BLE001
        logger.warning("index_creation_failed", extra={"error": str(e)[:200]})
    try:
        await seed_database()
    except Exception as e:  # noqa: BLE001
        logger.warning("seed_failed", extra={"error": str(e)[:200]})
    logger.info("startup_complete", extra={
        "ai_providers": ai_providers_status(),
        "integrations": integrations_status(),
    })
    yield
    logger.info("shutdown")

app = FastAPI(title="UNIFY API", version=APP_VERSION, lifespan=lifespan)

# CORS — explicit origin list (no wildcards). Add FRONTEND_URL at runtime.
_allowed_origins = {
    FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:3001",
    "https://www.unifies.codes",
    "https://unifies.codes",
    "https://backend.unifies.codes",
}
# Optional extra origins via env (comma-separated)
for _o in os.getenv("EXTRA_CORS_ORIGINS", "").split(","):
    _o = _o.strip()
    if _o:
        _allowed_origins.add(_o)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(_allowed_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Global error handler ────────────────────────────────────────
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Log + (optionally) Sentry-report any unhandled exception; return JSON 500."""
    logger.error(
        "unhandled_exception",
        extra={"path": str(request.url.path), "method": request.method, "error": str(exc)[:300]},
        exc_info=True,
    )
    if SENTRY_DSN_BACKEND:
        try:
            import sentry_sdk
            sentry_sdk.capture_exception(exc)
        except Exception:
            pass
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "request_id": secrets.token_hex(8)},
    )


# ─── Health ───────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    """Deep health check: pings Mongo, reports AI+integration provider status."""
    mongo_ok = False
    mongo_latency_ms = None
    try:
        import time as _t
        _t0 = _t.time()
        await asyncio.wait_for(client.admin.command("ping"), timeout=3)
        mongo_latency_ms = int((_t.time() - _t0) * 1000)
        mongo_ok = True
    except Exception as e:  # noqa: BLE001
        logger.warning("health_mongo_fail", extra={"error": str(e)[:200]})
    ai = ai_providers_status()
    any_ai = any(ai.values())
    integrations = integrations_status()
    status = "ok" if (mongo_ok and any_ai) else "degraded"
    return {
        "status": status,
        "version": APP_VERSION,
        "environment": ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mongo": {"ok": mongo_ok, "latency_ms": mongo_latency_ms},
        "ai_providers": ai,
        "integrations": integrations,
        "sentry": bool(SENTRY_DSN_BACKEND),
    }


@app.get("/")
async def root():
    return {"name": "UNIFY API", "version": APP_VERSION, "docs": "/docs"}


@app.get("/api/")
async def api_root():
    return {"message": "UNIFY API — Adaptive Placement Intelligence", "version": APP_VERSION}


@app.options("/{full_path:path}")
async def options_handler():
    return {"ok": True}

# ─── Auth Routes ──────────────────────────────────────────────────
@app.post("/api/auth/register")
async def register(req: RegisterReq, response: Response, request: Request):
    email = req.email.lower().strip()
    if req.role not in ["student", "mentor", "placement", "employer"]: raise HTTPException(400, "Invalid role")
    if await db.users.find_one({"email": email}): raise HTTPException(400, "Email already registered")
    now = datetime.now(timezone.utc).isoformat()
    user_doc = {"email": email, "password_hash": hash_password(req.password), "name": req.name, "role": req.role, "is_active": True, "created_at": now, "updated_at": now}
    r = await db.users.insert_one(user_doc); uid = str(r.inserted_id)
    if req.role == "student":
        parts = req.name.split(" ", 1)
        await db.student_profiles.insert_one({"user_id": uid, "first_name": parts[0], "last_name": parts[1] if len(parts) > 1 else "", "skills": [], "created_at": now, "updated_at": now})
    elif req.role == "mentor":
        parts = req.name.split(" ", 1)
        await db.mentor_profiles.insert_one({"user_id": uid, "first_name": parts[0], "last_name": parts[1] if len(parts) > 1 else "", "created_at": now})
    elif req.role == "employer":
        await db.employer_profiles.insert_one({"user_id": uid, "company_name": req.name, "verification_status": "pending", "created_at": now})
    access = create_access_token(uid, email); refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    await audit_log(uid, "register", {"role": req.role}, request.client.host if request.client else None)
    user_doc["_id"] = uid; user_doc["id"] = uid; user_doc.pop("password_hash", None); user_doc["access_token"] = access
    return user_doc

@app.post("/api/auth/login")
async def login(req: LoginReq, response: Response, request: Request):
    email = req.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    # Redis-first rate limiting with MongoDB fallback
    rate_key = f"login_attempts:{identifier}"
    attempts = await cache.get(rate_key)
    if attempts and int(attempts) >= 5:
        raise HTTPException(429, "Too many failed attempts. Try again in 15 minutes.")
    # MongoDB fallback check
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("attempts", 0) >= 5:
        locked = attempt.get("locked_until")
        if locked and datetime.fromisoformat(locked) > datetime.now(timezone.utc): raise HTTPException(429, "Too many failed attempts")
        else: await db.login_attempts.delete_one({"identifier": identifier})
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user["password_hash"]):
        await cache.incr(rate_key); await cache.expire(rate_key, 900)
        await db.login_attempts.update_one({"identifier": identifier}, {"$inc": {"attempts": 1}, "$set": {"locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}}, upsert=True)
        raise HTTPException(401, "Invalid email or password")
    await cache.delete(rate_key)
    await db.login_attempts.delete_one({"identifier": identifier})
    uid = str(user["_id"]); access = create_access_token(uid, email); refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    await audit_log(uid, "login", {}, ip)
    result = clean_user(user); result["access_token"] = access; return result

@app.post("/api/auth/logout")
async def logout(response: Response, request: Request):
    user = await get_current_user(request); clear_auth_cookies(response)
    # Also clear Google OAuth session
    response.delete_cookie("session_token", path="/")
    await db.user_sessions.delete_many({"user_id": user["id"]})
    await audit_log(user["id"], "logout"); return {"message": "Logged out"}

@app.get("/api/auth/me")
async def me(request: Request):
    return await get_current_user(request)

# ─── Google OAuth (UNIFY Auth — direct Google ID-token verification) ─
@app.post("/api/auth/google/verify")
async def google_auth_verify(request: Request, response: Response):
    """Verify a Google ID token (issued by Google Identity Services on the frontend)
    and exchange it for a UNIFY JWT. Replaces the legacy third-party OAuth proxy.
    """
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(500, "Google OAuth not configured on server (missing GOOGLE_CLIENT_ID)")
    body = await request.json()
    token_str = (body.get("credential") or body.get("id_token") or "").strip()
    if not token_str:
        raise HTTPException(400, "id_token / credential required")
    try:
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
        payload = await asyncio.to_thread(
            google_id_token.verify_oauth2_token,
            token_str,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("google_verify_failed", extra={"error": str(e)[:200]})
        raise HTTPException(401, "Google OAuth verification failed")
    email = (payload.get("email") or "").lower().strip()
    name = payload.get("name") or ""
    picture = payload.get("picture") or ""
    email_verified = payload.get("email_verified", False)
    if not email:
        raise HTTPException(400, "No email in Google token")
    if not email_verified:
        raise HTTPException(400, "Google email is not verified")
    now = datetime.now(timezone.utc).isoformat()
    user = await db.users.find_one({"email": email})
    if user:
        uid = str(user["_id"])
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"name": name or user.get("name", ""), "picture": picture, "auth_provider": "google", "updated_at": now}},
        )
    else:
        # Default role — student (can be escalated by admin). Role can also be
        # provided by frontend as body["role"] for self-registration.
        requested_role = body.get("role", "student")
        if requested_role not in {"student", "mentor", "employer", "placement"}:
            requested_role = "student"
        user_doc = {
            "email": email, "password_hash": "", "name": name, "role": requested_role,
            "is_active": True, "picture": picture, "auth_provider": "google",
            "created_at": now, "updated_at": now,
        }
        r = await db.users.insert_one(user_doc); uid = str(r.inserted_id)
        parts = (name or email.split("@")[0]).split(" ", 1)
        fn, ln = parts[0], (parts[1] if len(parts) > 1 else "")
        if requested_role == "student":
            await db.student_profiles.insert_one({"user_id": uid, "first_name": fn, "last_name": ln, "skills": [], "created_at": now, "updated_at": now})
        elif requested_role == "mentor":
            await db.mentor_profiles.insert_one({"user_id": uid, "first_name": fn, "last_name": ln, "created_at": now})
        elif requested_role == "employer":
            await db.employer_profiles.insert_one({"user_id": uid, "company_name": name or email, "verification_status": "pending", "created_at": now})
    access = create_access_token(uid, email); refresh_tok = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh_tok)
    await audit_log(uid, "google_login", {"email": email}, request.client.host if request.client else None)
    user_data = await db.users.find_one({"_id": ObjectId(uid)})
    result = clean_user(user_data); result["access_token"] = access; return result


# Deprecated Emergent Auth endpoint — kept temporarily to surface a clear
# 410 Gone error to any older frontend session cached in users' browsers.
@app.post("/api/auth/google/session")
async def google_auth_session_deprecated(request: Request):
    raise HTTPException(
        status_code=410,
        detail="This endpoint has been replaced. Please sign in again using the updated UNIFY Google sign-in button.",
    )

@app.post("/api/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token: raise HTTPException(401, "No refresh token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh": raise HTTPException(401, "Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user: raise HTTPException(401, "User not found")
        uid = str(user["_id"]); access = create_access_token(uid, user["email"])
        resp_kw = dict(COOKIE_KW); resp_kw["max_age"] = 3600
        response.set_cookie("access_token", access, **resp_kw)
        return {"message": "Token refreshed", "access_token": access}
    except jwt.ExpiredSignatureError: raise HTTPException(401, "Refresh token expired")
    except jwt.InvalidTokenError: raise HTTPException(401, "Invalid refresh token")

@app.post("/api/auth/forgot-password")
async def forgot_password(request: Request):
    body = await request.json(); email = body.get("email", "").lower().strip()
    user = await db.users.find_one({"email": email})
    if not user: return {"message": "If the email exists, a reset link has been sent"}
    token = secrets.token_urlsafe(32)
    await db.password_reset_tokens.insert_one({"user_id": str(user["_id"]), "token": token, "expires_at": datetime.now(timezone.utc) + timedelta(hours=1), "used": False, "created_at": datetime.now(timezone.utc).isoformat()})
    return {"message": "If the email exists, a reset link has been sent", "reset_token": token}

@app.post("/api/auth/reset-password")
async def reset_password(request: Request):
    body = await request.json(); token = body.get("token", ""); new_pw = body.get("password", "")
    if len(new_pw) < 6: raise HTTPException(400, "Password must be at least 6 characters")
    reset = await db.password_reset_tokens.find_one({"token": token, "used": False})
    if not reset: raise HTTPException(400, "Invalid or expired reset token")
    await db.users.update_one({"_id": ObjectId(reset["user_id"])}, {"$set": {"password_hash": hash_password(new_pw)}})
    await db.password_reset_tokens.update_one({"_id": reset["_id"]}, {"$set": {"used": True}})
    return {"message": "Password reset successfully"}

# ─── User Routes ──────────────────────────────────────────────────
@app.get("/api/users")
async def list_users(request: Request, role: Optional[str] = None, page: int = 1, limit: int = 20):
    await require_role("admin", "placement")(request)
    query = {}
    if role: query["role"] = role
    total = await db.users.count_documents(query)
    users = await db.users.find(query, {"password_hash": 0}).skip((page-1)*limit).limit(limit).to_list(limit)
    for u in users: u["_id"] = str(u["_id"]); u["id"] = u["_id"]
    return {"users": users, "total": total, "page": page, "limit": limit}

@app.put("/api/users/{user_id}")
async def update_user(user_id: str, request: Request):
    await require_role("admin")(request)
    body = await request.json(); update = {k: v for k, v in body.items() if k in {"name", "role", "is_active"}}
    if not update: raise HTTPException(400, "No valid fields")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update}); return {"message": "User updated"}

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    await require_role("admin")(request)
    await db.users.delete_one({"_id": ObjectId(user_id)}); return {"message": "User deleted"}

# ─── Profile Routes ───────────────────────────────────────────────
@app.get("/api/profile")
async def get_profile(request: Request):
    user = await get_current_user(request)
    profile = None
    if user["role"] == "student": profile = await db.student_profiles.find_one({"user_id": user["id"]})
    elif user["role"] == "mentor": profile = await db.mentor_profiles.find_one({"user_id": user["id"]})
    elif user["role"] == "employer": profile = await db.employer_profiles.find_one({"user_id": user["id"]})
    if profile: profile["_id"] = str(profile["_id"]); profile["id"] = profile["_id"]
    return {"user": user, "profile": profile}

@app.put("/api/profile")
async def update_profile(req: ProfileUpdate, request: Request):
    user = await get_current_user(request)
    data = {k: v for k, v in req.dict(exclude_none=True).items()}; data["updated_at"] = datetime.now(timezone.utc).isoformat()
    col = {"student": "student_profiles", "mentor": "mentor_profiles", "employer": "employer_profiles"}.get(user["role"])
    if col: await db[col].update_one({"user_id": user["id"]}, {"$set": data}, upsert=True)
    if "first_name" in data:
        await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": {"name": f"{data.get('first_name','')} {data.get('last_name','')}".strip()}})
    return {"message": "Profile updated"}

@app.get("/api/profile/strength")
async def profile_strength(request: Request):
    user = await get_current_user(request)
    profile = await db.student_profiles.find_one({"user_id": user["id"]}) if user["role"] == "student" else None
    if not profile: return {"score": 0, "max_score": 100, "sections": [], "suggestions": ["Complete your profile"]}
    checks = [("first_name","First Name",10),("last_name","Last Name",10),("department","Department",10),("cgpa","CGPA",10),("bio","Bio",15),("skills","Skills (3+)",20),("resume_text","Resume",15),("phone","Phone",5),("linkedin_url","LinkedIn",5)]
    sections, suggestions, total = [], [], 0
    for field, label, weight in checks:
        val = profile.get(field)
        filled = (isinstance(val, list) and len(val) >= 3) if field == "skills" else (val is not None and val > 0) if field == "cgpa" else bool(val)
        sections.append({"field": field, "label": label, "weight": weight, "filled": filled})
        if filled: total += weight
        else: suggestions.append(f"Add your {label.lower()}")
    return {"score": total, "max_score": 100, "sections": sections, "suggestions": suggestions[:5]}

# ─── Job Routes ───────────────────────────────────────────────────
@app.get("/api/jobs")
async def list_jobs(request: Request, status: Optional[str] = None, job_type: Optional[str] = None,
                    search: Optional[str] = None, location: Optional[str] = None, source: Optional[str] = None,
                    page: int = 1, limit: int = 20):
    """List jobs. If DB has few results and the caller is a student, live results
    from JSearch/Adzuna are merged in and persisted for future queries."""
    query = {}
    is_public_student_view = True
    try:
        user = await get_current_user(request)
        if user["role"] == "employer":
            emp = await db.employer_profiles.find_one({"user_id": user["id"]})
            if emp: query["employer_id"] = str(emp["_id"])
            is_public_student_view = False
        else:
            query["status"] = "active"
    except Exception:
        query["status"] = "active"
    if status: query["status"] = status
    if job_type: query["job_type"] = job_type
    if search: query["$or"] = [
        {"title": {"$regex": search, "$options": "i"}},
        {"description": {"$regex": search, "$options": "i"}},
        {"company_name": {"$regex": search, "$options": "i"}},
        {"required_skills": {"$regex": search, "$options": "i"}},
    ]
    # If student-facing view and DB is thin, trigger a background-ish sync first.
    if is_public_student_view and page == 1 and source != "db":
        db_count_estimate = await db.job_postings.count_documents({"status": "active"})
        if db_count_estimate < 6 or source == "live":
            try:
                q = search or "software intern"
                await _sync_live_jobs_to_db(queries=[q], location=location or "India")
            except Exception as e:  # noqa: BLE001
                logger.warning("inline_live_sync_failed", extra={"error": str(e)[:200]})
    total = await db.job_postings.count_documents(query)
    jobs = await db.job_postings.find(query).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    for j in jobs:
        j["_id"] = str(j["_id"]); j["id"] = j["_id"]
        j["application_count"] = await db.applications.count_documents({"job_id": j["id"]})
        if not j.get("company_logo") and j.get("company_name"):
            j["company_logo"] = company_logo_url(j["company_name"])
    return {"jobs": jobs, "total": total, "page": page, "limit": limit}

@app.post("/api/jobs")
async def create_job(req: JobCreate, request: Request):
    user = await require_role("employer", "placement", "admin")(request)
    emp = await db.employer_profiles.find_one({"user_id": user["id"]})
    doc = req.dict(); doc["employer_id"] = str(emp["_id"]) if emp else user["id"]; doc["employer_user_id"] = user["id"]
    doc["company_name"] = emp["company_name"] if emp else user.get("name", "Unknown")
    doc["created_at"] = datetime.now(timezone.utc).isoformat(); doc["updated_at"] = doc["created_at"]
    if not doc.get("application_deadline"): doc["application_deadline"] = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    r = await db.job_postings.insert_one(doc); doc["_id"] = str(r.inserted_id); doc["id"] = doc["_id"]
    return doc

@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str):
    job = await db.job_postings.find_one({"_id": ObjectId(job_id)})
    if not job: raise HTTPException(404, "Job not found")
    job["_id"] = str(job["_id"]); job["id"] = job["_id"]; return job

# ─── Application Routes ──────────────────────────────────────────
@app.post("/api/applications")
async def create_application(req: ApplicationCreate, request: Request):
    user = await require_role("student")(request)
    if await db.applications.find_one({"student_id": user["id"], "job_id": req.job_id}): raise HTTPException(400, "Already applied")
    job = await db.job_postings.find_one({"_id": ObjectId(req.job_id)})
    if not job: raise HTTPException(404, "Job not found")
    mentor = await db.mentor_profiles.find_one({}); mentor_id = str(mentor["user_id"]) if mentor else None
    now = datetime.now(timezone.utc).isoformat()
    doc = {"student_id": user["id"], "student_name": user.get("name",""), "job_id": req.job_id, "job_title": job.get("title",""),
           "company_name": job.get("company_name",""), "cover_letter": req.cover_letter, "status": "submitted",
           "mentor_approval_status": "pending", "mentor_id": mentor_id, "matching_score": 0, "applied_at": now, "updated_at": now}
    r = await db.applications.insert_one(doc); doc["_id"] = str(r.inserted_id); doc["id"] = doc["_id"]
    if mentor_id: await create_notification(mentor_id, "New Application", f"{user['name']} applied to {job['title']}", "info")
    if job.get("employer_user_id"): await create_notification(job["employer_user_id"], "New Application", f"Application for {job['title']}", "info")
    await audit_log(user["id"], "apply", {"job_id": req.job_id})
    # Track behavior
    await db.behavior_events.insert_one({"user_id": user["id"], "event_type": "apply", "target": req.job_id, "created_at": now})
    rec_cache = await db.recommendations_cache.find_one({"user_id": user["id"]})
    if rec_cache:
        rec_ids = [r.get("job_id") for r in rec_cache.get("recommendations", [])]
        if req.job_id in rec_ids:
            await db.recommendations_followed.insert_one({"user_id": user["id"], "job_id": req.job_id, "created_at": now})
    return doc

@app.get("/api/applications")
async def list_applications(request: Request, status: Optional[str] = None, page: int = 1, limit: int = 50):
    user = await get_current_user(request); query = {}
    if user["role"] == "student": query["student_id"] = user["id"]
    elif user["role"] == "mentor": query["mentor_id"] = user["id"]
    elif user["role"] == "employer":
        emp = await db.employer_profiles.find_one({"user_id": user["id"]})
        if emp:
            jobs = await db.job_postings.find({"employer_id": str(emp["_id"])}).to_list(1000)
            query["job_id"] = {"$in": [str(j["_id"]) for j in jobs]}
    if status: query["status"] = status
    total = await db.applications.count_documents(query)
    apps = await db.applications.find(query).sort("applied_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    for a in apps: a["_id"] = str(a["_id"]); a["id"] = a["_id"]
    return {"applications": apps, "total": total, "page": page, "limit": limit}

@app.get("/api/applications/{app_id}")
async def get_application(app_id: str, request: Request):
    await get_current_user(request)
    doc = await db.applications.find_one({"_id": ObjectId(app_id)})
    if not doc: raise HTTPException(404, "Application not found")
    doc["_id"] = str(doc["_id"]); doc["id"] = doc["_id"]; return doc

@app.put("/api/applications/{app_id}/status")
async def update_application_status(app_id: str, request: Request):
    user = await require_role("employer", "placement", "admin")(request)
    body = await request.json(); new_status = body.get("status")
    if new_status not in ["under_review", "shortlisted", "interview_scheduled", "selected", "rejected"]: raise HTTPException(400, "Invalid status")
    update = {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}
    if body.get("feedback"): update["employer_feedback"] = body["feedback"]
    await db.applications.update_one({"_id": ObjectId(app_id)}, {"$set": update})
    app_doc = await db.applications.find_one({"_id": ObjectId(app_id)})
    if app_doc:
        await create_notification(app_doc["student_id"], f"Application {new_status.replace('_',' ').title()}", f"Your application for {app_doc.get('job_title','')} has been {new_status.replace('_',' ')}", "info")
    await audit_log(user["id"], "update_app_status", {"app_id": app_id, "status": new_status})
    # Auto-learn on terminal outcomes
    if new_status in ("selected", "rejected") and app_doc:
        outcome = "hired" if new_status == "selected" else "rejected"
        pred = await db.probability_predictions.find_one({"user_id": app_doc["student_id"], "job_id": app_doc.get("job_id")})
        factors = pred.get("factors", {}) if pred else {}
        await _adapt_weights(outcome, factors)
        await db.hiring_outcomes.update_one({"application_id": app_id}, {"$set": {"application_id": app_id, "user_id": app_doc["student_id"], "job_id": app_doc.get("job_id"), "outcome": outcome, "recorded_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    return {"message": "Status updated"}

@app.put("/api/applications/{app_id}/mentor-review")
async def mentor_review(app_id: str, request: Request):
    user = await require_role("mentor")(request); body = await request.json(); approval = body.get("approval")
    if approval not in ["approved", "rejected"]: raise HTTPException(400, "Invalid")
    update = {"mentor_approval_status": approval, "mentor_comments": body.get("comments",""), "updated_at": datetime.now(timezone.utc).isoformat()}
    if approval == "approved": update["status"] = "under_review"
    await db.applications.update_one({"_id": ObjectId(app_id)}, {"$set": update})
    app_doc = await db.applications.find_one({"_id": ObjectId(app_id)})
    if app_doc: await create_notification(app_doc["student_id"], f"Mentor {approval.title()}", f"Application for {app_doc.get('job_title','')} was {approval}", "info")
    return {"message": f"Application {approval}"}

@app.put("/api/applications/{app_id}/feedback")
async def employer_feedback(app_id: str, req: FeedbackReq, request: Request):
    user = await require_role("employer")(request)
    await db.applications.update_one({"_id": ObjectId(app_id)}, {"$set": {"employer_feedback": req.feedback, "employer_rating": req.rating, "updated_at": datetime.now(timezone.utc).isoformat()}})
    app_doc = await db.applications.find_one({"_id": ObjectId(app_id)})
    if app_doc and req.rating and req.rating >= 4:
        cert = {"student_id": app_doc["student_id"], "application_id": app_id, "certificate_type": "internship_completion",
                "title": f"Certificate of Completion - {app_doc.get('job_title','')}", "description": req.feedback,
                "issuer_name": app_doc.get("company_name",""), "issue_date": datetime.now(timezone.utc).isoformat(), "status": "issued",
                "created_at": datetime.now(timezone.utc).isoformat()}
        cert["blockchain_hash"] = hashlib.sha256(json.dumps(cert, sort_keys=True).encode()).hexdigest()
        await db.certificates.insert_one(cert)
        await create_notification(app_doc["student_id"], "Certificate Issued", f"Certificate for {app_doc.get('job_title','')}", "success")
    return {"message": "Feedback submitted"}

# ─── Recommendations ──────────────────────────────────────────────
@app.get("/api/recommendations")
async def get_recommendations(request: Request):
    user = await require_role("student")(request)
    cached = await db.recommendations_cache.find_one({"user_id": user["id"]})
    if cached:
        age = datetime.now(timezone.utc) - datetime.fromisoformat(cached["generated_at"])
        if age.total_seconds() < 3600:
            cached["_id"] = str(cached["_id"]); return {"recommendations": cached.get("recommendations", []), "generated_at": cached["generated_at"]}
    profile = await db.student_profiles.find_one({"user_id": user["id"]})
    if not profile: return {"recommendations": [], "message": "Complete your profile first"}
    jobs = await db.job_postings.find({"status": "active"}).to_list(50)
    if not jobs: return {"recommendations": [], "message": "No active jobs"}
    recs = await fallback_recommendations(profile, jobs)
    await db.recommendations_shown.update_one({"user_id": user["id"]}, {"$inc": {"count": 1}, "$setOnInsert": {"user_id": user["id"]}}, upsert=True)
    return {"recommendations": recs, "generated_at": datetime.now(timezone.utc).isoformat()}

@app.post("/api/recommendations/generate")
async def force_generate_recommendations(request: Request):
    user = await require_role("student")(request)
    quota = await check_and_increment(db, user, "recommendations-generate")
    profile = await db.student_profiles.find_one({"user_id": user["id"]})
    if not profile: raise HTTPException(400, "Complete your profile first")
    jobs = await db.job_postings.find({"status": "active"}).to_list(50)
    if not jobs: return {"recommendations": [], "message": "No active jobs"}
    skills = profile.get("skills", []); bio = profile.get("bio", ""); dept = profile.get("department", "")
    jobs_data = [{"id": str(j["_id"]), "title": j.get("title",""), "description": j.get("description","")[:300], "required_skills": j.get("required_skills",[]), "job_type": j.get("job_type",""), "company": j.get("company_name",""), "location": j.get("location",""), "stipend_min": j.get("stipend_min"), "stipend_max": j.get("stipend_max")} for j in jobs]
    try:
        ai = await ai_generate(
            system="You are the UNIFY Intelligence Engine. Return ONLY valid JSON, no prose, no markdown.",
            prompt=(
                f"Score each job 0-100 for this student. "
                f"Skills={','.join(skills)}, Dept={dept}, Bio={bio}. "
                f"Jobs: {json.dumps(jobs_data)}. "
                "Return a JSON array: [{\"job_id\":\"...\",\"score\":0-100,\"reason\":\"1 sentence\"}]"
            ),
            session_id=f"rec-{user['id']}",
            max_tokens=2500,
        )
        scored = ai_extract_json(ai["text"])
        recs = []
        for s in scored:
            jd = next((j for j in jobs_data if j["id"] == s.get("job_id")), None)
            if jd: recs.append({"job_id": s["job_id"], "title": jd["title"], "company": jd["company"], "location": jd["location"], "job_type": jd["job_type"], "stipend_min": jd["stipend_min"], "stipend_max": jd["stipend_max"], "score": s.get("score",0), "reason": s.get("reason",""), "required_skills": jd["required_skills"]})
        await db.recommendations_cache.update_one({"user_id": user["id"]}, {"$set": {"user_id": user["id"], "recommendations": recs, "generated_at": datetime.now(timezone.utc).isoformat(), "ai_provider": ai["provider"]}}, upsert=True)
        await record_tokens(db, user, "recommendations-generate", tokens_estimated=len(ai["text"]) // 4, provider=ai["provider"])
        return {"recommendations": recs, "generated_at": datetime.now(timezone.utc).isoformat(), "ai_provider": ai["provider"], "quota": quota}
    except Exception as e:
        logger.warning("recs_ai_failed", extra={"error": str(e)[:200]})
        recs = await fallback_recommendations(profile, jobs)
        return {"recommendations": recs, "generated_at": datetime.now(timezone.utc).isoformat(), "ai_provider": "fallback_heuristic", "quota": quota}

async def fallback_recommendations(profile, jobs):
    skills = set(s.lower() for s in profile.get("skills", []))
    recs = []
    for j in jobs:
        req = set(s.lower() for s in j.get("required_skills", []))
        overlap = skills & req; score = int((len(overlap)/max(len(req),1))*100) if req else 50
        recs.append({"job_id": str(j["_id"]), "title": j.get("title",""), "company": j.get("company_name",""), "location": j.get("location",""), "job_type": j.get("job_type",""), "stipend_min": j.get("stipend_min"), "stipend_max": j.get("stipend_max"), "score": score, "reason": f"Skill match: {', '.join(overlap)}" if overlap else "Explore new opportunities", "required_skills": j.get("required_skills",[])})
    recs.sort(key=lambda x: -x["score"]); return recs

# ─── Certificate Routes ───────────────────────────────────────────
@app.get("/api/certificates")
async def list_certificates(request: Request):
    user = await get_current_user(request); query = {}
    if user["role"] == "student": query["student_id"] = user["id"]
    certs = await db.certificates.find(query).sort("created_at", -1).to_list(100)
    for c in certs: c["_id"] = str(c["_id"]); c["id"] = c["_id"]
    return {"certificates": certs}

@app.get("/api/certificates/verify/{cert_hash}")
async def verify_certificate(cert_hash: str):
    cert = await db.certificates.find_one({"blockchain_hash": cert_hash})
    if not cert: return {"verified": False, "message": "Certificate not found"}
    cert["_id"] = str(cert["_id"]); cert["id"] = cert["_id"]
    student = await db.users.find_one({"_id": ObjectId(cert["student_id"])}, {"password_hash": 0})
    return {"verified": True, "certificate": cert, "student_name": student["name"] if student else "Unknown"}

# Certificate PDF handled by WeasyPrint version below

# ─── Analytics ────────────────────────────────────────────────────
@app.get("/api/analytics/overview")
async def analytics_overview(request: Request):
    await require_role("admin", "placement")(request)
    total_users = await db.users.count_documents({}); total_students = await db.users.count_documents({"role": "student"})
    total_jobs = await db.job_postings.count_documents({}); active_jobs = await db.job_postings.count_documents({"status": "active"})
    total_apps = await db.applications.count_documents({}); selected = await db.applications.count_documents({"status": "selected"})
    rejected = await db.applications.count_documents({"status": "rejected"}); pending = await db.applications.count_documents({"status": "submitted"})
    return {"total_users": total_users, "total_students": total_students, "total_jobs": total_jobs, "active_jobs": active_jobs,
            "total_applications": total_apps, "selected": selected, "rejected": rejected, "pending": pending,
            "placement_rate": round(selected/max(total_apps,1)*100,1),
            "total_employers": await db.users.count_documents({"role": "employer"}), "total_mentors": await db.users.count_documents({"role": "mentor"}),
            "total_certificates": await db.certificates.count_documents({}),
            "applications_by_status": [{"status": s, "count": await db.applications.count_documents({"status": s})} for s in ["submitted","under_review","shortlisted","interview_scheduled","selected","rejected"]],
            "conversion_rate": round(selected/max(total_apps,1), 3)}

@app.get("/api/analytics/placements")
async def placement_analytics(request: Request):
    await require_role("admin", "placement")(request)
    status_agg = await db.applications.aggregate([{"$group": {"_id": "$status", "count": {"$sum": 1}}}]).to_list(20)
    return {"status_breakdown": {i["_id"]: i["count"] for i in status_agg}}

# ─── Notification Routes ──────────────────────────────────────────
@app.get("/api/notifications")
async def list_notifications(request: Request):
    user = await get_current_user(request)
    notifs = await db.notifications.find({"user_id": user["id"]}).sort("created_at", -1).limit(50).to_list(50)
    for n in notifs: n["_id"] = str(n["_id"]); n["id"] = n["_id"]
    unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"notifications": notifs, "unread_count": unread}

@app.put("/api/notifications/read-all")
async def mark_all_read(request: Request):
    user = await get_current_user(request)
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}}); return {"message": "All read"}

# ─── Interview Routes ─────────────────────────────────────────────
@app.post("/api/interviews")
async def create_interview(req: InterviewCreate, request: Request):
    user = await require_role("employer", "placement", "admin")(request)
    app_doc = await db.applications.find_one({"_id": ObjectId(req.application_id)})
    if not app_doc: raise HTTPException(404, "Application not found")
    interview = {"application_id": req.application_id, "student_id": app_doc["student_id"], "job_title": app_doc.get("job_title",""),
                 "interview_type": req.interview_type, "scheduled_date": req.scheduled_date, "duration_minutes": req.duration_minutes,
                 "location": req.location, "meeting_link": req.meeting_link, "status": "scheduled", "created_by": user["id"], "created_at": datetime.now(timezone.utc).isoformat()}
    r = await db.interviews.insert_one(interview); interview["_id"] = str(r.inserted_id); interview["id"] = interview["_id"]
    await db.applications.update_one({"_id": ObjectId(req.application_id)}, {"$set": {"status": "interview_scheduled"}})
    await create_notification(app_doc["student_id"], "Interview Scheduled", f"Interview for {app_doc.get('job_title','')} on {req.scheduled_date}", "info")
    return interview

@app.get("/api/interviews")
async def list_interviews(request: Request):
    user = await get_current_user(request); query = {}
    if user["role"] == "student": query["student_id"] = user["id"]
    elif user["role"] == "employer": query["created_by"] = user["id"]
    interviews = await db.interviews.find(query).sort("scheduled_date", 1).to_list(100)
    for i in interviews: i["_id"] = str(i["_id"]); i["id"] = i["_id"]
    return {"interviews": interviews}

# ─── Mentor Routes ────────────────────────────────────────────────
@app.get("/api/mentor/students")
async def mentor_students(request: Request):
    user = await require_role("mentor")(request)
    apps = await db.applications.find({"mentor_id": user["id"]}).to_list(1000)
    student_ids = list(set(a["student_id"] for a in apps)); students = []
    for sid in student_ids:
        s_user = await db.users.find_one({"_id": ObjectId(sid)}, {"password_hash": 0})
        if s_user: s_user["_id"] = str(s_user["_id"]); s_user["id"] = s_user["_id"]; students.append({"user": s_user, "total_applications": sum(1 for a in apps if a["student_id"] == sid)})
    return {"students": students}

# ─── Skill Gap ────────────────────────────────────────────────────
@app.get("/api/skill-gap")
async def skill_gap_analysis(request: Request):
    user = await require_role("student")(request)
    profile = await db.student_profiles.find_one({"user_id": user["id"]})
    if not profile: raise HTTPException(400, "Complete your profile")
    student_skills = set(s.lower() for s in profile.get("skills", []))
    jobs = await db.job_postings.find({"status": "active"}).to_list(50)
    all_req, gaps = {}, {}
    for j in jobs:
        for s in j.get("required_skills", []):
            sk = s.lower(); all_req[sk] = all_req.get(sk, 0) + 1
            if sk not in student_skills: gaps[sk] = gaps.get(sk, 0) + 1
    gap_details = [{"skill": s.title(), "demand_count": c, "total_jobs_requiring": all_req.get(s, 0), "learning_resource": f"https://www.google.com/search?q=learn+{s.replace(' ','+')}", "platform": "Google"} for s, c in sorted(gaps.items(), key=lambda x: -x[1])]
    return {"student_skills": list(student_skills), "total_skills": len(student_skills), "total_gaps": len(gap_details), "gaps": gap_details[:15], "skill_coverage": round(len(student_skills)/max(len(all_req),1)*100, 1)}

# ─── Resume Upload ────────────────────────────────────────────────
@app.post("/api/upload/resume")
async def upload_resume(request: Request):
    user = await require_role("student")(request); body = await request.json()
    file_data = body.get("file_data", ""); file_name = body.get("file_name", "resume.pdf")
    if not file_data: raise HTTPException(400, "No file data")
    await db.uploads.update_one({"user_id": user["id"], "type": "resume"}, {"$set": {"user_id": user["id"], "file_name": file_name, "file_data": file_data, "type": "resume", "uploaded_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    await db.student_profiles.update_one({"user_id": user["id"]}, {"$set": {"resume_url": f"/api/download/resume/{user['id']}"}})
    return {"message": "Resume uploaded", "file_name": file_name}

@app.get("/api/download/resume/{user_id}")
async def download_resume(user_id: str):
    doc = await db.uploads.find_one({"user_id": user_id, "type": "resume"})
    if not doc: raise HTTPException(404, "Resume not found")
    data = base64.b64decode(doc["file_data"].split(",")[-1] if "," in doc["file_data"] else doc["file_data"])
    return StreamingResponse(io.BytesIO(data), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={doc['file_name']}"})

@app.get("/api/resume/info")
async def resume_info(request: Request):
    user = await require_role("student")(request)
    doc = await db.uploads.find_one({"user_id": user["id"], "type": "resume"}, {"file_data": 0})
    if not doc: return {"has_resume": False}
    doc.pop("_id", None)
    return {"has_resume": True, "file_name": doc.get("file_name", ""), "uploaded_at": doc.get("uploaded_at", "")}

# ─── CSV Export ───────────────────────────────────────────────────
@app.get("/api/export/applications")
async def export_applications_csv(request: Request):
    await require_role("admin", "placement")(request)
    apps = await db.applications.find({}).to_list(10000)
    output = io.StringIO(); writer = csv.writer(output)
    writer.writerow(["ID","Student","Job","Company","Status","Applied"])
    for a in apps: writer.writerow([str(a["_id"]), a.get("student_name",""), a.get("job_title",""), a.get("company_name",""), a.get("status",""), a.get("applied_at","")])
    output.seek(0)
    return StreamingResponse(io.BytesIO(output.getvalue().encode()), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=applications.csv"})

# ─── Behavior Tracking ────────────────────────────────────────────
@app.post("/api/behavior/track")
async def track_behavior(request: Request):
    user = await get_current_user(request); body = await request.json()
    await db.behavior_events.insert_one({"user_id": user["id"], "event_type": body.get("event_type","page_view"), "target": body.get("target",""), "metadata": body.get("metadata",{}), "created_at": datetime.now(timezone.utc).isoformat()})
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    mom = await db.user_momentum.find_one({"user_id": user["id"]})
    if mom:
        if mom.get("last_active") != today:
            yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
            streak = (mom.get("current_streak",0)+1) if mom.get("last_active") == yesterday else 1
            await db.user_momentum.update_one({"user_id": user["id"]}, {"$set": {"current_streak": streak, "longest_streak": max(mom.get("longest_streak",0), streak), "last_active": today, "total_actions": mom.get("total_actions",0)+1}})
    else:
        await db.user_momentum.insert_one({"user_id": user["id"], "current_streak": 1, "longest_streak": 1, "total_actions": 1, "last_active": today, "created_at": datetime.now(timezone.utc).isoformat()})
    return {"tracked": True}

# ─── Momentum ─────────────────────────────────────────────────────
@app.get("/api/momentum")
async def get_momentum(request: Request):
    user = await get_current_user(request); mom = await db.user_momentum.find_one({"user_id": user["id"]})
    apps = await db.applications.count_documents({"student_id": user["id"]})
    selected = await db.applications.count_documents({"student_id": user["id"], "status": "selected"})
    certs = await db.certificates.count_documents({"student_id": user["id"]})
    xp = apps * 10 + selected * 50 + certs * 30 + (mom.get("current_streak",0) if mom else 0) * 5
    level = max(1, xp // 100 + 1); xp_to_next = (level * 100) - xp
    milestones = []
    if apps >= 1: milestones.append({"id": "first_app", "title": "First Application", "achieved": True, "icon": "rocket"})
    if apps >= 5: milestones.append({"id": "five_apps", "title": "5 Applications", "achieved": True, "icon": "fire"})
    if selected >= 1: milestones.append({"id": "first_select", "title": "First Selection", "achieved": True, "icon": "trophy"})
    weekly = [0]*7
    for i in range(7):
        d = (datetime.now(timezone.utc) - timedelta(days=6-i)).strftime("%Y-%m-%d")
        weekly[i] = await db.behavior_events.count_documents({"user_id": user["id"], "created_at": {"$regex": f"^{d}"}})
    return {"current_streak": mom.get("current_streak",0) if mom else 0, "longest_streak": mom.get("longest_streak",0) if mom else 0,
            "total_actions": mom.get("total_actions",0) if mom else 0, "milestones": milestones, "weekly_activity": weekly,
            "level": level, "xp": xp, "xp_to_next": xp_to_next, "total_applications": apps, "total_selections": selected, "total_certificates": certs}

# ─── Activity Stream ──────────────────────────────────────────────
@app.get("/api/activity-stream")
async def activity_stream(request: Request):
    user = await get_current_user(request)
    apps = await db.applications.find({"student_id": user["id"]}).sort("applied_at", -1).limit(10).to_list(10)
    activities = [{"type": "application", "action": f"Applied to {a.get('job_title','')} at {a.get('company_name','')}", "status": a.get("status","submitted"), "timestamp": a.get("applied_at",""), "meta": {"job_id": a.get("job_id","")}} for a in apps]
    return {"activities": activities}

# ─── Leaderboard (Redis-cached) ───────────────────────────────────
@app.get("/api/leaderboard")
async def get_leaderboard(request: Request, category: str = "xp"):
    user = await get_current_user(request)
    # Try Redis cache first (60s TTL)
    cache_key = f"leaderboard:{category}"
    cached = await cache.get(cache_key)
    if cached:
        data = json.loads(cached)
        # Fix is_you for current user
        for r in data.get("rankings", []):
            r["is_you"] = r["user_id"] == user["id"]
        data["your_rank"] = next((r for r in data["rankings"] if r["is_you"]), None)
        return data
    students = await db.users.find({"role": "student", "is_active": True}).to_list(500)
    rankings = []
    for s in students:
        sid = str(s["_id"]); profile = await db.student_profiles.find_one({"user_id": sid}) or {}
        apps_c = await db.applications.count_documents({"student_id": sid})
        sel_c = await db.applications.count_documents({"student_id": sid, "status": "selected"})
        cert_c = await db.certificates.count_documents({"student_id": sid})
        mom = await db.user_momentum.find_one({"user_id": sid}) or {}
        skills = profile.get("skills", []); xp = apps_c * 10 + sel_c * 50 + cert_c * 30
        rankings.append({"user_id": sid, "name": s.get("name",""), "department": profile.get("department",""), "xp": xp, "level": max(1, xp//100+1),
                         "applications": apps_c, "selections": sel_c, "certificates": cert_c, "skills_count": len(skills),
                         "streak": mom.get("current_streak",0), "longest_streak": mom.get("longest_streak",0), "profile_strength": 0,
                         "days_to_placement": None, "is_you": sid == user["id"], "rank": 0})
    sort_key = {"xp": "xp", "applications": "applications", "selections": "selections", "streak": "streak", "profile": "skills_count"}.get(category, "xp")
    rankings.sort(key=lambda x: -x[sort_key])
    for i, r in enumerate(rankings): r["rank"] = i + 1
    your_rank = next((r for r in rankings if r["is_you"]), None)
    result = {"rankings": rankings[:20], "your_rank": your_rank, "total_students": len(rankings), "departments": [], "fastest_to_placement": [], "category": category}
    # Cache for 60 seconds
    await cache.set(cache_key, json.dumps(result), ex=60)
    return result

# ─── Chatbot ──────────────────────────────────────────────────────
@app.post("/api/chatbot")
async def chatbot(request: Request):
    user = await get_current_user(request); body = await request.json(); message = body.get("message", "")
    if not message: raise HTTPException(400, "Message required")
    quota = await check_and_increment(db, user, "chatbot")
    try:
        ai = await ai_generate(
            system=(
                "You are the UNIFY Career Assistant — concise, friendly, and tactical. "
                f"User: {user.get('name','')} ({user.get('role','student')}). "
                "Give direct actionable advice. No fluff."
            ),
            prompt=message,
            session_id=f"chat-{user['id']}",
            max_tokens=800,
        )
        await record_tokens(db, user, "chatbot", tokens_estimated=len(ai["text"]) // 4, provider=ai["provider"])
        return {"response": ai["text"], "ai_provider": ai["provider"], "quota": quota}
    except UnifyAIError as e:
        logger.warning("chatbot_all_providers_failed", extra={"error": str(e)[:200]})
        return {"response": "I'm temporarily unavailable. Please try again in a minute.", "ai_provider": "none", "quota": quota}
    except Exception as e:
        logger.error("chatbot_error", extra={"error": str(e)[:200]})
        return {"response": "I hit an unexpected error. Please try again.", "ai_provider": "none", "quota": quota}

# ═══════════════════════════════════════════════════════════════════
# INTELLIGENCE LAYER: Self-Learning + Decision Engine + Probability
# ═══════════════════════════════════════════════════════════════════

DEFAULT_WEIGHTS = {"skills": 0.35, "experience": 0.15, "competition": 0.20, "profile": 0.15, "timing": 0.15}
LEARNING_RATE = 0.02

async def _get_model_weights():
    doc = await db.model_weights.find_one({"_id": "global"})
    if doc: return {k: doc[k] for k in DEFAULT_WEIGHTS if k in doc}
    await db.model_weights.insert_one({"_id": "global", **DEFAULT_WEIGHTS, "version": 1, "outcomes_processed": 0, "updated_at": datetime.now(timezone.utc).isoformat()})
    return dict(DEFAULT_WEIGHTS)

async def _adapt_weights(outcome, factors):
    weights = await _get_model_weights()
    doc = await db.model_weights.find_one({"_id": "global"}) or {}
    total_outcomes = doc.get("outcomes_processed", 0) + 1
    lr = max(0.005, LEARNING_RATE / (1 + total_outcomes / 500))
    if outcome == "hired":
        for k in weights:
            if factors.get(k, 0) > 0.5: weights[k] += lr
    elif outcome == "rejected":
        for k in weights:
            if factors.get(k, 0) > 0.5: weights[k] -= lr * 0.5
    total = sum(weights.values())
    if total > 0: weights = {k: round(v/total, 4) for k, v in weights.items()}
    await db.model_weights.update_one({"_id": "global"}, {"$set": {**weights, "outcomes_processed": total_outcomes, "version": total_outcomes, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return weights

def _skill_overlap(ss, js):
    if not js: return 0.5
    return len(ss & js) / len(js)

async def _compute_hire_probability(profile, job, apps_count, job_apps):
    ss = set(s.lower() for s in (profile.get("skills") or [])); js = set(s.lower() for s in (job.get("required_skills") or []))
    skill_score = _skill_overlap(ss, js); exp_score = min(1.0, apps_count/10)
    comp_score = max(0.1, 1.0 - min(1.0, job_apps/20))
    fields = ["bio","department","cgpa","phone","linkedin_url"]; prof_score = sum(1 for f in fields if profile.get(f))/len(fields)
    try: days_old = (datetime.now(timezone.utc) - datetime.fromisoformat(job.get("created_at",""))).days
    except: days_old = 30
    timing_score = max(0.1, 1.0 - days_old/60)
    w = await _get_model_weights()
    prob = round(skill_score*w.get("skills",0.35) + exp_score*w.get("experience",0.15) + comp_score*w.get("competition",0.2) + prof_score*w.get("profile",0.15) + timing_score*w.get("timing",0.15), 2)
    prob = min(0.95, max(0.05, prob))
    improvements = []
    if skill_score < 0.5:
        missing = list(js - ss)[:3]; improvements.append(f"Add skills: {', '.join(s.title() for s in missing)}")
    if prof_score < 0.6: improvements.append("Complete your profile (bio, LinkedIn, phone)")
    if timing_score < 0.5: improvements.append("Apply within 24h of posting")
    if exp_score < 0.3: improvements.append("Apply more to build experience signal")
    mdoc = await db.model_weights.find_one({"_id": "global"}) or {}
    return {"probability": prob, "factors": {"skills": round(skill_score,2), "experience": round(exp_score,2), "competition": round(comp_score,2), "profile": round(prof_score,2), "timing": round(timing_score,2)}, "improvement": improvements[:4], "model_version": mdoc.get("version",0)}

@app.post("/api/hiring-probability")
async def hiring_probability(request: Request):
    user = await require_role("student")(request); body = await request.json(); job_id = body.get("job_id","")
    if not job_id: raise HTTPException(400, "job_id required")
    try: job = await db.job_postings.find_one({"_id": ObjectId(job_id)})
    except: raise HTTPException(404, "Job not found")
    if not job: raise HTTPException(404, "Job not found")
    profile = await db.student_profiles.find_one({"user_id": user["id"]}) or {}
    result = await _compute_hire_probability(profile, job, await db.applications.count_documents({"student_id": user["id"]}), await db.applications.count_documents({"job_id": job_id}))
    result["job_id"] = job_id; result["job_title"] = job.get("title",""); result["company"] = job.get("company_name","")
    await db.probability_predictions.update_one({"user_id": user["id"], "job_id": job_id}, {"$set": {"user_id": user["id"], "job_id": job_id, "probability": result["probability"], "factors": result["factors"], "predicted_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    return result

@app.get("/api/next-action")
async def next_action(request: Request):
    user = await get_current_user(request)
    if user["role"] == "employer":
        emp = await db.employer_profiles.find_one({"user_id": user["id"]}); emp_jobs = []
        if emp: emp_jobs = await db.job_postings.find({"employer_id": str(emp["_id"])}).to_list(100)
        if not emp_jobs: return {"next_action": "Post your first job listing", "reason": "No active jobs", "impact": "Start receiving applications", "urgency": "HIGH", "action_url": "/dashboard/employer?tab=jobs"}
        pending = sum([await db.applications.count_documents({"job_id": str(j["_id"]), "status": "submitted"}) for j in emp_jobs])
        if pending: return {"next_action": f"Review {pending} pending applications", "reason": "Candidates waiting", "impact": "Fast response improves hire quality ~30%", "urgency": "HIGH", "action_url": "/dashboard/employer?tab=applicants"}
        return {"next_action": "Check candidate rankings", "reason": "AI has ranked matches", "impact": "Find ideal candidates faster", "urgency": "MEDIUM", "action_url": "/dashboard/employer?tab=candidates"}
    if user["role"] != "student": return {"next_action": "Check your dashboard", "reason": "Review tasks", "impact": "Stay active", "urgency": "MEDIUM", "action_url": f"/dashboard/{user['role']}"}
    profile = await db.student_profiles.find_one({"user_id": user["id"]}) or {}
    ss = set(s.lower() for s in (profile.get("skills") or []))
    apps = await db.applications.find({"student_id": user["id"]}).to_list(100)
    fields = ["bio","department","cgpa","skills","phone"]; filled = sum(1 for f in fields if profile.get(f))
    if filled < 3: return {"next_action": "Complete your profile", "reason": f"Only {filled}/{len(fields)} fields filled", "impact": "+40% visibility to employers", "urgency": "HIGH", "action_url": "/dashboard/student?tab=profile"}
    if not ss: return {"next_action": "Add skills to your profile", "reason": "Skills needed for AI matching", "impact": "Unlock personalized recommendations", "urgency": "HIGH", "action_url": "/dashboard/student?tab=profile"}
    active_jobs = await db.job_postings.find({"status": "active"}).to_list(50)
    applied_ids = set(a["job_id"] for a in apps)
    unapplied = [j for j in active_jobs if str(j["_id"]) not in applied_ids]
    if unapplied:
        best_job, best_score = None, -1
        for j in unapplied:
            js = set(s.lower() for s in (j.get("required_skills") or [])); score = _skill_overlap(ss, js)
            ja = await db.applications.count_documents({"job_id": str(j["_id"])}); adj = score * max(0.3, 1-ja/15)
            if adj > best_score: best_score = adj; best_job = j
        if best_job:
            prob = await _compute_hire_probability(profile, best_job, len(apps), await db.applications.count_documents({"job_id": str(best_job["_id"])}))
            return {"next_action": f"Apply to {best_job['title']} at {best_job.get('company_name','')}", "reason": "Highest match + lowest competition", "impact": f"+{int(prob['probability']*100)}% hire probability", "urgency": "HIGH" if prob["probability"] > 0.4 else "MEDIUM", "job_id": str(best_job["_id"]), "probability": prob["probability"], "action_url": "/dashboard/student?tab=jobs"}
    return {"next_action": "Analyze skill gaps", "reason": "Applied to all available jobs", "impact": "Expand your match pool", "urgency": "MEDIUM", "action_url": "/dashboard/student?tab=skills"}

@app.get("/api/control")
async def control_system(request: Request):
    user = await require_role("student")(request); profile = await db.student_profiles.find_one({"user_id": user["id"]}) or {}
    apps = await db.applications.find({"student_id": user["id"]}).to_list(100)
    selected = sum(1 for a in apps if a.get("status") == "selected"); rejected = sum(1 for a in apps if a.get("status") == "rejected")
    active_jobs = await db.job_postings.count_documents({"status": "active"}); applied_ids = set(a["job_id"] for a in apps)
    unapplied = max(0, active_jobs - len(applied_ids))
    ss = set(s.lower() for s in (profile.get("skills") or [])); fields = ["bio","department","cgpa","skills","phone","linkedin_url"]
    pf = sum(1 for f in fields if profile.get(f)); pp = int((pf/len(fields))*100)
    momentum = min(100, int(len(apps)*8 + selected*20 + len(ss)*3 + pp*0.3))
    if selected > 0: risk, action, deadline = "LOW", "You're placed! Complete remaining interviews", "No deadline"
    elif len(apps) == 0: risk, action, deadline = "CRITICAL", f"Apply to {min(5,unapplied)} jobs today", "Immediately"
    elif rejected > len(apps)*0.7 and len(apps) > 3: risk, action, deadline = "HIGH", "Improve profile/skills before applying more", "24 hours"
    elif unapplied > 0 and len(apps) < 5: risk, action, deadline = "HIGH", f"Apply to {min(7,unapplied)} jobs today", "24 hours"
    elif unapplied > 0: risk, action, deadline = "MEDIUM", f"Apply to {min(3,unapplied)} more positions", "48 hours"
    else: risk, action, deadline = "LOW", "Follow up on pending applications", "This week"
    wt = max(3, min(10, unapplied)); wd = sum(1 for a in apps if a.get("applied_at","") >= (datetime.now(timezone.utc)-timedelta(days=7)).isoformat())
    return {"risk": risk, "momentum": momentum, "action_required": action, "deadline": deadline,
            "stats": {"total_applications": len(apps), "selected": selected, "rejected": rejected, "unapplied_jobs": unapplied, "profile_completeness": pp, "skills_count": len(ss)},
            "weekly": {"target": wt, "done": wd, "remaining": max(0, wt-wd)}}

@app.get("/api/employer/best-candidates")
async def employer_best_candidates(request: Request, job_id: Optional[str] = None):
    user = await require_role("employer", "placement", "admin")(request)
    emp = await db.employer_profiles.find_one({"user_id": user["id"]}); emp_jobs = []
    if emp: emp_jobs = await db.job_postings.find({"employer_id": str(emp["_id"])}).to_list(100)
    elif user["role"] in ["placement","admin"]: emp_jobs = await db.job_postings.find({"status": "active"}).to_list(100)
    if job_id:
        emp_jobs = [j for j in emp_jobs if str(j["_id"]) == job_id]
        if not emp_jobs:
            try:
                j = await db.job_postings.find_one({"_id": ObjectId(job_id)})
                if j: emp_jobs = [j]
            except: pass
    candidates, seen = [], set()
    for job in emp_jobs:
        jid = str(job["_id"]); apps_for = await db.applications.find({"job_id": jid}).to_list(100)
        for ad in apps_for:
            sid = ad["student_id"]
            if sid in seen: continue
            seen.add(sid); prof = await db.student_profiles.find_one({"user_id": sid}) or {}
            su = await db.users.find_one({"_id": ObjectId(sid)}, {"password_hash": 0})
            if not su: continue
            prob = await _compute_hire_probability(prof, job, await db.applications.count_documents({"student_id": sid}), len(apps_for))
            reasons = []
            if prob["factors"]["skills"] >= 0.7: reasons.append("Exact skill match")
            if prob["factors"]["profile"] >= 0.6: reasons.append("Complete profile")
            if not reasons: reasons.append("Potential fit")
            candidates.append({"user_id": sid, "name": su.get("name",""), "email": su.get("email",""), "department": prof.get("department",""),
                               "skills": prof.get("skills",[]), "hire_probability": prob["probability"], "factors": prob["factors"],
                               "reason": " + ".join(reasons), "application_id": str(ad["_id"]), "job_id": jid, "job_title": job.get("title",""), "status": ad.get("status","submitted")})
    candidates.sort(key=lambda x: -x["hire_probability"])
    return {"candidates": candidates[:30], "total": len(candidates)}

@app.get("/api/model/weights")
async def get_model_weights_endpoint(request: Request):
    await get_current_user(request); w = await _get_model_weights(); doc = await db.model_weights.find_one({"_id": "global"}) or {}
    return {"weights": w, "version": doc.get("version",0), "outcomes_processed": doc.get("outcomes_processed",0), "updated_at": doc.get("updated_at",""), "default_weights": DEFAULT_WEIGHTS}

@app.get("/api/user-behavior")
async def user_behavior_analysis(request: Request):
    user = await get_current_user(request); uid = user["id"]
    events = await db.behavior_events.find({"user_id": uid}).sort("created_at", -1).limit(200).to_list(200)
    pv = [e for e in events if e.get("event_type") == "page_view"]
    actions = [e for e in events if e.get("event_type") in ("apply","profile_update","resume_upload")]
    rs = await db.recommendations_shown.count_documents({"user_id": uid})
    rf = await db.recommendations_followed.count_documents({"user_id": uid})
    ob = round(rf / max(rs, 1), 2)
    fp, fix = None, None
    pvp = sum(1 for e in pv if "profile" in (e.get("target") or ""))
    pu = await db.behavior_events.count_documents({"user_id": uid, "event_type": "profile_update"})
    if pvp > 3 and pu == 0: fp, fix = "profile_editing", "Simplify profile form or auto-fill"
    elif len(events) > 10 and len(actions) == 0: fp, fix = "no_actions", "Show prominent one-click apply buttons"
    apps = await db.applications.count_documents({"student_id": uid})
    jv = sum(1 for e in pv if "jobs" in (e.get("target") or ""))
    dr = round(1 - apps/max(jv,1), 2) if jv > 0 else None
    return {"obedience_score": ob, "friction_point": fp, "fix": fix, "total_events": len(events), "page_views": len(pv), "actions_taken": len(actions), "avg_time_to_action_seconds": None, "drop_off_rate": dr, "recommendations_shown": rs, "recommendations_followed": rf}

@app.get("/api/alerts")
async def predictive_alerts(request: Request):
    user = await require_role("student")(request)
    profile = await db.student_profiles.find_one({"user_id": user["id"]}) or {}
    ss = set(s.lower() for s in (profile.get("skills") or []))
    if not ss: return {"alerts": [], "message": "Add skills to get alerts"}
    applied = set(); apps = await db.applications.find({"student_id": user["id"]}, {"job_id": 1}).to_list(1000)
    for a in apps: applied.add(a["job_id"])
    jobs = await db.job_postings.find({"status": "active"}).to_list(50); ac = len(apps); alerts = []
    for j in jobs:
        jid = str(j["_id"])
        if jid in applied: continue
        ja = await db.applications.count_documents({"job_id": jid})
        prob = await _compute_hire_probability(profile, j, ac, ja)
        if prob["probability"] >= 0.35:
            dl = j.get("application_deadline",""); hl = None
            if dl:
                try: hl = max(0, (datetime.fromisoformat(dl) - datetime.now(timezone.utc)).total_seconds()/3600)
                except: pass
            urg = "CRITICAL" if (hl and hl < 24) else ("HIGH" if prob["probability"] >= 0.5 else "MEDIUM")
            alerts.append({"job_id": jid, "title": j.get("title",""), "company": j.get("company_name",""), "probability": prob["probability"], "urgency": urg, "message": f"Apply now — {int(prob['probability']*100)}% hire probability", "hours_until_deadline": round(hl,1) if hl else None})
    alerts.sort(key=lambda x: (-x["probability"], x.get("hours_until_deadline") or 9999))
    return {"alerts": alerts[:10]}

@app.get("/api/system-health")
async def system_health(request: Request):
    await require_role("admin", "placement")(request)
    ta = await db.applications.count_documents({}); ts = await db.applications.count_documents({"status": "selected"})
    tr = await db.applications.count_documents({"status": "rejected"})
    wk = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    ra = await db.applications.count_documents({"applied_at": {"$gte": wk}})
    tst = await db.users.count_documents({"role": "student"})
    issues = []
    if ta > 10 and ts/max(ta,1) < 0.1: issues.append({"issue": "Low conversion rate", "action": "Adjust matching weights"})
    wdoc = await db.model_weights.find_one({"_id": "global"}) or {}
    return {"status": "healthy" if not issues else "needs_attention", "issues": issues,
            "metrics": {"total_users": await db.users.count_documents({}), "total_students": tst, "total_applications": ta, "total_selected": ts, "total_rejected": tr, "conversion_rate": round(ts/max(ta,1),3), "weekly_applications": ra},
            "model": {"version": wdoc.get("version",0), "outcomes_processed": wdoc.get("outcomes_processed",0), "weights": await _get_model_weights(), "learning_rate": max(0.005, LEARNING_RATE/(1+wdoc.get("outcomes_processed",0)/500))}}

# ─── Seed Demo Jobs (live via JSearch) ────────────────────────────
@app.post("/api/seed/demo")
async def seed_demo_data(request: Request):
    """Seed an initial set of real jobs pulled from the live JSearch API.
    Called once on a fresh environment; no-ops if jobs already exist."""
    await require_role("admin")(request)
    if await db.job_postings.count_documents({}) > 0:
        return {"message": "Job data already exists, skipping seed"}
    count = await _sync_live_jobs_to_db(queries=["software intern", "data analyst", "ML intern"])
    return {"message": f"Seeded {count} live jobs from JSearch/Adzuna"}


@app.post("/api/jobs/sync-live")
async def sync_live_jobs(request: Request):
    """Admin/placement: pull fresh live jobs from JSearch/Adzuna into the DB."""
    await require_role("admin", "placement")(request)
    body = await request.json() if (await request.body()) else {}
    queries = body.get("queries") or ["software intern", "data analyst", "ML intern", "frontend intern", "backend developer"]
    count = await _sync_live_jobs_to_db(queries=queries, location=body.get("location", "India"))
    return {"message": f"Synced {count} live jobs", "queries": queries}


async def _sync_live_jobs_to_db(queries: list, location: str = "India") -> int:
    """Pull live jobs from JSearch/Adzuna and upsert into job_postings."""
    inserted = 0
    now = datetime.now(timezone.utc).isoformat()
    # Resolve a placeholder employer for live jobs
    emp_user = await db.users.find_one({"email": "employer@unifies.codes"})
    emp_id = str(emp_user["_id"]) if emp_user else "system"
    emp_profile = await db.employer_profiles.find_one({"user_id": emp_id}) if emp_user else None
    emp_profile_id = str(emp_profile["_id"]) if emp_profile else emp_id
    for q in queries:
        jobs = await search_jobs_live(q, location=location, limit=25)
        for j in jobs:
            if not j.get("source_id"):
                continue
            exists = await db.job_postings.find_one({"source": j["source"], "source_id": j["source_id"]})
            if exists:
                continue
            doc = {
                "title": j["title"],
                "description": j["description"],
                "job_type": "internship" if "intern" in (j["title"] + " " + (j.get("job_type") or "")).lower() else "fulltime",
                "location": j.get("location") or "Remote",
                "is_remote": bool(j.get("is_remote")),
                "stipend_min": j.get("salary_min"),
                "stipend_max": j.get("salary_max"),
                "salary_currency": j.get("salary_currency"),
                "required_skills": j.get("required_skills") or [],
                "application_deadline": j.get("deadline") or (datetime.now(timezone.utc) + timedelta(days=45)).isoformat(),
                "status": "active",
                "source": j["source"],
                "source_id": j["source_id"],
                "apply_url": j.get("apply_url"),
                "company_name": j.get("company_name") or "Unknown",
                "company_logo": j.get("company_logo") or company_logo_url((j.get("company_website") or "").replace("https://", "").replace("http://", "").split("/")[0] if j.get("company_website") else j.get("company_name", "")),
                "employer_id": emp_profile_id,
                "employer_user_id": emp_id,
                "created_at": j.get("posted_at") or now,
                "updated_at": now,
            }
            await db.job_postings.insert_one(doc)
            inserted += 1
    logger.info("live_jobs_synced", extra={"count": inserted, "queries": queries})
    return inserted


# ═══════════════════════════════════════════════════════════════════
# INTERVIEW PREP AI
# ═══════════════════════════════════════════════════════════════════
@app.post("/api/interview-prep")
async def interview_prep(request: Request):
    """Generate interview questions and prep material for a specific job."""
    user = await get_current_user(request); body = await request.json()
    quota = await check_and_increment(db, user, "interview-prep")
    job_id = body.get("job_id", ""); job = None
    if job_id:
        try: job = await db.job_postings.find_one({"_id": ObjectId(job_id)})
        except: pass
    profile = await db.student_profiles.find_one({"user_id": user["id"]}) or {}
    skills = profile.get("skills", []); dept = profile.get("department", "")
    job_title = job.get("title", "Software Engineer") if job else body.get("job_title", "Software Engineer")
    company = job.get("company_name", "the company") if job else body.get("company", "the company")
    req_skills = job.get("required_skills", []) if job else []
    try:
        prompt = (
            f"Generate interview prep for: {job_title} at {company}.\n"
            f"Required skills: {', '.join(req_skills)}. Student skills: {', '.join(skills)}. Dept: {dept}.\n"
            'Return JSON: {"questions": [{"question": "...", "category": "technical|behavioral|situational", '
            '"difficulty": "easy|medium|hard", "tip": "1-sentence answer strategy"}], '
            '"company_brief": "2-sentence company research note", '
            '"star_examples": ["1 STAR example they could prepare"], '
            '"do_list": ["things to do before interview"], '
            '"dont_list": ["things to avoid"]}\n'
            "Generate 8 questions (4 technical, 2 behavioral, 2 situational)."
        )
        ai = await ai_generate(
            system="You are a senior career coach. Return ONLY valid JSON, no prose, no markdown.",
            prompt=prompt,
            session_id=f"prep-{user['id']}-{job_id}",
            max_tokens=2000,
        )
        data = ai_extract_json(ai["text"])
        data["job_title"] = job_title; data["company"] = company
        data["ai_provider"] = ai["provider"]; data["quota"] = quota
        await record_tokens(db, user, "interview-prep", tokens_estimated=len(ai["text"]) // 4, provider=ai["provider"])
        return data
    except Exception as e:
        logger.warning("interview_prep_fallback", extra={"error": str(e)[:200]})
        questions = [
            {"question": f"Explain your experience with {req_skills[0] if req_skills else 'your primary skill'}.", "category": "technical", "difficulty": "medium", "tip": "Use specific project examples with measurable outcomes"},
            {"question": "Tell me about a time you faced a challenging deadline.", "category": "behavioral", "difficulty": "medium", "tip": "Use STAR framework: Situation, Task, Action, Result"},
            {"question": f"How would you approach building a feature for {company}?", "category": "situational", "difficulty": "hard", "tip": "Think aloud, ask clarifying questions, break into steps"},
            {"question": "What's your biggest technical weakness and how are you addressing it?", "category": "behavioral", "difficulty": "easy", "tip": "Be honest but show growth mindset"},
        ]
        for s in req_skills[:3]:
            questions.append({"question": f"Explain the core concepts of {s} and when you'd use it.", "category": "technical", "difficulty": "medium", "tip": f"Relate {s} to a real project you've worked on"})
        return {"questions": questions[:8], "company_brief": f"Research {company}'s recent projects and tech stack.", "star_examples": ["Prepare 2-3 STAR stories from your projects"], "do_list": ["Research the company", "Practice coding problems", "Prepare questions to ask"], "dont_list": ["Don't badmouth previous experiences", "Don't say 'I don't know' without trying"], "job_title": job_title, "company": company, "ai_provider": "fallback_heuristic", "quota": quota}


# ═══════════════════════════════════════════════════════════════════
# COVER LETTER GENERATOR
# ═══════════════════════════════════════════════════════════════════
@app.post("/api/cover-letter")
async def generate_cover_letter(request: Request):
    """Generate a tailored cover letter for a specific job."""
    user = await get_current_user(request); body = await request.json(); job_id = body.get("job_id", "")
    if not job_id: raise HTTPException(400, "job_id required")
    quota = await check_and_increment(db, user, "cover-letter")
    try: job = await db.job_postings.find_one({"_id": ObjectId(job_id)})
    except: raise HTTPException(404, "Job not found")
    if not job: raise HTTPException(404, "Job not found")
    profile = await db.student_profiles.find_one({"user_id": user["id"]}) or {}
    skills = profile.get("skills", []); bio = profile.get("bio", ""); dept = profile.get("department", "")
    try:
        ai = await ai_generate(
            system="You are an expert career advisor. Write concise, impactful cover letters. No placeholder text, no brackets.",
            prompt=(
                f"Write a professional cover letter (200 words max) for {user.get('name','')} "
                f"applying to {job['title']} at {job.get('company_name','')}. "
                f"Skills: {', '.join(skills)}. Bio: {bio}. Dept: {dept}. "
                f"Job requires: {', '.join(job.get('required_skills',[]))}. "
                f"Job desc: {job.get('description','')[:500]}"
            ),
            session_id=f"cl-{user['id']}-{job_id}",
            max_tokens=700,
        )
        await record_tokens(db, user, "cover-letter", tokens_estimated=len(ai["text"]) // 4, provider=ai["provider"])
        return {"cover_letter": ai["text"].strip(), "job_title": job["title"], "company": job.get("company_name", ""), "ai_provider": ai["provider"], "quota": quota}
    except Exception as e:
        logger.warning("cover_letter_fallback", extra={"error": str(e)[:200]})
        return {"cover_letter": f"Dear Hiring Manager,\n\nI am writing to express my interest in the {job['title']} position at {job.get('company_name','')}. With skills in {', '.join(skills[:3])}, I am confident I can contribute meaningfully to your team.\n\nBest regards,\n{user.get('name','')}", "job_title": job["title"], "company": job.get("company_name", ""), "ai_provider": "fallback_heuristic", "quota": quota}


# ═══════════════════════════════════════════════════════════════════
# RESUME AI ANALYZER
# ═══════════════════════════════════════════════════════════════════
@app.post("/api/resume/analyze")
async def analyze_resume(request: Request):
    """AI-powered resume analysis: score, keyword gaps, rewrite suggestions."""
    user = await require_role("student")(request); body = await request.json()
    quota = await check_and_increment(db, user, "resume-analyze")
    job_id = body.get("job_id")
    profile = await db.student_profiles.find_one({"user_id": user["id"]}) or {}
    resume_text = profile.get("resume_text", "")
    upload = await db.uploads.find_one({"user_id": user["id"], "type": "resume"})
    # If no manually-pasted resume text but a PDF was uploaded, extract text server-side.
    if not resume_text and upload:
        try:
            raw = upload.get("file_data", "")
            if "," in raw:
                raw = raw.split(",", 1)[1]
            pdf_bytes = base64.b64decode(raw)
            try:
                from pypdf import PdfReader  # preferred
            except Exception:
                from PyPDF2 import PdfReader  # type: ignore
            reader = PdfReader(io.BytesIO(pdf_bytes))
            extracted = []
            for page in reader.pages[:10]:
                try:
                    extracted.append(page.extract_text() or "")
                except Exception:
                    continue
            resume_text = ("\n".join(extracted)).strip()
            if resume_text:
                # Cache extracted text back on profile for future runs
                await db.student_profiles.update_one(
                    {"user_id": user["id"]},
                    {"$set": {"resume_text": resume_text[:15000]}},
                )
        except Exception as e:  # noqa: BLE001
            logger.warning("resume_pdf_parse_failed", extra={"error": str(e)[:200]})
    if not resume_text and not upload:
        raise HTTPException(400, "No resume found. Upload a resume or paste resume text in your profile.")
    job = None; job_skills = []
    if job_id:
        try: job = await db.job_postings.find_one({"_id": ObjectId(job_id)})
        except: pass
        if job: job_skills = job.get("required_skills", [])
    try:
        context = f"Resume text: {resume_text[:4000]}" if resume_text else "Resume uploaded as PDF (analyze based on profile data)"
        job_context = f"Target job: {job['title']} at {job.get('company_name','')}. Required: {', '.join(job_skills)}" if job else "General analysis"
        ai = await ai_generate(
            system="You are an expert ATS resume reviewer. Return ONLY valid JSON, no prose, no markdown.",
            prompt=(
                f"{context}\n"
                f"Profile skills: {', '.join(profile.get('skills',[]))}. Dept: {profile.get('department','')}.\n"
                f"{job_context}\n"
                'Return JSON: {"score": 0-100, "ats_score": 0-100, "strengths": ["..."], "weaknesses": ["..."], '
                '"keyword_gaps": ["missing keywords"], '
                '"rewrite_suggestions": [{"original": "weak bullet", "improved": "stronger version"}], '
                '"auto_fill": {"skills": ["detected skills"], "department": "detected dept"}}'
            ),
            session_id=f"resume-{user['id']}",
            max_tokens=2000,
        )
        data = ai_extract_json(ai["text"])
        data["has_resume"] = bool(resume_text or upload)
        data["ai_provider"] = ai["provider"]; data["quota"] = quota
        await record_tokens(db, user, "resume-analyze", tokens_estimated=len(ai["text"]) // 4, provider=ai["provider"])
        return data
    except Exception as e:
        logger.warning("resume_analyze_fallback", extra={"error": str(e)[:200]})
        student_skills = set(s.lower() for s in profile.get("skills", []))
        missing = [s for s in job_skills if s.lower() not in student_skills] if job_skills else []
        return {"score": 60 if resume_text else 30, "ats_score": 50, "strengths": ["Profile has skills listed"], "weaknesses": ["Add more detail to resume text"], "keyword_gaps": missing[:5], "rewrite_suggestions": [], "auto_fill": {"skills": profile.get("skills", []), "department": profile.get("department", "")}, "has_resume": bool(resume_text or upload), "ai_provider": "fallback_heuristic", "quota": quota}


# ═══════════════════════════════════════════════════════════════════
# WEASYPRINT PDF CERTIFICATES
# ═══════════════════════════════════════════════════════════════════
@app.get("/api/certificates/{cert_id}/pdf")
async def generate_certificate_pdf_v2(cert_id: str):
    """Generate a branded PDF certificate using WeasyPrint."""
    try: cert = await db.certificates.find_one({"_id": ObjectId(cert_id)})
    except: raise HTTPException(404, "Not found")
    if not cert: raise HTTPException(404, "Not found")
    student = await db.users.find_one({"_id": ObjectId(cert["student_id"])}, {"password_hash": 0})
    name = student["name"] if student else "Unknown"
    issue_date = cert.get("issue_date", datetime.now(timezone.utc).isoformat())[:10]
    html = f"""<!DOCTYPE html><html><head><style>
@page {{ size: A4 landscape; margin: 0; }}
body {{ font-family: Georgia, serif; margin: 0; padding: 0; background: white; }}
.cert {{ width: 297mm; height: 210mm; padding: 30mm 40mm; box-sizing: border-box; position: relative; border: 12px double #002FA7; }}
.cert::before {{ content: ''; position: absolute; top: 8px; left: 8px; right: 8px; bottom: 8px; border: 2px solid #E8E8F0; }}
.header {{ text-align: center; margin-bottom: 15mm; }}
.header h1 {{ font-size: 42pt; color: #002FA7; letter-spacing: 8px; margin: 0; font-weight: 300; }}
.header .subtitle {{ font-size: 12pt; color: #666; letter-spacing: 4px; margin-top: 5mm; }}
.body {{ text-align: center; }}
.body .preamble {{ font-size: 14pt; color: #555; margin-bottom: 8mm; }}
.body .name {{ font-size: 28pt; color: #002FA7; border-bottom: 3px solid #002FA7; display: inline-block; padding: 5mm 20mm; font-weight: bold; }}
.body .title {{ font-size: 16pt; color: #333; margin-top: 10mm; font-style: italic; }}
.body .issuer {{ font-size: 13pt; color: #555; margin-top: 5mm; }}
.body .date {{ font-size: 11pt; color: #888; margin-top: 8mm; }}
.footer {{ position: absolute; bottom: 15mm; left: 40mm; right: 40mm; text-align: center; }}
.footer .hash {{ font-family: monospace; font-size: 7pt; color: #AAA; word-break: break-all; }}
.footer .verify {{ font-size: 8pt; color: #002FA7; margin-top: 2mm; }}
.logo {{ font-size: 18pt; font-weight: bold; color: #002FA7; letter-spacing: 3px; }}
</style></head><body><div class="cert">
<div class="header"><div class="logo">UNIFY</div><h1>CERTIFICATE</h1><div class="subtitle">OF ACHIEVEMENT</div></div>
<div class="body"><p class="preamble">This is to certify that</p><div class="name">{name}</div>
<p class="title">{cert.get('title','')}</p><p class="issuer">Issued by: {cert.get('issuer_name','UNIFY Platform')}</p>
{f'<p class="issuer">{cert.get("description","")}</p>' if cert.get("description") else ''}
<p class="date">Date: {issue_date}</p></div>
<div class="footer"><div class="hash">Verification Hash: {cert.get('blockchain_hash','')}</div><div class="verify">Verify at: unifies.codes/verify/{cert.get('blockchain_hash','')}</div></div>
</div></body></html>"""
    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=html).write_pdf()
        return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=UNIFY_Certificate_{cert_id[:8]}.pdf"})
    except Exception:
        return Response(content=html, media_type="text/html")


# ═══════════════════════════════════════════════════════════════════
# ANALYTICS CHARTS DATA
# ═══════════════════════════════════════════════════════════════════
@app.get("/api/analytics/charts")
async def analytics_charts(request: Request):
    """Data for Recharts: monthly bar chart, status donut, skill demand."""
    await require_role("admin", "placement")(request)
    now = datetime.now(timezone.utc)
    # Monthly applications (last 6 months)
    monthly = []
    for i in range(5, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=30*i)).replace(day=1)
        month_end = (month_start + timedelta(days=32)).replace(day=1)
        count = await db.applications.count_documents({"applied_at": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}})
        selected = await db.applications.count_documents({"applied_at": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}, "status": "selected"})
        monthly.append({"month": month_start.strftime("%b %Y"), "applications": count, "selected": selected})
    # Status breakdown for donut
    statuses = ["submitted", "under_review", "shortlisted", "interview_scheduled", "selected", "rejected"]
    donut = []
    for s in statuses:
        c = await db.applications.count_documents({"status": s})
        if c > 0: donut.append({"name": s.replace("_"," ").title(), "value": c})
    # Top skills in demand
    pipeline = [{"$unwind": "$required_skills"}, {"$group": {"_id": "$required_skills", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}, {"$limit": 10}]
    skill_demand = await db.job_postings.aggregate(pipeline).to_list(10)
    skills_chart = [{"skill": s["_id"], "demand": s["count"]} for s in skill_demand]
    return {"monthly": monthly, "status_donut": donut, "skill_demand": skills_chart}


@app.get("/api/analytics/heatmap")
async def activity_heatmap(request: Request):
    """GitHub-style 12-week activity heatmap data for the current user."""
    user = await get_current_user(request)
    weeks = 12; heatmap = []
    now = datetime.now(timezone.utc)
    for w in range(weeks * 7 - 1, -1, -1):
        day = (now - timedelta(days=w)).strftime("%Y-%m-%d")
        count = await db.behavior_events.count_documents({"user_id": user["id"], "created_at": {"$regex": f"^{day}"}})
        apps = await db.applications.count_documents({"student_id": user["id"], "applied_at": {"$regex": f"^{day}"}})
        heatmap.append({"date": day, "count": count + apps * 3})
    return {"heatmap": heatmap, "weeks": weeks}


# ═══════════════════════════════════════════════════════════════════
# OUTCOMES RECORDING (for weight adaptation)
# ═══════════════════════════════════════════════════════════════════
@app.post("/api/outcomes/record")
async def record_outcome(request: Request):
    user = await require_role("employer", "placement", "admin")(request)
    body = await request.json(); app_id = body.get("application_id", ""); outcome = body.get("outcome", "")
    if outcome not in ["hired", "rejected"]: raise HTTPException(400, "outcome must be 'hired' or 'rejected'")
    try: app_doc = await db.applications.find_one({"_id": ObjectId(app_id)})
    except: raise HTTPException(404, "Not found")
    if not app_doc: raise HTTPException(404, "Not found")
    await db.hiring_outcomes.update_one({"application_id": app_id}, {"$set": {"application_id": app_id, "user_id": app_doc["student_id"], "job_id": app_doc.get("job_id"), "outcome": outcome, "recorded_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    pred = await db.probability_predictions.find_one({"user_id": app_doc["student_id"], "job_id": app_doc.get("job_id")})
    new_w = await _adapt_weights(outcome, pred.get("factors", {}) if pred else {})
    return {"message": "Outcome recorded, model updated", "new_weights": new_w}


# ═══════════════════════════════════════════════════════════════════
# TRENDING JOBS (DB + live)
# ═══════════════════════════════════════════════════════════════════
@app.get("/api/trending-jobs")
async def trending_jobs(request: Request):
    await get_current_user(request)
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    pipeline = [{"$match": {"applied_at": {"$gte": cutoff}}}, {"$group": {"_id": "$job_id", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}, {"$limit": 5}]
    trending = await db.applications.aggregate(pipeline).to_list(5)
    results = []
    for t in trending:
        try: job = await db.job_postings.find_one({"_id": ObjectId(t["_id"])})
        except: continue
        if job:
            results.append({
                "job_id": str(job["_id"]), "title": job.get("title",""),
                "company": job.get("company_name",""), "company_logo": job.get("company_logo"),
                "applications_48h": t["count"], "urgency": "Trending", "source": "db",
            })
    # Augment with live hot postings if we don't have enough trending internally
    if len(results) < 5:
        try:
            live = await jsearch_search("software intern", location="India", num_pages=1)
            for j in live[: 5 - len(results)]:
                results.append({
                    "job_id": None,
                    "title": j.get("title", ""),
                    "company": j.get("company_name", ""),
                    "company_logo": j.get("company_logo") or company_logo_url(j.get("company_website") or j.get("company_name", "")),
                    "applications_48h": None,
                    "urgency": "Hot (Live)",
                    "source": j.get("source"),
                    "source_id": j.get("source_id"),
                    "apply_url": j.get("apply_url"),
                    "location": j.get("location"),
                })
        except Exception as e:  # noqa: BLE001
            logger.warning("trending_live_augment_failed", extra={"error": str(e)[:200]})
    return {"trending": results}


# ═══════════════════════════════════════════════════════════════════
# ROAST MY PROFILE (AI, rate-limited)
# ═══════════════════════════════════════════════════════════════════
@app.post("/api/roast-profile")
async def roast_profile(request: Request):
    """Friendly-but-sharp AI roast of a student profile. Rate-limited."""
    user = await get_current_user(request)
    quota = await check_and_increment(db, user, "roast-profile")
    body = await request.json() if (await request.body()) else {}
    # Allow roasting arbitrary profile input (text) OR the caller's saved profile
    profile_text = body.get("profile_text")
    if not profile_text:
        profile = await db.student_profiles.find_one({"user_id": user["id"]}) or {}
        profile_text = json.dumps({
            "name": user.get("name"),
            "bio": profile.get("bio"),
            "department": profile.get("department"),
            "cgpa": profile.get("cgpa"),
            "skills": profile.get("skills", []),
            "linkedin_url": profile.get("linkedin_url"),
            "github_url": profile.get("github_url"),
        })
    try:
        ai = await ai_generate(
            system=(
                "You are UNIFY's brutally honest but encouraging career roaster. "
                "Roast the given profile in 3-5 punchy lines. End with one actionable upgrade."
                " Return JSON: {\"roast\": \"...\", \"score\": 0-100, \"fix\": \"...\"}"
            ),
            prompt=f"Profile: {profile_text}",
            session_id=f"roast-{user['id']}",
            max_tokens=400,
        )
        try:
            data = ai_extract_json(ai["text"])
        except Exception:
            data = {"roast": ai["text"].strip(), "score": 60, "fix": "Add more concrete accomplishments with metrics."}
        data["ai_provider"] = ai["provider"]; data["quota"] = quota
        await record_tokens(db, user, "roast-profile", tokens_estimated=len(ai["text"]) // 4, provider=ai["provider"])
        return data
    except Exception as e:
        logger.warning("roast_fallback", extra={"error": str(e)[:200]})
        return {"roast": "Your profile is cautious, which is another word for invisible. Fewer buzzwords, more shipped things.", "score": 55, "fix": "Add one project link and one measurable outcome per bullet.", "ai_provider": "fallback_heuristic", "quota": quota}


# ═══════════════════════════════════════════════════════════════════
# AI USAGE (per-user quota visibility)
# ═══════════════════════════════════════════════════════════════════
@app.get("/api/ai-usage/me")
async def my_ai_usage(request: Request):
    """Return the caller's daily AI usage vs. quota per endpoint."""
    user = await get_current_user(request)
    from unify_ratelimit import QUOTAS, _tier_for, _reset_at_iso
    tier = _tier_for(user)
    today = datetime.now(timezone.utc).date().isoformat()
    out = {}
    for ep, tiers in QUOTAS.items():
        limit = tiers.get(tier, 5)
        doc = await db.ai_usage.find_one({"user_id": user["id"], "endpoint": ep, "date": today})
        used = (doc or {}).get("count", 0)
        out[ep] = {"used": used, "limit": limit, "remaining": max(0, limit - used)}
    return {"tier": tier, "date": today, "reset_at": _reset_at_iso(), "endpoints": out}


# ═══════════════════════════════════════════════════════════════════
# WEEKLY DIGEST (Resend email)
# ═══════════════════════════════════════════════════════════════════
@app.post("/api/digest/send")
async def send_weekly_digest(request: Request):
    """Send weekly digest email to all students via Resend."""
    await require_role("admin", "placement")(request)
    resend_key = os.getenv("RESEND_API_KEY", ""); sender = os.getenv("SENDER_EMAIL", "onboarding@resend.dev")
    if not resend_key: raise HTTPException(400, "Resend not configured")
    import resend as resend_lib; resend_lib.api_key = resend_key
    students = await db.users.find({"role": "student", "is_active": True}).to_list(500)
    sent = 0
    for s in students:
        sid = str(s["_id"]); apps = await db.applications.count_documents({"student_id": sid})
        selected = await db.applications.count_documents({"student_id": sid, "status": "selected"})
        active_jobs = await db.job_postings.count_documents({"status": "active"})
        try:
            resend_lib.Emails.send({"from": sender, "to": s["email"], "subject": "UNIFY Weekly Digest",
                "html": f"<h2>Hi {s['name']},</h2><p>You have <b>{apps}</b> applications, <b>{selected}</b> selections.</p><p><b>{active_jobs}</b> active jobs waiting for you.</p><p>— UNIFY Intelligence Engine</p>"})
            sent += 1
        except: pass
    return {"message": f"Digest sent to {sent}/{len(students)} students"}

@app.get("/api/digest/preview")
async def digest_preview(request: Request):
    user = await get_current_user(request)
    apps = await db.applications.count_documents({"student_id": user["id"]})
    selected = await db.applications.count_documents({"student_id": user["id"], "status": "selected"})
    active_jobs = await db.job_postings.count_documents({"status": "active"})
    return {"apps": apps, "selected": selected, "active_jobs": active_jobs, "name": user.get("name","")}


# ─── WebSocket ────────────────────────────────────────────────────
@app.websocket("/api/ws/{user_id}")
async def websocket_endpoint(ws: WebSocket, user_id: str):
    await ws_manager.connect(ws, user_id)
    try:
        while True:
            data = await ws.receive_text()
            if data == "ping": await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        ws_manager.disconnect(ws, user_id)
