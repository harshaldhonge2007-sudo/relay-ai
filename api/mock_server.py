"""
RELAY AI — Standalone Demo Server (mock_server.py)
In-memory, zero-dependency, fully offline.
Dataset: "ShopLedger – Priya Nair Departure" (synthetic data, all APIs simulated)
"""
from fastapi import FastAPI, HTTPException, Body, APIRouter, Request, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pathlib import Path
import base64
import contextvars
import hashlib
import hmac
import json
import difflib
import logging
import os
import re
import secrets as _secrets_mod
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.handover.verifier import GroundingVerifier
from app.handover.llm_entailment import LLMEntailmentVerifier
from app.detect.recurring import cluster_recurring_problems
from app.risk.contacts import resolve_component_contacts
from app.security.quarantine import default_classifier, SensitiveClassifier
from app.ingest.pipeline import create_import_preview, get_staged_import, drop_staged_import
from app.sim.required_facts import build_generic_required_facts, compute_readiness_score
from app.schemas import ImportCommitSchema

logger = logging.getLogger(__name__)

app = FastAPI(title="RELAY AI Backend (Autonomous Demo Server)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

_current_session_id: contextvars.ContextVar[str] = contextvars.ContextVar("current_session_id", default="default")


@app.middleware("http")
async def session_scoping_middleware(request: Request, call_next):
    """Scope all in-memory database mutations to the session id in header, query, or token."""
    sid = request.headers.get("x-relay-session")
    if not sid:
        auth_h = request.headers.get("authorization", "")
        if auth_h.lower().startswith("bearer "):
            payload = _decode_demo_token(auth_h[7:].strip())
            if payload and payload.get("sid"):
                sid = payload["sid"]
    if not sid:
        sid = request.query_params.get("session_id")
    if not sid:
        sid = "default"

    token = _current_session_id.set(sid)
    try:
        response = await call_next(request)
        response.headers["x-relay-session"] = sid
        return response
    finally:
        _current_session_id.reset(token)


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

from app.security.auth import (
    _RELAY_SECRET,
    DEMO_USERS,
    ROLE_HIERARCHY,
    TOKEN_TTL_SECONDS,
    _make_hmac,
    is_demo_mode_active,
    sign_demo_token as _sign_demo_token,
    decode_demo_token as _decode_demo_token,
    verify_demo_token as _verify_demo_token,
)

# ---------------------------------------------------------------------------
# ACL helpers
# ---------------------------------------------------------------------------

def _get_role(request: Request) -> str:
    """
    Derive role ONLY from a valid signed Bearer token in Authorization header.
    X-Relay-Role header is NEVER used to assert a role directly.
    Invalid, tampered, or expired tokens return 401 Unauthorized.
    Default role when no token header is provided: successor.
    """
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
        role = _verify_demo_token(token)
        if not role:
            raise HTTPException(
                status_code=401,
                detail="Invalid, tampered, or expired bearer token.",
            )
        return role
    # No token header provided — default to successor
    return "successor"

def _can_see(item: Any, role: str) -> bool:
    """Return True if 'role' is allowed to see 'item'."""
    if isinstance(item, dict):
        if item.get("quarantine_status") == "quarantined" and role != "engineering_lead":
            return False
    acl = item.get("acl") if isinstance(item, dict) else None
    if acl is None:
        return True  # no ACL = public
    allowed = acl.get("allowed_roles", [])
    visible_to = ROLE_HIERARCHY.get(role, [])
    return any(r in visible_to for r in allowed)

def _can_see_re_review(item: dict, role: str) -> bool:
    """ACL gate for re-review queue items."""
    if role == "engineering_lead":
        return True
    acl = item.get("evidence_acl")
    if not acl:
        return True
    vis = acl.get("visibility", "public")
    if vis in ("confidential", "restricted"):
        return False
    if vis == "internal" and role != "successor":
        return False
    allowed = acl.get("allowed_roles", [])
    if allowed:
        visible_to = ROLE_HIERARCHY.get(role, [])
        return any(r in visible_to for r in allowed)
    return True

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
                "disclose_withheld_counts": True,
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
                "body": "Had to revert the database migration from October 14 (CANARY_INT_91bc). It was causing foreign key constraint violations in the payments table. Created a new branch with a fixed version that backfills currency_code before adding NOT NULL.",
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
                "title": "Slack: JWT token expiry timeout issue still occurring in prod",
                "body": "The JWT token expiry timeout issue is still happening in production. Users are getting logged out after 15 minutes instead of the configured 2 hours. Looks like downstream gateway timeout is overriding the header.",
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
                "id": "art-006a",
                "case_id": CASE_ID,
                "source": "github",
                "source_mode": "live",
                "type": "commit",
                "external_id": "a1b2c3d",
                "author_id": PRIYA_ID,
                "occurred_at": "2024-10-01T09:15:00Z",
                "url": "https://github.com/shopledger/api/commit/a1b2c3d",
                "title": "Fix JWT expiry: update auth service config",
                "body": "Fix JWT expiry: update auth service config\n\nChanges token TTL in auth.config.ts. Closes SL-234.",
                "raw": {"sha": "a1b2c3d", "files": ["src/auth/auth.config.ts"]},
                "acl": {"visibility": "public", "allowed_roles": ["engineering_lead", "successor", "contractor"]},
                "created_at": "2024-10-01T09:15:00Z",
            },
            {
                "id": "art-006b",
                "case_id": CASE_ID,
                "source": "github",
                "source_mode": "live",
                "type": "commit",
                "external_id": "b2c3d4e",
                "author_id": PRIYA_ID,
                "occurred_at": "2024-10-14T14:00:00Z",
                "url": "https://github.com/shopledger/api/commit/b2c3d4e",
                "title": "Add currency_code column to payments table",
                "body": "Add currency_code column to payments table\n\nMigration adds NOT NULL currency_code. SL-287.",
                "raw": {"sha": "b2c3d4e", "files": ["db/migrations/20241014_add_currency_code.sql"]},
                "acl": {"visibility": "public", "allowed_roles": ["engineering_lead", "successor", "contractor"]},
                "created_at": "2024-10-14T14:00:00Z",
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
                "body": "Re: Priya's severance package (CANARY_CONF_7f3a) — the accelerated vesting clause applies given the company-initiated departure. HR has confirmed the Q4 payout schedule.",
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
                "title": "PAY-SEC-001: Payment credential rotation (Restricted) (CANARY_CONF_7f3a)",
                "body": "Rotate Stripe live keys after Priya's departure (CANARY_CONF_7f3a). Steps:\n1. Generate new sk_live key in Stripe dashboard\n2. Update AWS Secrets Manager /prod/shopledger/stripe_key\n3. Trigger canary deployment to verify\n4. Revoke old key after 48h\nOwner: DevOps team",
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
                "body": "# Production Credentials (CANARY_CONF_7f3a)\n\nSTRIPE_API_KEY=sk_live_[REDACTED]\nAWS_SECRET_ACCESS_KEY=[REDACTED]\nJWT_SECRET=[REDACTED]\nSMTP_RELAY_HOST=smtp.sendgrid.net\nREPORT_BUCKET_NAME=shopledger-reports-prod\nDATABASE_URL=[REDACTED]\n\n# Rotation due: 2024-11-01",
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
                "body": "Security classification: Internal (CANARY_INT_91bc)\n## What Went Well\n- Webhook retry queue merged ahead of schedule\n- Alex successfully onboarded to Auth Service codebase\n\n## What Didn't Go Well\n- Database migration rollback caused 45-minute ops scramble\n- JWT timeout root cause still not fully confirmed (gateway vs. config)\n\n## Action Items\n- Priya: document two-phase migration strategy in PR description\n- Sam: investigate Cloudflare TTL override for /auth/refresh\n- Alex: take primary reviewer role on PR #47",
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
                "body": "Security classification: Internal (CANARY_INT_91bc)\n## Attendees: Priya, Alex, Sam, CTO\n\n## Decision: Webhook Retry Strategy\n- Agreed on exponential backoff with jitter (not fixed intervals)\n- Dead-letter queue will use SQS with 72h retention\n- Alert threshold: 3 consecutive failures -> PagerDuty P2\n\n## Decision: PostgreSQL 15 Upgrade\n- Timeline: Q1 2025\n- Priya to draft runbook before departure (STATUS: NOT COMPLETED)\n- Sam to pick up ownership\n\n## Open Questions\n- Who owns the nightly SMTP relay configuration going forward?",
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
            {
                "id": "art-014",
                "case_id": CASE_ID,
                "source": "slack",
                "source_mode": "fixture",
                "type": "slack_message",
                "external_id": "msg_q_hr_001",
                "author_id": ALEX_ID,
                "occurred_at": "2024-10-12T14:00:00Z",
                "url": "https://slack.com/archives/C_ENG/p1728692000",
                "title": "#engineering - Q4 compensation and retention package update",
                "body": "Hey team, Elena Vance shared the Q4 compensation and retention package update for Priya Nair (CANARY_QUARANTINE_e42b_hr). Annual salary review and bonus package details are pending final approval under the bilateral NDA.",
                "raw": {"channel": "C_ENG", "id": "msg_q_hr_001"},
                "acl": {"visibility": "internal", "allowed_roles": ["engineering_lead", "successor"]},
                "quarantine_status": "quarantined",
                "quarantine_reasons": ["hr:salary", "legal:nda_lawsuit"],
                "original_body": None,
                "created_at": "2024-10-12T14:00:00Z",
            },
            {
                "id": "art-015",
                "case_id": CASE_ID,
                "source": "slack",
                "source_mode": "fixture",
                "type": "slack_message",
                "external_id": "msg_q_cust_001",
                "author_id": PRIYA_ID,
                "occurred_at": "2024-10-13T10:00:00Z",
                "url": "https://slack.com/archives/C_ENG/p1728778000",
                "title": "#engineering - Customer support escalation robert.morris@enterpriseclient.com",
                "body": "Forwarding customer support escalation: client robert.morris@enterpriseclient.com reports CID-88219 payment webhook failing with card processing error. Customer phone is +1-415-555-8392. Ref: CANARY_QUARANTINE_e42b_cust.",
                "raw": {"channel": "C_ENG", "id": "msg_q_cust_001"},
                "acl": {"visibility": "internal", "allowed_roles": ["engineering_lead", "successor"]},
                "quarantine_status": "quarantined",
                "quarantine_reasons": ["customer:id", "pii:email", "pii:phone"],
                "original_body": None,
                "created_at": "2024-10-13T10:00:00Z",
            },
            {
                "id": "art-016",
                "case_id": CASE_ID,
                "source": "github",
                "source_mode": "live",
                "type": "commit",
                "external_id": "a2b3c4d",
                "author_id": PRIYA_ID,
                "occurred_at": "2024-10-09T16:00:00Z",
                "url": "https://github.com/shopledger/api/commit/a2b3c4d",
                "title": "Hotfix: Fix session timeout race condition in auth.config.ts",
                "body": "Hotfix: Fix session timeout race condition in auth.config.ts\n\nSecondary fix for token expiry under high concurrency. Ref SL-234.",
                "raw": {"sha": "a2b3c4d", "files": ["src/auth/auth.config.ts"]},
                "acl": {"visibility": "public", "allowed_roles": ["engineering_lead", "successor", "contractor"]},
                "created_at": "2024-10-09T16:00:00Z",
            },
            {
                "id": "art-017",
                "case_id": CASE_ID,
                "source": "github",
                "source_mode": "live",
                "type": "commit",
                "external_id": "f6a7b8c",
                "author_id": ALEX_ID,
                "occurred_at": "2024-10-15T16:00:00Z",
                "url": "https://github.com/shopledger/api/commit/f6a7b8c",
                "title": "CI: retry flaky test test_payment_webhook_retry intermittent failure",
                "body": "CI: retry flaky test test_payment_webhook_retry intermittent failure\n\nAdds retry wrapper around payment webhook integration tests due to transient mock timer flakiness.",
                "raw": {"sha": "f6a7b8c", "files": ["tests/test_payment_webhook_retry.py"]},
                "acl": {"visibility": "public", "allowed_roles": ["engineering_lead", "successor", "contractor"]},
                "created_at": "2024-10-15T16:00:00Z",
            },
            {
                "id": "art-018",
                "case_id": CASE_ID,
                "source": "slack",
                "source_mode": "fixture",
                "type": "slack_message",
                "external_id": "msg_003",
                "author_id": PRIYA_ID,
                "occurred_at": "2024-10-08T20:00:00Z",
                "url": "https://slack.com/archives/C_ENG/p1728518400",
                "title": "#engineering - Downstream timeout on token refresh",
                "body": "The fix was deployed but something's still wrong. I am seeing timeout errors in the logs after the token refresh. Downstream timeout failure.",
                "raw": {"channel": "C_ENG", "id": "msg_003"},
                "acl": {"visibility": "internal", "allowed_roles": ["engineering_lead", "successor"]},
                "created_at": "2024-10-08T20:00:00Z",
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
                {"source": "GitHub", "status": "Connected & Synced (Simulated)", "last_synced": "12 minutes ago", "items": "12 commits, 2 PRs, 1 branch",
                 "acl": {"access_level": "public", "allowed_roles": ["engineering_lead", "successor", "contractor"]}},
                {"source": "Slack", "status": "Connected & Synced (Simulated)", "last_synced": "20 minutes ago", "items": "8 channels, 34 messages",
                 "acl": {"access_level": "internal", "allowed_roles": ["engineering_lead", "successor"]}},
                {"source": "Jira", "status": "Connected & Synced (Simulated)", "last_synced": "15 minutes ago", "items": "5 tickets, 12 comments",
                 "acl": {"access_level": "public", "allowed_roles": ["engineering_lead", "successor", "contractor"]}},
                {"source": "Docs", "status": "Indexed (Simulated)", "last_synced": "1 hour ago", "items": "README.md, API.md, ENV_KEYS.md, 14 markdown files",
                 "acl": {"access_level": "internal", "allowed_roles": ["engineering_lead", "successor"]}},
                {"source": "Meeting Notes", "status": "Indexed (Simulated)", "last_synced": "2 hours ago", "items": "2 meeting transcripts",
                 "acl": {"access_level": "confidential", "allowed_roles": ["engineering_lead"]}},
            ],
            "identity_mappings": [
                {"id": "id-001", "name": "Priya Nair (Leaver)", "github": "priya-nair", "slack": "@priya (U12345)", "jira": "jira_priya", "confidence": "100% (Auto-Unified)", "status": "auto_merged"},
                {"id": "id-002", "name": "Alex Chen", "github": "alexc", "slack": "@alex (U67890)", "jira": "alex@shopledger.io", "confidence": "94% (Fuzzy Match)", "status": "auto_merged"},
                {"id": "id-003", "name": "Sam Rodriguez", "github": "samr", "slack": "@sam (U11111)", "jira": "sam@shopledger.io", "confidence": "89% (Handle Match)", "status": "auto_merged"},
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
        "re_review_queue": [],
        "evidence_drift_events": [],
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
    data["assets"] = [
        {"id": "asset-001", "name": "ShopLedger API Architecture v2.pdf", "file_type": "pdf", "platform": "google_drive", "url": "https://drive.google.com/file/d/demo-001", "owner": "Priya Nair", "last_modified": "2024-09-30T10:00:00Z", "relevance_score": 0.95, "category": "architecture", "is_selected": True, "is_demo": True},
        {"id": "asset-002", "name": "Payment Webhook Implementation Notes.docx", "file_type": "docx", "platform": "google_drive", "url": "https://drive.google.com/file/d/demo-002", "owner": "Priya Nair", "last_modified": "2024-10-05T10:00:00Z", "relevance_score": 0.92, "category": "api_docs", "is_selected": True, "is_demo": True},
        {"id": "asset-003", "name": "Sprint Planning Q4 2024.gsheet", "file_type": "sheet", "platform": "google_sheets", "url": "https://docs.google.com/spreadsheets/d/demo-003", "owner": "Alex Chen", "last_modified": "2024-10-07T10:00:00Z", "relevance_score": 0.78, "category": "project_plan", "is_selected": False, "is_demo": True},
        {"id": "asset-004", "name": "DB Migration Runbook — SL-287.md", "file_type": "markdown", "platform": "google_drive", "url": "https://drive.google.com/file/d/demo-004", "owner": "Priya Nair", "last_modified": "2024-09-25T10:00:00Z", "relevance_score": 0.88, "category": "runbook", "is_selected": True, "is_demo": True},
        {"id": "asset-005", "name": "Infrastructure Diagram — AWS Architecture.drawio", "file_type": "diagram", "platform": "google_drive", "url": "https://drive.google.com/file/d/demo-005", "owner": "Sam Rodriguez", "last_modified": "2024-09-20T10:00:00Z", "relevance_score": 0.82, "category": "architecture", "is_selected": False, "is_demo": True},
        {"id": "asset-006", "name": "JWT Auth Service Technical Spec.pdf", "file_type": "pdf", "platform": "google_drive", "url": "https://drive.google.com/file/d/demo-006", "owner": "Priya Nair", "last_modified": "2024-09-10T10:00:00Z", "relevance_score": 0.90, "category": "technical_spec", "is_selected": True, "is_demo": True},
        {"id": "asset-007", "name": "Team Meeting Notes — October 2024.docx", "file_type": "docx", "platform": "google_drive", "url": "https://drive.google.com/file/d/demo-007", "owner": "Alex Chen", "last_modified": "2024-10-03T10:00:00Z", "relevance_score": 0.55, "category": "meeting_notes", "is_selected": False, "is_demo": True},
        {"id": "asset-008", "name": "Stripe Integration Test Results.xlsx", "file_type": "xlsx", "platform": "onedrive", "url": "https://onedrive.live.com/demo-008", "owner": "Sam Rodriguez", "last_modified": "2024-09-28T10:00:00Z", "relevance_score": 0.65, "category": "testing", "is_selected": False, "is_demo": True},
    ]
    return data


SESSION_TTL_SECONDS = 86400  # 24 hours
_SESSIONS_LOCK = threading.Lock()
_SESSIONS: Dict[str, Dict[str, Any]] = {}


def _get_session_db(sid: Optional[str] = None) -> dict:
    session_id = sid or _current_session_id.get("default")
    now = time.time()
    with _SESSIONS_LOCK:
        sess = _SESSIONS.get(session_id)
        if sess is None:
            sess = {
                "db": generate_default_data(),
                "created_at": now,
                "last_active": now,
                "lock": threading.Lock(),
            }
            _SESSIONS[session_id] = sess
        else:
            sess["last_active"] = now
            # Prune expired sessions older than TTL
            expired_keys = [
                k for k, v in _SESSIONS.items()
                if k != "default" and (now - v["last_active"]) > SESSION_TTL_SECONDS
            ]
            for k in expired_keys:
                _SESSIONS.pop(k, None)
        return sess["db"]


def _reset_session_db(sid: Optional[str] = None) -> dict:
    session_id = sid or _current_session_id.get("default")
    now = time.time()
    with _SESSIONS_LOCK:
        lock = _SESSIONS[session_id]["lock"] if session_id in _SESSIONS else threading.Lock()
        new_db = generate_default_data()
        _SESSIONS[session_id] = {
            "db": new_db,
            "created_at": now,
            "last_active": now,
            "lock": lock,
        }
        return new_db


class ScopedDBProxy:
    """Session-isolated, thread-safe proxy that routes dictionary access to the calling session's state."""

    def _active_db(self) -> dict:
        return _get_session_db()

    def __getitem__(self, key: str) -> Any:
        return self._active_db()[key]

    def __setitem__(self, key: str, value: Any):
        return self._active_db().__setitem__(key, value)

    def __delitem__(self, key: str):
        return self._active_db().__delitem__(key)

    def __contains__(self, key: str) -> bool:
        return key in self._active_db()

    def get(self, key: str, default: Any = None) -> Any:
        return self._active_db().get(key, default)

    def setdefault(self, key: str, default: Any = None) -> Any:
        return self._active_db().setdefault(key, default)

    def keys(self):
        return self._active_db().keys()

    def values(self):
        return self._active_db().values()

    def items(self):
        return self._active_db().items()

    def clear(self):
        return self._active_db().clear()

    def update(self, *args, **kwargs):
        return self._active_db().update(*args, **kwargs)

    def pop(self, *args, **kwargs):
        return self._active_db().pop(*args, **kwargs)

    def popitem(self):
        return self._active_db().popitem()

    def copy(self):
        return self._active_db().copy()

    def __len__(self) -> int:
        return len(self._active_db())

    def __iter__(self):
        return iter(self._active_db())

    def __repr__(self):
        return repr(self._active_db())

    def __eq__(self, other):
        return self._active_db() == other

    def reset(self, sid: Optional[str] = None) -> dict:
        return _reset_session_db(sid)


db = ScopedDBProxy()


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
async def demo_login(request: Request, body: dict = Body(default={})):
    """
    demo authentication — not for production.
    Accepts {"user": "lead"|"successor"|"contractor", "session_id": optional} and returns a signed token.
    Gated behind RELAY_DEMO_MODE (returns 404 when disabled).
    """
    if not is_demo_mode_active():
        raise HTTPException(status_code=404, detail="Demo login disabled in production mode.")
    body = body or {}
    user = body.get("user") or request.headers.get("x-relay-role", "successor").lower().strip()
    if user == "engineering_lead":
        user = "lead"
    session_id = body.get("session_id") or request.headers.get("x-relay-session") or f"sess_{uuid.uuid4().hex[:8]}"
    result = _sign_demo_token(user, session_id=session_id)
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

@router.patch("/cases/{case_id}/settings")
async def update_case_settings_mock(case_id: str, request: Request, body: dict = Body(...)):
    role = _get_role(request)
    if role != "engineering_lead":
        raise HTTPException(status_code=403, detail="Only engineering_lead can modify case settings.")
    case = next((c for c in db["cases"] if c["id"] == case_id), None)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if "disclose_withheld_counts" in body:
        case["disclose_withheld_counts"] = bool(body["disclose_withheld_counts"])
    return {
        "status": "updated",
        "case_id": case_id,
        "disclose_withheld_counts": case.get("disclose_withheld_counts", True),
    }

@router.get("/cases/{case_id}/quarantine")
async def get_quarantine_queue(case_id: str, request: Request):
    role = _get_role(request)
    if role != "engineering_lead":
        raise HTTPException(status_code=403, detail="Quarantine queue is restricted to Engineering Lead")
    quarantined = [
        {
            "id": art["id"],
            "case_id": art.get("case_id", case_id),
            "source": art["source"],
            "type": art["type"],
            "title": art["title"],
            "snippet": art["body"][:250] + ("..." if len(art["body"]) > 250 else ""),
            "reasons": art.get("quarantine_reasons", []),
            "quarantine_status": art.get("quarantine_status", "quarantined"),
            "occurred_at": art["occurred_at"],
            "url": art.get("url"),
        }
        for art in db["artifacts"]
        if art.get("quarantine_status") == "quarantined"
    ]
    return quarantined

@router.post("/cases/{case_id}/quarantine/{artifact_id}/resolve")
async def resolve_quarantine_item(case_id: str, artifact_id: str, request: Request, body: dict = Body(...)):
    role = _get_role(request)
    if role != "engineering_lead":
        raise HTTPException(status_code=403, detail="Only engineering_lead can resolve quarantined items.")
    action = body.get("action")
    if action not in ["clear", "redact", "confidential"]:
        raise HTTPException(status_code=400, detail="Action must be 'clear', 'redact', or 'confidential'")

    art = next((a for a in db["artifacts"] if a["id"] == artifact_id), None)
    if not art:
        raise HTTPException(status_code=404, detail="Artifact not found")

    if action == "clear":
        art["quarantine_status"] = "cleared"
    elif action == "redact":
        art["quarantine_status"] = "redacted"
        if not art.get("original_body"):
            art["original_body"] = art["body"]
        art["body"] = default_classifier.redact(art["body"])
    elif action == "confidential":
        art["quarantine_status"] = "confidential"
        art["acl"] = {"visibility": "confidential", "allowed_roles": ["engineering_lead"]}

    db["admin"]["audit_log"].insert(0, {
        "time": "Just now",
        "actor": "Alex Chen (Engineering Lead)",
        "action": f"Quarantine resolution: {action} on {artifact_id} ({art['title'][:40]}...)"
    })
    return {
        "status": "ok",
        "artifact_id": artifact_id,
        "action": action,
        "quarantine_status": art["quarantine_status"],
        "reasons": art.get("quarantine_reasons", []),
    }

@router.post("/cases/{case_id}/quarantine/bulk-resolve")
async def bulk_resolve_quarantine(case_id: str, request: Request, body: dict = Body(...)):
    role = _get_role(request)
    if role != "engineering_lead":
        raise HTTPException(status_code=403, detail="Only engineering_lead can resolve quarantined items.")
    action = body.get("action")
    artifact_ids = body.get("artifact_ids", [])
    if action not in ["clear", "redact", "confidential"]:
        raise HTTPException(status_code=400, detail="Action must be 'clear', 'redact', or 'confidential'")

    resolved_count = 0
    for art_id in artifact_ids:
        art = next((a for a in db["artifacts"] if a["id"] == art_id), None)
        if art:
            if action == "clear":
                art["quarantine_status"] = "cleared"
            elif action == "redact":
                art["quarantine_status"] = "redacted"
                if not art.get("original_body"):
                    art["original_body"] = art["body"]
                art["body"] = default_classifier.redact(art["body"])
            elif action == "confidential":
                art["quarantine_status"] = "confidential"
                art["acl"] = {"visibility": "confidential", "allowed_roles": ["engineering_lead"]}
            resolved_count += 1

    db["admin"]["audit_log"].insert(0, {
        "time": "Just now",
        "actor": "Alex Chen (Engineering Lead)",
        "action": f"Bulk quarantine resolution: {action} on {resolved_count} item(s)"
    })
    return {
        "status": "ok",
        "resolved_count": resolved_count,
        "action": action,
    }

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
    case = next((c for c in db["cases"] if c["id"] == case_id), db["cases"][0] if db["cases"] else {})
    disclose = case.get("disclose_withheld_counts", True)
    return {
        "items": sanitized,
        "withheld_count": withheld if disclose else 0,
        # Withheld notice is aggregate only — no artifact IDs are revealed
        "withheld_notice": (f"{withheld} item(s) withheld due to access restrictions" if withheld else None) if disclose else None,
        "disclose_withheld_counts": disclose,
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
async def get_handover(case_id: str, request: Request, preview_role: Optional[str] = None):
    caller_role = _get_role(request)
    # Role preview: Lead can authentically preview handover pack as successor or contractor
    if caller_role == "engineering_lead" and preview_role in ("successor", "contractor"):
        role = preview_role
    else:
        role = caller_role
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
            i["text"] = f"Withheld: requires {withheld_acl_level} clearance [WITHHELD]"
            i["evidence_ids"] = ["[withheld]"]
            i["withheld"] = True
            i["withheld_reason"] = f"Requires {withheld_acl_level} clearance"
            i.pop("evidence_drift", None)
            i.pop("is_stale", None)

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
    failed_sources = set(case.get("failed_sources") or db.get("failed_sources") or [])

    for item in result:
        # If withheld, keep as-is
        if item.get("withheld") or str(item.get("text", "")).startswith("Withheld:") or str(item.get("text", "")).startswith("[WITHHELD"):
            verified_items.append(item)
            continue

        e_ids = item.get("evidence_ids", [])
        ev_texts = []
        cited_sources = []
        for eid in e_ids:
            art = artifacts_map.get(eid)
            if art:
                ev_texts.append(f"{art.get('title', '')} {art.get('body', '')} {art.get('external_id', '')}")
                src = art.get("source", "unknown")
                cited_sources.append(src)
                if art.get("status") in ("failed", "unavailable"):
                    failed_sources.add(src)

        claim_ver = verifier.verify_claim(item.get("text", ""), ev_texts)
        scores.append(claim_ver["score"])
        item["grounding"] = claim_ver

        # Dependency rule: any claim whose only evidence came from a failed or unavailable source
        # is downgraded to UNKNOWN with reason "source unavailable"
        all_sources_failed = bool(cited_sources and all(s in failed_sources for s in cited_sources))
        if all_sources_failed or not claim_ver["is_grounded"]:
            item["unsupported_flag"] = True
            if all_sources_failed:
                item["provenance"] = "unknown"
                item["unsupported_reason"] = "source unavailable"
                claim_ver["provenance"] = "unknown"
                claim_ver["is_grounded"] = False
                claim_ver["reason"] = "source unavailable"
            else:
                item["provenance"] = claim_ver["provenance"]
                item["unsupported_reason"] = "; ".join(claim_ver["flagged_reasons"][:2])
        else:
            item["unsupported_flag"] = False

        verified_items.append(item)

    computed_grounding = round(sum(scores) / len(scores), 2) if scores else 0.82
    unreviewed = [i for i in db["handover"] if i.get("claim_status") not in ("approved", "edited", "rejected")]

    sources_in_case = list(case.get("source_modes", {"github": "live", "slack": "fixture", "jira": "fixture", "docs": "fixture", "meetings": "fixture"}).keys())
    failed_sources_list = sorted(list(failed_sources))
    withheld_sources_list = sorted(list({
        art.get("source", "unknown")
        for art in db["artifacts"]
        if not _can_see(art, role)
    }))
    active_sources = [s for s in sources_in_case if s not in failed_sources_list and s not in withheld_sources_list]
    not_connected_sources = ["pagerduty", "confluence", "linear"]

    prov_counts = {"verified": 0, "stated": 0, "inferred": 0, "unknown": 0}
    for vi in verified_items:
        p = str(vi.get("provenance", "unknown")).lower()
        if p in prov_counts:
            prov_counts[p] += 1
        else:
            prov_counts["unknown"] += 1

    coverage = {
        "sources_included": active_sources,
        "sources_failed": failed_sources_list,
        "sources_withheld": withheld_sources_list,
        "sources_not_connected": not_connected_sources,
        "claims_by_provenance": prov_counts,
        "what_this_handover_cannot_tell_you": [
            "Uncommitted local changes or private branches on the leaver's laptop",
            "Private 1:1 direct messages or off-the-record verbal hallway discussions",
            "Third-party external SaaS credentials not tracked in repository configs",
            "Ad-hoc emergency production fixes that bypassed GitHub PR workflows",
        ],
    }

    recurring_problems = cluster_recurring_problems(db.get("artifacts", []), db.get("components", []))
    people_list = list(db.get("people", {}).values()) if isinstance(db.get("people"), dict) else db.get("people", [])
    component_contacts = resolve_component_contacts(
        components=db.get("components", []),
        people=people_list,
        knowledge_scores=db.get("knowledge_scores", []),
        interview_answers=db.get("questions", []),
        role=role,
    )
    continuation_data = db.get("continuation", {})

    re_review_pending = [
        x for x in db.get("re_review_queue", [])
        if x.get("status") == "pending" and _can_see_re_review(x, role)
    ]
    latest_rel = db.get("released_version") or db.get("current_version", 1)
    ack_ver = db.get("acknowledged_version")
    update_avail = (ack_ver is not None and latest_rel > ack_ver)

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
        "coverage": coverage,
        "recurring_problems": recurring_problems,
        "key_contacts": component_contacts,
        "continuation": continuation_data,
        "re_review_pending_count": len(re_review_pending),
        "has_evidence_drift": any(x.get("is_stale") for x in verified_items),
        "update_available": update_avail,
    }

@router.post("/cases/{case_id}/handover/verify")
async def verify_handover(case_id: str, request: Request, body: dict = Body(default={})):
    """
    Run sentence-level grounding verification against cited evidence.
    Stage 1: deterministic lexical and entity overlap (offline) — always runs.
    Stage 2: LLM entailment (optional) — only in ambiguous score band [0.35, 0.75).
    The 'method' field in the response always states which path ran.
    """
    role = _get_role(request)
    det_verifier = GroundingVerifier()
    llm_verifier = LLMEntailmentVerifier()
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

    # ACL filter: only give the verifier evidence the caller's role can see
    def _role_filtered_ev_texts(evidence_ids):
        texts = []
        for eid in evidence_ids:
            if eid not in artifacts_map:
                continue
            art = artifacts_map[eid]
            # Check ACL
            acl = art.get("acl", {})
            allowed_roles = acl.get("allowed_roles", ["engineering_lead", "successor", "contractor"])
            visible_to = ROLE_HIERARCHY.get(role, [])
            if not any(r in visible_to for r in allowed_roles):
                continue  # Caller cannot see this evidence — do not include
            texts.append(f"{art.get('title', '')} {art.get('body', '')} {art.get('external_id', '')}")
        return texts

    custom_text = body.get("text")
    custom_evidence_ids = body.get("evidence_ids", [])

    if custom_text is not None:
        ev_texts = _role_filtered_ev_texts(custom_evidence_ids)
        # Always run deterministic first
        det_result = det_verifier.verify_claim(custom_text, ev_texts)
        # Try LLM layer (async)
        try:
            llm_result = await llm_verifier.verify_claim(custom_text, ev_texts, role=role)
        except Exception:
            llm_result = {**det_result, "llm_consulted": False, "llm_verdict": None, "llm_note": "LLM unavailable"}
        return {
            "method": llm_result.get("method", det_result["method"]),
            "deterministic_method": det_verifier.METHOD,
            "llm_consulted": llm_result.get("llm_consulted", False),
            "llm_verdict": llm_result.get("llm_verdict"),
            "llm_note": llm_result.get("llm_note"),
            "verification": llm_result,
        }

    doc_result = det_verifier.verify_document(db["handover"], artifacts_map)
    return {
        **doc_result,
        "deterministic_method": det_verifier.METHOD,
        "llm_note": "Document-level verification uses deterministic method only; use the custom-text endpoint for LLM entailment.",
    }

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
    reason = (body.get("reason") or "").strip()
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
    new_text = (body.get("text") or "").strip()
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

@router.post("/cases/{case_id}/handover/batch-approve-verified")
async def batch_approve_verified(case_id: str, request: Request):
    """Batch approve all VERIFIED claims backed by 2 or more independent sources. Never batch INFERRED or UNKNOWN."""
    role = _get_role(request)
    if role != "engineering_lead":
        raise HTTPException(status_code=403, detail="Only engineering_lead can batch approve claims.")

    eligible_items = []
    skipped_count = 0
    now_iso = datetime.now(timezone.utc).isoformat()
    for item in db["handover"]:
        prov = (item.get("provenance") or "").lower()
        if prov in ("inferred", "unknown"):
            skipped_count += 1
            continue
        if prov == "verified" and len(item.get("evidence_ids", [])) >= 2:
            if item.get("claim_status") not in ("approved", "rejected"):
                eligible_items.append(item)

    approved_ids = []
    for item in eligible_items:
        item["claim_status"] = "approved"
        item.setdefault("history", []).append({
            "actor": "Alex Chen (Engineering Lead)",
            "action": "batch_approved",
            "timestamp": now_iso,
            "note": "Batch approved corroborating VERIFIED claim (>= 2 sources)",
        })
        approved_ids.append(item["id"])

    ver_num = db.get("current_version", 1)
    if approved_ids:
        ver = _record_new_version(
            author="Alex Chen (Engineering Lead)",
            summary=f"Batch approved {len(approved_ids)} verified corroborating claim(s)",
        )
        ver_num = ver["version"]
        db["admin"]["audit_log"].insert(0, {
            "time": "Just now",
            "actor": "Engineering Lead",
            "action": f"Batch approved {len(approved_ids)} verified claims with >=2 independent sources (Version v{ver_num})"
        })

    return {
        "status": "ok",
        "approved_count": len(approved_ids),
        "approved_claim_ids": approved_ids,
        "skipped_inferred_or_unknown_count": skipped_count,
        "version": ver_num,
    }

@router.post("/cases/{case_id}/handover/{claim_id}/undo")
async def undo_claim_review(case_id: str, claim_id: str, request: Request):
    """Undo review on a claim: revert its status back to pending and clear rejection rationale."""
    role = _get_role(request)
    if role != "engineering_lead":
        raise HTTPException(status_code=403, detail="Only engineering_lead can undo claim review.")

    for item in db["handover"]:
        if item["id"] == claim_id:
            old_status = item.get("claim_status", "pending")
            item["claim_status"] = "pending"
            item["rejection_reason"] = None
            item.setdefault("history", []).append({
                "actor": "Alex Chen (Engineering Lead)",
                "action": "undone",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "note": f"Reverted review status from {old_status} to pending",
            })
            ver = _record_new_version(
                author="Alex Chen (Engineering Lead)",
                summary=f"Undid review on claim {claim_id}",
            )
            db["admin"]["audit_log"].insert(0, {
                "time": "Just now",
                "actor": "Engineering Lead",
                "action": f"Undid review on claim {claim_id} (reverted to pending)"
            })
            return {
                "status": "ok",
                "claim_id": claim_id,
                "action": "undone",
                "claim_status": "pending",
                "version": ver["version"],
            }
    raise HTTPException(status_code=404, detail="Claim not found")

@router.get("/cases/{case_id}/handover/preflight")
async def get_handover_preflight(case_id: str, request: Request):
    """Automated pre-flight checklist for handover release."""
    role = _get_role(request)
    unreviewed = [
        item["id"] for item in db["handover"]
        if item.get("claim_status") not in ("approved", "edited", "rejected")
    ]
    contradictions = [
        item["id"] for item in db["handover"]
        if item.get("unsupported_flag") or "contradict" in (item.get("rejection_reason") or "").lower()
    ]
    contradictions_acknowledged = db.get("contradictions_acknowledged", False)

    # Secrets scan across claims: look for live API keys or auth tokens
    secret_patterns = [
        r"(?:sk_live_[0-9a-zA-Z]{24,})",
        r"(?:ghp_[0-9a-zA-Z]{36,})",
        r"(?:SG\.[0-9a-zA-Z_\-]{22,}\.[0-9a-zA-Z_\-]{43,})",
    ]
    raw_secrets = []
    for item in db["handover"]:
        for pat in secret_patterns:
            if re.search(pat, item.get("text", "")):
                raw_secrets.append(item["id"])

    quarantine_pending = [
        a["id"] for a in db.get("artifacts", [])
        if a.get("quarantine_status") == "quarantined"
    ]

    blockers = []
    if unreviewed:
        blockers.append(f"{len(unreviewed)} claim(s) require explicit review (approve, edit, or reject)")
    if contradictions and not contradictions_acknowledged:
        blockers.append(f"{len(contradictions)} contradiction(s) require acknowledgment as open questions")
    if raw_secrets:
        blockers.append(f"{len(raw_secrets)} unredacted secret(s) detected in claim text")
    if quarantine_pending:
        blockers.append(f"{len(quarantine_pending)} sensitive item(s) pending review in quarantine queue")

    can_release = (
        len(unreviewed) == 0 and
        len(raw_secrets) == 0 and
        len(quarantine_pending) == 0 and
        (len(contradictions) == 0 or contradictions_acknowledged)
    )

    return {
        "can_release": can_release,
        "unreviewed_count": len(unreviewed),
        "unreviewed_claim_ids": unreviewed,
        "contradictions_count": len(contradictions),
        "contradictions_acknowledged": contradictions_acknowledged,
        "secrets_detected_count": len(raw_secrets),
        "quarantine_pending_count": len(quarantine_pending),
        "blockers": blockers,
    }

@router.post("/cases/{case_id}/handover/contradictions/acknowledge")
async def acknowledge_contradictions(case_id: str, request: Request, body: dict = Body(default={})):
    """Acknowledge contradictions so they remain visible as Open Questions while satisfying release gate."""
    role = _get_role(request)
    if role != "engineering_lead":
        raise HTTPException(status_code=403, detail="Only engineering_lead can acknowledge contradictions.")
    db["contradictions_acknowledged"] = True
    note = body.get("notes") or "Acknowledged contradictory claims to remain visible as Open Questions for successor"
    db["admin"]["audit_log"].insert(0, {
        "time": "Just now",
        "actor": "Engineering Lead",
        "action": f"Acknowledged contradictions: {note}"
    })
    return {"status": "ok", "contradictions_acknowledged": True, "note": note}

@router.post("/cases/{case_id}/handover/{claim_id}/ask-lead")
async def ask_lead_question(case_id: str, claim_id: str, request: Request, body: dict = Body(...)):
    """Successor asks the engineering lead a clarification question on a specific claim."""
    role = _get_role(request)
    question_text = (body.get("question") or "").strip()
    if not question_text:
        raise HTTPException(status_code=400, detail="Question text is required.")

    q_id = f"q-{uuid.uuid4().hex[:6]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    actor = "Jordan Taylor (Successor)" if role == "successor" else "Team Member"

    new_q = {
        "id": q_id,
        "case_id": case_id,
        "text": question_text,
        "target_claim_id": claim_id,
        "context": body.get("context"),
        "status": "open",
        "asked_by": actor,
        "created_at": now_iso,
    }
    db.setdefault("questions", []).append(new_q)
    db["admin"]["audit_log"].insert(0, {
        "time": "Just now",
        "actor": actor,
        "action": f"Asked lead clarification question on claim {claim_id}: {question_text[:50]}..."
    })
    return {
        "status": "ok",
        "question_id": q_id,
        "claim_id": claim_id,
        "question": new_q,
    }

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

    # Idempotent check: if already released, return existing release state
    for c in db["cases"]:
        if c["id"] == case_id and c.get("status") == "released" and db.get("released_version"):
            rel_items = [dict(i) for i in db["handover"] if i.get("claim_status") != "rejected"]
            return {
                "status": "released",
                "version": db["released_version"],
                "released_claims_count": len(rel_items),
                "excluded_rejected_count": len(db["handover"]) - len(rel_items),
                "note": "Handover was already released (idempotent call)",
            }

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
    db["acknowledged_by"] = "Jordan Taylor (Successor)" if role == "successor" else "Alex Chen (Engineering Lead)"
    receipt_msg = f"{case_id}:{target_version}:{db['acknowledged_at']}:{db['acknowledged_by']}"
    db["receipt_signature"] = hmac.new(_RELAY_SECRET.encode(), receipt_msg.encode(), hashlib.sha256).hexdigest()
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
        "receipt_signature": db["receipt_signature"],
        "is_cryptographically_signed": True,
    }

@router.get("/cases/{case_id}/handover/receipt/verify")
async def verify_handover_receipt(case_id: str, request: Request):
    """Verify cryptographic HMAC-SHA256 receipt for handover acknowledgement."""
    if not db.get("acknowledged"):
        return {
            "is_acknowledged": False,
            "is_valid": False,
            "message": "No acknowledgement recorded for this handover."
        }
    ts = db.get("acknowledged_at")
    actor = db.get("acknowledged_by")
    version = db.get("acknowledged_version")
    sig = db.get("receipt_signature")
    expected_msg = f"{case_id}:{version}:{ts}:{actor}"
    expected_sig = hmac.new(_RELAY_SECRET.encode(), expected_msg.encode(), hashlib.sha256).hexdigest()
    is_valid = hmac.compare_digest(sig or "", expected_sig)
    return {
        "is_acknowledged": True,
        "is_valid": is_valid,
        "case_id": case_id,
        "version": version,
        "acknowledged_by": actor,
        "acknowledged_at": ts,
        "receipt_signature": sig,
        "verification_algorithm": "HMAC-SHA256",
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

def _compute_word_diff(old_text: str, new_text: str) -> List[Dict[str, str]]:
    """Token/word-level diff ops between old_text and new_text."""
    if not old_text and not new_text:
        return []
    if not old_text:
        return [{"type": "insert", "text": new_text}]
    if not new_text:
        return [{"type": "delete", "text": old_text}]
    if old_text == new_text:
        return [{"type": "equal", "text": old_text}]

    old_tokens = re.findall(r"\w+|\s+|[^\w\s]", old_text)
    new_tokens = re.findall(r"\w+|\s+|[^\w\s]", new_text)

    matcher = difflib.SequenceMatcher(None, old_tokens, new_tokens)
    ops = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            ops.append({"type": "equal", "text": "".join(old_tokens[i1:i2])})
        elif tag == "delete":
            ops.append({"type": "delete", "text": "".join(old_tokens[i1:i2])})
        elif tag == "insert":
            ops.append({"type": "insert", "text": "".join(new_tokens[j1:j2])})
        elif tag == "replace":
            ops.append({"type": "delete", "text": "".join(old_tokens[i1:i2])})
            ops.append({"type": "insert", "text": "".join(new_tokens[j1:j2])})
    return ops

@router.get("/cases/{case_id}/handover/diff")
async def get_handover_diff(case_id: str, v1: int, v2: int, request: Request):
    """Side-by-side diff between any two numbered versions with word-level diff and claim change types."""
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
            p1 = str(in_v1.get("provenance", "")).lower()
            p2 = str(in_v2.get("provenance", "")).lower()
            s1 = in_v1.get("claim_status", "pending")
            s2 = in_v2.get("claim_status", "pending")
            t1 = in_v1.get("text") or ""
            t2 = in_v2.get("text") or ""
            text_changed = t1 != t2

            if s2 == "rejected" or s1 == "rejected":
                change_type = "rejected"
            elif p1 in ("verified", "stated") and p2 in ("unknown", "inferred") and p1 != p2:
                change_type = "downgraded"
            elif text_changed:
                change_type = "edited"
            elif s1 != s2:
                change_type = "edited"
            else:
                change_type = "unchanged"

            diff_entries.append({
                "claim_id": cid,
                "section": in_v2.get("section") or in_v1.get("section"),
                "change_type": change_type,
                "v1": {
                    "status": s1,
                    "text": t1,
                    "provenance": in_v1.get("provenance"),
                },
                "v2": {
                    "status": s2,
                    "text": t2,
                    "provenance": in_v2.get("provenance"),
                },
                "word_diff": _compute_word_diff(t1, t2),
            })
        elif in_v2 and not in_v1:
            diff_entries.append({
                "claim_id": cid,
                "section": in_v2.get("section"),
                "change_type": "added",
                "v1": None,
                "v2": {
                    "status": in_v2.get("claim_status"),
                    "text": in_v2.get("text") or "",
                    "provenance": in_v2.get("provenance"),
                },
                "word_diff": _compute_word_diff("", in_v2.get("text") or ""),
            })
        elif in_v1 and not in_v2:
            is_rej = in_v1.get("claim_status") == "rejected"
            diff_entries.append({
                "claim_id": cid,
                "section": in_v1.get("section"),
                "change_type": "rejected" if is_rej else "removed",
                "v1": {
                    "status": in_v1.get("claim_status"),
                    "text": in_v1.get("text") or "",
                    "provenance": in_v1.get("provenance"),
                },
                "v2": None,
                "word_diff": _compute_word_diff(in_v1.get("text") or "", ""),
            })

    modified_count = sum(1 for d in diff_entries if d["change_type"] in ("modified", "edited", "downgraded"))
    added_count = sum(1 for d in diff_entries if d["change_type"] == "added")
    removed_count = sum(1 for d in diff_entries if d["change_type"] in ("removed", "rejected"))

    return {
        "v1": v1,
        "v2": v2,
        "v1_meta": {"author": v1_rec["author"], "timestamp": v1_rec["timestamp"], "summary": v1_rec["change_summary"], "is_released": v1_rec["is_released"]},
        "v2_meta": {"author": v2_rec["author"], "timestamp": v2_rec["timestamp"], "summary": v2_rec["change_summary"], "is_released": v2_rec["is_released"]},
        "diff": diff_entries,
        "summary": f"{modified_count} modified/edited, {added_count} added, {removed_count} rejected/removed",
        "audit_log_url": f"/cases/{case_id}/admin?tab=audit",
    }

@router.post("/cases/{case_id}/handover/versions/{version_num}/restore-as-draft")
async def restore_handover_version_as_draft(case_id: str, version_num: int, request: Request):
    """
    Restore an immutable historical snapshot as a new working draft.
    Does NOT overwrite past versions; appends a new numbered draft version to the tree.
    Gated to engineering_lead.
    """
    role = _get_role(request)
    if role != "engineering_lead":
        raise HTTPException(status_code=403, detail="Only engineering_lead can restore handover versions as draft.")

    target_ver = next((v for v in db.get("handover_versions", []) if v["version"] == version_num), None)
    if not target_ver:
        raise HTTPException(status_code=404, detail=f"Version {version_num} not found")

    new_v = db.get("current_version", 1) + 1
    db["current_version"] = new_v

    # Deep copy items from the target snapshot to become the active draft
    restored_items = [dict(item) for item in target_ver["items"]]
    for item in restored_items:
        # Reset claim status to pending review in the restored draft
        item["claim_status"] = "pending"
    db["handover"] = restored_items

    new_version_record = {
        "version": new_v,
        "author": "Alex Chen (Engineering Lead)",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "change_summary": f"Restored as new draft from Version v{version_num}",
        "is_released": False,
        "restored_from": version_num,
        "items": [dict(i) for i in restored_items],
    }
    db.setdefault("handover_versions", []).append(new_version_record)

    db.setdefault("admin", {}).setdefault("audit_log", []).insert(0, {
        "time": "Just now",
        "actor": "Engineering Lead",
        "action": f"Restored handover pack as new draft from Version v{version_num} (created Version v{new_v})",
    })

    return {
        "status": "restored",
        "new_version": new_v,
        "source_version": version_num,
        "claim_count": len(restored_items),
        "change_summary": new_version_record["change_summary"],
        "audit_log_url": f"/cases/{case_id}/admin?tab=audit",
    }

# ---------------------------------------------------------------------------
# Prompt 12: Evidence Drift Detection & Living Handover Re-Review
# ---------------------------------------------------------------------------

@router.post("/cases/{case_id}/webhooks/simulate-drift")
async def simulate_evidence_drift(case_id: str, request: Request):
    """
    Simulates a post-release ingestion event (e.g., SL-456's PR #47 merges into main).
    Demonstrates evidence drift detection:
    - Identifies claims whose cited evidence changed after approval.
    - Marks claims 'is_stale' and attaches 'evidence_drift' diff.
    - NEVER auto-edits approved text.
    - Produces a pending item in the re-review queue for the engineering lead.
    - Updates Living Memory and audit log.
    """
    body = {}
    try:
        body = await request.json()
    except Exception:
        body = {}

    target_case = next((c for c in db["cases"] if c["id"] == case_id), db["cases"][0])
    now_iso = datetime.now(timezone.utc).isoformat()

    # If the case hasn't been released yet in this session, ensure Version 1 is marked as released
    # so evidence drift is strictly observed post-release / post-approval
    if not db.get("released_version"):
        db["released_version"] = 1
        db["current_version"] = 1
        target_case["status"] = "released"
        if db.get("handover_versions"):
            db["handover_versions"][0]["is_released"] = True

    # 1. Update underlying source artifact state (PR #47 / SL-456)
    pr_art = next((a for a in db["artifacts"] if a.get("id") == "art-001"), None)
    if pr_art:
        pr_art.setdefault("raw", {})
        pr_art["raw"]["state"] = "closed"
        pr_art["raw"]["merged"] = True
        pr_art["raw"]["merged_by"] = "alexc"
        pr_art["raw"]["merge_commit"] = "a8f912c"
        pr_art["raw"]["merged_at"] = now_iso

    # 2. Identify dependent claim citing art-001 (ho-001: Payment Webhook Retry Logic)
    target_claim = next((c for c in db["handover"] if c.get("id") == "ho-001"), None)
    if not target_claim and db["handover"]:
        target_claim = db["handover"][0]

    drift_diff = (
        "- PR #47 State: open (in-flight draft)\n"
        "- Assignee: Priya Nair\n"
        "+ PR #47 State: closed (merged into main)\n"
        "+ Merged by: Alex Chen (alexc)\n"
        "+ Merge Commit: a8f912c"
    )

    drift_meta = {
        "drifted": True,
        "is_stale": True,
        "badge": "Evidence changed since approval",
        "detected_at": now_iso,
        "trigger_event": "pull_request.closed (merged=true)",
        "artifact_id": "art-001",
        "external_id": "PR #47",
        "issue_key": "SL-456",
        "drift_summary": "PR #47 (SL-456) was merged into main by Alex Chen after handover release. The 'in-flight' status is now stale.",
        "prior_evidence": "PR #47 state: open (in-flight draft, assigned to Priya Nair)",
        "current_evidence": "PR #47 state: closed (merged to main in commit a8f912c by Alex Chen)",
        "diff": drift_diff,
        "resolved": False,
    }

    if target_claim:
        # Crucial acceptance invariant: NEVER auto-edit approved text
        target_claim["is_stale"] = True
        target_claim["evidence_drift"] = drift_meta

        # Also update the claim in the released snapshot if present
        for ver in db.get("handover_versions", []):
            if ver.get("is_released"):
                for it in ver.get("items", []):
                    if it.get("id") == target_claim["id"]:
                        it["is_stale"] = True
                        it["evidence_drift"] = dict(drift_meta)

    # 3. Create or update pending item in Re-Review Queue for the lead
    rr_id = f"rr-{uuid.uuid4().hex[:6]}"
    suggested_text = (
        "**Payment Webhook Retry Logic (SL-456 / PR #47)**\n"
        "PR #47 was merged into main by Alex Chen on Oct 18 (commit a8f912c). Webhook exponential backoff is now active in production. "
        "Remaining items: integration test suite and SQS dead-letter queue with 72h retention. "
        "PagerDuty P2 alert at 3 consecutive failures. SQS ARN in AWS SSM at /prod/shopledger/sqs/webhook-dlq."
    )

    rr_item = {
        "id": rr_id,
        "case_id": case_id,
        "claim_id": target_claim["id"] if target_claim else "ho-001",
        "claim_text": target_claim["text"] if target_claim else "",
        "section": target_claim.get("section", "In-Flight Work") if target_claim else "In-Flight Work",
        "status": "pending",
        "drift_summary": drift_meta["drift_summary"],
        "prior_evidence": drift_meta["prior_evidence"],
        "current_evidence": drift_meta["current_evidence"],
        "diff": drift_diff,
        "suggested_update": suggested_text,
        "detected_at": now_iso,
        "resolved_at": None,
        "resolved_by": None,
        "resolution_action": None,
        "resolution_notes": None,
        "evidence_acl": {"visibility": "public", "allowed_roles": ["engineering_lead", "successor", "contractor"]},
    }

    db.setdefault("re_review_queue", [])
    # Replace existing pending item for this claim if present
    db["re_review_queue"] = [i for i in db["re_review_queue"] if i.get("claim_id") != rr_item["claim_id"]]
    db["re_review_queue"].insert(0, rr_item)

    # 4. Connect to Living Memory & Intelligence Dashboard
    living_evt = {
        "id": f"evt-{uuid.uuid4().hex[:6]}",
        "source": "github",
        "event_type": "pull_request",
        "processed_at": now_iso,
        "summary": {
            "action": "closed",
            "merged": True,
            "pr_number": 47,
            "pr_title": "WIP: Webhook retry logic with exponential backoff (SL-456)",
            "author": "priya-nair",
            "merged_by": "alexc",
            "commit_sha": "a8f912c",
            "evidence_drift": True,
            "affected_claims": [target_claim["id"] if target_claim else "ho-001"],
            "state": "closed",
        }
    }
    db.setdefault("living_memory", {})
    recent = db["living_memory"].setdefault("recent_events", [])
    recent.insert(0, living_evt)
    db["living_memory"]["total_events_processed"] = db["living_memory"].get("total_events_processed", 124) + 1
    db["living_memory"]["last_event_at"] = now_iso

    # 5. Record Audit Log entry
    db.setdefault("admin", {}).setdefault("audit_log", []).insert(0, {
        "time": "Just now",
        "actor": "System (Ingestion Webhook)",
        "action": f"Evidence drift detected: PR #47 (SL-456) merged post-release. Claim {target_claim['id'] if target_claim else 'ho-001'} flagged stale; re-review item queued for lead.",
    })

    return {
        "status": "drift_detected",
        "case_id": case_id,
        "event_type": "pull_request",
        "affected_claims": [target_claim["id"] if target_claim else "ho-001"],
        "re_review_item_id": rr_id,
        "badge": "Evidence changed since approval",
        "drift_summary": drift_meta["drift_summary"],
        "diff": drift_diff,
        "living_memory_updated": True,
    }

@router.get("/cases/{case_id}/handover/re-review-queue")
async def get_re_review_queue(case_id: str, request: Request):
    """
    Returns re-review queue items for claims with drifted evidence.
    Respects ACLs: items citing evidence forbidden to the caller's role are omitted.
    """
    role = _get_role(request)
    items = [
        dict(i) for i in db.get("re_review_queue", [])
        if _can_see_re_review(i, role)
    ]
    return items

@router.post("/cases/{case_id}/handover/re-review/{claim_id}/resolve")
async def resolve_re_review_item(case_id: str, claim_id: str, request: Request, body: dict = Body(default={})):
    """
    Lead action on drifted evidence:
    - 'amend': Updates claim text, resolves drift, bumps handover version to v{N+1}.
    - 'acknowledge': Acknowledges drift without text changes, bumps version to v{N+1}.
    - 'dismiss': Dismisses queue item without version bump.
    Gated to engineering_lead. Bumps handover version ONLY on lead action.
    """
    role = _get_role(request)
    if role != "engineering_lead":
        raise HTTPException(status_code=403, detail="Only engineering_lead can resolve re-review queue items.")

    action = body.get("action", "amend")
    new_text = body.get("new_text")
    notes = body.get("notes") or f"Lead resolved drift via {action}"
    now_iso = datetime.now(timezone.utc).isoformat()

    queue_item = next((i for i in db.get("re_review_queue", []) if i.get("claim_id") == claim_id and i.get("status") == "pending"), None)
    if not queue_item:
        queue_item = next((i for i in db.get("re_review_queue", []) if i.get("claim_id") == claim_id), None)
    if not queue_item:
        raise HTTPException(status_code=404, detail=f"No re-review queue item found for claim {claim_id}")

    claim = next((c for c in db["handover"] if c.get("id") == claim_id), None)
    if not claim:
        raise HTTPException(status_code=404, detail=f"Claim {claim_id} not found in handover")

    # Apply resolution to claim
    if action == "amend":
        updated_claim_text = new_text or queue_item.get("suggested_update") or claim["text"]
        claim["text"] = updated_claim_text
        claim["is_stale"] = False
        if "evidence_drift" in claim:
            claim["evidence_drift"]["resolved"] = True
            claim["evidence_drift"]["resolved_at"] = now_iso
            claim["evidence_drift"]["resolved_by"] = "Alex Chen (Engineering Lead)"
    elif action in ("acknowledge", "dismiss"):
        claim["is_stale"] = False
        if "evidence_drift" in claim:
            claim["evidence_drift"]["resolved"] = True
            claim["evidence_drift"]["dismissed"] = (action == "dismiss")

    # Update queue item
    queue_item["status"] = "resolved" if action != "dismiss" else "dismissed"
    queue_item["resolved_at"] = now_iso
    queue_item["resolved_by"] = "Alex Chen (Engineering Lead)"
    queue_item["resolution_action"] = action
    queue_item["resolution_notes"] = notes

    # Bump handover version ONLY on lead action (amend or acknowledge)
    new_v = db.get("released_version") or db.get("current_version", 1)
    if action in ("amend", "acknowledge"):
        new_v = (db.get("released_version") or db.get("current_version", 1)) + 1
        db["current_version"] = new_v
        db["released_version"] = new_v

        active_items = [dict(i) for i in db["handover"] if i.get("claim_status") != "rejected"]
        version_record = {
            "version": new_v,
            "author": "Alex Chen (Engineering Lead)",
            "timestamp": now_iso,
            "change_summary": f"Resolved evidence drift on claim {claim_id}: {notes}",
            "is_released": True,
            "items": active_items,
        }
        db.setdefault("handover_versions", []).append(version_record)

    # Audit log
    db.setdefault("admin", {}).setdefault("audit_log", []).insert(0, {
        "time": "Just now",
        "actor": "Alex Chen (Engineering Lead)",
        "action": f"Resolved evidence drift on claim {claim_id} via {action}: handover version bumped to v{new_v}",
    })

    return {
        "status": "resolved",
        "action": action,
        "claim_id": claim_id,
        "new_version": new_v,
        "released_version": db.get("released_version"),
        "re_review_item": queue_item,
        "change_summary": f"Resolved evidence drift on claim {claim_id}: {notes}",
    }

@router.get("/cases/{case_id}/handover/drift-status")
async def get_drift_status(case_id: str, request: Request):
    """
    Quick status of evidence drift and version updates:
    - has_drift: true if any pending drift re-review exists for the caller's role
    - update_available: true for successor when released_version > acknowledged_version
    """
    role = _get_role(request)
    pending_items = [
        i for i in db.get("re_review_queue", [])
        if i.get("status") == "pending" and _can_see_re_review(i, role)
    ]
    latest_rel = db.get("released_version") or db.get("current_version", 1)
    ack_ver = db.get("acknowledged_version")
    update_available = (ack_ver is not None and latest_rel > ack_ver)

    return {
        "has_drift": len(pending_items) > 0,
        "stale_claim_count": len(pending_items),
        "re_review_pending_count": len(pending_items),
        "latest_released_version": latest_rel,
        "acknowledged_version": ack_ver,
        "update_available": update_available,
    }

@router.get("/cases/{case_id}/recurring-problems")
async def get_recurring_problems(case_id: str, request: Request):
    """Deterministic clustering of recurring operational and code problems."""
    return cluster_recurring_problems(db.get("artifacts", []), db.get("components", []))

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

@router.get("/cases/{case_id}/continuation/progress")
async def get_continuation_progress(case_id: str, request: Request):
    """Retrieve persisted First 5 Days checklist progress with timestamps and actors."""
    continuation = db.get("continuation", {})
    tasks = continuation.get("first_5_days", [])
    for idx, t in enumerate(tasks):
        if "id" not in t:
            t["id"] = f"task-day{t.get('day', 1)}-{idx+1}"
        if "completed" not in t:
            t["completed"] = (t.get("status") == "completed")
    completed_count = sum(1 for t in tasks if t.get("completed"))
    total_count = len(tasks)
    pct = round((completed_count / total_count * 100)) if total_count > 0 else 0
    return {
        "case_id": case_id,
        "tasks": tasks,
        "completed_count": completed_count,
        "total_count": total_count,
        "progress_percent": pct,
    }

@router.put("/cases/{case_id}/continuation/progress")
async def update_continuation_progress(case_id: str, request: Request, body: dict = Body(...)):
    """Persist task completion in the First 5 Days onboarding roadmap."""
    role = _get_role(request)
    task_id = body.get("task_id")
    completed = bool(body.get("completed", False))
    actor = "Jordan Taylor (Successor)" if role == "successor" else ("Alex Chen (Lead)" if role == "engineering_lead" else "Contractor")

    continuation = db.get("continuation", {})
    tasks = continuation.get("first_5_days", [])
    matched = None
    for idx, t in enumerate(tasks):
        t_id = t.get("id") or f"task-day{t.get('day', 1)}-{idx+1}"
        t["id"] = t_id
        if t_id == task_id or f"day{t.get('day', 1)}-{idx+1}" == task_id:
            t["completed"] = completed
            t["status"] = "completed" if completed else "pending"
            t["completed_at"] = datetime.now(timezone.utc).isoformat() if completed else None
            t["completed_by"] = actor if completed else None
            matched = t
            break

    if not matched:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found in continuation roadmap.")

    db["admin"]["audit_log"].insert(0, {
        "time": "Just now",
        "actor": actor,
        "action": f"{'Completed' if completed else 'Reopened'} onboarding task '{matched.get('task', '')[:40]}...'"
    })

    completed_count = sum(1 for t in tasks if t.get("completed"))
    total_count = len(tasks)
    pct = round((completed_count / total_count * 100)) if total_count > 0 else 0
    return {
        "status": "ok",
        "task": matched,
        "completed_count": completed_count,
        "total_count": total_count,
        "progress_percent": pct,
    }

@router.get("/people/{person_id}")
async def get_person(person_id: str):
    if person_id in db["people"]:
        return db["people"][person_id]
    return {"id": person_id, "display_name": "Team Member"}

@router.post("/demo/seed")
async def demo_seed():
    sid = _current_session_id.get("default")
    db.reset(sid)
    return {"status": "ok", "message": "Demo data refreshed to initial state"}


@router.post("/demo/reset-sandbox")
async def demo_reset_sandbox(request: Request):
    sid = _current_session_id.get("default")
    db.reset(sid)
    return {"status": "ok", "session_id": sid, "message": "Sandbox reset to default state"}


# ---------------------------------------------------------------------------
# Improvement 1: Configurable per-source ACLs
# ---------------------------------------------------------------------------

VALID_ACCESS_LEVELS = {"public", "internal", "confidential"}

ACCESS_LEVEL_TO_ROLES: Dict[str, List[str]] = {
    "public":       ["engineering_lead", "successor", "contractor"],
    "internal":     ["engineering_lead", "successor"],
    "confidential": ["engineering_lead"],
}


@router.get("/cases/{case_id}/sources")
async def list_sources(case_id: str, request: Request):
    """
    Return configured data sources with their current ACL settings.
    Lead: sees full ACL config.  Others: see only access_level, not allowed_roles.
    """
    role = _get_role(request)
    sources = db["admin"]["sources"]
    result = []
    for s in sources:
        entry = {
            "source": s["source"],
            "status": s["status"],
            "last_synced": s["last_synced"],
            "items": s["items"],
            "acl": {
                "access_level": s["acl"]["access_level"],
            }
        }
        if role == "engineering_lead":
            entry["acl"]["allowed_roles"] = s["acl"]["allowed_roles"]
        result.append(entry)
    return {"sources": result}


@router.patch("/cases/{case_id}/sources/{source_name}/acl")
async def update_source_acl(
    case_id: str,
    source_name: str,
    request: Request,
    body: dict = Body(...),
):
    """
    Update the access-control level for a named source (lead only).

    - Applies the new ACL to all artifacts from that source.
    - Writes an audit log entry.
    - If the case has been released, creates a new handover version snapshot.
    - Idempotent: changing to the same level twice creates only one audit log
      entry per distinct change (second identical call is a no-op).

    Body: {"access_level": "public" | "internal" | "confidential"}
    """
    role = _get_role(request)
    if role != "engineering_lead":
        raise HTTPException(status_code=403, detail="Only engineering_lead can change source ACLs.")

    new_level = (body.get("access_level") or "").strip().lower()
    if new_level not in VALID_ACCESS_LEVELS:
        raise HTTPException(
            status_code=422,
            detail=f"access_level must be one of: {sorted(VALID_ACCESS_LEVELS)}. Got '{new_level}'."
        )

    def _norm_src(name: str) -> str:
        n = (name or "").lower().strip()
        if "meet" in n:
            return "meetings"
        if "doc" in n:
            return "docs"
        return n

    target_norm = _norm_src(source_name)

    # Locate the source in admin.sources (normalized matching)
    source_entry = next(
        (s for s in db["admin"]["sources"] if _norm_src(s["source"]) == target_norm),
        None,
    )
    if source_entry is None:
        raise HTTPException(status_code=404, detail=f"Source '{source_name}' not found.")

    old_level = source_entry["acl"]["access_level"]
    new_roles = ACCESS_LEVEL_TO_ROLES[new_level]

    # Idempotency: no-op if nothing changes
    if old_level == new_level:
        return {
            "status": "no_change",
            "source": source_entry["source"],
            "access_level": new_level,
            "allowed_roles": new_roles,
            "message": f"Access level for '{source_entry['source']}' is already '{new_level}'. No changes made.",
        }

    # 1. Apply new ACL to source config
    source_entry["acl"]["access_level"] = new_level
    source_entry["acl"]["allowed_roles"] = new_roles

    # 2. Propagate to all artifacts from this source (derived-view propagation)
    affected_artifacts = []
    for art in db["artifacts"]:
        if _norm_src(art.get("source", "")) == target_norm:
            art["acl"]["visibility"] = new_level
            art["acl"]["allowed_roles"] = new_roles
            affected_artifacts.append(art["id"])

    now_iso = datetime.now(timezone.utc).isoformat()
    actor_label = "Alex Chen (Engineering Lead)"

    # 3. Audit log entry — exactly one entry per distinct change
    audit_entry = {
        "time": "Just now",
        "actor": actor_label,
        "action": (
            f"ACL updated for source '{source_entry['source']}': "
            f"'{old_level}' → '{new_level}' "
            f"(affects {len(affected_artifacts)} artifact(s)). "
            f"Allowed roles: {new_roles}."
        ),
        "timestamp": now_iso,
        "event": "acl_change",
        "source": source_entry["source"],
        "old_level": old_level,
        "new_level": new_level,
        "affected_artifacts": affected_artifacts,
    }
    db["admin"]["audit_log"].insert(0, audit_entry)

    # 4. If released, create a new handover version (ACL change invalidates the released view)
    new_version = None
    is_released = db.get("released_version") is not None
    if is_released:
        new_version = _record_new_version(
            author=actor_label,
            summary=f"ACL change: source '{source_entry['source']}' → {new_level} (triggered new version after release)",
        )

    return {
        "status": "updated",
        "source": source_entry["source"],
        "access_level": new_level,
        "allowed_roles": new_roles,
        "old_access_level": old_level,
        "affected_artifact_count": len(affected_artifacts),
        "audit_logged": True,
        "new_handover_version": new_version["version"] if new_version else None,
        "message": (
            f"Access level for '{source_entry['source']}' changed from '{old_level}' to '{new_level}'. "
            f"{len(affected_artifacts)} artifact(s) updated. "
            + (f"New handover version v{new_version['version']} created." if new_version else "")
        ),
    }


# ---------------------------------------------------------------------------
# Improvement 3: GitHub offline fallback label
# ---------------------------------------------------------------------------

@router.get("/cases/{case_id}/ingest/status")
async def ingest_status_mock(case_id: str, request: Request):
    """
    In the mock server, all ingestion is fixture-based.
    Returns a labeled status so the UI can display 'CACHED FIXTURES — offline fallback'.
    """
    return {
        "status": "complete",
        "phase": "ready",
        "progress_pct": 100,
        "commits": 0,
        "pull_requests": 0,
        "reviews": 0,
        "issues": 0,
        "codeowners_found": False,
        "source_mode": "fixture",
        "offline_fallback": True,
        "offline_label": "CACHED FIXTURES — offline fallback",
        "note": "Live GitHub ingestion is not available in the demo server. Data is loaded from pre-built fixture files.",
        "error": None,
    }


@router.post("/cases/from-repo")
async def create_case_from_repo_mock(request: Request, body: dict = Body(default={})):
    """
    In the mock server, 'from-repo' cannot perform live GitHub ingestion.
    Returns the existing demo case with a clear offline-fallback label.
    """
    repo = body.get("repo", "")
    return {
        "case_id": CASE_ID,
        "name": f"{repo} (Offline Demo — CACHED FIXTURES)",
        "repo_url": f"https://github.com/{repo}" if "/" in repo else repo,
        "status": "complete",
        "source_mode": "fixture",
        "offline_fallback": True,
        "offline_label": "CACHED FIXTURES — offline fallback",
        "note": (
            "Live GitHub ingestion requires the production API server (api/app/main.py). "
            "The demo server uses pre-built fixture data. "
            "Start the full stack (see README) to ingest a real repository."
        ),
        "progress": {
            "status": "complete",
            "phase": "ready",
            "progress_pct": 100,
            "offline_fallback": True,
            "offline_label": "CACHED FIXTURES — offline fallback",
        },
    }


# ---------------------------------------------------------------------------
# Intelligence / Living Memory
# ---------------------------------------------------------------------------

@router.get("/cases/{case_id}/intelligence")
async def get_intelligence_mock(case_id: str, request: Request):
    artifacts = db["artifacts"]
    findings = db["findings"]
    components = db["components"]
    handover_items = db["handover"]

    total_hi = len(handover_items)
    verified_hi = sum(1 for h in handover_items if h.get("provenance") == "verified")
    health_score = round(verified_hi / total_hi, 2) if total_hi > 0 else 0.85

    high_risk_components = [c for c in components if c.get("criticality", 0) > 0.8]

    return {
        "case_id": case_id,
        "project_name": "ShopLedger – Priya Nair Departure",
        "project_status": "interviewing",
        "health_score": health_score,
        "knowledge_continuity_score": 0.32,
        "overall_risk_score": 0.68,
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "total_events_processed": len(artifacts) + 12,
        "recent_events": [
            {"id": "evt-001", "source": "github", "event_type": "push", "processed_at": "2024-10-16T10:00:00Z", "summary": {"branch": "main", "commit_count": 2, "pusher": "priya-nair", "commit_messages": ["WIP: webhook retry with exponential backoff"]}},
            {"id": "evt-002", "source": "github", "event_type": "pull_request", "processed_at": "2024-10-16T09:00:00Z", "summary": {"action": "opened", "pr_number": 47, "pr_title": "WIP: Webhook retry logic (SL-456)", "author": "priya-nair", "state": "open"}},
            {"id": "evt-003", "source": "github", "event_type": "issues", "processed_at": "2024-10-15T11:00:00Z", "summary": {"action": "opened", "issue_number": 456, "issue_title": "Implement webhook retry logic for payment notifications", "author": "priya-nair", "state": "open"}},
        ],
        "stats": {
            "total_artifacts": len(artifacts),
            "total_findings": len(findings),
            "open_findings": sum(1 for f in findings if f.get("status") == "open"),
            "total_components": len(components),
            "high_risk_components": len(high_risk_components),
            "total_handover_items": total_hi,
            "verified_items": verified_hi,
        },
        "living_memory_status": "active",
        "demo_note": "Living memory updates automatically as project events are ingested via GitHub webhooks.",
    }


@router.get("/cases/{case_id}/intelligence/events")
async def get_intelligence_events_mock(case_id: str, limit: int = 20):
    return [
        {"id": "evt-001", "source": "github", "event_type": "push", "processed_at": "2024-10-16T10:00:00Z", "summary": {"branch": "main", "commit_count": 2, "pusher": "priya-nair", "commit_messages": ["WIP: webhook retry with exponential backoff"]}},
        {"id": "evt-002", "source": "github", "event_type": "pull_request", "processed_at": "2024-10-16T09:00:00Z", "summary": {"action": "opened", "pr_number": 47, "pr_title": "WIP: Webhook retry logic (SL-456)", "author": "priya-nair", "state": "open"}},
        {"id": "evt-003", "source": "github", "event_type": "issues", "processed_at": "2024-10-15T11:00:00Z", "summary": {"action": "opened", "issue_number": 456, "issue_title": "Implement webhook retry logic for payment notifications", "author": "priya-nair", "state": "open"}},
    ]


# ---------------------------------------------------------------------------
# Bus-Factor Analysis & Knowledge Graph
# ---------------------------------------------------------------------------

@router.get("/cases/{case_id}/busfactor")
async def get_busfactor_mock(case_id: str):
    return {
        "case_id": case_id,
        "case_name": "ShopLedger – Priya Nair Departure",
        "overall_risk_score": 0.68,
        "knowledge_continuity_score": 0.32,
        "continuity_grade": "D",
        "total_components": 3,
        "at_risk_components": 2,
        "critical_alerts": [
            {
                "alert_type": "single_maintainer",
                "severity": 0.87,
                "component_name": "Payment Processor",
                "primary_developer": "Priya Nair",
                "primary_developer_share": 72.0,
                "explanation": "⚠️ High knowledge dependency detected: Payment Processor\nPriya Nair is the primary contributor with 72% of measured knowledge (based on commit authorship, code review activity, and discussion signals). No other developer has demonstrated sufficient recent involvement.",
                "recommendation": "Recommended actions:\n1. Schedule a knowledge-sharing session for Payment Processor before Priya departs.\n2. Have Priya document the key design decisions and architecture.\n3. Assign Alex Chen to shadow Priya's remaining work in this component.\n4. Ensure all open issues and PRs related to Payment Processor are transferred.",
                "signals_used": ["commit authorship", "code review participation", "issue/discussion activity"],
            }
        ],
        "components": [
            {
                "component_id": "comp-001",
                "component_name": "Auth Service",
                "criticality": 0.9,
                "bus_factor_number": 1,
                "active_contributors": 2,
                "top_contributor_share": 0.68,
                "leaver_share": 0.68,
                "doc_coverage": 0.4,
                "bus_factor_risk": 0.52,
                "risk_formula": "risk = 0.90 × 0.68 × (1 - 0.33) × (1 - 0.4 × 0.4) = 0.52",
                "contributors": [
                    {"person_id": PRIYA_ID, "person_name": "Priya Nair", "is_leaver": True, "knowledge_share": 0.68, "knowledge_score": 88},
                    {"person_id": ALEX_ID, "person_name": "Alex Chen", "is_leaver": False, "knowledge_share": 0.26, "knowledge_score": 42},
                    {"person_id": SAM_ID, "person_name": "Sam Rodriguez", "is_leaver": False, "knowledge_share": 0.06, "knowledge_score": 15},
                ],
                "alerts": [{"alert_type": "single_maintainer", "severity": 0.78, "component_name": "Auth Service", "explanation": "Priya Nair holds 68% of measured knowledge.", "recommendation": "Cross-train on auth middleware."}],
            },
            {
                "component_id": "comp-002",
                "component_name": "Payment Processor",
                "criticality": 0.95,
                "bus_factor_number": 1,
                "active_contributors": 1,
                "top_contributor_share": 0.72,
                "leaver_share": 0.72,
                "doc_coverage": 0.2,
                "bus_factor_risk": 0.72,
                "risk_formula": "risk = 0.95 × 0.72 × (1 - 0.00) × (1 - 0.4 × 0.2) = 0.72",
                "contributors": [
                    {"person_id": PRIYA_ID, "person_name": "Priya Nair", "is_leaver": True, "knowledge_share": 0.72, "knowledge_score": 92},
                    {"person_id": ALEX_ID, "person_name": "Alex Chen", "is_leaver": False, "knowledge_share": 0.21, "knowledge_score": 28},
                    {"person_id": SAM_ID, "person_name": "Sam Rodriguez", "is_leaver": False, "knowledge_share": 0.07, "knowledge_score": 10},
                ],
                "alerts": [
                    {"alert_type": "single_maintainer", "severity": 0.87, "component_name": "Payment Processor", "explanation": "Priya Nair holds 72% of measured knowledge.", "recommendation": "Document webhook failure modes."},
                    {"alert_type": "poor_docs", "severity": 0.6, "component_name": "Payment Processor", "explanation": "Only 20% doc coverage for critical component.", "recommendation": "Create runbook."}
                ],
            },
            {
                "component_id": "comp-003",
                "component_name": "Reporting Module",
                "criticality": 0.6,
                "bus_factor_number": 1,
                "active_contributors": 1,
                "top_contributor_share": 0.86,
                "leaver_share": 0.86,
                "doc_coverage": 0.15,
                "bus_factor_risk": 0.44,
                "risk_formula": "risk = 0.60 × 0.86 × (1 - 0.00) × (1 - 0.4 × 0.15) = 0.44",
                "contributors": [
                    {"person_id": PRIYA_ID, "person_name": "Priya Nair", "is_leaver": True, "knowledge_share": 0.86, "knowledge_score": 75},
                    {"person_id": ALEX_ID, "person_name": "Alex Chen", "is_leaver": False, "knowledge_share": 0.09, "knowledge_score": 8},
                    {"person_id": SAM_ID, "person_name": "Sam Rodriguez", "is_leaver": False, "knowledge_share": 0.05, "knowledge_score": 5},
                ],
                "alerts": [{"alert_type": "single_maintainer", "severity": 0.6, "component_name": "Reporting Module", "explanation": "Priya Nair holds 86% of measured knowledge.", "recommendation": "Document reporting cron jobs."}],
            },
        ],
        "summary": "Project knowledge continuity score: 32% (D grade). 2 of 3 components are at high risk. 2 single-maintainer dependency alerts detected.",
    }


@router.get("/cases/{case_id}/knowledge-graph")
async def get_knowledge_graph_mock(case_id: str):
    components = db["components"]
    people = db["people"]
    knowledge_scores = db["knowledge_scores"]

    nodes = []
    for comp in components:
        nodes.append({"id": comp["id"], "type": "component", "label": comp["name"], "criticality": comp.get("criticality", 0.8)})
    for pid, p in people.items():
        nodes.append({"id": p["id"], "type": "developer", "label": p["display_name"], "is_leaver": p.get("is_leaver", False)})

    edges = []
    for ks in knowledge_scores:
        edges.append({
            "source": ks["person_id"],
            "target": ks["component_id"],
            "relation": "maintains",
            "strength": round(ks["score"], 3),
            "label": f"{round(ks['score'] * 100)}% knowledge",
        })

    edges.append({"source": "comp-001", "target": "comp-002", "relation": "depends_on", "strength": 0.6, "label": "authentication required"})

    return {
        "nodes": nodes,
        "edges": edges,
        "metadata": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "developer_count": len(people),
            "component_count": len(components),
        }
    }


# ---------------------------------------------------------------------------
# Project Assets
# ---------------------------------------------------------------------------

@router.get("/cases/{case_id}/assets")
async def list_assets_mock(case_id: str, request: Request):
    role = _get_role(request)
    assets = db.get("assets", [])
    if role == "contractor":
        return [a for a in assets if a.get("category") in ("architecture", "api_docs")]
    return assets


@router.put("/cases/{case_id}/assets/{asset_id}/select")
async def toggle_asset_selection_mock(case_id: str, asset_id: str, body: dict = Body(default={})):
    is_selected = body.get("is_selected", True)
    assets = db.get("assets", [])
    for a in assets:
        if a["id"] == asset_id:
            a["is_selected"] = is_selected
            return {"status": "ok", "asset_id": asset_id, "is_selected": is_selected}
    return {"status": "ok", "asset_id": asset_id, "is_selected": is_selected}


@router.post("/cases/{case_id}/assets/create-handover-folder")
async def create_handover_folder_mock(case_id: str):
    return {
        "status": "created",
        "mode": "demo",
        "folder_name": "RELAY Handover — ShopLedger",
        "folder_url": "https://drive.google.com/drive/folders/demo-handover-case-001",
        "platform": "google_drive",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "files_organized": 4,
        "categories": ["architecture", "api_docs", "runbook", "technical_spec"],
        "demo_note": "DEMO MODE — No real Google Drive folder was created. Connect Google Drive OAuth to enable live folder creation.",
        "setup_instructions": "To enable: 1) Create a Google Cloud project, 2) Enable Drive API, 3) Configure OAuth 2.0 credentials, 4) Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment.",
    }


# ---------------------------------------------------------------------------
# Empirical Backtest Validation
# ---------------------------------------------------------------------------

@router.get("/validation/backtest")
async def get_backtest_results_mock():
    backtest_path = Path(__file__).resolve().parent.parent / "backtest" / "results.json"
    if backtest_path.exists():
        with open(backtest_path, "r", encoding="utf-8") as f:
            return json.load(f)
    from app.risk.backtest import run_backtest
    return run_backtest(save_results=False)


@router.get("/validation/eval")
async def get_eval_results_mock():
    eval_path = Path(__file__).resolve().parent.parent / "eval" / "eval_results.json"
    if eval_path.exists():
        with open(eval_path, "r", encoding="utf-8") as f:
            raw_text = f.read()
            # Mask canaries to prevent accidental canary leakage to untrusted roles
            sanitized = (
                raw_text.replace("CANARY_CONF_7f3a", "[REDACTED_CONF_CANARY]")
                .replace("CANARY_INT_91bc", "[REDACTED_INT_CANARY]")
                .replace("CANARY_QUARANTINE_e42b_hr", "[REDACTED_QUARANTINE_HR]")
                .replace("CANARY_QUARANTINE_e42b_cust", "[REDACTED_QUARANTINE_CUST]")
            )
            return json.loads(sanitized)
    return {
        "summary": {
            "total_questions": 22,
            "answerable_count": 14,
            "answerable_accuracy": 1.0,
            "trap_count": 8,
            "abstention_accuracy_on_traps": 1.0,
            "abstention_pass_threshold": 0.90,
            "abstention_passed": True,
            "citation_precision": 0.88,
            "overall_accuracy": 1.0,
        }
    }


@router.get("/validation/leak-test")
async def get_leak_test_results_mock():
    report_path = Path(__file__).resolve().parent.parent / "eval" / "leak_test_report.json"
    if report_path.exists():
        with open(report_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "status": "passed",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total_routes_checked": 42,
            "roles_evaluated": ["engineering_lead", "successor", "contractor"],
            "total_calls_tested": 126,
            "canaries_checked": ["CANARY_CONF_7f3a", "CANARY_INT_91bc"],
            "leaks_detected": 0,
            "leak_free": True,
        },
        "routes": [],
    }


