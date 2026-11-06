"""
Demo seeder – creates the ShopLedger / Priya Nair departure scenario with
pre-populated persons, artifacts, components, findings, interview questions,
and handover items so the UI has rich data out of the box.
"""

import uuid
import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models import (
    Case, Person, Artifact, ArtifactType, SourceMode,
    Component, KnowledgeScore,
    Finding, FindingKind, FindingStatus,
    InterviewQuestion, QuestionStatus,
    HandoverItem, Provenance,
    CaseStatus,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _dt(iso: str) -> datetime:
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


# ---------------------------------------------------------------------------
# public entry point
# ---------------------------------------------------------------------------

async def seed_demo(session: AsyncSession) -> dict:
    """Idempotent: wipes any existing demo case by name, then recreates it."""

    # --- clean up old demo case ----------------------------------------
    old = (await session.execute(
        select(Case).where(Case.name == "ShopLedger – Priya Nair Departure")
    )).scalar()
    if old:
        await session.delete(old)
        await session.flush()

    # ===================================================================
    # 1. PERSONS
    # ===================================================================
    priya = Person(
        display_name="Priya Nair",
        identities=[
            {"source": "github",  "id": "priya-nair",    "handle": "priya-nair",    "email": "priya@shopledger.io"},
            {"source": "slack",   "id": "U12345",         "handle": "priya",          "email": "priya@shopledger.io"},
            {"source": "jira",    "id": "jira_priya",     "handle": "Priya Nair",     "email": "priya@shopledger.io"},
        ],
        is_leaver=True,
    )
    alex = Person(
        display_name="Alex Chen",
        identities=[
            {"source": "github", "id": "alexc",   "handle": "alexc",  "email": "alex@shopledger.io"},
            {"source": "slack",  "id": "U67890",  "handle": "alex",   "email": "alex@shopledger.io"},
        ],
        is_leaver=False,
    )
    sam = Person(
        display_name="Sam Rodriguez",
        identities=[
            {"source": "github", "id": "samr",    "handle": "samr",   "email": "sam@shopledger.io"},
            {"source": "slack",  "id": "U11111",  "handle": "sam",    "email": "sam@shopledger.io"},
        ],
        is_leaver=False,
    )
    session.add_all([priya, alex, sam])
    await session.flush()

    # ===================================================================
    # 2. CASE
    # ===================================================================
    case = Case(
        name="ShopLedger – Priya Nair Departure",
        repo_url="https://github.com/shopledger/api",
        leaver_person_id=priya.id,
        status=CaseStatus.DETECTING,
        source_modes={"github": "fixture", "slack": "fixture", "jira": "fixture", "docs": "fixture"},
    )
    session.add(case)
    await session.flush()

    cid = case.id

    # ===================================================================
    # 3. ARTIFACTS – GitHub commits
    # ===================================================================
    commits = [
        Artifact(
            case_id=cid, source="github", source_mode=SourceMode.FIXTURE,
            type=ArtifactType.COMMIT, external_id="a1b2c3d",
            author_id=priya.id, occurred_at=_dt("2024-10-01T09:15:00Z"),
            url="https://github.com/shopledger/api/commit/a1b2c3d",
            title="Fix JWT expiry: update auth service config",
            body="Fix JWT expiry: update auth service config\n\nChanges the token TTL from 900s to 7200s in auth.config.ts.\nCloses SL-234.",
            raw={"sha": "a1b2c3d", "files": ["src/auth/auth.config.ts"], "author": {"login": "priya-nair"}},
            acl_tag="readable",
        ),
        Artifact(
            case_id=cid, source="github", source_mode=SourceMode.FIXTURE,
            type=ArtifactType.COMMIT, external_id="b2c3d4e",
            author_id=priya.id, occurred_at=_dt("2024-10-14T14:00:00Z"),
            url="https://github.com/shopledger/api/commit/b2c3d4e",
            title="Add currency_code column to payments table",
            body="Add currency_code column to payments table\n\nMigration adds NOT NULL currency_code VARCHAR(3).\nSL-287.",
            raw={"sha": "b2c3d4e", "files": ["db/migrations/20241014_add_currency_code.sql"], "author": {"login": "priya-nair"}},
            acl_tag="readable",
        ),
        Artifact(
            case_id=cid, source="github", source_mode=SourceMode.FIXTURE,
            type=ArtifactType.COMMIT, external_id="c3d4e5f",
            author_id=priya.id, occurred_at=_dt("2024-10-14T18:30:00Z"),
            url="https://github.com/shopledger/api/commit/c3d4e5f",
            title="Revert: Add currency_code column to payments table",
            body="Revert 'Add currency_code column to payments table'\n\nForeign key constraint violations on existing rows. Fixed version pending.",
            raw={"sha": "c3d4e5f", "files": ["db/migrations/20241014_add_currency_code.sql"], "author": {"login": "priya-nair"}},
            acl_tag="readable",
        ),
        Artifact(
            case_id=cid, source="github", source_mode=SourceMode.FIXTURE,
            type=ArtifactType.COMMIT, external_id="d4e5f6a",
            author_id=priya.id, occurred_at=_dt("2024-10-16T10:00:00Z"),
            url="https://github.com/shopledger/api/commit/d4e5f6a",
            title="WIP: webhook retry with exponential backoff",
            body="WIP: webhook retry with exponential backoff\n\nPartial implementation of SL-456. Adds retry queue and backoff calculator. Tests TODO.",
            raw={"sha": "d4e5f6a", "files": ["src/payments/webhook_retry.ts", "src/payments/backoff.ts"], "author": {"login": "priya-nair"}},
            acl_tag="readable",
        ),
        Artifact(
            case_id=cid, source="github", source_mode=SourceMode.FIXTURE,
            type=ArtifactType.COMMIT, external_id="e5f6a7b",
            author_id=alex.id, occurred_at=_dt("2024-09-20T11:00:00Z"),
            url="https://github.com/shopledger/api/commit/e5f6a7b",
            title="Refactor: extract PaymentProcessor into service layer",
            body="Refactor: extract PaymentProcessor into service layer\n\nMoves business logic out of controllers for better testability.",
            raw={"sha": "e5f6a7b", "files": ["src/payments/payment_processor.ts"], "author": {"login": "alexc"}},
            acl_tag="readable",
        ),
    ]

    # GitHub PRs
    prs = [
        Artifact(
            case_id=cid, source="github", source_mode=SourceMode.FIXTURE,
            type=ArtifactType.PULL_REQUEST, external_id="42",
            author_id=priya.id, occurred_at=_dt("2024-10-01T08:00:00Z"),
            url="https://github.com/shopledger/api/pull/42",
            title="Fix JWT token expiry (SL-234)",
            body="## Summary\nFixes premature session timeouts by correcting the JWT TTL config.\n\n## Testing\nManually verified sessions persist for 2 hours in staging.",
            raw={"number": 42, "state": "closed", "merged": True, "draft": False, "user": {"login": "priya-nair"}},
            acl_tag="readable",
        ),
        Artifact(
            case_id=cid, source="github", source_mode=SourceMode.FIXTURE,
            type=ArtifactType.PULL_REQUEST, external_id="47",
            author_id=priya.id, occurred_at=_dt("2024-10-16T09:00:00Z"),
            url="https://github.com/shopledger/api/pull/47",
            title="WIP: Webhook retry logic (SL-456)",
            body="## Summary\nIn-progress implementation of exponential backoff retry for payment webhooks.\n\n## Status\n- [x] Retry queue\n- [x] Backoff calculator\n- [ ] Integration tests\n- [ ] Dead-letter queue",
            raw={"number": 47, "state": "open", "merged": False, "draft": True, "user": {"login": "priya-nair"}},
            acl_tag="readable",
        ),
    ]

    # Slack messages
    slacks = [
        Artifact(
            case_id=cid, source="slack", source_mode=SourceMode.FIXTURE,
            type=ArtifactType.SLACK_MESSAGE, external_id="msg_001",
            author_id=priya.id, occurred_at=_dt("2024-10-08T09:00:00Z"),
            url="https://slack.com/archives/C_ENG/p1728345600",
            title="Slack: Priya Nair",
            body="The JWT token expiry issue is still happening in production. Users are getting logged out after 15 minutes instead of the configured 2 hours.",
            raw={"id": "msg_001", "channel": "C_ENG"},
            acl_tag="readable",
        ),
        Artifact(
            case_id=cid, source="slack", source_mode=SourceMode.FIXTURE,
            type=ArtifactType.SLACK_MESSAGE, external_id="msg_002",
            author_id=alex.id, occurred_at=_dt("2024-10-08T11:00:00Z"),
            url="https://slack.com/archives/C_ENG/p1728432000",
            title="Slack: Alex Chen",
            body="I thought SL-234 fixed that? The ticket shows as done.",
            raw={"id": "msg_002", "channel": "C_ENG"},
            acl_tag="readable",
        ),
        Artifact(
            case_id=cid, source="slack", source_mode=SourceMode.FIXTURE,
            type=ArtifactType.SLACK_MESSAGE, external_id="msg_004",
            author_id=priya.id, occurred_at=_dt("2024-10-14T19:00:00Z"),
            url="https://slack.com/archives/C_ENG/p1728604800",
            title="Slack: Priya Nair",
            body="Had to revert the database migration from October 14. It was causing foreign key constraint violations in the payments table. Created a new branch with a fixed version.",
            raw={"id": "msg_004", "channel": "C_ENG"},
            acl_tag="readable",
        ),
        Artifact(
            case_id=cid, source="slack", source_mode=SourceMode.FIXTURE,
            type=ArtifactType.SLACK_MESSAGE, external_id="msg_006",
            author_id=priya.id, occurred_at=_dt("2024-10-16T08:00:00Z"),
            url="https://slack.com/archives/C_ENG/p1728777600",
            title="Slack: Priya Nair",
            body="The issue was that we added the new currency_code column with a NOT NULL constraint before backfilling existing records. I have a fixed version ready but haven't deployed it yet.",
            raw={"id": "msg_006", "channel": "C_ENG"},
            acl_tag="readable",
        ),
        Artifact(
            case_id=cid, source="slack", source_mode=SourceMode.FIXTURE,
            type=ArtifactType.SLACK_MESSAGE, external_id="msg_007",
            author_id=priya.id, occurred_at=_dt("2024-10-15T07:00:00Z"),
            url="https://slack.com/archives/C_OPS/p1729036800",
            title="Slack: Priya Nair (ops)",
            body="Reminder: the nightly report generation job runs via cron at 2 AM UTC. It depends on REPORT_BUCKET_NAME and SMTP_RELAY_HOST environment variables.",
            raw={"id": "msg_007", "channel": "C_OPS"},
            acl_tag="readable",
        ),
    ]

    # Jira tickets
    jiras = [
        Artifact(
            case_id=cid, source="jira", source_mode=SourceMode.FIXTURE,
            type=ArtifactType.JIRA_TICKET, external_id="SL-234",
            author_id=priya.id, occurred_at=_dt("2024-10-01T10:00:00Z"),
            url="https://jira.shopledger.io/browse/SL-234",
            title="Fix JWT token expiry configuration",
            body="Users are experiencing premature session timeouts. The JWT token should expire after 2 hours but currently expires after 15 minutes.",
            raw={"key": "SL-234", "status": "Done", "assignee": "Priya Nair"},
            acl_tag="readable",
        ),
        Artifact(
            case_id=cid, source="jira", source_mode=SourceMode.FIXTURE,
            type=ArtifactType.JIRA_TICKET, external_id="SL-287",
            author_id=priya.id, occurred_at=_dt("2024-09-15T09:00:00Z"),
            url="https://jira.shopledger.io/browse/SL-287",
            title="Add currency code support to payments table",
            body="Extend the payments table to support multiple currencies. Add currency_code column and update all payment processing logic.",
            raw={"key": "SL-287", "status": "Done", "assignee": "Priya Nair"},
            acl_tag="readable",
        ),
        Artifact(
            case_id=cid, source="jira", source_mode=SourceMode.FIXTURE,
            type=ArtifactType.JIRA_TICKET, external_id="SL-456",
            author_id=priya.id, occurred_at=_dt("2024-10-15T11:00:00Z"),
            url="https://jira.shopledger.io/browse/SL-456",
            title="Implement webhook retry logic for payment notifications",
            body="When payment webhook notifications fail, they should be retried with exponential backoff. Maximum 5 retries over 24 hours.",
            raw={"key": "SL-456", "status": "In Progress", "assignee": "Priya Nair"},
            acl_tag="readable",
        ),
        Artifact(
            case_id=cid, source="jira", source_mode=SourceMode.FIXTURE,
            type=ArtifactType.JIRA_TICKET, external_id="SL-412",
            author_id=priya.id, occurred_at=_dt("2024-10-10T13:00:00Z"),
            url="https://jira.shopledger.io/browse/SL-412",
            title="Upgrade PostgreSQL to version 15",
            body="Database upgrade needed for better performance and security patches. Planned for Q4.",
            raw={"key": "SL-412", "status": "To Do", "assignee": "Priya Nair"},
            acl_tag="readable",
        ),
    ]

    # Docs
    docs = [
        Artifact(
            case_id=cid, source="docs", source_mode=SourceMode.FIXTURE,
            type=ArtifactType.DOCUMENT, external_id="README.md",
            author_id=None, occurred_at=_dt("2024-09-01T00:00:00Z"),
            url="", title="README.md",
            body="# ShopLedger API\n\nPayment processing backend for the ShopLedger platform.\n\n## Setup\n\nRequires Node 18+, PostgreSQL 14+.\n\n## Environment Variables\n\n- `DATABASE_URL`: PostgreSQL connection string\n- `JWT_SECRET`: Secret key for token signing\n- `STRIPE_API_KEY`: Stripe payment gateway key\n\n## Running\n\n```bash\nnpm install\nnpm run dev\n```",
            raw={"path": "README.md"},
            acl_tag="readable",
        ),
        Artifact(
            case_id=cid, source="docs", source_mode=SourceMode.FIXTURE,
            type=ArtifactType.DOCUMENT, external_id="API.md",
            author_id=None, occurred_at=_dt("2024-09-01T00:00:00Z"),
            url="", title="API.md",
            body="# ShopLedger API Reference\n\n## Payments\n\n`POST /payments` – Create a payment\n`GET /payments/:id` – Get payment status\n`POST /payments/:id/refund` – Issue refund\n\n## Auth\n\n`POST /auth/login` – Returns JWT token (expires 2h)\n`POST /auth/refresh` – Refresh JWT token\n\n## Webhooks\n\nWebhooks are sent to your configured endpoint on payment status changes.",
            raw={"path": "API.md"},
            acl_tag="readable",
        ),
    ]

    all_artifacts = commits + prs + slacks + jiras + docs
    session.add_all(all_artifacts)
    await session.flush()

    # convenience refs
    commit_a1 = commits[0]  # JWT fix commit
    commit_b2 = commits[1]  # currency migration commit
    commit_c3 = commits[2]  # revert commit
    commit_d4 = commits[3]  # WIP webhook
    pr_42     = prs[0]
    pr_47     = prs[1]
    slack_jwt = slacks[0]   # JWT still broken msg
    slack_rev = slacks[2]   # revert msg
    slack_env = slacks[4]   # env vars msg
    jira_234  = jiras[0]
    jira_287  = jiras[1]
    jira_456  = jiras[2]
    jira_412  = jiras[3]

    # ===================================================================
    # 4. COMPONENTS + KNOWLEDGE SCORES
    # ===================================================================
    comp_auth = Component(
        case_id=cid, name="Auth Service",
        path_globs='["src/auth/**", "src/middleware/auth*"]',
        criticality=0.9,
    )
    comp_pay = Component(
        case_id=cid, name="Payment Processor",
        path_globs='["src/payments/**", "db/migrations/**"]',
        criticality=0.95,
    )
    comp_report = Component(
        case_id=cid, name="Reporting Module",
        path_globs='["src/reports/**", "scripts/nightly*"]',
        criticality=0.6,
    )
    session.add_all([comp_auth, comp_pay, comp_report])
    await session.flush()

    scores = [
        # Priya knows Auth deeply
        KnowledgeScore(component_id=comp_auth.id, person_id=priya.id, score=0.88,
                       breakdown={"edits": 0.45, "reviews": 0.25, "discussion": 0.18}),
        KnowledgeScore(component_id=comp_auth.id, person_id=alex.id,  score=0.42,
                       breakdown={"edits": 0.20, "reviews": 0.18, "discussion": 0.04}),
        KnowledgeScore(component_id=comp_auth.id, person_id=sam.id,   score=0.15,
                       breakdown={"edits": 0.05, "reviews": 0.08, "discussion": 0.02}),
        # Priya is sole owner of Payment Processor
        KnowledgeScore(component_id=comp_pay.id, person_id=priya.id, score=0.92,
                       breakdown={"edits": 0.60, "reviews": 0.20, "discussion": 0.12}),
        KnowledgeScore(component_id=comp_pay.id, person_id=alex.id,  score=0.28,
                       breakdown={"edits": 0.15, "reviews": 0.10, "discussion": 0.03}),
        KnowledgeScore(component_id=comp_pay.id, person_id=sam.id,   score=0.10,
                       breakdown={"edits": 0.03, "reviews": 0.06, "discussion": 0.01}),
        # Reporting is a black box
        KnowledgeScore(component_id=comp_report.id, person_id=priya.id, score=0.75,
                       breakdown={"edits": 0.50, "reviews": 0.15, "discussion": 0.10}),
        KnowledgeScore(component_id=comp_report.id, person_id=alex.id,  score=0.08,
                       breakdown={"edits": 0.03, "reviews": 0.04, "discussion": 0.01}),
        KnowledgeScore(component_id=comp_report.id, person_id=sam.id,   score=0.05,
                       breakdown={"edits": 0.02, "reviews": 0.02, "discussion": 0.01}),
    ]
    session.add_all(scores)
    await session.flush()

    # ===================================================================
    # 5. FINDINGS
    # ===================================================================
    f1 = Finding(
        case_id=cid, kind=FindingKind.CONTRADICTION, severity=0.9, confidence=0.9,
        title="SL-234 marked Done but JWT expiry still broken in production",
        summary=(
            "Jira ticket SL-234 (Fix JWT token expiry) was resolved on 2024-10-08, "
            "but a Slack thread from the same day shows users still getting logged out "
            "after 15 minutes. The fix was deployed but something downstream is still "
            "overriding the 2-hour TTL. The root cause is unknown to the remaining team."
        ),
        evidence=[
            {"artifact_id": str(jira_234.id), "span": "status: Done, resolved: 2024-10-08", "role": "ticket_done"},
            {"artifact_id": str(slack_jwt.id), "span": "JWT token expiry issue is still happening", "role": "contradiction"},
            {"artifact_id": str(commit_a1.id), "span": "update auth service config", "role": "fix_commit"},
        ],
        status=FindingStatus.OPEN,
    )

    f2 = Finding(
        case_id=cid, kind=FindingKind.CONTRADICTION, severity=0.85, confidence=0.9,
        title="SL-287 marked Done but migration was reverted same day",
        summary=(
            "Jira ticket SL-287 shows status Done (resolved 2024-10-14), but a Slack message "
            "from that evening confirms the migration was reverted due to foreign key constraint "
            "violations. A fixed version exists on a branch but was never merged or deployed."
        ),
        evidence=[
            {"artifact_id": str(jira_287.id), "span": "status: Done, resolved: 2024-10-14", "role": "ticket_done"},
            {"artifact_id": str(slack_rev.id), "span": "Had to revert the database migration", "role": "revert"},
            {"artifact_id": str(commit_c3.id), "span": "Revert: Add currency_code column", "role": "revert_commit"},
        ],
        status=FindingStatus.OPEN,
    )

    f3 = Finding(
        case_id=cid, kind=FindingKind.INFLIGHT, severity=0.8, confidence=1.0,
        title="Webhook retry logic (SL-456) is in-progress and unfinished",
        summary=(
            "PR #47 and Jira SL-456 show active work on payment webhook retry logic with "
            "exponential backoff. The implementation is partial — retry queue and backoff "
            "calculator are done, but integration tests and dead-letter queue are missing. "
            "No other team member has context on this work."
        ),
        evidence=[
            {"artifact_id": str(jira_456.id), "span": "status: In Progress", "role": "ticket"},
            {"artifact_id": str(pr_47.id),    "span": "WIP: Webhook retry logic", "role": "open_pr"},
            {"artifact_id": str(commit_d4.id),"span": "WIP: webhook retry with exponential backoff", "role": "wip_commit"},
        ],
        status=FindingStatus.OPEN,
    )

    f4 = Finding(
        case_id=cid, kind=FindingKind.HIDDEN_DEPENDENCY, severity=0.7, confidence=0.95,
        title="Nightly report job requires REPORT_BUCKET_NAME and SMTP_RELAY_HOST — not in docs",
        summary=(
            "A Slack message from Priya reveals the nightly report generation cron job "
            "depends on two environment variables (REPORT_BUCKET_NAME, SMTP_RELAY_HOST) "
            "that appear nowhere in README.md, API.md, or deployment docs. If these are "
            "not configured on the new team's infrastructure, the job will silently fail."
        ),
        evidence=[
            {"artifact_id": str(slack_env.id), "span": "REPORT_BUCKET_NAME and SMTP_RELAY_HOST environment variables", "role": "source"},
        ],
        status=FindingStatus.OPEN,
    )

    f5 = Finding(
        case_id=cid, kind=FindingKind.INFLIGHT, severity=0.5, confidence=1.0,
        title="PostgreSQL 15 upgrade (SL-412) not started — owned solely by Priya",
        summary=(
            "SL-412 (Upgrade PostgreSQL to version 15) is assigned to Priya with status "
            "'To Do'. No design doc, branch, or runbook exists. The upgrade will be blocked "
            "indefinitely unless reassigned with context."
        ),
        evidence=[
            {"artifact_id": str(jira_412.id), "span": "status: To Do, assignee: Priya Nair", "role": "ticket"},
        ],
        status=FindingStatus.OPEN,
    )

    session.add_all([f1, f2, f3, f4, f5])
    await session.flush()

    # ===================================================================
    # 6. INTERVIEW QUESTIONS
    # ===================================================================
    questions = [
        InterviewQuestion(
            case_id=cid, finding_id=f1.id, priority=0.95,
            text=(
                "SL-234 (Fix JWT token expiry) is marked Done on Jira, but Slack shows "
                "users were still being logged out after 15 minutes. What was the actual "
                "root cause, and was it fully resolved?"
            ),
            evidence=[
                {"artifact_id": str(jira_234.id), "role": "ticket"},
                {"artifact_id": str(slack_jwt.id), "role": "contradiction"},
            ],
            status=QuestionStatus.DRAFT,
        ),
        InterviewQuestion(
            case_id=cid, finding_id=f2.id, priority=0.92,
            text=(
                "The currency_code migration was reverted on Oct 14 due to FK constraint violations. "
                "You mentioned a fixed version on a branch — what branch is it, what's different, "
                "and what are the deployment steps?"
            ),
            evidence=[
                {"artifact_id": str(slack_rev.id), "role": "source"},
                {"artifact_id": str(commit_c3.id), "role": "revert_commit"},
            ],
            status=QuestionStatus.DRAFT,
        ),
        InterviewQuestion(
            case_id=cid, finding_id=f3.id, priority=0.88,
            text=(
                "PR #47 (webhook retry logic) is a draft with missing integration tests and "
                "dead-letter queue. What's the intended architecture — where does the retry "
                "queue live, and what happens after the 5th retry?"
            ),
            evidence=[
                {"artifact_id": str(pr_47.id),    "role": "open_pr"},
                {"artifact_id": str(commit_d4.id), "role": "wip_commit"},
            ],
            status=QuestionStatus.DRAFT,
        ),
        InterviewQuestion(
            case_id=cid, finding_id=f4.id, priority=0.80,
            text=(
                "The nightly report job needs REPORT_BUCKET_NAME and SMTP_RELAY_HOST. "
                "Where are these configured currently (AWS Secrets Manager, .env, CI)? "
                "Who is the owner of the SMTP relay account?"
            ),
            evidence=[
                {"artifact_id": str(slack_env.id), "role": "source"},
            ],
            status=QuestionStatus.DRAFT,
        ),
        InterviewQuestion(
            case_id=cid, finding_id=f5.id, priority=0.65,
            text=(
                "SL-412 (PostgreSQL 15 upgrade) hasn't started. Are there any blockers, "
                "runbooks, or migration notes you've drafted? Is the upgrade compatible "
                "with the current ORM version?"
            ),
            evidence=[
                {"artifact_id": str(jira_412.id), "role": "ticket"},
            ],
            status=QuestionStatus.DRAFT,
        ),
    ]
    session.add_all(questions)
    await session.flush()

    # ===================================================================
    # 7. HANDOVER ITEMS
    # ===================================================================
    handover_items = [
        HandoverItem(
            case_id=cid, section="In-Flight Work",
            text=(
                "**Webhook retry logic (SL-456)** – PR #47 is a draft. Retry queue and "
                "backoff calculator are implemented in `src/payments/webhook_retry.ts` and "
                "`src/payments/backoff.ts`. Missing: integration tests, dead-letter queue. "
                "Max 5 retries over 24 hours per original spec."
            ),
            evidence_ids=[str(jira_456.id), str(pr_47.id)],
            provenance=Provenance.INFERRED,
            confidence=0.95,
        ),
        HandoverItem(
            case_id=cid, section="In-Flight Work",
            text=(
                "**PostgreSQL 15 upgrade (SL-412)** – Not started. No runbook exists. "
                "Assess ORM compatibility before proceeding. Recommended: dry-run on staging first."
            ),
            evidence_ids=[str(jira_412.id)],
            provenance=Provenance.INFERRED,
            confidence=0.90,
        ),
        HandoverItem(
            case_id=cid, section="Known Issues",
            text=(
                "**JWT token expiry (SL-234)** – Marked Done but may still be incomplete. "
                "Verify that sessions last 2 hours end-to-end in production, including after "
                "token refresh. Check for middleware that overrides TTL."
            ),
            evidence_ids=[str(jira_234.id), str(slack_jwt.id)],
            provenance=Provenance.INFERRED,
            confidence=0.85,
        ),
        HandoverItem(
            case_id=cid, section="Pending Deployments",
            text=(
                "**Currency code migration** – The original migration (Oct 14) was reverted. "
                "A fixed version exists on a branch (ask Priya for branch name). Migration must "
                "backfill `currency_code = 'USD'` for existing rows before adding NOT NULL constraint."
            ),
            evidence_ids=[str(jira_287.id), str(slack_rev.id), str(commit_c3.id)],
            provenance=Provenance.STATED,
            confidence=0.90,
        ),
        HandoverItem(
            case_id=cid, section="Environment & Ops",
            text=(
                "**Nightly report cron** – Runs at 02:00 UTC. Requires two undocumented env vars:\n"
                "- `REPORT_BUCKET_NAME` – S3 bucket for report output\n"
                "- `SMTP_RELAY_HOST` – SMTP server for email delivery\n"
                "These are not in README or deployment docs. Confirm values with DevOps."
            ),
            evidence_ids=[str(slack_env.id)],
            provenance=Provenance.STATED,
            confidence=0.95,
        ),
        HandoverItem(
            case_id=cid, section="Architecture",
            text=(
                "**Auth Service** – JWT tokens are signed with `JWT_SECRET` (env var). "
                "Token TTL is set in `src/auth/auth.config.ts`. Refresh endpoint is "
                "`POST /auth/refresh`. Sessions should persist for 2 hours."
            ),
            evidence_ids=[str(pr_42.id), str(commit_a1.id)],
            provenance=Provenance.VERIFIED,
            confidence=0.88,
        ),
    ]
    session.add_all(handover_items)
    await session.flush()

    await session.commit()
    logger.info(f"Demo seed complete: case_id={cid}")

    return {
        "case_id": str(cid),
        "case_name": case.name,
        "persons": 3,
        "artifacts": len(all_artifacts),
        "components": 3,
        "findings": 5,
        "questions": 5,
        "handover_items": len(handover_items),
    }

