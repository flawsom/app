"""UNIFY branded email sender (Resend) with durable logging + retry.

Behaviour
─────────
- Never raises into the caller. Any failure is captured, logged, persisted.
- Every dispatch is persisted to the `email_logs` MongoDB collection with:
    {to, type, subject, status, resend_id, attempts, error, created_at, updated_at}
- Transient failures are retried twice more with exponential backoff
  (0.5s → 1.5s → 4.5s) before being marked permanently_failed.
- UI + admin endpoints can query `email_logs` to see delivery health.

Templates
─────────
- UNIFY-branded HTML wrapper (gradient header, responsive)
- Plain-text fallback for Outlook / Gmail plain-text readers
- Unsubscribe link in every email footer
"""
from __future__ import annotations
import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional, Any

logger = logging.getLogger("unify.email")

APP_URL = os.getenv("FRONTEND_URL", "https://www.unifies.codes").rstrip("/")
SUPPORT_EMAIL = os.getenv("SENDER_EMAIL", "support@unifies.codes")

# Module-level DB reference. Wired up at startup via `set_email_db(db)`.
# When unset, logs fall back to the stdlib logger only (useful for CLI scripts).
_DB: Any = None


def set_email_db(db: Any) -> None:
    """Wire the MongoDB database used for email_logs persistence."""
    global _DB
    _DB = db


# ─── Template wrapper ────────────────────────────────────────────

def _wrap(title: str, body_html: str, cta_text: str = "", cta_url: str = "", footnote: str = "") -> str:
    """UNIFY-branded HTML wrapper. Renders cleanly in Gmail, Outlook, Apple Mail."""
    cta_block = (
        f'<a href="{cta_url}" style="display:inline-block;margin:24px 0;padding:12px 24px;'
        f'background:#00E5FF;color:#01010B;font-weight:600;text-decoration:none;border-radius:8px;'
        f'font-family:system-ui,sans-serif;">{cta_text}</a>'
    ) if cta_text and cta_url else ""
    footnote_block = (
        f'<p style="color:#888;font-size:12px;margin-top:24px;">{footnote}</p>'
        if footnote else ""
    )
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0A0A10;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#14141C;border-radius:16px;overflow:hidden;border:1px solid #22222A;">
    <div style="padding:28px 32px;background:linear-gradient(135deg,#00E5FF22,#8B5CF622);border-bottom:1px solid #22222A;">
      <div style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:0.2em;color:#00E5FF;">UNIFY</div>
      <h1 style="margin:8px 0 0;color:#F0F0F5;font-size:22px;line-height:1.3;">{title}</h1>
    </div>
    <div style="padding:28px 32px;color:#C5C5D0;font-size:15px;line-height:1.6;">
      {body_html}
      {cta_block}
      {footnote_block}
    </div>
    <div style="padding:20px 32px;background:#0A0A10;border-top:1px solid #22222A;color:#666;font-size:11px;font-family:ui-monospace,monospace;">
      UNIFY · <a href="{APP_URL}" style="color:#00E5FF;text-decoration:none;">unifies.codes</a> ·
      <a href="{APP_URL}/settings?unsubscribe=1" style="color:#888;text-decoration:none;">Unsubscribe</a>
    </div>
  </div>