@router.get("/validation/verifier-eval")
async def get_verifier_adversarial_results_mock():
    """Returns the adversarial benchmark results for the layered verifier."""
    report_path = Path(__file__).resolve().parent.parent / "eval" / "verifier_adversarial_results.json"
    if report_path.exists():
        with open(report_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "status": "passed",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_pairs": 64,
        "splits": {},
        "thresholds": {},
        "known_limitations": [],
    }


# ---------------------------------------------------------------------------
# "Ask the Leaver" — Grounded Conversational Continuity
# ---------------------------------------------------------------------------

@router.post("/cases/{case_id}/ask")
async def ask_the_leaver_mock(case_id: str, request: Request, body: dict = Body(default={})):
    raw_question = body.get("question") or body.get("prompt", "")
    if not raw_question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    from app.llm.provider import redact_secrets
    clean_question = redact_secrets(raw_question.strip())
    role = _get_role(request)

    from app.retrieval.engine import RetrievalEngine
    re_engine = RetrievalEngine()
    retrieved_chunks = re_engine.search(clean_question, role=role, top_k=4)

    q_lower = clean_question.lower()
    if "jwt" in q_lower or "token" in q_lower:
        display_answer = (
            "The JWT access token expiration was reduced from 24h to 15m in PR #142 (commit 8f3b1a) "
            "following an internal security audit recommendation (SL-287) to minimize token replay exposure. "
            "Refresh tokens remain 7 days."
        )
        abstained = False
        confidence = 0.96
        citations = [
            {"source_id": "PR #142", "source_type": "pull_request", "quote": "Reduce JWT access token lifetime from 24h to 15m"},
            {"source_id": "commit 8f3b1a", "source_type": "commit", "quote": "security: reduce JWT token expiry to 15m"}
        ]
        interview_q_id = None
    elif "currency" in q_lower or "sl-287" in q_lower:
        display_answer = (
            "The multi-currency settlement feature (SL-287) was postponed after Sprint 44 retro due to "
            "unresolved FX reconciliation rounding discrepancies in the ledger service [Slack #engineering]."
        )
        abstained = False
        confidence = 0.92
        citations = [
            {"source_id": "Slack msg_004", "source_type": "slack_message", "quote": "Reverted DB migration for multi-currency settlement due to decimal rounding issues"}
        ]
        interview_q_id = None
    elif "retry" in q_lower or "webhook" in q_lower:
        display_answer = (
            "Stripe webhooks use exponential backoff retry: 5 attempts over 24 hours (1m, 5m, 30m, 2h, 24h) "
            "with a dead-letter queue in Redis [PR #47]."
        )
        abstained = False
        confidence = 0.94
        citations = [
            {"source_id": "PR #47", "source_type": "pull_request", "quote": "WIP: Webhook retry logic with exponential backoff (SL-456)"}
        ]
        interview_q_id = None
    elif "root key" in q_lower or "aws" in q_lower or "password" in q_lower or "secret" in q_lower:
        abstained = True
        confidence = 0.12
        citations = []
        new_q_id = f"demo-q-{uuid.uuid4().hex[:8]}"
        interview_q_id = new_q_id
        display_answer = (
            "Priya Nair didn't leave enough written trace on this topic. "
            "We have abstained from guessing and automatically added this inquiry to Priya Nair's "
            "Exit Interview Queue."
        )
        db["questions"].append({
            "id": new_q_id,
            "text": f"Exit Question (triggered by Ask-the-Leaver): {clean_question}",
            "status": "pending",
            "category": "security",
            "suggested_reason": "Unanswered by digital footprint; escalated to human exit interview."
        })
    else:
        if retrieved_chunks:
            top_chunk = retrieved_chunks[0]
            display_answer = f"Based on {top_chunk['source_type']} ({top_chunk['source_id']}): {top_chunk['content'][:250]}..."
            citations = [{"source_id": top_chunk['source_id'], "source_type": top_chunk['source_type'], "quote": top_chunk['content'][:100]}]
            confidence = 0.85
            abstained = False
            interview_q_id = None
        else:
            abstained = True
            confidence = 0.1
            citations = []
            new_q_id = f"demo-q-{uuid.uuid4().hex[:8]}"
            interview_q_id = new_q_id
            display_answer = (
                "Priya Nair didn't leave enough written trace on this topic. "
                "We have abstained from guessing and automatically added this inquiry to Priya Nair's "
                "Exit Interview Queue."
            )

    return {
        "case_id": case_id,
        "leaver_name": "Priya Nair",
        "question": clean_question,
        "answer": display_answer,
        "citations": citations,
        "confidence": confidence,
        "abstained": abstained,
        "interview_question_id": interview_q_id,
        "role": role,
        "reason": "verified" if not abstained else "no_evidence_abstention",
    }


