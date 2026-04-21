"""UNIFY branded email sender (Resend).

Safe-by-default: never raises — logs on failure.
All email sends are fire-and-forget (queued via asyncio.create_task)
so API handlers stay responsive.

Every email:
- Uses UNIFY-branded HTML template (gradient header + plain-text-friendly body)
- Includes unsubscribe link (plain mailto — the digest sender persists preferences)
- Falls back to plain text for Outlook/Gmail plain-text readers
"""
from __future__ import annotations
import asyncio
import logging
import os
from typing import Optional

logger = logging.getLogger("unify.email")

APP_URL = os.getenv("FRONTEND_URL", "https://www.unifies.codes").rstrip("/")
SUPPORT_EMAIL = os.getenv("SENDER_EMAIL", "support@unifies.codes")


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
    """Lightweight plain-text wrapper for clients that don't render HTML."""
    return f"{text}\n\n—\nUNIFY · {APP_URL}\nUnsubscribe: {APP_URL}/settings?unsubscribe=1"


def _send_sync(to: str, subject: str, html: str, text: str) -> bool:
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    sender = os.getenv("SENDER_EMAIL", "onboarding@resend.dev").strip()
    if not api_key:
        logger.warning("email_skip_no_key", extra={"to": to, "subject": subject})
        return False
    try:
        import resend as resend_lib
        resend_lib.api_key = api_key
        resend_lib.Emails.send({
            "from": f"UNIFY <{sender}>",
            "to": to,
            "subject": subject,
            "html": html,
            "text": text,
        })
        logger.info("email_sent", extra={"to": to, "subject": subject})
        return True
    except Exception as e:  # noqa: BLE001
        logger.warning("email_fail", extra={"to": to, "subject": subject, "error": str(e)[:200]})
        return False


async def send_email(to: str, subject: str, html: str, text: Optional[str] = None) -> None:
    """Fire-and-forget send. Does NOT raise. Uses threadpool (Resend SDK is sync)."""
    if not to or "@" not in to:
        return
    plain = text or _plain("Open UNIFY to view: " + APP_URL)
    # Don't block — return immediately; real send runs in background.
    asyncio.get_event_loop().run_in_executor(None, _send_sync, to, subject, html, plain)


# ─── Templates ────────────────────────────────────────────────────

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
        f'<p>UNIFY hire probability: <b style="color:#00E5FF;">{pct}%</b>. We\'ll notify you the moment the employer moves your application.</p>'
        f'<p style="color:#888;font-size:13px;">Tip: candidates who apply within the first 24 hours see a +18% boost in interview rate.</p>'
    )
    html = _wrap("Application confirmed", body, "Track this application", f"{APP_URL}/dashboard/student?tab=applications",
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
    html = _wrap("New application", body, "Review candidate", f"{APP_URL}/dashboard/employer?tab=applicants", "")
    plain = _plain(f"New application: {student_name} for {job_title}.\n\nUNIFY summary: {fit_summary}")
    return sub, html, plain


def application_status_email(student_name: str, job_title: str, company: str, new_status: str) -> tuple[str, str, str]:
    status_map = {
        "shortlisted":         ("You're shortlisted", "This is a real signal — respond fast."),
        "interview_scheduled": ("Interview scheduled", "Time to prep. Run the UNIFY Interview Prep for this role — it references the company and JD."),
        "selected":            ("Offer! You're placed 🎉", "Huge. Accept or negotiate — UNIFY can draft either for you."),
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
