"""
Shared HMAC-SHA256 auth utilities for RELAY AI.
demo authentication — not for production.
"""
import base64
import hashlib
import hmac
import json
import time
from typing import Optional

# demo authentication — not for production
RELAY_DEMO_SECRET = "relay-demo-only-not-production"

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


def _make_hmac(payload_b64: str, secret: str = RELAY_DEMO_SECRET) -> str:
    return hmac.new(
        secret.encode(),
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