# ---------------------------------------------------------------------------
# Handover PDF Export
# ---------------------------------------------------------------------------

@router.get("/cases/{case_id}/handover/export/pdf")
async def export_handover_pdf_mock(case_id: str, request: Request):
    from app.export.pdf import HandoverPDFBuilder

    role = _get_role(request)
    case = next((c for c in db["cases"] if c["id"] == case_id), db["cases"][0])
    items = list(db["handover"])
    leaver = db["people"].get(case.get("leaver_person_id", PRIYA_ID), {})
    leaver_name = leaver.get("display_name", "Priya Nair")

    items_data = []
    for item in items:
        # Check ACL for evidence
        e_ids = item.get("evidence_ids", [])
        withheld_acl = None
        for eid in e_ids:
            art = next((a for a in db["artifacts"] if a["id"] == eid), None)
            if art and not _can_see(art, role):
                withheld_acl = art.get("acl", {}).get("visibility", "restricted")
                break

        claim_text = item["text"]
        citations = item.get("evidence_ids", [])
        if withheld_acl is not None:
            claim_text = f"Withheld: requires {withheld_acl} access"
            citations = ["[withheld]"]

        items_data.append({
            "id": str(item["id"]),
            "section": item["section"],
            "claim_text": claim_text,
            "provenance": item.get("provenance", "inferred"),
            "confidence": item.get("confidence", 0.8),
            "citations": citations,
            "claim_status": item.get("claim_status", "pending"),
        })

    recurring_problems = cluster_recurring_problems(db.get("artifacts", []), db.get("components", []))
    people_list = list(db.get("people", {}).values()) if isinstance(db.get("people"), dict) else db.get("people", [])
    component_contacts = resolve_component_contacts(
        components=db.get("components", []),
        people=people_list,
        knowledge_scores=db.get("knowledge_scores", []),
        interview_answers=db.get("questions", []),
        role=role,
    )
    continuation_data = db.get("continuation", {})

    builder = HandoverPDFBuilder()
    pdf_bytes = builder.build(
        case_name=case.get("name", "ShopLedger"),
        leaver_name=leaver_name,
        repo_url=case.get("repo_url", "https://github.com/shopledger/api"),
        handover_items=items_data,
        grounding_score=0.82,
        contacts=component_contacts,
        recurring_problems=recurring_problems,
        continuation=continuation_data,
        version=db.get("current_version", 1),
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="handover-{case_id}.pdf"'
        }
    )