</body></html>"""


def _plain(text: str) -> str:
    return f"{text}\n\n—\nUNIFY · {APP_URL}\nUnsubscribe: {APP_URL}/settings?unsubscribe=1"


# ─── Low-level send + retry ──────────────────────────────────────

def _send_once(to: str, subject: str, html: str, text: str, sender_email: str, api_key: str) -> dict:
    """Synchronous single attempt. Returns {ok, resend_id, error}."""
    try:
        import resend as resend_lib
        resend_lib.api_key = api_key
        res = resend_lib.Emails.send({
            "from": f"UNIFY <{sender_email}>",
            "to": to,
            "subject": subject,
            "html": html,
            "text": text,
        })
        resend_id = (res or {}).get("id") if isinstance(res, dict) else getattr(res, "id", None)
        return {"ok": True, "resend_id": resend_id, "error": None}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "resend_id": None, "error": str(e)[:400]}


async def _retry_send(log_id: Optional[str], to: str, subject: str, html: str, text: str,
                      email_type: str) -> None:
    """Retries with exponential backoff. Persists status on every attempt."""
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    sender_email = os.getenv("SENDER_EMAIL", "onboarding@resend.dev").strip()
    if not api_key:
        await _update_log(log_id, status="skipped_no_key", error="RESEND_API_KEY not set")
        logger.warning("email_skip_no_key", extra={"to": to, "subject": subject})
        return

    backoffs = [0.5, 1.5, 4.5]  # 3 attempts total
    last_error = None
    resend_id = None
    for attempt_idx, delay in enumerate(backoffs, start=1):
        if attempt_idx > 1:
            await asyncio.sleep(delay)
        result = await asyncio.to_thread(_send_once, to, subject, html, text, sender_email, api_key)
        if result["ok"]:
            resend_id = result["resend_id"]
            await _update_log(log_id, status="sent", resend_id=resend_id, attempts=attempt_idx, error=None)
            logger.info("email_sent", extra={
                "to": to, "subject": subject, "type": email_type,
                "attempt": attempt_idx, "resend_id": resend_id,
            })
            return
        last_error = result["error"]
        await _update_log(log_id, status="retrying", attempts=attempt_idx, error=last_error)
        logger.warning("email_retry", extra={
            "to": to, "subject": subject, "attempt": attempt_idx, "error": last_error,
        })

    await _update_log(log_id, status="permanently_failed", attempts=len(backoffs), error=last_error)
    logger.error("email_permanently_failed", extra={
        "to": to, "subject": subject, "type": email_type, "error": last_error,
    })


# ─── Persistence helpers ─────────────────────────────────────────

async def _create_log(to: str, email_type: str, subject: str) -> Optional[str]:
    """Insert a pending entry into email_logs. Returns the log _id (stringified)."""
    if _DB is None:
        return None
    try:
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "_id": str(uuid.uuid4()),
            "to": to,
            "type": email_type,
            "subject": subject,
            "status": "pending",
            "attempts": 0,
            "resend_id": None,
            "error": None,
            "created_at": now,
            "updated_at": now,
        }
        await _DB.email_logs.insert_one(doc)
        return doc["_id"]
    except Exception as e:  # noqa: BLE001
        logger.warning("email_log_insert_failed", extra={"error": str(e)[:200]})
        return None


async def _update_log(log_id: Optional[str], **fields) -> None:
    if _DB is None or not log_id:
        return
    try:
        fields["updated_at"] = datetime.now(timezone.utc).isoformat()
        await _DB.email_logs.update_one({"_id": log_id}, {"$set": fields})
    except Exception as e:  # noqa: BLE001
        logger.warning("email_log_update_failed", extra={"error": str(e)[:200]})


# ─── Public API ──────────────────────────────────────────────────

async def send_email(to: str, subject: str, html: str, text: Optional[str] = None,
                      email_type: str = "transactional") -> None:
    """Fire-and-forget send. Does NOT raise.
    - Persists a log row immediately (status=pending).
    - Launches a background retry loop that updates the row on completion/failure.
    """
    if not to or "@" not in to:
        return
    plain = text or _plain("Open UNIFY to view: " + APP_URL)
    log_id = await _create_log(to, email_type, subject)
    # Spawn background retry — do not await, keep API handlers responsive.
    asyncio.create_task(_retry_send(log_id, to, subject, html, plain, email_type))


# ─── Templates ───────────────────────────────────────────────────

def welcome_email(user_name: str, role: str) -> tuple[str, str, str]:
    role_map = {
        "student": ("Your adaptive dashboard is ready", "/dashboard/student"),
        "mentor": ("Your mentor workspace is ready", "/dashboard/mentor"),
        "employer": ("Your employer console is ready", "/dashboard/employer"),
        "placement": ("Your placement cell workspace is ready", "/dashboard/placement"),
    }
    sub, path = role_map.get(role, ("Welcome to UNIFY", "/"))
    body = (
        f'<p>Hi <b>{user_name}</b>,</p>'
        f'<p>Welcome to UNIFY — the hiring engine that actually learns from outcomes.</p>'
        f'<p>Your {role} workspace is live. Jump in when you are ready — the decision '
        f'engine has already pre-computed your first recommendations.</p>'
    )
    html = _wrap("Welcome to UNIFY", body, "Open your dashboard", f"{APP_URL}{path}",
                 "No app to download. Instant sign-in at unifies.codes.")
    plain = _plain(f"Hi {user_name},\n\nWelcome to UNIFY.\n\nOpen your dashboard: {APP_URL}{path}")
    return sub, html, plain


def application_submitted_email(student_name: str, job_title: str, company: str, hire_probability: float) -> tuple[str, str, str]:
    pct = int(hire_probability * 100)
    sub = f"Application received — {job_title} at {company}"
    body = (
        f'<p>Hi <b>{student_name}</b>,</p>'
        f'<p>We confirmed your application to <b>{job_title}</b> at <b>{company}</b>.</p>'
        f'<p>UNIFY hire probability: <b style="color:#00E5FF;">{pct}%</b>. '
        f'We\'ll notify you the moment the employer moves your application.</p>'
        f'<p style="color:#888;font-size:13px;">Tip: candidates who apply within the first 24 hours see a +18% boost in interview rate.</p>'
    )
    html = _wrap("Application confirmed", body, "Track this application",
                 f"{APP_URL}/dashboard/student?tab=applications",
                 "Need help? Reply to this email or message support.")
    plain = _plain(f"Hi {student_name},\n\nYour application to {job_title} at {company} is in. "
                   f"Current UNIFY hire probability: {pct}%.")
    return sub, html, plain


def employer_new_application_email(employer_name: str, student_name: str, job_title: str, fit_summary: str) -> tuple[str, str, str]:
    sub = f"New application — {student_name} for {job_title}"
    body = (
        f'<p>Hi <b>{employer_name}</b>,</p>'
        f'<p><b>{student_name}</b> just applied to <b>{job_title}</b>.</p>'
        f'<p style="background:#1C1C28;padding:12px 16px;border-left:3px solid #00E5FF;'
        f'border-radius:4px;color:#C5C5D0;font-size:14px;">{fit_summary}</p>'
        f'<p style="color:#888;font-size:13px;">Employers who respond within 24 hours hire ~30% better candidates.</p>'
    )
    html = _wrap("New application", body, "Review candidate",
                 f"{APP_URL}/dashboard/employer?tab=applicants", "")
    plain = _plain(f"New application: {student_name} for {job_title}.\n\nUNIFY summary: {fit_summary}")
    return sub, html, plain


def application_status_email(student_name: str, job_title: str, company: str, new_status: str) -> tuple[str, str, str]:
    status_map = {
        "shortlisted":         ("You're shortlisted", "This is a real signal — respond fast."),
        "interview_scheduled": ("Interview scheduled", "Time to prep. Run the UNIFY Interview Prep — it references the company and JD."),
        "selected":            ("Offer! You're placed", "Huge. Accept or negotiate — UNIFY can draft either for you."),
        "rejected":            ("Application closed", "This one didn't move — UNIFY's model has already learned from it. Your future matches just got smarter."),
        "under_review":        ("Under review", "The employer is reviewing your application."),
    }
    title, detail = status_map.get(new_status, (f"Status: {new_status}", ""))
    sub = f"UNIFY · {title}"
    body = (
        f'<p>Hi <b>{student_name}</b>,</p>'
        f'<p>Your application for <b>{job_title}</b> at <b>{company}</b> is now <b>{new_status.replace("_"," ")}</b>.</p>'
        f'<p>{detail}</p>'
    )
    html = _wrap(title, body, "Open application", f"{APP_URL}/dashboard/student?tab=applications", "")
    plain = _plain(f"Hi {student_name},\n\nApplication for {job_title} at {company}: {new_status}.\n{detail}")
    return sub, html, plain


def certificate_issued_email(student_name: str, cert_title: str, cert_hash: str) -> tuple[str, str, str]:
    sub = f"Your UNIFY certificate is ready — {cert_title}"
    verify_url = f"{APP_URL}/verify/{cert_hash}"
    body = (
        f'<p>Hi <b>{student_name}</b>,</p>'
        f'<p>Your certificate <b>{cert_title}</b> is issued and independently verifiable.</p>'
        f'<p style="color:#888;font-size:13px;">SHA-256 hash and QR code are embedded in the PDF. Anyone can verify authenticity without logging in.</p>'
    )
    html = _wrap("Certificate issued", body, "View & download PDF", verify_url,
                 "Share the verify link on LinkedIn — it proves authenticity without exposing private data.")
    plain = _plain(f"Certificate issued: {cert_title}.\nVerify: {verify_url}")
    return sub, html, plain


def password_reset_email(user_name: str, reset_url: str) -> tuple[str, str, str]:
    sub = "Reset your UNIFY password"
    body = (
        f'<p>Hi <b>{user_name}</b>,</p>'
        f'<p>A password reset was requested for your UNIFY account. Click the button below to set a new password. '
        f'The link expires in 60 minutes.</p>'
        f'<p style="color:#888;font-size:13px;">If you didn\'t request this, ignore this email — your account is safe.</p>'
    )
    html = _wrap("Password reset", body, "Reset password", reset_url, "")
    plain = _plain(f"Reset your UNIFY password: {reset_url}\n\nLink expires in 60 minutes.")
    return sub, html, plain


def interview_scheduled_email(student_name: str, job_title: str, company: str,
                               scheduled_date: str, interview_type: str, meeting_link: Optional[str]) -> tuple[str, str, str]:
    sub = f"Interview scheduled — {job_title} at {company}"
    link_block = (f'<p>Meeting link: <a href="{meeting_link}" style="color:#00E5FF;">{meeting_link}</a></p>'
                  if meeting_link else "")
    body = (
        f'<p>Hi <b>{student_name}</b>,</p>'
        f'<p>Your interview for <b>{job_title}</b> at <b>{company}</b> is confirmed.</p>'
        f'<p><b>Type:</b> {interview_type}<br /><b>When:</b> {scheduled_date}</p>'
        f'{link_block}'
        f'<p style="color:#888;font-size:13px;">Run the UNIFY Interview Prep — it tailors questions to this exact role.</p>'
    )
    html = _wrap("Interview scheduled", body, "Open interview details",
                 f"{APP_URL}/dashboard/student?tab=applications", "")
    plain = _plain(f"Interview: {job_title} at {company}\nType: {interview_type}\nWhen: {scheduled_date}")
    return sub, html, plain


def mentor_message_email(recipient_name: str, sender_name: str, preview: str) -> tuple[str, str, str]:
    sub = f"New message from {sender_name}"
    body = (
        f'<p>Hi <b>{recipient_name}</b>,</p>'
        f'<p><b>{sender_name}</b> sent you a message on UNIFY:</p>'
        f'<p style="background:#1C1C28;padding:12px 16px;border-left:3px solid #00E5FF;'
        f'border-radius:4px;color:#C5C5D0;font-size:14px;">{preview}</p>'
    )
    html = _wrap("New mentor message", body, "Open message", f"{APP_URL}/dashboard/student", "")
    plain = _plain(f"Message from {sender_name}: {preview}")
    return sub, html, plain


def high_probability_job_alert_email(student_name: str, job_title: str, company: str,
                                      probability: float, apply_url: str) -> tuple[str, str, str]:
    pct = int(probability * 100)
    sub = f"{pct}% match — {job_title} at {company}"
    body = (
        f'<p>Hi <b>{student_name}</b>,</p>'
        f'<p>New high-probability match: <b>{job_title}</b> at <b>{company}</b> — UNIFY score <b style="color:#00E5FF;">{pct}%</b>.</p>'
        f'<p style="color:#888;font-size:13px;">Candidates at this match-level get interviews 2.4× more often.</p>'
    )
    html = _wrap("High-probability match", body, "Apply now", apply_url, "")
    plain = _plain(f"High-probability match ({pct}%): {job_title} at {company}\n{apply_url}")
    return sub, html, plain


def weekly_digest_email(student_name: str, apps: int, selected: int, active_jobs: int) -> tuple[str, str, str]:
    sub = "Your UNIFY weekly digest"
    body = (
        f'<p>Hi <b>{student_name}</b>,</p>'
        f'<p>This week on UNIFY:</p>'
        f'<ul style="color:#C5C5D0;">'
        f'<li><b>{apps}</b> applications submitted</li>'
        f'<li><b>{selected}</b> selections</li>'
        f'<li><b>{active_jobs}</b> active jobs waiting for you</li>'
        f'</ul>'
        f'<p>The decision engine refreshed your match scores overnight. Jump in.</p>'
    )
    html = _wrap("Weekly digest", body, "Open dashboard", f"{APP_URL}/dashboard/student", "")
    plain = _plain(f"Weekly digest: {apps} apps, {selected} selected, {active_jobs} active jobs.")
    return sub, html, plain
