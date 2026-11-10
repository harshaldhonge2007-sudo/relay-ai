"""
Shared HMAC-SHA256 auth utilities for RELAY AI.
demo authentication — not for production.

Token secret priority:
  1. RELAY_TOKEN_SECRET environment variable
  2. Auto-generated random secret per process (tokens do not survive restarts)

A hardcoded fallback is intentionally absent so that accidental deployments
without the env-var do not issue tokens signed with a known public key.
"""
import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import time
from typing import Optional

logger = logging.getLogger(__name__)


def _load_secret() -> str:
    """
    Read the signing secret from RELAY_TOKEN_SECRET.
    If unset, generate a random per-process secret and warn.
    demo authentication — not for production.
    """
    env_secret = os.environ.get("RELAY_TOKEN_SECRET", "").strip()
    if env_secret:
        return env_secret
    generated = secrets.token_hex(32)
    logger.warning(
        "RELAY_TOKEN_SECRET is not set. Using a random per-process secret. "
        "Tokens will not survive a server restart. "
        "Set RELAY_TOKEN_SECRET in the environment for stable demo sessions. "
        "demo authentication — not for production."
    )
    return generated


# Resolved once at import time for the life of the process.
_RELAY_SECRET: str = _load_secret()

DEMO_USERS = {
    "lead": {
        "role": "engineering_lead",
        "display_name": "Alex Chen (Engineering Lead)",
    },
    "successor": {
        "role": "successor",
        "display_name": "Alex Chen (Successor)",
    },
    "contractor": {
        "role": "contractor",
        "display_name": "Sam Rodriguez (Contractor)",
    },
}

ROLE_HIERARCHY = {
    "engineering_lead": ["engineering_lead", "successor", "contractor"],
    "successor": ["successor", "contractor"],
    "contractor": ["contractor"],
}

# Token validity window: 24 hours
TOKEN_TTL_SECONDS = 86400


def _make_hmac(payload_b64: str) -> str:
    """HMAC-SHA256 of base64 payload using the per-process signing secret."""
    return hmac.new(
        _RELAY_SECRET.encode(),
        payload_b64.encode(),
        hashlib.sha256,
    ).hexdigest()


def sign_demo_token(user: str) -> Optional[dict]:
    """
    Create a signed demo token for the given user key.
    Returns dict with token, role, display_name, note — or None if user unknown.
    demo authentication — not for production.
    """
    if user not in DEMO_USERS:
        return None
    info = DEMO_USERS[user]
    payload = {"role": info["role"], "user": user, "iat": int(time.time())}
    payload_json = json.dumps(payload, separators=(",", ":"))
    payload_b64 = base64.b64encode(payload_json.encode()).decode()
    sig = _make_hmac(payload_b64)
    token = f"{payload_b64}.{sig}"
    return {
        "token": token,
        "role": info["role"],
        "display_name": info["display_name"],
        "note": "demo authentication — not for production",
    }


def verify_demo_token(token: str) -> Optional[str]:
    """
    Verify a demo token and return the role if valid, else None.
    Returns None for expired, malformed, or tokens with invalid signatures.
    Uses hmac.compare_digest to prevent timing attacks.
    demo authentication — not for production.
    """
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
        payload_b64, sig = parts
        expected_sig = _make_hmac(payload_b64)
        if not hmac.compare_digest(sig, expected_sig):
            return None
        payload_json = base64.b64decode(payload_b64.encode()).decode()
        payload = json.loads(payload_json)
        # Check expiry
        iat = payload.get("iat", 0)
        if int(time.time()) - iat > TOKEN_TTL_SECONDS:
            return None
        role = payload.get("role", "")
        if role not in ROLE_HIERARCHY:
            return None
        return role
    except Exception:
        return None