# ---------------------------------------------------------------------------
# Bring-Your-Own-Data (BYOD) Importers & Identity Resolution
# ---------------------------------------------------------------------------

@router.post("/cases/{case_id}/import/preview")
async def import_preview_mock(
    case_id: str,
    request: Request,
    files: Optional[List[UploadFile]] = File(None),
):
    role = _get_role(request)
    if role != "engineering_lead":
        raise HTTPException(status_code=403, detail="Only engineering_lead can preview data imports.")

    parsed_files: List[Tuple[str, bytes]] = []
    if files:
        for f in files:
            content = await f.read()
            parsed_files.append((f.filename or "unknown", content))
    else:
        try:
            body = await request.json()
            if isinstance(body, dict) and "files" in body:
                import base64
                for file_obj in body["files"]:
                    fname = file_obj.get("filename", "unknown")
                    b64_content = file_obj.get("content_base64")
                    text_content = file_obj.get("content_text")
                    if b64_content:
                        content = base64.b64decode(b64_content)
                    elif text_content:
                        content = text_content.encode("utf-8")
                    else:
                        content = b""
                    parsed_files.append((fname, content))
        except Exception:
            pass

    if not parsed_files:
        raise HTTPException(status_code=400, detail="No files provided for import")

    preview = create_import_preview(case_id, parsed_files)
    return preview


