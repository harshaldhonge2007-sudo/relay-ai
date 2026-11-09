from fastapi import FastAPI, HTTPException, Body, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uuid
from datetime import datetime, timezone

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

def generate_default_data():
    return {
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
            {
                "id": "comp-001",
                "case_id": CASE_ID,
                "name": "Auth Service",
                "path_globs": '["src/auth/**", "src/middleware/auth*"]',
                "criticality": 0.95,
            },
            {
                "id": "comp-002",
                "case_id": CASE_ID,
                "name": "Payment Processor",
                "path_globs": '["src/payments/**", "db/migrations/**"]',
                "criticality": 0.90,
            },
            {
                "id": "comp-003",
                "case_id": CASE_ID,
                "name": "Reporting Module",
                "path_globs": '["src/reports/**", "scripts/nightly*"]',
                "criticality": 0.65,
            },
        ],
        "knowledge_scores": [
            {
                "id": "ks-001",
                "component_id": "comp-001",
                "person_id": PRIYA_ID,
                "score": 0.88,
                "breakdown": {"edits": 0.45, "reviews": 0.25, "discussion": 0.18},
            },
            {
                "id": "ks-002",
                "component_id": "comp-001",
                "person_id": ALEX_ID,
                "score": 0.42,
                "breakdown": {"edits": 0.20, "reviews": 0.18, "discussion": 0.04},
            },
            {
                "id": "ks-003",
                "component_id": "comp-001",
                "person_id": SAM_ID,
                "score": 0.15,
                "breakdown": {"edits": 0.05, "reviews": 0.08, "discussion": 0.02},
            },
            {
                "id": "ks-004",
                "component_id": "comp-002",
                "person_id": PRIYA_ID,
                "score": 0.92,
                "breakdown": {"edits": 0.60, "reviews": 0.20, "discussion": 0.12},
            },
            {
                "id": "ks-005",
                "component_id": "comp-002",
                "person_id": ALEX_ID,
                "score": 0.28,
                "breakdown": {"edits": 0.15, "reviews": 0.10, "discussion": 0.03},
            },
            {
                "id": "ks-006",
                "component_id": "comp-002",
                "person_id": SAM_ID,
                "score": 0.10,
                "breakdown": {"edits": 0.03, "reviews": 0.06, "discussion": 0.01},
            },
            {
                "id": "ks-007",
                "component_id": "comp-003",
                "person_id": PRIYA_ID,
                "score": 0.78,
                "breakdown": {"edits": 0.50, "reviews": 0.15, "discussion": 0.13},
            },
            {
                "id": "ks-008",
                "component_id": "comp-003",
                "person_id": ALEX_ID,
                "score": 0.12,
                "breakdown": {"edits": 0.05, "reviews": 0.05, "discussion": 0.02},
            },
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
                "acl_tag": "readable",
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
                "acl_tag": "readable",
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
                "acl_tag": "readable",
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
                "acl_tag": "readable",
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
                "acl_tag": "readable",
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
                "acl_tag": "readable",
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
                "acl_tag": "readable",
                "created_at": "2024-09-01T00:00:00Z",
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
                "summary": "Jira ticket SL-234 shows status Done, but Slack messages on the same date verify users are still being logged out after 15 minutes. Downstream API gateway is likely overriding the TTL headers.",
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
        ],
        "questions": [
            {
                "id": "q-001",
                "case_id": CASE_ID,
                "finding_id": "find-001",
                "text": "SL-234 is marked Done on Jira, but users are still timing out after 15 minutes. What downstream cache or gateway setting is overriding the 2-hour TTL?",
                "evidence": [{"artifact_id": "art-003"}, {"artifact_id": "art-004"}],
                "priority": 0.95,
                "status": "draft",
                "created_at": "2024-10-16T11:30:00Z",
            },
            {
                "id": "q-002",
                "case_id": CASE_ID,
                "finding_id": "find-002",
                "text": "The currency_code migration was reverted after throwing FK errors. Where is the fixed branch, and what are the exact steps to backfill existing rows before running the migration?",
                "evidence": [{"artifact_id": "art-002"}, {"artifact_id": "art-006"}],
                "priority": 0.90,
                "status": "draft",
                "created_at": "2024-10-16T11:30:00Z",
            },
            {
                "id": "q-003",
                "case_id": CASE_ID,
                "finding_id": "find-003",
                "text": "PR #47 implements webhook retry logic with exponential backoff. What remains to be done before merging, and how should dead-lettered events be alerted?",
                "evidence": [{"artifact_id": "art-001"}],
                "priority": 0.85,
                "status": "draft",
                "created_at": "2024-10-16T11:30:00Z",
            },
            {
                "id": "q-004",
                "case_id": CASE_ID,
                "finding_id": "find-004",
                "text": "The 2 AM reporting cron requires REPORT_BUCKET_NAME and SMTP_RELAY_HOST. Where are the production credentials stored, and who owns the SMTP relay access?",
                "evidence": [{"artifact_id": "art-005"}],
                "priority": 0.80,
                "status": "draft",
                "created_at": "2024-10-16T11:30:00Z",
            },
            {
                "id": "q-005",
                "case_id": CASE_ID,
                "finding_id": "find-005",
                "text": "Are there any other scheduled jobs or private keys on your local machine that haven't been transferred to 1Password or AWS Secrets Manager?",
                "evidence": [],
                "priority": 0.70,
                "status": "draft",
                "created_at": "2024-10-16T11:30:00Z",
            },
        ],
        "handover": [
            {
                "id": "ho-001",
                "case_id": CASE_ID,
                "section": "In-Flight Work",
                "text": "**Payment Webhook Retry Logic (SL-456 / PR #47)**\nPR #47 contains the exponential backoff queue. Missing items: integration test suite and dead-letter queue routing. Ready for Alex Chen to take over review and complete deployment.",
                "evidence_ids": ["art-001"],
                "provenance": "inferred",
                "confidence": 0.95,
                "created_at": "2024-10-16T12:00:00Z",
            },
            {
                "id": "ho-002",
                "case_id": CASE_ID,
                "section": "Pending Deployments",
                "text": "**Currency Code Schema Migration (SL-287)**\nThe original migration failed due to existing rows lacking currency defaults. Fixed migration branch `feature/currency-fix` contains a pre-migration script: `UPDATE payments SET currency_code = 'USD' WHERE currency_code IS NULL;` before adding `NOT NULL` constraint.",
                "evidence_ids": ["art-002", "art-006"],
                "provenance": "stated",
                "confidence": 0.92,
                "created_at": "2024-10-16T12:00:00Z",
            },
            {
                "id": "ho-003",
                "case_id": CASE_ID,
                "section": "Known Production Issues",
                "text": "**Premature JWT Session Timeouts (SL-234)**\nThough the backend token configuration was increased to 2 hours, Cloudflare reverse proxy edge rules enforce a 15-minute connection TTL. Update Cloudflare Page Rule for `/auth/refresh` to resolve completely.",
                "evidence_ids": ["art-003", "art-004"],
                "provenance": "verified",
                "confidence": 0.90,
                "created_at": "2024-10-16T12:00:00Z",
            },
            {
                "id": "ho-004",
                "case_id": CASE_ID,
                "section": "Environment & Ops",
                "text": "**Nightly Cron Prerequisites**\nThe nightly accounting ledger report (runs 02:00 UTC) requires:\n- `REPORT_BUCKET_NAME=shopledger-reports-prod`\n- `SMTP_RELAY_HOST=smtp.sendgrid.net`\nCredentials stored in AWS Secrets Manager under `/prod/shopledger/reports`.",
                "evidence_ids": ["art-005", "art-007"],
                "provenance": "stated",
                "confidence": 0.98,
                "created_at": "2024-10-16T12:00:00Z",
            },
            {
                "id": "ho-005",
                "case_id": CASE_ID,
                "section": "Architecture & Ownership",
                "text": "**Payment Processor Subsystem Handover**\nPriya was primary owner (92% knowledge share). Primary contact during handover: Alex Chen. Critical services: Stripe Webhook Ingestion, Daily Settlement Reconciliation, and Multi-Currency Ledger.",
                "evidence_ids": [],
                "provenance": "verified",
                "confidence": 0.96,
                "created_at": "2024-10-16T12:00:00Z",
            },
        ],
        "completeness": {
            "task": "Simulated blind developer setup: Clone repo, run test suite, and trigger payment webhook worker",
            "score": 0.87,
            "mean": 0.83,
            "spread": 0.08,
            "runs": [0.79, 0.87, 0.83],
            "required_facts": [
                {"kind": "env_var", "key": "DATABASE_URL", "source": "README.md", "status": "found"},
                {"kind": "env_var", "key": "JWT_SECRET", "source": "README.md", "status": "found"},
                {"kind": "env_var", "key": "STRIPE_API_KEY", "source": "README.md", "status": "found"},
                {"kind": "env_var", "key": "REPORT_BUCKET_NAME", "source": "Handover Item #4 (Slack)", "status": "found"},
                {"kind": "env_var", "key": "SMTP_RELAY_HOST", "source": "Handover Item #4 (Slack)", "status": "found"},
                {"kind": "migration", "key": "currency_code_backfill", "source": "Handover Item #2 (Jira/Git)", "status": "found"},
                {"kind": "documentation", "key": "SL-412_postgres15_runbook", "source": "Not documented yet", "status": "missing"},
            ],
            "blockers": [
                "PostgreSQL 15 upgrade runbook (SL-412) is missing from repository documentation.",
            ],
        },
        "admin": {
            "sources": [
                {"source": "GitHub", "status": "Connected & Synced", "last_synced": "12 minutes ago", "items": "12 commits, 2 PRs, 1 branch"},
                {"source": "Slack", "status": "Connected & Synced", "last_synced": "20 minutes ago", "items": "8 channels, 34 messages"},
                {"source": "Jira", "status": "Connected & Synced", "last_synced": "15 minutes ago", "items": "5 tickets, 12 comments"},
                {"source": "Docs", "status": "Indexed", "last_synced": "1 hour ago", "items": "README.md, API.md, 14 markdown files"},
            ],
            "identity_mappings": [
                {"name": "Priya Nair (Leaver)", "github": "priya-nair", "slack": "@priya (U12345)", "jira": "jira_priya", "confidence": "100% (Auto-Unified)"},
                {"name": "Alex Chen", "github": "alexc", "slack": "@alex (U67890)", "jira": "alex@shopledger.io", "confidence": "100% (Auto-Unified)"},
                {"name": "Sam Rodriguez", "github": "samr", "slack": "@sam (U11111)", "jira": "sam@shopledger.io", "confidence": "100% (Auto-Unified)"},
            ],
            "audit_log": [
                {"time": "Just now", "actor": "System AI", "action": "Calculated knowledge radar distribution across 3 components"},
                {"time": "2 hours ago", "actor": "System AI", "action": "Extracted 5 gap findings and generated interview questions"},
                {"time": "5 hours ago", "actor": "Priya Nair", "action": "Submitted clarification answer on currency_code migration"},
                {"time": "Yesterday", "actor": "Engineering Manager", "action": "Created case: ShopLedger – Priya Nair Departure"},
            ],
        },
    }

