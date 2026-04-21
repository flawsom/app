"""Per-user rate limiting for AI-powered endpoints.

Enforced at the API level (not just frontend) — prevents a single viral
moment from destroying the AI budget. State is persisted in MongoDB so
quotas survive backend restarts.

Quotas are per-endpoint, per-day, per-role-tier:
  - free/student : lowest
  - mentor/employer : moderate
  - placement : high
  - admin : unlimited
  - pro (user.is_pro=True) : moderate+ (overrides role)
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict

from fastapi import HTTPException

# Daily quotas per endpoint per tier
QUOTAS: Dict[str, Dict[str, int]] = {
    "cover-letter":          {"student": 5,  "mentor": 20, "employer": 20, "placement": 50, "admin": 10**6, "pro": 50},
    "interview-prep":        {"student": 5,  "mentor": 20, "employer": 20, "placement": 50, "admin": 10**6, "pro": 50},
    "resume-analyze":        {"student": 5,  "mentor": 20, "employer": 20, "placement": 50, "admin": 10**6, "pro": 30},
    "chatbot":               {"student": 25, "mentor": 60, "employer": 60, "placement": 150, "admin": 10**6, "pro": 150},
    "recommendations-generate": {"student": 10, "mentor": 30, "employer": 30, "placement": 60, "admin": 10**6, "pro": 60},
    "roast-profile":         {"student": 3,  "mentor": 10, "employer": 10, "placement": 30, "admin": 10**6, "pro": 15},
}


def _tier_for(user: Dict[str, Any]) -> str:
    if user.get("is_pro"):
        return "pro"
    return user.get("role", "student") or "student"


def _reset_at_iso() -> str:
    now = datetime.now(timezone.utc)
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    return midnight.isoformat()


async def check_and_increment(db, user: Dict[str, Any], endpoint: str) -> Dict[str, Any]:
    """Verify quota, record usage, raise 429 if exceeded.

    Returns ``{used, limit, reset_at, tier}`` on success.
    """
    uid = user.get("id") or user.get("_id")
    tier = _tier_for(user)
    quota = QUOTAS.get(endpoint, {}).get(tier, 5)
    today = datetime.now(timezone.utc).date().isoformat()
    doc = await db.ai_usage.find_one({"user_id": uid, "endpoint": endpoint, "date": today})
    used = (doc or {}).get("count", 0)
    if used >= quota:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "rate_limit_exceeded",
                "endpoint": endpoint,
                "used": used,
                "limit": quota,
                "reset_at": _reset_at_iso(),
                "message": (
                    f"Daily limit for {endpoint} reached ({used}/{quota}). "
                    f"Resets at {_reset_at_iso()}. Upgrade to UNIFY Pro for higher limits."
                ),
            },
        )
    await db.ai_usage.update_one(
        {"user_id": uid, "endpoint": endpoint, "date": today},
        {
            "$inc": {"count": 1},
            "$setOnInsert": {
                "user_id": uid,
                "endpoint": endpoint,
                "date": today,
                "tier": tier,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
            "$set": {"last_used_at": datetime.now(timezone.utc).isoformat()},
        },
        upsert=True,
    )
    return {"used": used + 1, "limit": quota, "reset_at": _reset_at_iso(), "tier": tier}


async def record_tokens(db, user: Dict[str, Any], endpoint: str,
                         tokens_estimated: int = 0, provider: str = "") -> None:
    """Record token estimate for a successful AI call (for observability/billing)."""
    uid = user.get("id") or user.get("_id")
    today = datetime.now(timezone.utc).date().isoformat()
    await db.ai_usage.update_one(
        {"user_id": uid, "endpoint": endpoint, "date": today},
        {
            "$inc": {"tokens_estimated": tokens_estimated},
            "$set": {"last_provider": provider},
        },
        upsert=True,
    )