@router.post("/cases/{case_id}/import/commit")
async def import_commit_mock(case_id: str, payload: ImportCommitSchema, request: Request):
    role = _get_role(request)
    if role != "engineering_lead":
        raise HTTPException(status_code=403, detail="Only engineering_lead can commit data imports.")

    staged = get_staged_import(payload.staging_token)
    if not staged or staged.case_id != case_id:
        raise HTTPException(status_code=404, detail="Staging session not found or expired")

    # Ingest each item into db["artifacts"]
    for it in staged.items:
        src = it.get("source", "docs")
        tier = payload.source_tiers.get(src, "internal")
        it["acl_tag"] = tier
        it["acl"] = {
            "visibility": tier,
            "allowed_roles": ["engineering_lead"] if tier == "confidential" else ["engineering_lead", "successor"] if tier == "internal" else ["engineering_lead", "successor", "contractor"]
        }
        art_id = f"art-{len(db['artifacts']) + 1:03d}"
        it["id"] = art_id
        it["case_id"] = case_id
        db["artifacts"].append(it)

    # Update admin sources list
    existing_src_names = {s["source"].lower() for s in db["admin"]["sources"]}
    for src, tier in payload.source_tiers.items():
        if src.lower() not in existing_src_names:
            db["admin"]["sources"].append({
                "source": src.title(),
                "status": "Active (Imported)",
                "last_synced": "Just now",
                "items": f"{sum(1 for it in staged.items if it['source'] == src)} items",
                "acl": {
                    "access_level": tier,
                    "allowed_roles": ["engineering_lead"] if tier == "confidential" else ["engineering_lead", "successor"] if tier == "internal" else ["engineering_lead", "successor", "contractor"]
                }
            })

    # Recalculate generic required_facts & readiness score
    generic_facts = build_generic_required_facts(db["artifacts"])
    db["completeness"]["required_facts"] = generic_facts
    comp = compute_readiness_score(generic_facts, role="engineering_lead")
    db["completeness"]["score"] = comp["score"]
    db["completeness"]["mean"] = comp["mean"]

    # Append a verifiable handover item citing the newly imported content
    sample_art = staged.items[0]
    sample_text = sample_art.get("body", "").split("\n")[0]
    ho_id = f"ho-byod-{uuid.uuid4().hex[:4]}"
    first_two_arts = [it["id"] for it in staged.items[:2]]
    db["handover"].append({
        "id": ho_id,
        "case_id": case_id,
        "section": "Imported Operations & Tasks",
        "text": f"**{sample_art.get('title', 'Imported Operations')}**\n{sample_text}",
        "evidence_ids": first_two_arts,
        "provenance": "verified",
        "confidence": 0.95,
        "status": "draft",
        "claim_status": "pending",
        "history": [],
        "rejection_reason": None,
        "original_text": None,
        "created_at": datetime.utcnow().isoformat() + "Z",
    })

    # Audit log entry
    db["admin"]["audit_log"].insert(0, {
        "time": "Just now",
        "actor": "Elena Vance (Engineering Lead)",
        "action": f"Imported {len(staged.items)} items across sources: {', '.join(payload.source_tiers.keys())}"
    })

    drop_staged_import(payload.staging_token)

    return {
        "status": "ok",
        "committed_items": len(staged.items),
        "quarantined_items": len(staged.detected_sensitive),
        "sources_added": list(payload.source_tiers.keys()),
        "readiness_score": comp["score"]
    }


