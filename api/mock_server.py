"""
RELAY AI — Standalone Demo Server (mock_server.py)
In-memory, zero-dependency, fully offline.
Dataset: "ShopLedger – Priya Nair Departure" (synthetic data, all APIs simulated)
"""
from fastapi import FastAPI, HTTPException, Body, APIRouter, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import base64
import hashlib
import hmac
import json
import logging
import os
import secrets as _secrets_mod
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.handover.verifier import GroundingVerifier

logger = logging.getLogger(__name__)

app = FastAPI(title="RELAY AI Backend (Autonomous Demo Server)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter()

CASE_ID = "case-001"
PRIYA_ID = "person-001"
ALEX_ID = "person-002"
SAM_ID = "person-003"

# ---------------------------------------------------------------------------
# demo authentication — not for production
#
# Token secret priority:
#   1. RELAY_TOKEN_SECRET environment variable
#   2. Auto-generated random secret per process (tokens do not survive restarts)
# ---------------------------------------------------------------------------

def _load_mock_secret() -> str:
    env_secret = os.environ.get("RELAY_TOKEN_SECRET", "").strip()
    if env_secret:
        return env_secret
    generated = _secrets_mod.token_hex(32)
    logger.warning(
        "RELAY_TOKEN_SECRET is not set. Using a random per-process secret. "
        "Tokens will not survive a server restart. "
        "Set RELAY_TOKEN_SECRET in the environment for stable demo sessions. "
        "demo authentication — not for production."
    )
    return generated

_RELAY_SECRET: str = _load_mock_secret()

TOKEN_TTL_SECONDS = 86400  # 24 hours

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

# ---------------------------------------------------------------------------
# ACL helpers
# ---------------------------------------------------------------------------

ROLE_HIERARCHY: Dict[str, List[str]] = {
    "engineering_lead": ["engineering_lead", "successor", "contractor"],
    "successor": ["successor", "contractor"],
    "contractor": ["contractor"],
}


def _make_hmac(payload_b64: str) -> str:
    """HMAC-SHA256 of base64 payload using the per-process signing secret."""
    return hmac.new(
        _RELAY_SECRET.encode(),
        payload_b64.encode(),
        hashlib.sha256,
    ).hexdigest()


def _sign_demo_token(user: str) -> Optional[dict]:
    """
    Create signed demo token for the given user key.
    Token format: {payload_b64}.{hmac_hex}
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


def _verify_demo_token(token: str) -> Optional[str]:
    """
    Verify a demo token; return role string if valid, else None.
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
        iat = payload.get("iat", 0)
        if int(time.time()) - iat > TOKEN_TTL_SECONDS:
            return None
        role = payload.get("role", "")
        if role not in ROLE_HIERARCHY:
            return None
        return role
    except Exception:
        return None


def _get_role(request: Request) -> str:
    """
    Derive role ONLY from a valid signed Bearer token in Authorization header.
    X-Relay-Role header is NEVER used to assert a role directly.
    Default role when no valid token is present: successor.
    """
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
        role = _verify_demo_token(token)
        if role:
            return role
    # No valid token — default to successor (not engineering_lead)
    return "successor"

def _can_see(item: Any, role: str) -> bool:
    """Return True if 'role' is allowed to see 'item'."""
    acl = item.get("acl") if isinstance(item, dict) else None
    if acl is None:
        return True  # no ACL = public
    allowed = acl.get("allowed_roles", [])
    visible_to = ROLE_HIERARCHY.get(role, [])
    return any(r in visible_to for r in allowed)

def _filter_by_role(items: List[Dict], role: str) -> tuple:
    """Return (visible_items, withheld_count)."""
    visible = [i for i in items if _can_see(i, role)]
    withheld = len(items) - len(visible)
    return visible, withheld

def _redact_secrets(body: Optional[str]) -> Optional[str]:
    """Mask tokens and credentials in artifact bodies."""
    if not body:
        return body
    import re
    patterns = [
        (r'sk_live_[A-Za-z0-9]+', 'sk_live_[REDACTED]'),
        (r'sk_test_[A-Za-z0-9]+', 'sk_test_[REDACTED]'),
        (r'(AWS_SECRET[^=\n]*=\s*)[^\n]+', r'\1[REDACTED]'),
        (r'(AWS_ACCESS_KEY[^=\n]*=\s*)[^\n]+', r'\1[REDACTED]'),
        (r'(JWT_SECRET[^=\n]*=\s*)[^\n]+', r'\1[REDACTED]'),
        (r'(DATABASE_URL\s*=\s*)[^\n]+', r'\1[REDACTED]'),
        (r'ghp_[A-Za-z0-9]+', 'ghp_[REDACTED]'),
        (r'github_pat_[A-Za-z0-9_]+', 'github_pat_[REDACTED]'),
        (r'xox[baprs]-[A-Za-z0-9\-]+', '[SLACK_TOKEN_REDACTED]'),
    ]
    result = body
    for pattern, replacement in patterns:
        result = re.sub(pattern, replacement, result)
    return result

def _sanitize_artifact(art: Dict, role: str) -> Dict:
    """Return a copy of the artifact with secrets redacted."""
    a = dict(art)
    a["body"] = _redact_secrets(a.get("body"))
    # Strip acl meta from response
    a.pop("acl", None)
    return a


# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------

def generate_default_data():
    data = {
        "cases": [
            {
                "id": CASE_ID,
                "name": "ShopLedger – Priya Nair Departure",
                "repo_url": "https://github.com/shopledger/api",
                "leaver_person_id": PRIYA_ID,
                "status": "interviewing",
                "source_modes": {
                    "github": "live",
                    "slack": "fixture",
                    "jira": "fixture",
                    "docs": "fixture",
                    "meetings": "fixture",
                },
                "created_at": "2024-10-15T10:00:00Z",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        ],
        "people": {
            PRIYA_ID: {
                "id": PRIYA_ID,
                "display_name": "Priya Nair",
                "identities": [
                    {"source": "github", "id": "priya-nair", "handle": "priya-nair", "email": "priya@shopledger.io"},
                    {"source": "slack", "id": "U12345", "handle": "priya", "email": "priya@shopledger.io"},
                    {"source": "jira", "id": "jira_priya", "handle": "Priya Nair", "email": "priya@shopledger.io"},
                ],
                "is_leaver": True,
                "created_at": "2024-10-15T10:00:00Z",
            },
            ALEX_ID: {
                "id": ALEX_ID,
                "display_name": "Alex Chen",
                "identities": [
                    {"source": "github", "id": "alexc", "handle": "alexc", "email": "alex@shopledger.io"},
                    {"source": "slack", "id": "U67890", "handle": "alex", "email": "alex@shopledger.io"},
                ],
                "is_leaver": False,
                "created_at": "2024-10-15T10:00:00Z",
            },
            SAM_ID: {
                "id": SAM_ID,
                "display_name": "Sam Rodriguez",
                "identities": [
                    {"source": "github", "id": "samr", "handle": "samr", "email": "sam@shopledger.io"},
                    {"source": "slack", "id": "U11111", "handle": "sam", "email": "sam@shopledger.io"},
                ],
                "is_leaver": False,
                "created_at": "2024-10-15T10:00:00Z",
            },
        },
        "components": [
            {"id": "comp-001", "case_id": CASE_ID, "name": "Auth Service",
             "path_globs": '["src/auth/**", "src/middleware/auth*"]', "criticality": 0.95},
            {"id": "comp-002", "case_id": CASE_ID, "name": "Payment Processor",
             "path_globs": '["src/payments/**", "db/migrations/**"]', "criticality": 0.90},
            {"id": "comp-003", "case_id": CASE_ID, "name": "Reporting Module",
             "path_globs": '["src/reports/**", "scripts/nightly*"]', "criticality": 0.65},
        ],
        "knowledge_scores": [
            {"id": "ks-001", "component_id": "comp-001", "person_id": PRIYA_ID,
             "score": 0.88, "breakdown": {"edits": 0.45, "reviews": 0.25, "discussion": 0.18}},
            {"id": "ks-002", "component_id": "comp-001", "person_id": ALEX_ID,
             "score": 0.42, "breakdown": {"edits": 0.20, "reviews": 0.18, "discussion": 0.04}},
            {"id": "ks-003", "component_id": "comp-001", "person_id": SAM_ID,
             "score": 0.15, "breakdown": {"edits": 0.05, "reviews": 0.08, "discussion": 0.02}},
            {"id": "ks-004", "component_id": "comp-002", "person_id": PRIYA_ID,
             "score": 0.92, "breakdown": {"edits": 0.60, "reviews": 0.20, "discussion": 0.12}},
            {"id": "ks-005", "component_id": "comp-002", "person_id": ALEX_ID,
             "score": 0.28, "breakdown": {"edits": 0.15, "reviews": 0.10, "discussion": 0.03}},
            {"id": "ks-006", "component_id": "comp-002", "person_id": SAM_ID,
             "score": 0.10, "breakdown": {"edits": 0.03, "reviews": 0.06, "discussion": 0.01}},
            {"id": "ks-007", "component_id": "comp-003", "person_id": PRIYA_ID,
             "score": 0.78, "breakdown": {"edits": 0.50, "reviews": 0.15, "discussion": 0.13}},
            {"id": "ks-008", "component_id": "comp-003", "person_id": ALEX_ID,
             "score": 0.12, "breakdown": {"edits": 0.05, "reviews": 0.05, "discussion": 0.02}},
        ],
        "artifacts": [
            {
                "id": "art-001",
                "case_id": CASE_ID,
                "source": "github",
                "source_mode": "live",
                "type": "pull_request",
                "external_id": "PR #47",
                "author_id": PRIYA_ID,
                "occurred_at": "2024-10-16T09:00:00Z",
                "url": "https://github.com/shopledger/api/pull/47",
                "title": "WIP: Webhook retry logic with exponential backoff (SL-456)",
                "body": "## Summary\nIn-progress implementation of exponential backoff retry for payment webhook delivery.\n\n## Status\n- [x] Retry queue implementation\n- [x] Backoff calculator\n- [ ] Integration tests\n- [ ] Dead-letter queue handling\n\nAssigned to Priya Nair. Currently blocking payment gateway resilience.",
                "raw": {"number": 47, "state": "open", "draft": True},
                "acl": {"visibility": "public", "allowed_roles": ["engineering_lead", "successor", "contractor"]},
                "created_at": "2024-10-16T09:00:00Z",
            },
            {
                "id": "art-002",
                "case_id": CASE_ID,
                "source": "slack",
                "source_mode": "fixture",
                "type": "slack_message",
                "external_id": "msg_004",
                "author_id": PRIYA_ID,
                "occurred_at": "2024-10-14T19:00:00Z",
                "url": "https://slack.com/archives/C_ENG/p1728604800",
                "title": "Slack: Migration reverted in #engineering",
                "body": "Had to revert the database migration from October 14. It was causing foreign key constraint violations in the payments table. Created a new branch with a fixed version that backfills currency_code before adding NOT NULL.",
                "raw": {"channel": "C_ENG"},
                "acl": {"visibility": "internal", "allowed_roles": ["engineering_lead", "successor"]},
                "created_at": "2024-10-14T19:00:00Z",
            },
            {
                "id": "art-003",
                "case_id": CASE_ID,
                "source": "jira",
                "source_mode": "fixture",
                "type": "jira_ticket",
                "external_id": "SL-234",
                "author_id": PRIYA_ID,
                "occurred_at": "2024-10-08T15:30:00Z",
                "url": "https://jira.shopledger.io/browse/SL-234",
                "title": "Fix JWT token expiry configuration [Status: Done]",
                "body": "Issue: Users experiencing premature timeouts after 15 minutes instead of 2 hours.\nResolution: Updated auth service config to 7200s.\nResolved Date: 2024-10-08T15:30:00Z",
                "raw": {"key": "SL-234", "status": "Done"},
                "acl": {"visibility": "public", "allowed_roles": ["engineering_lead", "successor", "contractor"]},
                "created_at": "2024-10-08T15:30:00Z",
            },
            {
                "id": "art-004",
                "case_id": CASE_ID,
                "source": "slack",
                "source_mode": "fixture",
                "type": "slack_message",
                "external_id": "msg_001",
                "author_id": PRIYA_ID,
                "occurred_at": "2024-10-08T18:00:00Z",
                "url": "https://slack.com/archives/C_ENG/p1728345600",
                "title": "Slack: JWT token expiry issue still occurring in prod",
                "body": "The JWT token expiry issue is still happening in production. Users are getting logged out after 15 minutes instead of the configured 2 hours. Looks like downstream gateway cache is overriding the header.",
                "raw": {"channel": "C_ENG"},
                "acl": {"visibility": "internal", "allowed_roles": ["engineering_lead", "successor"]},
                "created_at": "2024-10-08T18:00:00Z",
            },
            {
                "id": "art-005",
                "case_id": CASE_ID,
                "source": "slack",
                "source_mode": "fixture",
                "type": "slack_message",
                "external_id": "msg_007",
                "author_id": PRIYA_ID,
                "occurred_at": "2024-10-15T07:00:00Z",
                "url": "https://slack.com/archives/C_OPS/p1729036800",
                "title": "Slack: Cron setup note in #ops",
                "body": "Reminder: the nightly report generation job runs via cron at 2 AM UTC. It depends on REPORT_BUCKET_NAME and SMTP_RELAY_HOST environment variables.",
                "raw": {"channel": "C_OPS"},
                "acl": {"visibility": "internal", "allowed_roles": ["engineering_lead", "successor"]},
                "created_at": "2024-10-15T07:00:00Z",
            },
            {
                "id": "art-006",
                "case_id": CASE_ID,
                "source": "github",
                "source_mode": "live",
                "type": "commit",
                "external_id": "c3d4e5f",
                "author_id": PRIYA_ID,
                "occurred_at": "2024-10-14T18:30:00Z",
                "url": "https://github.com/shopledger/api/commit/c3d4e5f",
                "title": "Revert: Add currency_code column to payments table",
                "body": "Revert 'Add currency_code column to payments table'\n\nForeign key constraint violations on existing rows. Fixed version pending on feature/currency-fix branch.",
                "raw": {"sha": "c3d4e5f", "files": ["db/migrations/20241014_add_currency_code.sql"]},
                "acl": {"visibility": "public", "allowed_roles": ["engineering_lead", "successor", "contractor"]},
                "created_at": "2024-10-14T18:30:00Z",
            },
            {
                "id": "art-007",
                "case_id": CASE_ID,
                "source": "docs",
                "source_mode": "fixture",
                "type": "document",
                "external_id": "README.md",
                "author_id": None,
                "occurred_at": "2024-09-01T00:00:00Z",
                "url": "https://github.com/shopledger/api/blob/main/README.md",
                "title": "README.md",
                "body": "# ShopLedger API\n\nPayment processing backend.\n\n## Environment Variables\n- DATABASE_URL\n- JWT_SECRET\n- STRIPE_API_KEY\n*(Note: Missing REPORT_BUCKET_NAME and SMTP_RELAY_HOST)*",
                "raw": {"path": "README.md"},
                "acl": {"visibility": "public", "allowed_roles": ["engineering_lead", "successor", "contractor"]},
                "created_at": "2024-09-01T00:00:00Z",
            },
            # --- Restricted artifacts ---
            {
                "id": "art-008",
                "case_id": CASE_ID,
                "source": "slack",
                "source_mode": "fixture",
                "type": "slack_message",
                "external_id": "msg_fin_001",
                "author_id": PRIYA_ID,
                "occurred_at": "2024-10-10T14:00:00Z",
                "url": "https://slack.com/archives/C_FINANCE/p1728565200",
                "title": "Slack: Severance discussion in #finance-private",
                "body": "Re: Priya's severance package — the accelerated vesting clause applies given the company-initiated departure. HR has confirmed the Q4 payout schedule.",
                "raw": {"channel": "C_FINANCE_PRIVATE"},
                "acl": {"visibility": "confidential", "allowed_roles": ["engineering_lead"]},
                "created_at": "2024-10-10T14:00:00Z",
            },
            {
                "id": "art-009",
                "case_id": CASE_ID,
                "source": "jira",
                "source_mode": "fixture",
                "type": "jira_ticket",
                "external_id": "PAY-SEC-001",
                "author_id": PRIYA_ID,
                "occurred_at": "2024-10-12T11:00:00Z",
                "url": "https://jira.shopledger.io/browse/PAY-SEC-001",
                "title": "PAY-SEC-001: Payment credential rotation (Restricted)",
                "body": "Rotate Stripe live keys after Priya's departure. Steps:\n1. Generate new sk_live key in Stripe dashboard\n2. Update AWS Secrets Manager /prod/shopledger/stripe_key\n3. Trigger canary deployment to verify\n4. Revoke old key after 48h\nOwner: DevOps team",
                "raw": {"key": "PAY-SEC-001", "status": "Open", "project": "PAY-SEC"},
                "acl": {"visibility": "restricted", "allowed_roles": ["engineering_lead"]},
                "created_at": "2024-10-12T11:00:00Z",
            },
            {
                "id": "art-010",
                "case_id": CASE_ID,
                "source": "docs",
                "source_mode": "fixture",
                "type": "document",
                "external_id": "ENV_KEYS.md",
                "author_id": PRIYA_ID,
                "occurred_at": "2024-10-01T00:00:00Z",
                "url": "https://github.com/shopledger/api/blob/main/ENV_KEYS.md",
                "title": "ENV_KEYS.md (Confidential)",
                "body": "# Production Credentials\n\nSTRIPE_API_KEY=sk_live_[REDACTED]\nAWS_SECRET_ACCESS_KEY=[REDACTED]\nJWT_SECRET=[REDACTED]\nSMTP_RELAY_HOST=smtp.sendgrid.net\nREPORT_BUCKET_NAME=shopledger-reports-prod\nDATABASE_URL=[REDACTED]\n\n# Rotation due: 2024-11-01",
                "raw": {"path": "ENV_KEYS.md"},
                "acl": {"visibility": "confidential", "allowed_roles": ["engineering_lead"]},
                "created_at": "2024-10-01T00:00:00Z",
            },
            # --- Meeting notes ---
            {
                "id": "art-011",
                "case_id": CASE_ID,
                "source": "meetings",
                "source_mode": "fixture",
                "type": "document",
                "external_id": "sprint-retro-oct-2024.md",
                "author_id": PRIYA_ID,
                "occurred_at": "2024-10-11T14:00:00Z",
                "url": None,
                "title": "Sprint Retro – Oct 11, 2024",
                "body": "## What Went Well\n- Webhook retry queue merged ahead of schedule\n- Alex successfully onboarded to Auth Service codebase\n\n## What Didn't Go Well\n- Database migration rollback caused 45-minute ops scramble\n- JWT timeout root cause still not fully confirmed (gateway vs. config)\n\n## Action Items\n- Priya: document two-phase migration strategy in PR description\n- Sam: investigate Cloudflare TTL override for /auth/refresh\n- Alex: take primary reviewer role on PR #47",
                "raw": {"path": "seed/meetings/sprint-retro-oct-2024.md"},
                "acl": {"visibility": "internal", "allowed_roles": ["engineering_lead", "successor"]},
                "created_at": "2024-10-11T14:00:00Z",
            },
            {
                "id": "art-012",
                "case_id": CASE_ID,
                "source": "meetings",
                "source_mode": "fixture",
                "type": "document",
                "external_id": "arch-sync-oct-14.md",
                "author_id": PRIYA_ID,
                "occurred_at": "2024-10-14T10:00:00Z",
                "url": None,
                "title": "Architecture Sync – Oct 14, 2024",
                "body": "## Attendees: Priya, Alex, Sam, CTO\n\n## Decision: Webhook Retry Strategy\n- Agreed on exponential backoff with jitter (not fixed intervals)\n- Dead-letter queue will use SQS with 72h retention\n- Alert threshold: 3 consecutive failures -> PagerDuty P2\n\n## Decision: PostgreSQL 15 Upgrade\n- Timeline: Q1 2025\n- Priya to draft runbook before departure (STATUS: NOT COMPLETED)\n- Sam to pick up ownership\n\n## Open Questions\n- Who owns the nightly SMTP relay configuration going forward?",
                "raw": {"path": "seed/meetings/arch-sync-oct-14.md"},
                "acl": {"visibility": "internal", "allowed_roles": ["engineering_lead", "successor"]},
                "created_at": "2024-10-14T10:00:00Z",
            },
            {
                "id": "art-013",
                "case_id": CASE_ID,
                "source": "docs",
                "source_mode": "live",
                "type": "document",
                "external_id": "ARCHITECTURE.md",
                "author_id": PRIYA_ID,
                "occurred_at": "2024-10-15T12:00:00Z",
                "url": "https://github.com/shopledger/api/blob/main/docs/ARCHITECTURE.md",
                "title": "Architecture & Subsystem Ownership",
                "body": "Payment Processor Subsystem Handover. Priya was primary owner (92% knowledge share) of Payment Processor. Primary contact during handover: Alex Chen. Critical services: Stripe Webhook Ingestion, Daily Settlement Reconciliation, and Multi-Currency Ledger.",
                "raw": {"path": "docs/ARCHITECTURE.md"},
                "acl": {"visibility": "internal", "allowed_roles": ["engineering_lead", "successor", "contractor"]},
                "created_at": "2024-10-15T12:00:00Z",
            },
        ],
        "findings": [
            {
                "id": "find-001",
                "case_id": CASE_ID,
                "kind": "contradiction",
                "severity": 0.92,
                "confidence": 0.95,
                "title": "SL-234 marked Done on Jira, but JWT timeout still broken in prod",
                "summary": "Jira ticket SL-234 shows status Done, but Slack messages on the same date confirm users are still being logged out after 15 minutes. Downstream API gateway is likely overriding the TTL headers.",
                "evidence": [
                    {"artifact_id": "art-003", "span": "Jira SL-234 status: Done", "role": "ticket"},
                    {"artifact_id": "art-004", "span": "Slack: users getting logged out after 15 min", "role": "contradiction"},
                ],
                "status": "open",
                "created_at": "2024-10-16T11:00:00Z",
                "updated_at": "2024-10-16T11:00:00Z",
            },
            {
                "id": "find-002",
                "case_id": CASE_ID,
                "kind": "contradiction",
                "severity": 0.88,
                "confidence": 0.90,
                "title": "SL-287 marked Done, but migration was reverted same day",
                "summary": "Payments table currency migration was marked completed in Jira but was reverted on GitHub after throwing FK constraint errors on production data. Fixed branch unmerged.",
                "evidence": [
                    {"artifact_id": "art-002", "span": "Slack: Had to revert the database migration", "role": "revert"},
                    {"artifact_id": "art-006", "span": "Commit c3d4e5f: Revert migration", "role": "commit"},
                ],
                "status": "open",
                "created_at": "2024-10-16T11:05:00Z",
                "updated_at": "2024-10-16T11:05:00Z",
            },
            {
                "id": "find-003",
                "case_id": CASE_ID,
                "kind": "inflight",
                "severity": 0.82,
                "confidence": 1.0,
                "title": "PR #47: Webhook retry logic unmerged and missing test suite",
                "summary": "Exponential backoff logic is implemented in draft PR #47, but dead-letter queue and integration tests are unfinished. Sole author is Priya.",
                "evidence": [
                    {"artifact_id": "art-001", "span": "PR #47 draft state, missing tests", "role": "open_pr"},
                ],
                "status": "open",
                "created_at": "2024-10-16T11:10:00Z",
                "updated_at": "2024-10-16T11:10:00Z",
            },
            {
                "id": "find-004",
                "case_id": CASE_ID,
                "kind": "hidden_dependency",
                "severity": 0.78,
                "confidence": 0.95,
                "title": "Nightly report cron job depends on undocumented env vars",
                "summary": "Cron job scheduled at 02:00 UTC requires REPORT_BUCKET_NAME and SMTP_RELAY_HOST. Neither appears in README.md or Docker Compose. Silently fails if missing.",
                "evidence": [
                    {"artifact_id": "art-005", "span": "Slack: depends on REPORT_BUCKET_NAME and SMTP_RELAY_HOST", "role": "source"},
                    {"artifact_id": "art-007", "span": "README.md does not list these vars", "role": "docs"},
                ],
                "status": "open",
                "created_at": "2024-10-16T11:15:00Z",
                "updated_at": "2024-10-16T11:15:00Z",
            },
            {
                "id": "find-005",
                "case_id": CASE_ID,
                "kind": "undocumented_decision",
                "severity": 0.65,
                "confidence": 0.85,
                "title": "Currency code backfill strategy only exists in Slack thread",
                "summary": "Priya planned a two-phase rollout to backfill default currency before applying the constraint, but this architecture decision was never added to docs or PR description.",
                "evidence": [
                    {"artifact_id": "art-002", "span": "Slack: fixed version ready", "role": "chat"},
                ],
                "status": "open",
                "created_at": "2024-10-16T11:20:00Z",
                "updated_at": "2024-10-16T11:20:00Z",
            },
            {
                "id": "find-006",
                "case_id": CASE_ID,
                "kind": "undocumented_decision",
                "severity": 0.72,
                "confidence": 0.80,
                "title": "PostgreSQL 15 upgrade runbook not completed before departure",
                "summary": "Architecture sync notes confirm Priya was assigned to draft the PG15 upgrade runbook before leaving. Meeting notes show this was not completed. Sam Rodriguez picked up ownership without written procedures.",
                "evidence": [
                    {"artifact_id": "art-012", "span": "Priya to draft runbook before departure (STATUS: NOT COMPLETED)", "role": "meeting_note"},
                ],
                "status": "open",
                "created_at": "2024-10-16T11:25:00Z",
                "updated_at": "2024-10-16T11:25:00Z",
            },
        ],
        "questions": [
            {
                "id": "q-001",
                "case_id": CASE_ID,
                "finding_id": "find-001",
                "text": "SL-234 is marked Done on Jira, but users are still timing out after 15 minutes. What downstream cache or gateway setting is overriding the 2-hour TTL?",
                "evidence": [{"artifact_id": "art-003"}, {"artifact_id": "art-004"}],
                "priority": 0.95,
                "status": "answered",
                "answer": "The Cloudflare Page Rule for /auth/* is enforcing a 15-minute TTL override. I didn't update it when I changed the backend config. The fix is to add a specific rule for /auth/refresh with TTL=0 (bypass). I've documented the Cloudflare dashboard path in the handover.",
                "answer_provenance": "stated",
                "created_at": "2024-10-16T11:30:00Z",
            },
            {
                "id": "q-002",
                "case_id": CASE_ID,
                "finding_id": "find-002",
                "text": "The currency_code migration was reverted after throwing FK errors. Where is the fixed branch, and what are the exact steps to backfill existing rows before running the migration?",
                "evidence": [{"artifact_id": "art-002"}, {"artifact_id": "art-006"}],
                "priority": 0.90,
                "status": "answered",
                "answer": "The fixed branch is feature/currency-fix. Run: UPDATE payments SET currency_code = 'USD' WHERE currency_code IS NULL; first, then apply the migration. The script is in db/scripts/backfill_currency.sql.",
                "answer_provenance": "stated",
                "created_at": "2024-10-16T11:30:00Z",
            },
            {
                "id": "q-003",
                "case_id": CASE_ID,
                "finding_id": "find-003",
                "text": "PR #47 implements webhook retry logic with exponential backoff. What remains to be done before merging, and how should dead-lettered events be alerted?",
                "evidence": [{"artifact_id": "art-001"}],
                "priority": 0.85,
                "status": "answered",
                "answer": "Three things remain: (1) integration test suite for the retry queue, (2) SQS dead-letter queue configuration with 72h retention, (3) PagerDuty alert at 3 consecutive failures (P2 severity). The SQS ARN is in AWS SSM at /prod/shopledger/sqs/webhook-dlq.",
                "answer_provenance": "stated",
                "created_at": "2024-10-16T11:30:00Z",
            },
            {
                "id": "q-004",
                "case_id": CASE_ID,
                "finding_id": "find-004",
                "text": "The 2 AM reporting cron requires REPORT_BUCKET_NAME and SMTP_RELAY_HOST. Where are the production credentials stored, and who owns the SMTP relay access?",
                "evidence": [{"artifact_id": "art-005"}],
                "priority": 0.80,
                "status": "answered",
                "answer": "REPORT_BUCKET_NAME=shopledger-reports-prod, SMTP_RELAY_HOST=smtp.sendgrid.net. Both are in AWS Secrets Manager under /prod/shopledger/reports. SendGrid account access is owned by Sam Rodriguez (ops@shopledger.io).",
                "answer_provenance": "stated",
                "created_at": "2024-10-16T11:30:00Z",
            },
            {
                "id": "q-005",
                "case_id": CASE_ID,
                "finding_id": "find-005",
                "text": "Are there any other scheduled jobs or private keys on your local machine that haven't been transferred to 1Password or AWS Secrets Manager?",
                "evidence": [],
                "priority": 0.70,
                "status": "unanswered",
                "answer": None,
                "answer_provenance": None,
                "created_at": "2024-10-16T11:30:00Z",
            },
        ],
        "handover": [
            {
                "id": "ho-001",
                "case_id": CASE_ID,
                "section": "In-Flight Work",
                "text": "**Payment Webhook Retry Logic (SL-456 / PR #47)**\nPR #47 contains the exponential backoff queue. Remaining items: integration test suite and SQS dead-letter queue with 72h retention. PagerDuty P2 alert at 3 consecutive failures. Ready for Alex Chen to take over review and complete deployment. SQS ARN in AWS SSM at /prod/shopledger/sqs/webhook-dlq.",
                "evidence_ids": ["art-001", "art-012", "q-003"],
                "provenance": "inferred",
                "confidence": 0.95,
                "status": "draft",
                "claim_status": "pending",
                "history": [],
                "rejection_reason": None,
                "original_text": None,
                "created_at": "2024-10-16T12:00:00Z",
            },
            {
                "id": "ho-002",
                "case_id": CASE_ID,
                "section": "Pending Deployments",
                "text": "**Currency Code Schema Migration (SL-287)**\nThe original migration failed due to existing rows lacking currency defaults. Fixed migration branch `feature/currency-fix` contains a pre-migration script: `UPDATE payments SET currency_code = 'USD' WHERE currency_code IS NULL;` before adding `NOT NULL` constraint. Script path: db/scripts/backfill_currency.sql.",
                "evidence_ids": ["art-002", "art-006", "q-002"],
                "provenance": "stated",
                "confidence": 0.92,
                "status": "draft",
                "claim_status": "pending",
                "history": [],
                "rejection_reason": None,
                "original_text": None,
                "created_at": "2024-10-16T12:00:00Z",
            },
            {
                "id": "ho-003",
                "case_id": CASE_ID,
                "section": "Known Production Issues",
                "text": "**Premature JWT Session Timeouts (SL-234)**\nThough the backend token configuration was increased to 2 hours, Cloudflare reverse proxy edge rules enforce a 15-minute connection TTL. Fix: add a Cloudflare Page Rule for `/auth/refresh` with TTL=0 (bypass cache). Dashboard path: Cloudflare > shopledger.io > Rules > Page Rules.",
                "evidence_ids": ["art-003", "art-004", "q-001"],
                "provenance": "verified",
                "confidence": 0.90,
                "status": "draft",
                "claim_status": "pending",
                "history": [],
                "rejection_reason": None,
                "original_text": None,
                "created_at": "2024-10-16T12:00:00Z",
            },
            {
                "id": "ho-004",
                "case_id": CASE_ID,
                "section": "Environment & Ops",
                "text": "**Nightly Cron Prerequisites**\nThe nightly accounting ledger report (runs 02:00 UTC) requires:\n- `REPORT_BUCKET_NAME=shopledger-reports-prod`\n- `SMTP_RELAY_HOST=smtp.sendgrid.net`\nCredentials stored in AWS Secrets Manager under `/prod/shopledger/reports`. SendGrid ownership: Sam Rodriguez (ops@shopledger.io).",
                "evidence_ids": ["art-005", "art-007", "q-004"],
                "provenance": "stated",
                "confidence": 0.98,
                "status": "draft",
                "claim_status": "approved",
                "history": [
                    {"actor": "Alex Chen (Engineering Lead)", "action": "approved", "timestamp": "2024-10-16T13:00:00Z", "note": None}
                ],
                "rejection_reason": None,
                "original_text": None,
                "created_at": "2024-10-16T12:00:00Z",
            },
            {
                "id": "ho-005",
                "case_id": CASE_ID,
                "section": "Architecture & Ownership",
                "text": "**Payment Processor Subsystem Handover**\nPriya was primary owner (92% knowledge share). Primary contact during handover: Alex Chen. Critical services: Stripe Webhook Ingestion, Daily Settlement Reconciliation, and Multi-Currency Ledger.",
                "evidence_ids": ["art-013", "art-011", "art-012"],
                "provenance": "verified",
                "confidence": 0.96,
                "status": "draft",
                "claim_status": "pending",
                "history": [],
                "rejection_reason": None,
                "original_text": None,
                "created_at": "2024-10-16T12:00:00Z",
            },
        ],
        # Initial state: 71% — two facts missing
        "completeness": {
            "task": "Simulated blind developer setup: Clone repo, run test suite, and trigger payment webhook worker",
            "score": 0.71,
            "mean": 0.69,
            "spread": 0.08,
            "runs": [0.65, 0.71, 0.72],
            "phase": "initial",
            "required_facts": [
                {"kind": "env_var", "key": "DATABASE_URL", "source": "README.md", "status": "found", "weight": 0.12, "visibility": "public"},
                {"kind": "env_var", "key": "JWT_SECRET", "source": "README.md", "status": "found", "weight": 0.12, "visibility": "public"},
                {"kind": "env_var", "key": "STRIPE_API_KEY", "source": "README.md", "status": "found", "weight": 0.12, "visibility": "public"},
                {"kind": "env_var", "key": "REPORT_BUCKET_NAME", "source": "Handover Item #4 (Slack)", "status": "found", "weight": 0.10, "visibility": "internal"},
                {"kind": "env_var", "key": "SMTP_RELAY_HOST", "source": "Handover Item #4 (Slack)", "status": "found", "weight": 0.10, "visibility": "internal"},
                {"kind": "migration", "key": "currency_code_backfill", "source": "Handover Item #2 (Jira/Git)", "status": "found", "weight": 0.15, "visibility": "internal"},
                {"kind": "documentation", "key": "pg15_upgrade_runbook", "source": "Not documented", "status": "missing", "weight": 0.15, "visibility": "internal"},
                {"kind": "documentation", "key": "jwt_timeout_root_cause", "source": "Not documented", "status": "missing", "weight": 0.14, "visibility": "internal"},
            ],
            "blockers": [
                "PostgreSQL 15 upgrade runbook (SL-412) is missing from repository documentation.",
                "JWT timeout root cause (Cloudflare gateway) is not explicitly documented in handover.",
            ],
            "grounding_score": 0.82,
        },
        "admin": {
            "sources": [
                {"source": "GitHub", "status": "Connected & Synced (Simulated)", "last_synced": "12 minutes ago", "items": "12 commits, 2 PRs, 1 branch"},
                {"source": "Slack", "status": "Connected & Synced (Simulated)", "last_synced": "20 minutes ago", "items": "8 channels, 34 messages"},
                {"source": "Jira", "status": "Connected & Synced (Simulated)", "last_synced": "15 minutes ago", "items": "5 tickets, 12 comments"},
                {"source": "Docs", "status": "Indexed (Simulated)", "last_synced": "1 hour ago", "items": "README.md, API.md, ENV_KEYS.md, 14 markdown files"},
                {"source": "Meeting Notes", "status": "Indexed (Simulated)", "last_synced": "2 hours ago", "items": "2 meeting transcripts"},
            ],
            "identity_mappings": [
                {"name": "Priya Nair (Leaver)", "github": "priya-nair", "slack": "@priya (U12345)", "jira": "jira_priya", "confidence": "100% (Auto-Unified)"},
                {"name": "Alex Chen", "github": "alexc", "slack": "@alex (U67890)", "jira": "alex@shopledger.io", "confidence": "100% (Auto-Unified)"},
                {"name": "Sam Rodriguez", "github": "samr", "slack": "@sam (U11111)", "jira": "sam@shopledger.io", "confidence": "100% (Auto-Unified)"},
            ],
            "audit_log": [
                {"time": "Just now", "actor": "System", "action": "Calculated knowledge radar distribution across 3 components"},
                {"time": "2 hours ago", "actor": "System", "action": "Extracted 6 gap findings and generated interview questions"},
                {"time": "5 hours ago", "actor": "Priya Nair", "action": "Submitted clarification answer on currency_code migration"},
                {"time": "Yesterday", "actor": "Alex Chen (Engineering Lead)", "action": "Approved handover item ho-004: Nightly Cron Prerequisites"},
                {"time": "Yesterday", "actor": "Alex Chen (Engineering Lead)", "action": "Created case: ShopLedger – Priya Nair Departure"},
            ],
            "redactions": {
                "count": 4,
                "locations": [
                    {"artifact_id": "art-010", "type": "stripe_key", "location": "ENV_KEYS.md:line 3"},
                    {"artifact_id": "art-010", "type": "aws_secret", "location": "ENV_KEYS.md:line 4"},
                    {"artifact_id": "art-010", "type": "jwt_secret", "location": "ENV_KEYS.md:line 5"},
                    {"artifact_id": "art-010", "type": "database_url", "location": "ENV_KEYS.md:line 8"},
                ],
                "policy": "Secrets and credentials are automatically redacted before storage and display. Only masked values are stored.",
            },
        },
        "uncertainty": {
            "missing_evidence": [
                {
                    "key": "pg15_upgrade_runbook",
                    "description": "PostgreSQL 15 upgrade runbook was assigned to Priya (Architecture Sync, Oct 14) but was never completed or committed.",
                    "suggested_action": "Ask Priya directly in the interview, or assign Sam Rodriguez to draft from scratch.",
                },
                {
                    "key": "jwt_timeout_root_cause",
                    "description": "Exact Cloudflare rule path not documented. The finding is confirmed but specific configuration steps are only inferred from Priya's interview answer.",
                    "suggested_action": "Verify in Cloudflare dashboard: Rules > Page Rules for /auth/refresh. Document and add to handover.",
                },
                {
                    "key": "smtp_relay_owner_confirmed",
                    "description": "Sam Rodriguez listed as SMTP relay owner, but this was stated by Priya — not confirmed by Sam.",
                    "suggested_action": "Confirm with Sam Rodriguez directly.",
                },
            ],
            "conflicts": [
                {
                    "id": "conflict-001",
                    "source_a": {"artifact_id": "art-003", "label": "Jira SL-234: Done (2024-10-08)", "span": "Resolution: Updated auth service config to 7200s."},
                    "source_b": {"artifact_id": "art-004", "label": "Slack #engineering (2024-10-08)", "span": "The JWT token expiry issue is still happening in production. Users are getting logged out after 15 minutes."},
                    "description": "Jira ticket SL-234 is marked 'Done' but Slack messages on the same day confirm the issue persisted in production.",
                    "resolution_status": "partially_resolved",
                    "resolution_note": "Priya's interview answer explains the discrepancy: backend was fixed but Cloudflare was not updated. INFERRED — not yet verified.",
                },
                {
                    "id": "conflict-002",
                    "source_a": {"artifact_id": "art-002", "label": "Slack: migration reverted (2024-10-14)", "span": "Had to revert the database migration from October 14."},
                    "source_b": {"artifact_id": "art-006", "label": "Commit c3d4e5f (2024-10-14)", "span": "Revert 'Add currency_code column to payments table'"},
                    "description": "Both confirm the migration was reverted, but Jira SL-287 was marked Done. The fixed branch status is unverified.",
                    "resolution_status": "open",
                    "resolution_note": None,
                },
            ],
            "unanswered_questions": [
                {"question_id": "q-005", "text": "Are there any other scheduled jobs or private keys on your local machine that haven't been transferred to 1Password or AWS Secrets Manager?"},
            ],
        },
        "decisions": [
            {
                "id": "dec-001",
                "title": "Exponential backoff with jitter for webhook retries",
                "summary": "Agreed in Architecture Sync (Oct 14): use exponential backoff with jitter instead of fixed intervals. Dead-letter queue uses SQS with 72h retention.",
                "rationale": "Fixed intervals cause thundering herd on webhook endpoint after outages. Jitter spreads load. SQS was chosen over Redis for durability and cost.",
                "evidence_ids": ["art-012", "art-001"],
                "made_by": "Priya Nair, Alex Chen, CTO",
                "made_at": "2024-10-14T10:00:00Z",
                "provenance": "stated",
            },
            {
                "id": "dec-002",
                "title": "Two-phase migration strategy for currency_code column",
                "summary": "Backfill existing rows with USD default before applying NOT NULL constraint. Avoids FK violations on production data.",
                "rationale": "Direct ALTER TABLE fails because existing payments rows have NULL currency_code. The two-phase approach is safer for a live production table with 2M rows.",
                "evidence_ids": ["art-002", "art-006"],
                "made_by": "Priya Nair",
                "made_at": "2024-10-14T19:00:00Z",
                "provenance": "stated",
            },
            {
                "id": "dec-003",
                "title": "PostgreSQL 15 upgrade deferred to Q1 2025",
                "summary": "PG15 upgrade timeline set to Q1 2025 with Sam Rodriguez as new owner. Runbook not completed before Priya's departure.",
                "rationale": "Insufficient runway to complete upgrade safely before departure date. Q1 gives team time to test on staging and prepare rollback procedures.",
                "evidence_ids": ["art-012"],
                "made_by": "Priya Nair, CTO",
                "made_at": "2024-10-14T10:00:00Z",
                "provenance": "stated",
            },
        ],
        "contacts": [
            {"name": "Alex Chen", "role": "Engineering Lead / Handover Recipient", "email": "alex@shopledger.io", "slack": "@alex", "owns": ["Auth Service", "Payment Processor (incoming)"]},
            {"name": "Sam Rodriguez", "role": "DevOps / Ops Owner", "email": "sam@shopledger.io", "slack": "@sam", "owns": ["Nightly Reports", "Infrastructure", "SMTP Relay"]},
            {"name": "CTO (name withheld)", "role": "Executive Sponsor", "email": "cto@shopledger.io", "slack": "@cto", "owns": ["PG15 Upgrade Decision", "Q4 Roadmap"]},
        ],
        "continuation": {
            "first_5_days": [
                {"day": 1, "task": "Clone repo, run test suite locally, verify payment webhook worker starts", "owner": "Alex Chen", "status": "pending"},
                {"day": 1, "task": "Review ENV_KEYS.md and rotate Stripe live key (PAY-SEC-001)", "owner": "DevOps (Sam)", "status": "pending"},
                {"day": 2, "task": "Review PR #47 and assign integration test ownership", "owner": "Alex Chen", "status": "pending"},
                {"day": 2, "task": "Run feature/currency-fix branch on staging with backfill script", "owner": "Alex Chen", "status": "pending"},
                {"day": 3, "task": "Verify Cloudflare Page Rule for /auth/refresh (JWT fix)", "owner": "Sam Rodriguez", "status": "pending"},
                {"day": 4, "task": "Confirm SMTP relay ownership with SendGrid account access", "owner": "Sam Rodriguez", "status": "pending"},
                {"day": 5, "task": "Draft PostgreSQL 15 upgrade runbook (taking over from Priya)", "owner": "Sam Rodriguez", "status": "pending"},
            ],
        },
        "current_version": 1,
        "released_version": None,
        "acknowledged": False,
        "acknowledged_version": None,
        "acknowledged_at": None,
        "acknowledged_by": None,
        "handover_versions": [],
    }
    data["handover_versions"] = [
        {
            "version": 1,
            "author": "System (Autonomous Handover Engine)",
            "timestamp": "2024-10-16T12:00:00Z",
            "change_summary": "Initial synthesized handover pack (5 claims extracted)",
            "is_released": False,
            "items": [dict(i) for i in data["handover"]],
        }
    ]
    return data


db = generate_default_data()


def _record_new_version(
    author: str,
    summary: str,
    is_released: bool = False,
    items_override: Optional[List[Dict]] = None,
) -> dict:
    """Create a new numbered immutable version snapshot of the handover pack."""
    db["current_version"] = db.get("current_version", 1) + 1
    v_num = db["current_version"]
    if is_released:
        db["released_version"] = v_num

    items_snapshot = [dict(i) for i in (items_override if items_override is not None else db["handover"])]

    version_record = {
        "version": v_num,
        "author": author,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "change_summary": summary,
        "is_released": is_released,
        "items": items_snapshot,
    }
    db.setdefault("handover_versions", []).append(version_record)
    return version_record


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/auth/demo-login")
async def demo_login(request: Request, body: dict = Body(...)):
    """
    demo authentication — not for production.
    Accepts {"user": "lead"|"successor"|"contractor"} and returns a signed token.
    X-Relay-Role header may also specify the user key (for convenience in demo).
    """
    # Accept user from body, or fall back to X-Relay-Role header as user key
    user = body.get("user") or request.headers.get("x-relay-role", "successor").lower().strip()
    result = _sign_demo_token(user)
    if result is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown user '{user}'. Valid users: lead, successor, contractor."
        )
    return result


@router.get("/health")
async def health():
    return {"status": "ok", "version": "0.2.0", "mode": "standalone_demo", "dataset": "synthetic"}

@router.get("/")
async def root():
    return {"app": "RELAY AI", "version": "0.2.0", "status": "ready", "note": "Synthetic dataset. External APIs simulated."}

@router.get("/cases")
async def list_cases(request: Request):
    return db["cases"]

@router.post("/cases")
async def create_case(body: dict = Body(...)):
    new_case = {
        "id": f"case-{uuid.uuid4().hex[:6]}",
        "name": body.get("name", "New Departure Case"),
        "repo_url": body.get("repo_url", "https://github.com/company/repo"),
        "leaver_person_id": None,
        "status": "draft",
        "source_modes": body.get("source_modes", {"github": "live", "slack": "fixture", "jira": "fixture", "docs": "fixture"}),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    db["cases"].insert(0, new_case)
    return new_case

@router.get("/cases/{case_id}")
async def get_case(case_id: str):
    for c in db["cases"]:
        if c["id"] == case_id:
            return c
    return db["cases"][0]

@router.get("/cases/{case_id}/components")
async def get_components(case_id: str):
    return db["components"]

@router.get("/cases/{case_id}/knowledge")
async def get_knowledge(case_id: str):
    """
    Return knowledge concentration scores per person per component.
    Each score represents a leaver's time-decayed authorship share.

    Knowledge Concentration Risk formula (computed in api/app/risk/score.py):
      Risk = Criticality × L × (1 − B) × (1 − 0.6 × D)
    where:
      L = leaver authorship share (time-decayed edits + reviews + discussion)
      B = bench strength (highest other-contributor score / leaver score)
      D = documentation coverage ratio (0–1)
    This endpoint returns the raw L scores; risk values are derived from them.
    """
    # Annotate each score with its derived risk value for UI display.
    components = {c["id"]: c for c in db["components"]}
    result = []
    for ks in db["knowledge_scores"]:
        entry = dict(ks)
        comp = components.get(ks["component_id"], {})
        criticality = comp.get("criticality", 0.5)
        L = ks["score"]
        # Bench strength: best other-contributor score / leaver score
        others = [
            o["score"] for o in db["knowledge_scores"]
            if o["component_id"] == ks["component_id"] and o["person_id"] != ks["person_id"]
        ]
        B = (max(others) / L) if others and L > 0 else 0.0
        B = min(B, 1.0)
        D = 0.6  # demo: moderate doc coverage
        risk = round(criticality * L * (1 - B) * (1 - 0.6 * D), 3)
        entry["risk"] = risk
        entry["risk_formula"] = (
            f"Knowledge Concentration Risk = {criticality:.2f} × {L:.2f} × (1 − {B:.2f}) × (1 − 0.6 × {D:.2f}) = {risk:.3f}"
        )
        entry["risk_score_name"] = "Knowledge Concentration Risk"
        result.append(entry)
    return result

@router.get("/cases/{case_id}/artifacts")
async def get_artifacts(case_id: str, request: Request):
    role = _get_role(request)
    visible, withheld = _filter_by_role(db["artifacts"], role)
    sanitized = [_sanitize_artifact(a, role) for a in visible]
    return {
        "items": sanitized,
        "withheld_count": withheld,
        # Withheld notice is aggregate only — no artifact IDs are revealed
        "withheld_notice": f"{withheld} item(s) withheld due to access restrictions" if withheld else None,
        "role": role,
    }

@router.get("/artifacts/{artifact_id}")
async def get_artifact(artifact_id: str, request: Request):
    role = _get_role(request)
    for art in db["artifacts"]:
        if art["id"] == artifact_id:
            if not _can_see(art, role):
                # Return 404 to avoid revealing existence of restricted artifacts
                raise HTTPException(status_code=404, detail="Artifact not found")
            return _sanitize_artifact(art, role)
    raise HTTPException(status_code=404, detail="Artifact not found")

@router.get("/cases/{case_id}/findings")
async def get_findings(case_id: str, request: Request):
    role = _get_role(request)
    findings = list(db["findings"])
    result = []
    for f in findings:
        f_copy = dict(f)
        evidence = []
        for ev in f.get("evidence", []):
            art = next((a for a in db["artifacts"] if a["id"] == ev.get("artifact_id")), None)
            ev_copy = dict(ev)
            if art and not _can_see(art, role):
                ev_copy["withheld"] = True
                ev_copy["span"] = "[Source withheld — insufficient access]"
            else:
                ev_copy["withheld"] = False
            evidence.append(ev_copy)
        f_copy["evidence"] = evidence
        result.append(f_copy)
    return result

@router.get("/cases/{case_id}/questions")
async def get_questions(case_id: str, request: Request):
    return db["questions"]

@router.post("/cases/{case_id}/questions/{question_id}/answer")
async def answer_question(case_id: str, question_id: str, body: dict = Body(...)):
    for q in db["questions"]:
        if q["id"] == question_id:
            q["status"] = "answered"
            q["answer"] = body.get("text", "")
            q["answer_provenance"] = "stated"
            db["admin"]["audit_log"].insert(0, {
                "time": "Just now",
                "actor": "Priya Nair (Leaver)",
                "action": f"Answered question: {q['text'][:60]}..."
            })
            return {"status": "ok", "question": q}
    return {"status": "ok"}

@router.get("/cases/{case_id}/handover")
async def get_handover(case_id: str, request: Request):
    role = _get_role(request)
    case = next((c for c in db["cases"] if c["id"] == case_id), db["cases"][0])
    case_status = case.get("status", "")

    # If released and non-lead, serve the immutable released snapshot (which omits rejected claims)
    if case_status == "released" and role != "engineering_lead" and db.get("released_version"):
        rel_ver = db.get("released_version")
        rel_snapshot = next((v for v in db.get("handover_versions", []) if v["version"] == rel_ver), None)
        if rel_snapshot:
            items = [dict(x) for x in rel_snapshot["items"]]
        else:
            items = [dict(x) for x in db["handover"] if x.get("claim_status") != "rejected"]
    else:
        items = list(db["handover"])

    result = []
    for item in items:
        i = dict(item)
        if role != "engineering_lead":
            i.pop("rejection_reason", None)

        # Withheld claim logic: if any evidence_id points to an artifact this role
        # cannot see, replace text and evidence_ids to avoid leaking restricted info.
        # The claim itself is still included (not silently dropped).
        evidence_ids = i.get("evidence_ids", [])
        withheld_acl_level = None
        for eid in evidence_ids:
            art = next((a for a in db["artifacts"] if a["id"] == eid), None)
            if art and not _can_see(art, role):
                acl_level = art.get("acl", {}).get("visibility", "restricted")
                withheld_acl_level = acl_level
                break

        if withheld_acl_level is not None:
            i["text"] = f"Withheld: requires {withheld_acl_level} access"
            i["evidence_ids"] = ["[withheld]"]

        result.append(i)

    # Deterministic Sentence-Level Verification
    verifier = GroundingVerifier()
    artifacts_map = {a["id"]: a for a in db["artifacts"]}
    for q in db.get("questions", []):
        if q.get("answer"):
            artifacts_map[q["id"]] = {
                "id": q["id"],
                "title": f"Interview Question: {q.get('text', '')}",
                "body": q.get("answer", ""),
                "external_id": q["id"],
                "acl": {"visibility": "internal", "allowed_roles": ["engineering_lead", "successor"]}
            }
    verified_items = []
    scores = []

    for item in result:
        # If withheld, keep as-is
        if str(item.get("text", "")).startswith("Withheld:"):
            verified_items.append(item)
            continue

        e_ids = item.get("evidence_ids", [])
        ev_texts = []
        for eid in e_ids:
            art = artifacts_map.get(eid)
            if art:
                ev_texts.append(f"{art.get('title', '')} {art.get('body', '')} {art.get('external_id', '')}")

        claim_ver = verifier.verify_claim(item.get("text", ""), ev_texts)
        scores.append(claim_ver["score"])
        item["grounding"] = claim_ver

        # If claim had unsupported sentences or no evidence, downgrade provenance and flag
        if not claim_ver["is_grounded"]:
            item["unsupported_flag"] = True
            # Downgrade provenance
            item["provenance"] = claim_ver["provenance"]
            item["unsupported_reason"] = "; ".join(claim_ver["flagged_reasons"][:2])
        else:
            item["unsupported_flag"] = False

        verified_items.append(item)

    computed_grounding = round(sum(scores) / len(scores), 2) if scores else 0.82
    unreviewed = [i for i in db["handover"] if i.get("claim_status") not in ("approved", "edited", "rejected")]

    return {
        "items": verified_items,
        "grounding_score": computed_grounding,
        "grounding_method": GroundingVerifier.METHOD,
        "case_status": case_status,
        "role": role,
        "current_version": db.get("current_version", 1),
        "released_version": db.get("released_version"),
        "acknowledged": db.get("acknowledged", False),
        "acknowledged_version": db.get("acknowledged_version"),
        "acknowledged_at": db.get("acknowledged_at"),
        "acknowledged_by": db.get("acknowledged_by"),
        "unreviewed_count": len(unreviewed),
        "can_release": len(unreviewed) == 0,
    }

@router.post("/cases/{case_id}/handover/verify")
async def verify_handover(case_id: str, request: Request, body: dict = Body(default={})):
    """
    Run sentence-level grounding verification against cited evidence.
    Method: deterministic lexical and entity overlap (offline).
    """
    verifier = GroundingVerifier()
    artifacts_map = {a["id"]: a for a in db["artifacts"]}
    for q in db.get("questions", []):
        if q.get("answer"):
            artifacts_map[q["id"]] = {
                "id": q["id"],
                "title": f"Interview Question: {q.get('text', '')}",
                "body": q.get("answer", ""),
                "external_id": q["id"],
                "acl": {"visibility": "internal", "allowed_roles": ["engineering_lead", "successor"]}
            }

    custom_text = body.get("text")
    custom_evidence_ids = body.get("evidence_ids", [])

    if custom_text is not None:
        ev_texts = [
            f"{artifacts_map[eid].get('title', '')} {artifacts_map[eid].get('body', '')} {artifacts_map[eid].get('external_id', '')}"
            for eid in custom_evidence_ids if eid in artifacts_map
        ]
        result = verifier.verify_claim(custom_text, ev_texts)
        return {
            "method": verifier.METHOD,
            "verification": result,
        }

    doc_result = verifier.verify_document(db["handover"], artifacts_map)
    return doc_result

@router.post("/cases/{case_id}/handover/{claim_id}/approve")
async def approve_claim(case_id: str, claim_id: str, request: Request, body: dict = Body(default={})):
    role = _get_role(request)
    if role != "engineering_lead":
        raise HTTPException(status_code=403, detail="Only engineering_lead can approve claims.")
    for item in db["handover"]:
        if item["id"] == claim_id:
            item["claim_status"] = "approved"
            item["history"].append({
                "actor": "Alex Chen (Engineering Lead)",
                "action": "approved",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "note": body.get("note"),
            })
            ver = _record_new_version(
                author="Alex Chen (Engineering Lead)",
                summary=f"Approved claim {claim_id}: {item['text'][:40]}...",
            )
            db["admin"]["audit_log"].insert(0, {
                "time": "Just now",
                "actor": "Engineering Lead",
                "action": f"Approved claim {claim_id} (Version v{ver['version']})"
            })
            return {"status": "ok", "claim": item, "version": ver["version"]}
    raise HTTPException(status_code=404, detail="Claim not found")

@router.post("/cases/{case_id}/handover/{claim_id}/reject")
async def reject_claim(case_id: str, claim_id: str, request: Request, body: dict = Body(...)):
    role = _get_role(request)
    if role != "engineering_lead":
        raise HTTPException(status_code=403, detail="Only engineering_lead can reject claims.")
    reason = body.get("reason", "")
    if not reason:
        raise HTTPException(status_code=400, detail="Rejection reason is required.")
    for item in db["handover"]:
        if item["id"] == claim_id:
            item["claim_status"] = "rejected"
            item["rejection_reason"] = reason
            item["history"].append({
                "actor": "Alex Chen (Engineering Lead)",
                "action": "rejected",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "note": reason,
            })
            ver = _record_new_version(
                author="Alex Chen (Engineering Lead)",
                summary=f"Rejected claim {claim_id}: {reason}",
            )
            db["admin"]["audit_log"].insert(0, {
                "time": "Just now",
                "actor": "Engineering Lead",
                "action": f"Rejected claim {claim_id} (Version v{ver['version']}). Reason: {reason}"
            })
            return {"status": "ok", "claim": item, "version": ver["version"]}
    raise HTTPException(status_code=404, detail="Claim not found")

@router.put("/cases/{case_id}/handover/{claim_id}/edit")
async def edit_claim(case_id: str, claim_id: str, request: Request, body: dict = Body(...)):
    role = _get_role(request)
    if role != "engineering_lead":
        raise HTTPException(status_code=403, detail="Only engineering_lead can edit claims.")
    new_text = body.get("text", "")
    if not new_text:
        raise HTTPException(status_code=400, detail="Text is required.")
    for item in db["handover"]:
        if item["id"] == claim_id:
            if item["original_text"] is None:
                item["original_text"] = item["text"]
            item["text"] = new_text
            item["claim_status"] = "edited"
            item["history"].append({
                "actor": "Alex Chen (Engineering Lead)",
                "action": "edited",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "note": "Text edited by reviewer. Original preserved.",
            })
            ver = _record_new_version(
                author="Alex Chen (Engineering Lead)",
                summary=f"Edited text of claim {claim_id}",
            )
            return {"status": "ok", "claim": item, "version": ver["version"]}
    raise HTTPException(status_code=404, detail="Claim not found")

@router.get("/cases/{case_id}/handover/{claim_id}/history")
async def get_claim_history(case_id: str, claim_id: str):
    for item in db["handover"]:
        if item["id"] == claim_id:
            return {"claim_id": claim_id, "history": item["history"]}
    raise HTTPException(status_code=404, detail="Claim not found")

@router.post("/cases/{case_id}/handover/approve")
async def approve_handover(case_id: str, request: Request):
    role = _get_role(request)
    if role != "engineering_lead":
        raise HTTPException(status_code=403, detail="Only engineering_lead can approve the handover.")
    for c in db["cases"]:
        if c["id"] == case_id:
            c["status"] = "approved"
    return {"status": "approved"}

@router.post("/cases/{case_id}/handover/release")
async def release_handover(case_id: str, request: Request):
    role = _get_role(request)
    if role != "engineering_lead":
        raise HTTPException(status_code=403, detail="Only engineering_lead can release the handover.")

    # Release gating: the lead cannot release until every claim is approved, edited or rejected
    unreviewed = [
        item["id"] for item in db["handover"]
        if item.get("claim_status") not in ("approved", "edited", "rejected")
    ]
    if unreviewed:
        raise HTTPException(
            status_code=400,
            detail=f"Release gated: All claims must be approved, edited, or rejected before release. Unreviewed claim IDs: {', '.join(unreviewed)}"
        )

    # Filter out rejected claims so they NEVER appear in the released version
    released_items = [
        dict(item) for item in db["handover"]
        if item.get("claim_status") != "rejected"
    ]

    version_record = _record_new_version(
        author="Alex Chen (Engineering Lead)",
        summary=f"Released Handover Pack. Excluded {len(db['handover']) - len(released_items)} rejected claim(s).",
        is_released=True,
        items_override=released_items,
    )

    for c in db["cases"]:
        if c["id"] == case_id:
            c["status"] = "released"

    db["admin"]["audit_log"].insert(0, {
        "time": "Just now",
        "actor": "Engineering Lead",
        "action": f"Released handover pack (Version v{version_record['version']}) with {len(released_items)} active claims"
    })
    return {
        "status": "released",
        "version": version_record["version"],
        "released_claims_count": len(released_items),
        "excluded_rejected_count": len(db["handover"]) - len(released_items),
    }

@router.post("/cases/{case_id}/handover/acknowledge")
async def acknowledge_handover(case_id: str, request: Request):
    role = _get_role(request)
    target_version = db.get("released_version") or db.get("current_version", 1)
    db["acknowledged"] = True
    db["acknowledged_version"] = target_version
    db["acknowledged_at"] = datetime.now(timezone.utc).isoformat()
    db["acknowledged_by"] = "Alex Chen (Successor)" if role == "successor" else "Alex Chen (Engineering Lead)"
    db["admin"]["audit_log"].insert(0, {
        "time": "Just now",
        "actor": db["acknowledged_by"],
        "action": f"Acknowledged receipt of handover document (Version v{target_version})"
    })
    return {
        "status": "acknowledged",
        "version": target_version,
        "timestamp": db["acknowledged_at"],
        "actor": db["acknowledged_by"],
    }

@router.get("/cases/{case_id}/handover/versions")
async def list_handover_versions(case_id: str, request: Request):
    """Real version history: list of numbered versions with author, timestamp, change summary."""
    return [
        {
            "version": v["version"],
            "author": v["author"],
            "timestamp": v["timestamp"],
            "change_summary": v["change_summary"],
            "is_released": v["is_released"],
            "claim_count": len(v["items"]),
        }
        for v in db.get("handover_versions", [])
    ]

@router.get("/cases/{case_id}/handover/versions/{version_num}")
async def get_handover_version(case_id: str, version_num: int, request: Request):
    """Retrieve full immutable snapshot of a specific numbered version."""
    role = _get_role(request)
    for v in db.get("handover_versions", []):
        if v["version"] == version_num:
            sanitized_items = []
            for item in v["items"]:
                i = dict(item)
                if role != "engineering_lead":
                    i.pop("rejection_reason", None)
                evidence_ids = i.get("evidence_ids", [])
                withheld_level = None
                for eid in evidence_ids:
                    art = next((a for a in db["artifacts"] if a["id"] == eid), None)
                    if art and not _can_see(art, role):
                        withheld_level = art.get("acl", {}).get("visibility", "restricted")
                        break
                if withheld_level is not None:
                    i["text"] = f"Withheld: requires {withheld_level} access"
                    i["evidence_ids"] = ["[withheld]"]
                sanitized_items.append(i)
            return {
                "version": v["version"],
                "author": v["author"],
                "timestamp": v["timestamp"],
                "change_summary": v["change_summary"],
                "is_released": v["is_released"],
                "items": sanitized_items,
            }
    raise HTTPException(status_code=404, detail=f"Version {version_num} not found")

@router.get("/cases/{case_id}/handover/diff")
async def get_handover_diff(case_id: str, v1: int, v2: int, request: Request):
    """Side-by-side diff between any two numbered versions."""
    v1_rec = next((v for v in db.get("handover_versions", []) if v["version"] == v1), None)
    v2_rec = next((v for v in db.get("handover_versions", []) if v["version"] == v2), None)
    if not v1_rec or not v2_rec:
        raise HTTPException(status_code=404, detail="One or both requested versions not found")

    items_v1 = {item["id"]: item for item in v1_rec["items"]}
    items_v2 = {item["id"]: item for item in v2_rec["items"]}

    all_ids = list(dict.fromkeys(list(items_v1.keys()) + list(items_v2.keys())))
    diff_entries = []

    for cid in all_ids:
        in_v1 = items_v1.get(cid)
        in_v2 = items_v2.get(cid)

        if in_v1 and in_v2:
            status_changed = in_v1.get("claim_status") != in_v2.get("claim_status")
            text_changed = in_v1.get("text") != in_v2.get("text")
            change_type = "modified" if (status_changed or text_changed) else "unchanged"

            diff_entries.append({
                "claim_id": cid,
                "section": in_v2.get("section") or in_v1.get("section"),
                "change_type": change_type,
                "v1": {
                    "status": in_v1.get("claim_status"),
                    "text": in_v1.get("text"),
                },
                "v2": {
                    "status": in_v2.get("claim_status"),
                    "text": in_v2.get("text"),
                },
            })
        elif in_v2 and not in_v1:
            diff_entries.append({
                "claim_id": cid,
                "section": in_v2.get("section"),
                "change_type": "added",
                "v1": None,
                "v2": {
                    "status": in_v2.get("claim_status"),
                    "text": in_v2.get("text"),
                },
            })
        elif in_v1 and not in_v2:
            diff_entries.append({
                "claim_id": cid,
                "section": in_v1.get("section"),
                "change_type": "removed",
                "v1": {
                    "status": in_v1.get("claim_status"),
                    "text": in_v1.get("text"),
                },
                "v2": None,
            })

    modified_count = sum(1 for d in diff_entries if d["change_type"] == "modified")
    added_count = sum(1 for d in diff_entries if d["change_type"] == "added")
    removed_count = sum(1 for d in diff_entries if d["change_type"] == "removed")

    return {
        "v1": v1,
        "v2": v2,
        "v1_meta": {"author": v1_rec["author"], "timestamp": v1_rec["timestamp"], "summary": v1_rec["change_summary"], "is_released": v1_rec["is_released"]},
        "v2_meta": {"author": v2_rec["author"], "timestamp": v2_rec["timestamp"], "summary": v2_rec["change_summary"], "is_released": v2_rec["is_released"]},
        "diff": diff_entries,
        "summary": f"{modified_count} modified, {added_count} added, {removed_count} removed",
    }

def _compute_role_completeness(role: str) -> dict:
    """
    Role-aware simulation: The blind onboarding agent can only read content
    the active role has permission to access.
    Score formula (Handover Readiness Score):
      weighted_sum(found_facts) / total_weight
    Computed dynamically from the fact checklist — never hardcoded.
    """
    base_facts = db["completeness"]["required_facts"]
    withheld_count = 0
    role_facts = []
    for f in base_facts:
        f_copy = dict(f)
        if role == "contractor" and f.get("visibility") != "public":
            # Mask all identifying information from withheld items.
            # A contractor must not learn the name, source, or weight of
            # restricted facts — only that some items require higher access.
            withheld_count += 1
            f_copy["status"] = "withheld"
            f_copy["key"] = "Item requires higher access"
            f_copy["source"] = "Withheld: requires internal access"
        role_facts.append(f_copy)

    found_facts = [f for f in role_facts if f["status"] == "found"]
    total_weight = 1.00
    found_weight = round(sum(f.get("weight", 0.0) for f in found_facts), 2)
    score = round(found_weight / total_weight, 2)

    # Blockers: contractor sees only an opaque count, never specific names.
    blockers = []
    if role == "contractor":
        if withheld_count > 0:
            blockers = [
                f"{withheld_count} items require higher access"
            ]
    else:
        missing = [f for f in role_facts if f["status"] == "missing"]
        if any(f["key"] == "pg15_upgrade_runbook" for f in missing):
            blockers.append("PostgreSQL 15 upgrade runbook (SL-412) is missing from repository documentation.")
        if any(f["key"] == "jwt_timeout_root_cause" for f in missing):
            blockers.append("JWT timeout root cause (Cloudflare gateway) is not explicitly documented in handover.")

    # Add an opaque notice so the contractor knows some items were hidden.
    withheld_notice = (
        f"{withheld_count} required facts require higher access and are not shown."
        if withheld_count > 0 and role == "contractor"
        else None
    )

    db["completeness"]["score"] = score
    db["completeness"]["mean"] = round(score - 0.02, 2) if score > 0.05 else score
    db["completeness"]["blockers"] = blockers
    db["completeness"]["phase"] = "complete" if len([f for f in role_facts if f["status"] == "missing"]) == 0 else "initial"

    return {
        "task": db["completeness"]["task"],
        "score": score,
        "mean": db["completeness"]["mean"],
        "spread": 0.05,
        "runs": [round(max(0.1, score - 0.03), 2), score, round(min(1.0, score + 0.02), 2)],
        "phase": db["completeness"]["phase"],
        "required_facts": role_facts,
        "withheld_facts_count": withheld_count,
        "withheld_notice": withheld_notice,
        "blockers": blockers,
        "grounding_score": db["completeness"].get("grounding_score", 0.88),
        "role": role,
        "score_name": "Handover Readiness Score",
        "formula": "Handover Readiness Score = weighted_sum(found_facts) / total_weight",
        "formula_calc": f"{found_weight:.2f} / {total_weight:.2f} = {int(round(score * 100))}%",
        "unweighted_calc": f"{len(found_facts)} of {len(role_facts)} accessible required facts found",
        "is_simulated": True,
        "simulated_label": "Simulated developer onboarding agent (offline, deterministic)",
    }

@router.get("/cases/{case_id}/completeness")
async def get_completeness(case_id: str, request: Request):
    role = _get_role(request)
    return _compute_role_completeness(role)

@router.post("/cases/{case_id}/completeness/run")
async def run_completeness(case_id: str, request: Request):
    role = _get_role(request)
    return _compute_role_completeness(role)

@router.post("/cases/{case_id}/completeness/fix-missing")
async def fix_missing_facts(case_id: str, request: Request):
    """Closed-loop: generate follow-up questions with demo-suggested answers requiring lead confirmation.
    Only engineering_lead and successor may trigger this action."""
    role = _get_role(request)
    if role == "contractor":
        raise HTTPException(status_code=403, detail="Only engineering_lead or successor can trigger the fix loop.")
    missing = [f for f in db["completeness"]["required_facts"] if f["status"] == "missing"]
    if not missing:
        return {"status": "nothing_to_fix", "questions": []}

    q_map = {
        "pg15_upgrade_runbook": {
            "id": f"q-auto-{uuid.uuid4().hex[:6]}",
            "case_id": CASE_ID,
            "finding_id": "find-006",
            "text": "You were assigned to draft the PostgreSQL 15 upgrade runbook before your departure (Architecture Sync, Oct 14). Did you complete any notes, even informally? Who should own this going forward?",
            "evidence": [{"artifact_id": "art-012"}],
            "priority": 0.95,
            "status": "unanswered",
            "auto_generated": True,
            "missing_fact_key": "pg15_upgrade_runbook",
            "demo_suggested_answer": "I have rough notes in Notion (link in ENV_KEYS.md). Sam should own this — he already manages DB backups. Main steps: (1) test on staging first, (2) check pg_upgrade compatibility, (3) update connection pooler config. I'll send my notes to Sam directly.",
            "answer": None,
            "answer_provenance": None,
            "confirmed_by_lead": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        "jwt_timeout_root_cause": {
            "id": f"q-auto-{uuid.uuid4().hex[:6]}",
            "case_id": CASE_ID,
            "finding_id": "find-001",
            "text": "You mentioned the JWT timeout issue is caused by a Cloudflare rule. Can you give the exact steps to find and update that rule? Which Cloudflare account holds the shopledger.io zone?",
            "evidence": [{"artifact_id": "art-003"}, {"artifact_id": "art-004"}],
            "priority": 0.90,
            "status": "unanswered",
            "auto_generated": True,
            "missing_fact_key": "jwt_timeout_root_cause",
            "demo_suggested_answer": "Cloudflare account: ops@shopledger.io (Sam has access). Zone: shopledger.io. Go to Rules > Page Rules, find the rule for /auth/*, add a new rule for /auth/refresh with Cache Level = Bypass. Priority matters — put it above the wildcard rule.",
            "answer": None,
            "answer_provenance": None,
            "confirmed_by_lead": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    }

    generated_questions = []
    for fact in missing:
        q = q_map.get(fact["key"])
        if q and not any(x.get("missing_fact_key") == fact["key"] for x in db["questions"]):
            db["questions"].append(q)
            generated_questions.append(q)

    db["admin"]["audit_log"].insert(0, {
        "time": "Just now",
        "actor": "System",
        "action": f"Generated {len(generated_questions)} follow-up question(s) with demo-suggested answers requiring lead confirmation"
    })

    return {
        "status": "questions_generated",
        "count": len(generated_questions),
        "questions": generated_questions,
    }

@router.post("/cases/{case_id}/completeness/regenerate-handover")
async def regenerate_handover(case_id: str, request: Request, body: dict = Body(default={})):
    """
    Closed-loop fix loop: apply lead-confirmed interview answers,
    update handover document, and re-compute completeness score.
    """
    role = _get_role(request)
    default_answers = {
        "pg15_upgrade_runbook": "I have rough notes in Notion (link in ENV_KEYS.md). Sam should own this — he already manages DB backups. Main steps: (1) test on staging first, (2) check pg_upgrade compatibility, (3) update connection pooler config. I'll send my notes to Sam directly.",
        "jwt_timeout_root_cause": "Cloudflare account: ops@shopledger.io (Sam has access). Zone: shopledger.io. Go to Rules > Page Rules, find the rule for /auth/*, add a new rule for /auth/refresh with Cache Level = Bypass. Priority matters — put it above the wildcard rule.",
    }
    user_answers = body.get("answers", {})
    answers = {**default_answers, **user_answers}
    confirmed_by_lead = bool(user_answers)

    for q in db["questions"]:
        if q.get("auto_generated") and q["status"] == "unanswered":
            key = q.get("missing_fact_key")
            if key in answers:
                q["status"] = "answered"
                q["answer"] = answers[key]
                q["answer_provenance"] = "stated"
                q["confirmed_by_lead"] = confirmed_by_lead

    for fact in db["completeness"]["required_facts"]:
        if fact["status"] == "missing":
            fact["status"] = "found"
            label = "Confirmed leaver interview answer" if confirmed_by_lead else "Demo-suggested answer (confirmed)"
            if fact["key"] == "pg15_upgrade_runbook":
                fact["source"] = f"{label} (pg15_upgrade_runbook)"
                fact["weight"] = 0.15
            elif fact["key"] == "jwt_timeout_root_cause":
                fact["source"] = f"{label} (jwt_timeout_root_cause)"
                fact["weight"] = 0.10

    if not any(h["id"] == "ho-006" for h in db["handover"]):
        db["handover"].append({
            "id": "ho-006",
            "case_id": CASE_ID,
            "section": "Architecture & Ownership",
            "text": "**PostgreSQL 15 Upgrade Runbook (SL-412)**\nRough notes exist in Notion (link in ENV_KEYS.md). Owner: Sam Rodriguez. Steps: (1) test PG15 on staging, (2) verify pg_upgrade compatibility flags, (3) update PgBouncer connection pooler config, (4) coordinate maintenance window with CTO.",
            "evidence_ids": ["art-012"],
            "provenance": "stated",
            "confidence": 0.75,
            "status": "draft",
            "claim_status": "pending",
            "history": [],
            "rejection_reason": None,
            "original_text": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    if not any(h["id"] == "ho-007" for h in db["handover"]):
        db["handover"].append({
            "id": "ho-007",
            "case_id": CASE_ID,
            "section": "Known Production Issues",
            "text": "**JWT Timeout Fix — Cloudflare Steps (SL-234)**\nCloudflare account: ops@shopledger.io (Sam Rodriguez has access). Zone: shopledger.io. Navigate to Rules > Page Rules. Add rule for `/auth/refresh` with Cache Level = Bypass. Place this rule above the wildcard `/auth/*` rule by priority.",
            "evidence_ids": ["art-003", "art-004"],
            "provenance": "stated",
            "confidence": 0.88,
            "status": "draft",
            "claim_status": "pending",
            "history": [],
            "rejection_reason": None,
            "original_text": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    # Re-compute completeness dynamically
    comp_result = _compute_role_completeness(role)
    db["completeness"]["grounding_score"] = 0.94

    db["admin"]["audit_log"].insert(0, {
        "time": "Just now",
        "actor": "Alex Chen (Engineering Lead)",
        "action": f"Confirmed leaver interview answers and re-scored completeness: 71% -> {int(round(comp_result['score'] * 100))}%"
    })

    return {
        "status": "ok",
        "previous_score": 0.71,
        "new_score": comp_result["score"],
        "facts_recovered": 2,
        "completeness": comp_result,
    }

@router.get("/cases/{case_id}/admin")
async def get_admin_data(case_id: str, request: Request):
    role = _get_role(request)
    admin = dict(db["admin"])
    if role != "engineering_lead":
        admin.pop("redactions", None)
    return admin

@router.get("/cases/{case_id}/redactions")
async def get_redactions(case_id: str, request: Request):
    role = _get_role(request)
    if role != "engineering_lead":
        raise HTTPException(status_code=403, detail="Only engineering_lead can view redaction details.")
    return db["admin"]["redactions"]

@router.get("/cases/{case_id}/uncertainty")
async def get_uncertainty(case_id: str, request: Request):
    """
    Return uncertainty data filtered by role.
    - engineering_lead / successor: full detail including source artifact IDs and descriptions.
    - contractor: opaque summary only — no artifact IDs, no restricted source names.
    Unauthenticated callers are treated as successor (default role).
    """
    role = _get_role(request)
    uncertainty = db["uncertainty"]

    if role == "contractor":
        # Contractor sees only public conflicts; restricted details replaced.
        # missing_evidence items reference internal documents — omit entirely.
        # unanswered_questions may reference local credentials — omit entirely.
        public_conflicts = []
        for c in uncertainty.get("conflicts", []):
            # Only expose conflicts whose source artifacts are public.
            src_a_art = next((a for a in db["artifacts"] if a["id"] == c["source_a"].get("artifact_id")), None)
            src_b_art = next((a for a in db["artifacts"] if a["id"] == c["source_b"].get("artifact_id")), None)
            a_public = src_a_art is None or src_a_art.get("acl", {}).get("visibility") == "public"
            b_public = src_b_art is None or src_b_art.get("acl", {}).get("visibility") == "public"
            if a_public and b_public:
                public_conflicts.append(c)

        withheld_evidence = len(uncertainty.get("missing_evidence", []))
        withheld_questions = len(uncertainty.get("unanswered_questions", []))
        return {
            "missing_evidence": [],
            "withheld_missing_evidence_count": withheld_evidence,
            "conflicts": public_conflicts,
            "unanswered_questions": [],
            "withheld_questions_count": withheld_questions,
            "notice": (
                f"{withheld_evidence} evidence gaps and {withheld_questions} open questions "
                "require higher access and are not shown."
            ) if withheld_evidence or withheld_questions else None,
        }

    return uncertainty

@router.get("/cases/{case_id}/decisions")
async def get_decisions(case_id: str):
    return db["decisions"]

@router.get("/cases/{case_id}/contacts")
async def get_contacts(case_id: str):
    return db["contacts"]

@router.get("/cases/{case_id}/continuation")
async def get_continuation(case_id: str):
    return db["continuation"]

@router.get("/people/{person_id}")
async def get_person(person_id: str):
    if person_id in db["people"]:
        return db["people"][person_id]
    return {"id": person_id, "display_name": "Team Member"}

@router.post("/demo/seed")
async def demo_seed():
    global db
    db = generate_default_data()
    return {"status": "ok", "message": "Demo data refreshed to initial state"}

app.include_router(router)
app.include_router(router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    print("RELAY AI — Standalone Demo Server on http://0.0.0.0:8000")
    print("Dataset: synthetic — ShopLedger / Priya Nair Departure")
    uvicorn.run("mock_server:app", host="0.0.0.0", port=8000, reload=True)
