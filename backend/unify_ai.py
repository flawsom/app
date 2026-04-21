"""UNIFY Intelligence Engine — Multi-provider AI router.

Every AI-powered feature in UNIFY routes through this module. No feature
should call any provider directly. The router attempts providers in priority
order and falls back automatically on any failure.

Priority order:
  1. Anthropic Claude 3.5 Sonnet (primary)
  2. OpenAI GPT-4o          (fallback 1)
  3. Google Gemini 2.0      (fallback 2)
  4. UNIFY_AI_KEY universal (fallback 3 — proxy key, routes to OpenAI/Anthropic).

Environment variables (all optional; router skips missing ones):
  ANTHROPIC_API_KEY, ANTHROPIC_MODEL
  OPENAI_API_KEY,    OPENAI_MODEL
  GEMINI_API_KEY,    GEMINI_MODEL
  UNIFY_AI_KEY       (universal proxy key)
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger("unify.ai")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
UNIFY_AI_KEY = os.getenv("UNIFY_AI_KEY", "").strip()

ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
UNIFY_KEY_MODEL = os.getenv("UNIFY_KEY_MODEL", "gpt-4o")
UNIFY_KEY_PROVIDER = os.getenv("UNIFY_KEY_PROVIDER", "openai")

DEFAULT_TIMEOUT = float(os.getenv("UNIFY_AI_TIMEOUT", "45"))


class UnifyAIError(Exception):
    """Raised when all configured AI providers fail."""


# ─── Provider adapters ────────────────────────────────────────────
async def _call_anthropic(system: str, user: str, max_tokens: int = 2048,
                          temperature: float = 0.7, **_kw) -> str:
    from anthropic import AsyncAnthropic  # pragma: no cover
    client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY, timeout=DEFAULT_TIMEOUT)
    msg = await client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=max_tokens,
        temperature=temperature,
        system=system or "You are a helpful assistant.",
        messages=[{"role": "user", "content": user}],
    )
    # Anthropic returns a list of content blocks; join text blocks
    parts = [b.text for b in msg.content if getattr(b, "type", "") == "text"]
    return "".join(parts) or ""


async def _call_openai(system: str, user: str, max_tokens: int = 2048,
                       temperature: float = 0.7, **_kw) -> str:
    from openai import AsyncOpenAI  # pragma: no cover
    client = AsyncOpenAI(api_key=OPENAI_API_KEY, timeout=DEFAULT_TIMEOUT)
    resp = await client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system or "You are a helpful assistant."},
            {"role": "user", "content": user},
        ],
        max_tokens=max_tokens,
        temperature=temperature,
    )
    return resp.choices[0].message.content or ""


async def _call_gemini(system: str, user: str, max_tokens: int = 2048,
                       temperature: float = 0.7, **_kw) -> str:
    import google.generativeai as genai  # pragma: no cover
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(
        GEMINI_MODEL,
        system_instruction=system or "You are a helpful assistant.",
    )

    def _sync_call():
        return model.generate_content(
            user,
            generation_config={
                "temperature": temperature,
                "max_output_tokens": max_tokens,
            },
        )

    resp = await asyncio.wait_for(asyncio.to_thread(_sync_call), timeout=DEFAULT_TIMEOUT)
    # Gemini sometimes returns blocked responses with no .text
    try:
        return resp.text or ""
    except Exception:
        parts = []
        for cand in getattr(resp, "candidates", []) or []:
            for p in getattr(cand.content, "parts", []) or []:
                t = getattr(p, "text", "")
                if t:
                    parts.append(t)
        return "".join(parts)


async def _call_unify_key(system: str, user: str, session_id: str = "unify",
                          max_tokens: int = 2048, **_kw) -> str:
    from emergentintegrations.llm.chat import LlmChat, UserMessage  # pragma: no cover
    chat = LlmChat(
        api_key=UNIFY_AI_KEY,
        session_id=session_id,
        system_message=system or "You are a helpful assistant.",
    ).with_model(UNIFY_KEY_PROVIDER, UNIFY_KEY_MODEL)
    return await chat.send_message(UserMessage(text=user))


# ─── Router ───────────────────────────────────────────────────────
def _providers() -> List[tuple]:
    """Return list of (name, model, async_fn) in priority order, skipping unconfigured ones."""
    chain = []
    if ANTHROPIC_API_KEY:
        chain.append(("anthropic", ANTHROPIC_MODEL, _call_anthropic))
    if OPENAI_API_KEY:
        chain.append(("openai", OPENAI_MODEL, _call_openai))
    if GEMINI_API_KEY:
        chain.append(("gemini", GEMINI_MODEL, _call_gemini))
    if UNIFY_AI_KEY:
        chain.append(("unify_key", f"{UNIFY_KEY_PROVIDER}/{UNIFY_KEY_MODEL}", _call_unify_key))
    return chain


def providers_status() -> Dict[str, bool]:
    """For /api/health — which providers are configured."""
    return {
        "anthropic": bool(ANTHROPIC_API_KEY),
        "openai": bool(OPENAI_API_KEY),
        "gemini": bool(GEMINI_API_KEY),
        "unify_key": bool(UNIFY_AI_KEY),
    }


async def generate(
    prompt: str,
    system: str = "",
    session_id: str = "unify",
    max_tokens: int = 2048,
    temperature: float = 0.7,
) -> Dict[str, Any]:
    """Generate text with automatic multi-provider fallback.

    Returns ``{text, provider, model, latency_ms}``.
    Raises ``UnifyAIError`` only if every provider fails.
    """
    chain = _providers()
    if not chain:
        raise UnifyAIError(
            "No AI providers configured. Set at least one of "
            "ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, or UNIFY_AI_KEY."
        )
    last_err: Optional[str] = None
    for name, model, fn in chain:
        t0 = time.time()
        try:
            text = await fn(
                system=system, user=prompt, session_id=session_id,
                max_tokens=max_tokens, temperature=temperature,
            )
            latency_ms = int((time.time() - t0) * 1000)
            if not (text or "").strip():
                raise RuntimeError("empty response")
            logger.info(
                "ai_ok",
                extra={
                    "provider": name,
                    "model": model,
                    "latency_ms": latency_ms,
                    "prompt_chars": len(prompt),
                    "response_chars": len(text),
                },
            )
            return {
                "text": text,
                "provider": name,
                "model": model,
                "latency_ms": latency_ms,
            }
        except Exception as e:  # noqa: BLE001 — fall through to next provider
            last_err = f"{name}: {type(e).__name__}: {str(e)[:200]}"
            logger.warning(
                "ai_fail",
                extra={
                    "provider": name,
                    "model": model,
                    "error": last_err,
                    "latency_ms": int((time.time() - t0) * 1000),
                },
            )
            continue
    raise UnifyAIError(f"All AI providers failed. Last error: {last_err}")


def extract_json(text: str) -> Any:
    """Robustly parse JSON from LLM output (handles ```json fences and text around)."""
    t = (text or "").strip()
    if t.startswith("```"):
        # Strip opening fence line (```json or ```)
        nl = t.find("\n")
        if nl > 0:
            t = t[nl + 1:]
        # Strip trailing fence
        if "```" in t:
            t = t.rsplit("```", 1)[0]
    t = t.strip()
    # Sometimes models prepend explanatory text — try to locate outermost braces/brackets
    if t and t[0] not in "[{":
        for ch in "[{":
            idx = t.find(ch)
            if idx >= 0:
                close = "]" if ch == "[" else "}"
                end = t.rfind(close)
                if end > idx:
                    t = t[idx:end + 1]
                    break
    return json.loads(t)