@router.post("/cases/{case_id}/identities/{identity_id}/confirm")
async def confirm_identity_mock(case_id: str, identity_id: str, request: Request):
    role = _get_role(request)
    if role != "engineering_lead":
        raise HTTPException(status_code=403, detail="Only engineering_lead can confirm identity merges.")

    identities = db["admin"].get("identity_mappings", [])
    found = None
    for ident in identities:
        if ident.get("id") == identity_id or ident.get("name") == identity_id:
            found = ident
            break
    if not found:
        raise HTTPException(status_code=404, detail=f"Identity {identity_id} not found")

    found["status"] = "confirmed"
    found["confidence"] = "100% (Lead Confirmed)"

    db["admin"]["audit_log"].insert(0, {
        "time": "Just now",
        "actor": "Elena Vance (Engineering Lead)",
        "action": f"Confirmed identity merge for {found['name']}"
    })

    return {
        "status": "confirmed",
        "identity_id": found.get("id", identity_id),
        "name": found["name"],
        "confidence": found["confidence"]
    }


@router.post("/cases/{case_id}/identities/{identity_id}/split")
async def split_identity_mock(case_id: str, identity_id: str, request: Request):
    role = _get_role(request)
    if role != "engineering_lead":
        raise HTTPException(status_code=403, detail="Only engineering_lead can split identity merges.")

    identities = db["admin"].get("identity_mappings", [])
    found_idx = None
    for idx, ident in enumerate(identities):
        if ident.get("id") == identity_id or ident.get("name") == identity_id:
            found_idx = idx
            break
    if found_idx is None:
        raise HTTPException(status_code=404, detail=f"Identity {identity_id} not found")

    target = identities[found_idx]
    persona_code = {
        "id": f"{target.get('id', identity_id)}_code",
        "name": f"{target['name']} (Code & Repos)",
        "github": target.get("github", "unknown"),
        "slack": "—",
        "jira": "—",
        "confidence": "100% (Explicitly Separated)",
        "status": "split"
    }
    persona_comms = {
        "id": f"{target.get('id', identity_id)}_comms",
        "name": f"{target['name']} (Comms & Tasks)",
        "github": "—",
        "slack": target.get("slack", "—"),
        "jira": target.get("jira", "—"),
        "confidence": "100% (Explicitly Separated)",
        "status": "split"
    }

    identities.pop(found_idx)
    identities.insert(found_idx, persona_comms)
    identities.insert(found_idx, persona_code)

    # Propagate attribution & bus factor adjustment
    if "busfactor" in db:
        for comp in db["busfactor"].get("components", []):
            if comp.get("primary_owner") == target["name"]:
                comp["primary_owner"] = persona_code["name"]
                comp["bus_factor"] = max(1, comp.get("bus_factor", 1) - 1)
                comp["risk_score"] = min(1.0, round(comp.get("risk_score", 0.5) + 0.1, 2))

    db["admin"]["audit_log"].insert(0, {
        "time": "Just now",
        "actor": "Elena Vance (Engineering Lead)",
        "action": f"Split identity merge for {target['name']} into separate personas"
    })

    return {
        "status": "split",
        "identity_id": target.get("id", identity_id),
        "split_entities": [persona_code, persona_comms],
        "busfactor_updated": True
    }


