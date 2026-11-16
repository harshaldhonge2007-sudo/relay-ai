"""
Unit and integration tests for Prompt 7: Close the brief's explicit gaps.
Covers:
1. Recurring Problems Detector (deterministic clustering, provenance corroboration, 4 failure categories).
2. Key Contacts Resolver ('Who to Ask' by component, leaver exclusion, CODEOWNERS, STATED contacts, no-remaining-owner warning, role gating).
3. Version History UI support (word-level diff, change types, immutable snapshot restore-as-draft, lead role gating).
4. PDF Export integration (renders recurring problems, component contacts, first 5 days plan).
"""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from mock_server import app as mock_app
from app.detect.recurring import cluster_recurring_problems
from app.risk.contacts import resolve_component_contacts
from app.export.pdf import HandoverPDFBuilder


client = TestClient(mock_app)


def _login(role: str) -> str:
    res = client.post("/auth/demo-login", json={"user": role})
    assert res.status_code == 200
    return res.json()["token"]


# =============================================================================
# 1. RECURRING PROBLEMS DETECTOR TESTS
# =============================================================================

class TestRecurringProblemsDetector:
    def test_churn_clustering_with_corroboration(self):
        """Code churn with 3 fix commits and slack discussion produces VERIFIED problem card."""
        artifacts = [
            {
                "id": "c1",
                "source": "github",
                "type": "commit",
                "title": "Fix auth race condition in auth.config.ts",
                "occurred_at": "2024-10-01T10:00:00Z",
                "raw": {"files": ["src/auth/auth.config.ts"]},
            },
            {
                "id": "c2",
                "source": "github",
                "type": "commit",
                "title": "Hotfix: token timeout patch in auth.config.ts",
                "occurred_at": "2024-10-05T12:00:00Z",
                "raw": {"files": ["src/auth/auth.config.ts"]},
            },
            {
                "id": "c3",
                "source": "github",
                "type": "commit",
                "title": "Bugfix: session expiry header in auth.config.ts",
                "occurred_at": "2024-10-08T15:00:00Z",
                "raw": {"files": ["src/auth/auth.config.ts"]},
            },
            {
                "id": "s1",
                "source": "slack",
                "type": "slack_message",
                "title": "#engineering discussion",
                "body": "auth.config.ts changes deployed but users are still timing out.",
                "occurred_at": "2024-10-08T16:00:00Z",
            },
        ]
        problems = cluster_recurring_problems(artifacts)
        assert len(problems) >= 1
        churn_card = next((p for p in problems if p["category"] == "code_churn"), None)
        assert churn_card is not None
        assert churn_card["frequency"] == 3
        assert churn_card["component"] == "Auth Service"
        assert churn_card["provenance"] == "VERIFIED"  # 2 sources: github + slack
        assert "auth.config.ts" in churn_card["title"]
        assert "c1" in churn_card["evidence_ids"]
        assert "s1" in churn_card["evidence_ids"]

    def test_revert_clustering_churn(self):
        """Revert commit creates churn card even with 2 commits."""
        artifacts = [
            {
                "id": "c1",
                "source": "github",
                "type": "commit",
                "title": "Add currency_code column to payments table",
                "occurred_at": "2024-10-14T14:00:00Z",
                "raw": {"files": ["db/migrations/20241014_add_currency_code.sql"]},
            },
            {
                "id": "c2",
                "source": "github",
                "type": "commit",
                "title": "Revert: Add currency_code column to payments table",
                "occurred_at": "2024-10-14T18:00:00Z",
                "raw": {"files": ["db/migrations/20241014_add_currency_code.sql"]},
            },
        ]
        problems = cluster_recurring_problems(artifacts)
        churn = next((p for p in problems if p["category"] == "code_churn"), None)
        assert churn is not None
        assert churn["provenance"] == "INFERRED"  # only 1 source (github)

    def test_reopened_jira_bug(self):
        """Reopened ticket corroborated by slack discussion is marked VERIFIED."""
        artifacts = [
            {
                "id": "j1",
                "source": "jira",
                "type": "jira_ticket",
                "title": "Fix JWT token expiry",
                "body": "Users premature timeout after 15 minutes. Reopened bug.",
                "occurred_at": "2024-10-08T10:00:00Z",
                "raw": {"key": "SL-234", "status": "Reopened"},
            },
            {
                "id": "s1",
                "source": "slack",
                "type": "slack_message",
                "title": "Thread on SL-234",
                "body": "SL-234 was reopened because production is still seeing 15-minute logouts.",
                "occurred_at": "2024-10-08T12:00:00Z",
            },
        ]
        problems = cluster_recurring_problems(artifacts)
        jira_prob = next((p for p in problems if p["category"] == "reopened_bug"), None)
        assert jira_prob is not None
        assert jira_prob["provenance"] == "VERIFIED"
        assert "SL-234" in jira_prob["title"]

    def test_flaky_test_pattern(self):
        """Flaky test mentions across commits or slack are clustered."""
        artifacts = [
            {
                "id": "c1",
                "source": "github",
                "type": "commit",
                "title": "CI: retry flaky test test_payment_webhook_retry",
                "body": "Intermittent failure in CI test suite due to timer race.",
                "occurred_at": "2024-10-15T10:00:00Z",
            }
        ]
        problems = cluster_recurring_problems(artifacts)
        flaky = next((p for p in problems if p["category"] == "flaky_test"), None)
        assert flaky is not None
        assert flaky["category"] == "flaky_test"
        assert "Quarantine" in flaky["suggested_action"]

    def test_seeded_case_recurring_problems_endpoint(self):
        """The /cases/{case_id}/recurring-problems endpoint returns clusters on ShopLedger."""
        token = _login("engineering_lead")
        res = client.get("/cases/case-001/recurring-problems", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        probs = res.json()
        assert len(probs) >= 3
        categories = {p["category"] for p in probs}
        assert "code_churn" in categories
        assert "repeated_incident" in categories


# =============================================================================
# 2. KEY CONTACTS ("WHO TO ASK") TESTS
# =============================================================================

class TestKeyContactsResolver:
    def test_leaver_is_strictly_excluded(self):
        """Priya Nair is excluded from remaining ownership."""
        people = [
            {"id": "p1", "name": "Priya Nair", "is_leaver": True, "role": "Staff Engineer"},
            {"id": "p2", "name": "Alex Chen", "is_leaver": False, "role": "Engineering Lead", "slack": "@alex"},
        ]
        components = [{"id": "c1", "name": "Auth Service"}]
        k_scores = [
            {"component_id": "c1", "person_id": "p1", "score": 0.85},
            {"component_id": "c1", "person_id": "p2", "score": 0.65},
        ]
        result = resolve_component_contacts(components, people, k_scores)
        comp = result[0]
        contact_names = [c["name"] for c in comp["contacts"]]
        assert "Priya Nair" not in contact_names
        assert "Alex Chen" in contact_names

    def test_codeowners_marked_verified(self):
        """CODEOWNERS contact is assigned VERIFIED provenance."""
        people = [
            {"id": "p2", "name": "Alex Chen", "is_leaver": False, "role": "Engineering Lead", "slack": "@alex"},
        ]
        components = [{"id": "c1", "name": "Auth Service"}]
        result = resolve_component_contacts(components, people)
        alex_contact = next((c for c in result[0]["contacts"] if c["name"] == "Alex Chen"), None)
        assert alex_contact is not None
        assert alex_contact["provenance"] == "VERIFIED"
        assert alex_contact["source"] == "codeowners"

    def test_leaver_stated_interview_contact_marked_stated(self):
        """Contacts explicitly designated by leaver in interview are marked STATED."""
        people = [
            {"id": "p3", "name": "Sam Rodriguez", "is_leaver": False, "role": "DevOps", "slack": "@sam"},
        ]
        components = [{"id": "c2", "name": "Reporting Module"}]
        interviews = [
            {
                "question": "Who owns the nightly cron jobs and reporting?",
                "answer": "Sam Rodriguez handles all SMTP relay configuration and cron setup.",
            }
        ]
        result = resolve_component_contacts(components, people, interview_answers=interviews)
        sam_contact = next((c for c in result[0]["contacts"] if c["name"] == "Sam Rodriguez"), None)
        assert sam_contact is not None
        assert sam_contact["provenance"] == "STATED"
        assert sam_contact["source"] == "interview"

    def test_no_remaining_owner_warning(self):
        """A component whose only knowledge was with the leaver generates a critical warning."""
        people = [
            {"id": "p1", "name": "Priya Nair", "is_leaver": True, "role": "Staff Engineer"},
            {"id": "p2", "name": "Alex Chen", "is_leaver": False, "role": "Engineering Lead"},
        ]
        components = [{"id": "c3", "name": "Database & Migrations"}]
        # Only Priya had knowledge; Alex has 0
        k_scores = [{"component_id": "c3", "person_id": "p1", "score": 1.0}]
        result = resolve_component_contacts(components, people, k_scores)
        comp = result[0]
        assert comp["has_remaining_owner"] is False
        assert "No remaining owner" in comp["warning"]
        assert "Priya Nair" in comp["warning"]

    def test_contractor_role_sanitization(self):
        """Contractor role does not receive confidential vendor SLA PIN or emergency contracts."""
        people = [{"id": "p2", "name": "Alex Chen", "is_leaver": False, "slack": "@alex"}]
        components = [{"id": "c1", "name": "Payment Processor"}]
        lead_result = resolve_component_contacts(components, people, role="engineering_lead")
        lead_vendor = next(c for c in lead_result[0]["contacts"] if c["contact_type"] == "external_vendor")
        assert "confidential_detail" in lead_vendor

        contractor_result = resolve_component_contacts(components, people, role="contractor")
        contractor_vendor = next(c for c in contractor_result[0]["contacts"] if c["contact_type"] == "external_vendor")
        assert "confidential_detail" not in contractor_vendor


# =============================================================================
# 3. VERSION HISTORY, WORD-LEVEL DIFF & RESTORE-AS-DRAFT TESTS
# =============================================================================

class TestVersionHistoryAndDiff:
    def test_diff_word_level_tokens(self):
        """Handover diff produces word-level token additions and deletions."""
        token = _login("engineering_lead")
        res = client.get("/cases/case-001/handover/diff?v1=1&v2=1", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        data = res.json()
        assert "diff" in data
        assert "audit_log_url" in data
        for entry in data["diff"]:
            assert "word_diff" in entry
            assert "change_type" in entry

    def test_restore_as_draft_lead_only(self):
        """Successor cannot restore draft; Lead creates a new draft version without overwriting."""
        succ_token = _login("successor")
        res = client.post("/cases/case-001/handover/versions/1/restore-as-draft", headers={"Authorization": f"Bearer {succ_token}"})
        assert res.status_code == 403

        lead_token = _login("engineering_lead")
        res = client.post("/cases/case-001/handover/versions/1/restore-as-draft", headers={"Authorization": f"Bearer {lead_token}"})
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "restored"
        assert body["source_version"] == 1
        assert body["new_version"] >= 2
        assert "Restored as new draft" in body["change_summary"]

    def test_handover_payload_contains_gaps_features(self):
        """GET /cases/{id}/handover returns recurring_problems and key_contacts."""
        token = _login("successor")
        res = client.get("/cases/case-001/handover", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        doc = res.json()
        assert "recurring_problems" in doc
        assert "key_contacts" in doc
        assert "continuation" in doc
        assert len(doc["recurring_problems"]) > 0
        assert len(doc["key_contacts"]) > 0


# =============================================================================
# 4. PDF EXPORT INTEGRATION TESTS
# =============================================================================

class TestPDFExportIntegration:
    def test_pdf_generation_includes_gaps_content(self):
        """HandoverPDFBuilder generates valid PDF with contacts, recurring problems, and plan."""
        builder = HandoverPDFBuilder()
        contacts = [
            {
                "component_name": "Auth Service",
                "has_remaining_owner": True,
                "warning": None,
                "contacts": [
                    {"name": "Alex Chen", "handle": "@alex", "role": "Lead", "provenance": "VERIFIED", "source": "codeowners", "notes": "Primary owner"},
                ],
            },
            {
                "component_name": "Database & Migrations",
                "has_remaining_owner": False,
                "warning": "No remaining owner: Priya Nair was sole knowledge holder.",
                "contacts": [],
            },
        ]
        recurring = [
            {
                "title": "Recurring Migration Revert Churn",
                "category": "code_churn",
                "component": "Database & Migrations",
                "frequency": 3,
                "provenance": "VERIFIED",
                "sources_corroborated": ["github", "slack"],
                "description": "Migration reverted due to foreign key constraints.",
                "suggested_action": "Freeze schema changes.",
            }
        ]
        continuation = {
            "first_5_days": [
                {"day": 1, "task": "Clone repo and start worker", "owner": "Alex Chen", "status": "pending"},
            ]
        }
        pdf_bytes = builder.build(
            case_name="ShopLedger Test",
            leaver_name="Priya Nair",
            repo_url="https://github.com/shopledger/api",
            handover_items=[{"id": "1", "section": "Architecture", "text": "Test claim", "provenance": "verified"}],
            contacts=contacts,
            recurring_problems=recurring,
            continuation=continuation,
        )
        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 1000
        assert pdf_bytes.startswith(b"%PDF")

    def test_export_pdf_endpoint_live(self):
        """The /cases/{case_id}/handover/export/pdf endpoint serves generated PDF bytes."""
        token = _login("engineering_lead")
        res = client.get("/cases/case-001/handover/export/pdf", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        assert res.headers["content-type"] == "application/pdf"
        assert len(res.content) > 1000
        assert res.content.startswith(b"%PDF")