db = generate_default_data()

@router.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0", "mode": "standalone_live"}

@router.get("/")
async def root():
    return {"app": "RELAY AI", "version": "0.1.0", "status": "ready"}

@router.get("/cases")
async def list_cases():
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
    # Return default case if not found to avoid blank page
    return db["cases"][0]

@router.get("/cases/{case_id}/components")
async def get_components(case_id: str):
    return db["components"]

@router.get("/cases/{case_id}/knowledge")
async def get_knowledge(case_id: str):
    return db["knowledge_scores"]

@router.get("/cases/{case_id}/artifacts")
async def get_artifacts(case_id: str):
    return db["artifacts"]

@router.get("/cases/{case_id}/findings")
async def get_findings(case_id: str):
    return db["findings"]

@router.get("/cases/{case_id}/questions")
async def get_questions(case_id: str):
    return db["questions"]

@router.post("/cases/{case_id}/questions/{question_id}/answer")
async def answer_question(case_id: str, question_id: str, body: dict = Body(...)):
    for q in db["questions"]:
        if q["id"] == question_id:
            q["status"] = "answered"
            q["answer"] = body.get("text", "")
            return {"status": "ok", "question": q}
    return {"status": "ok"}

@router.get("/cases/{case_id}/handover")
async def get_handover(case_id: str):
    return db["handover"]

