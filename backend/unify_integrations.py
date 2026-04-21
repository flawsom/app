"""UNIFY live third-party data integrations.

- JSearch (RapidAPI)  : primary job feed
- Adzuna             : fallback job feed
- Clearbit Logo      : free company logo endpoint (no key required)

All adapters are async, timeout-bounded, cached in-memory with TTL, and
normalize responses to a common shape so the rest of the app never sees
provider-specific fields.
"""
from __future__ import annotations

import logging
import os
import time
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("unify.integrations")

RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY", "").strip()
RAPIDAPI_HOST = os.getenv("RAPIDAPI_HOST", "jsearch.p.rapidapi.com")
ADZUNA_APP_ID = os.getenv("ADZUNA_APP_ID", "").strip()
ADZUNA_APP_KEY = os.getenv("ADZUNA_APP_KEY", "").strip()
CLEARBIT_API_KEY = os.getenv("CLEARBIT_API_KEY", "").strip()

HTTP_TIMEOUT = float(os.getenv("UNIFY_HTTP_TIMEOUT", "15"))

# Simple TTL cache — single-process; acceptable for MVP.
_cache: Dict[str, tuple] = {}


def _cache_get(key: str, ttl_s: int = 600) -> Optional[Any]:
    v = _cache.get(key)
    if v is None:
        return None
    ts, val = v
    if time.time() - ts > ttl_s:
        _cache.pop(key, None)
        return None
    return val


def _cache_set(key: str, val: Any) -> None:
    _cache[key] = (time.time(), val)


def providers_status() -> Dict[str, bool]:
    return {
        "jsearch": bool(RAPIDAPI_KEY),
        "adzuna": bool(ADZUNA_APP_ID and ADZUNA_APP_KEY),
        "clearbit_logo": True,  # free endpoint, always on
    }


# ─── JSearch (RapidAPI) ───────────────────────────────────────────
async def jsearch_search(query: str, location: str = "India", page: int = 1,
                          num_pages: int = 1, date_posted: str = "week") -> List[Dict[str, Any]]:
    if not RAPIDAPI_KEY:
        return []
    cache_key = f"jsearch:{query}:{location}:{page}:{date_posted}"
    cached = _cache_get(cache_key, ttl_s=900)
    if cached is not None:
        return cached
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            resp = await client.get(
                f"https://{RAPIDAPI_HOST}/search",
                params={
                    "query": f"{query} in {location}" if location else query,
                    "page": page,
                    "num_pages": num_pages,
                    "date_posted": date_posted,
                },
                headers={
                    "X-RapidAPI-Key": RAPIDAPI_KEY,
                    "X-RapidAPI-Host": RAPIDAPI_HOST,
                },
            )
            resp.raise_for_status()
            data = resp.json()
        out: List[Dict[str, Any]] = []
        for j in (data.get("data") or []):
            city = j.get("job_city") or ""
            country = j.get("job_country") or ""
            loc = ", ".join(x for x in (city, country) if x) or ("Remote" if j.get("job_is_remote") else "")
            out.append({
                "source": "jsearch",
                "source_id": j.get("job_id"),
                "title": j.get("job_title", ""),
                "company_name": j.get("employer_name", "") or "Unknown",
                "company_logo": j.get("employer_logo"),
                "company_website": j.get("employer_website"),
                "location": loc,
                "is_remote": bool(j.get("job_is_remote")),
                "description": (j.get("job_description") or "")[:1500],
                "required_skills": j.get("job_required_skills") or [],
                "apply_url": j.get("job_apply_link"),
                "salary_min": j.get("job_min_salary"),
                "salary_max": j.get("job_max_salary"),
                "salary_currency": j.get("job_salary_currency"),
                "salary_period": j.get("job_salary_period"),
                "job_type": (j.get("job_employment_type") or "FULLTIME").lower(),
                "posted_at": j.get("job_posted_at_datetime_utc"),
                "deadline": j.get("job_offer_expiration_datetime_utc"),
            })
        _cache_set(cache_key, out)
        return out
    except Exception as e:  # noqa: BLE001
        logger.warning("jsearch_error", extra={"error": str(e)[:200], "query": query})
        return []