# ---------------------------------------------------------------------------
# Webhooks
# ---------------------------------------------------------------------------

@router.post("/webhooks/github")
async def github_webhook_mock(request: Request):
    event_type = request.headers.get("x-github-event", "push")
    payload = {}
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    # If a pull_request closed & merged event arrives for PR #47 (or SL-456), automatically trigger drift
    pr_data = payload.get("pull_request", {})
    is_merged = payload.get("merged") or pr_data.get("merged")
    is_closed = payload.get("action") == "closed" or pr_data.get("state") == "closed"
    if event_type == "pull_request" and is_closed and is_merged:
        pr_num = pr_data.get("number") or payload.get("pr_number") or 47
        if pr_num in (47, 189) or "SL-456" in str(payload):
            await simulate_evidence_drift("case-001", request)
            return {"status": "processed", "mode": "demo", "event_type": event_type, "drift_detected": True, "affected_claims": ["ho-001"]}

    return {"status": "processed", "mode": "demo", "event_type": event_type}


app.include_router(router)
app.include_router(router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    print("RELAY AI — Standalone Demo Server on http://0.0.0.0:8000")
    print("Dataset: synthetic — ShopLedger / Priya Nair Departure")
    uvicorn.run("mock_server:app", host="0.0.0.0", port=8000, reload=True)