@router.post("/cases/{case_id}/handover/approve")
async def approve_handover(case_id: str):
    for c in db["cases"]:
        if c["id"] == case_id:
            c["status"] = "approved"
    return {"status": "approved"}

@router.post("/cases/{case_id}/handover/release")
async def release_handover(case_id: str):
    for c in db["cases"]:
        if c["id"] == case_id:
            c["status"] = "released"
    return {"status": "released"}

@router.get("/cases/{case_id}/completeness")
async def get_completeness(case_id: str):
    return db["completeness"]

@router.post("/cases/{case_id}/completeness/run")
async def run_completeness(case_id: str):
    # Simulate a new run
    db["completeness"]["score"] = 0.91
    db["completeness"]["runs"].append(0.91)
    db["completeness"]["mean"] = round(sum(db["completeness"]["runs"]) / len(db["completeness"]["runs"]), 2)
    return db["completeness"]

@router.get("/cases/{case_id}/admin")
async def get_admin_data(case_id: str):
    return db["admin"]

@router.get("/people/{person_id}")
async def get_person(person_id: str):
    if person_id in db["people"]:
        return db["people"][person_id]
    return {"id": person_id, "display_name": "Team Member"}

@router.post("/demo/seed")
async def demo_seed():
    global db
    db = generate_default_data()
    return {"status": "ok", "message": "Demo data refreshed successfully"}

app.include_router(router)
app.include_router(router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting RELAY AI Standalone Server on http://0.0.0.0:8000")
    uvicorn.run("mock_server:app", host="0.0.0.0", port=8000, reload=True)
