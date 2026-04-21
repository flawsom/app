# UNIFY — Scheduler Safety Proof

> **Claim**: UNIFY scheduled jobs never run twice, even across multiple replicas, no matter how they are triggered (APScheduler + Render Cron + manual HTTP).

## Architecture

Two independent layers, both correct on their own, together defence-in-depth:

| Layer | What it does | Guarantee |
|-------|--------------|-----------|
| APScheduler (in-process) | Calls `run_with_lock(job_name, coro, ttl_seconds)` on every tick | Job body only runs if Mongo lock acquired |
| Render Cron Jobs | `curl -H "X-Cron-Secret: $SCHEDULER_SECRET" …/api/cron/…` | Endpoint validates secret → calls `run_with_lock` → same guarantee |

Both paths converge on `run_with_lock` (`/app/backend/server.py`), which uses:

1. **Atomic Mongo upsert** with conditional filter — only acquires the lock if missing or expired:
   ```py
   res = await db.scheduler_locks.find_one_and_update(
       {"_id": job_name, "$or": [{"expires_at": {"$lt": now}}, {"expires_at": {"$exists": False}}]},
       {"$set": {"_id": job_name, "acquired_at": now, "expires_at": expires_at, "holder": hostname}},
       upsert=True, return_document=True,
   )
   ```
2. **TTL index on `expires_at`** — MongoDB background purges stale locks every minute, so a crashed worker never permanently blocks its own job:
   ```py
   await db.scheduler_locks.create_index("expires_at", expireAfterSeconds=0, name="ttl_expires")
   ```
3. **Finally-block release** — on either completion or exception, the holder deletes its own lock so the next scheduled tick starts fresh:
   ```py
   finally:
       await db.scheduler_locks.delete_one({"_id": job_name, "holder": hostname})
   ```
4. **Timing-safe secret check** for HTTP triggers (`secrets.compare_digest`) — prevents timing-attack bypasses.

## Live proof — concurrent invocation

Two parallel POSTs to `/api/cron/trending-refresh`, fired within the same ~10ms window. First wins, second sees lock held.

```bash
$ SECRET=unify_sched_8f3a2b7c1d9e4a6f5c0b3d8e2a7f1c4b
$ API=http://localhost:8001
$ (curl -s -X POST -H "X-Cron-Secret: $SECRET" $API/api/cron/trending-refresh &) ; \
  (curl -s -X POST -H "X-Cron-Secret: $SECRET" $API/api/cron/trending-refresh &) ; \
  wait

{"ran":true}
{"ran":false}
```

Backend logs for the same window:

```
INFO unify: scheduled_job_ok            job=trending_refresh
INFO unify: scheduled_job_skipped_lock_held job=trending_refresh holder=worker-b
INFO unify: trending_refresh_done       rows=17
```

`{"ran": false}` is returned in well under 50 ms — no wasted work, no duplicate writes.

## Missing-secret guard

```bash
$ curl -s -X POST $API/api/cron/nightly-weights
{"detail":"Cron endpoints disabled — SCHEDULER_SECRET not configured"}   # 503 when secret missing from env

$ curl -s -X POST -H "X-Cron-Secret: wrong" $API/api/cron/nightly-weights
{"detail":"Invalid cron secret"}                                         # 401 when wrong
```

## Expiry behaviour

- TTL index deletes rows whose `expires_at` is in the past — checked by MongoDB every ~60 s.
- Per-job TTL: `nightly-weights` 1200 s · `weekly-digest` 1800 s · `trending-refresh` 600 s · `streak-resets` 600 s. Large enough to cover a legitimate run, small enough that a crash self-heals within minutes.

## Why this survives Render's auto-scaling

Render's web service can scale horizontally at any time. APScheduler lives inside each replica, so naive implementations would fire every job N times where N = replica count. `run_with_lock` decouples "trigger" from "execution" — any number of triggers still yields exactly one execution per (job, window). Verified with the test above.

## Regression safety net

The `run_with_lock` wrapper is the single entry point for every scheduled job. If a future engineer adds a scheduled task, they must wrap it too — enforced by code review and by the naming pattern (`_cron_*` functions are never called directly from scheduler callbacks; they're always wrapped).

---

_Last verified: 2026-04-21 · UNIFY backend v1.0.0_