# ─── Adzuna (fallback) ────────────────────────────────────────────
async def adzuna_search(query: str, country: str = "in", page: int = 1,
                         results_per_page: int = 20) -> List[Dict[str, Any]]:
    if not (ADZUNA_APP_ID and ADZUNA_APP_KEY):
        return []
    cache_key = f"adzuna:{query}:{country}:{page}"
    cached = _cache_get(cache_key, ttl_s=900)
    if cached is not None:
        return cached
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            resp = await client.get(
                f"https://api.adzuna.com/v1/api/jobs/{country}/search/{page}",
                params={
                    "app_id": ADZUNA_APP_ID,
                    "app_key": ADZUNA_APP_KEY,
                    "what": query,
                    "results_per_page": results_per_page,
                    "content-type": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()
        out: List[Dict[str, Any]] = []
        for j in (data.get("results") or []):
            out.append({
                "source": "adzuna",
                "source_id": str(j.get("id")),
                "title": j.get("title", ""),
                "company_name": (j.get("company") or {}).get("display_name", "") or "Unknown",
                "company_logo": None,
                "company_website": None,
                "location": (j.get("location") or {}).get("display_name", ""),
                "is_remote": False,
                "description": (j.get("description") or "")[:1500],
                "required_skills": [],
                "apply_url": j.get("redirect_url"),
                "salary_min": j.get("salary_min"),
                "salary_max": j.get("salary_max"),
                "salary_currency": "USD",
                "salary_period": "YEAR",
                "job_type": (j.get("contract_time") or "fulltime").lower(),
                "posted_at": j.get("created"),
                "deadline": None,
            })
        _cache_set(cache_key, out)
        return out
    except Exception as e:  # noqa: BLE001
        logger.warning("adzuna_error", extra={"error": str(e)[:200], "query": query})
        return []


# ─── Unified search ───────────────────────────────────────────────
async def search_jobs_live(query: str = "software intern", location: str = "India",
                             limit: int = 20) -> List[Dict[str, Any]]:
    """Primary (JSearch) + fallback (Adzuna). Deduped by (title, company)."""
    results: List[Dict[str, Any]] = []
    try:
        results = await jsearch_search(query, location)
    except Exception as e:  # pragma: no cover
        logger.warning("jsearch_unexpected", extra={"error": str(e)[:200]})
    if len(results) < 5:
        try:
            results += await adzuna_search(query, "in")
        except Exception as e:  # pragma: no cover
            logger.warning("adzuna_unexpected", extra={"error": str(e)[:200]})
    seen = set()
    out = []
    for j in results:
        key = (str(j.get("title", "")).lower(), str(j.get("company_name", "")).lower())
        if key in seen:
            continue
        seen.add(key)
        out.append(j)
        if len(out) >= limit:
            break
    return out


# ─── Company / Logo ───────────────────────────────────────────────
def company_logo_url(domain_or_name: str) -> Optional[str]:
    """Return Clearbit logo URL for a company domain (free endpoint, no key)."""
    if not domain_or_name:
        return None
    d = domain_or_name.strip().lower()
    # If a name was passed, best-effort guess
    if "." not in d:
        d = d.replace(" ", "") + ".com"
    return f"https://logo.clearbit.com/{d}"


async def company_enrich(domain: str) -> Dict[str, Any]:
    """Best-effort company enrichment. Always returns logo; real data if Clearbit key set."""
    out = {"logo_url": company_logo_url(domain), "domain": domain}
    if not CLEARBIT_API_KEY or not domain:
        return out
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            resp = await client.get(
                f"https://company.clearbit.com/v2/companies/find?domain={domain}",
                headers={"Authorization": f"Bearer {CLEARBIT_API_KEY}"},
            )
            if resp.status_code == 200:
                data = resp.json()
                out.update({
                    "name": data.get("name"),
                    "description": data.get("description"),
                    "industry": (data.get("category") or {}).get("industry"),
                    "size": (data.get("metrics") or {}).get("employeesRange"),
                    "logo_url": data.get("logo") or out["logo_url"],
                })
    except Exception as e:  # noqa: BLE001
        logger.warning("clearbit_error", extra={"error": str(e)[:200]})
    return out
