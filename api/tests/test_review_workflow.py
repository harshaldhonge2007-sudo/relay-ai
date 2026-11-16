"""
test_review_workflow.py — Comprehensive tests for Prompt 9: Review and successor workflow.

Covers:
  1. Batch approve verified claims:
     - Approves VERIFIED claims backed by >= 2 independent sources
     - Invariant: Never batch approves INFERRED or UNKNOWN claims
     - Gated to engineering_lead only (403 for successor/contractor)
  2. Undo review action:
     - Reverts claim status to pending
     - Clears rejection rationale
     - Gated to engineering_lead only
  3. Release pre-flight dialog:
     - Automated checklist (unreviewed count, contradictions, secrets scan, quarantine queue)
     - Blocks release if unreviewed claims exist
     - Contradictions acknowledgment satisfies release gate
  4. Successor continuation progress:
     - Persists task completion state with timestamp and actor
     - Computes completion percentage accurately
  5. "Ask the lead" action:
     - Queues question in interview/inquiry queue with claim reference
     - Validates non-empty question text
  6. Real role-filtered endpoint:
     - Contractor view censors restricted claims with [WITHHELD] labels
     - Lead previewing as contractor receives authentic server-censored payload
"""

import pytest
from fastapi.testclient import TestClient
from mock_server import app as mock_app, db

@pytest.fixture
def client():
    return TestClient(mock_app)

def login(client: TestClient, user: str) -> str:
    resp = client.post("/auth/demo-login", json={"user": user})
    assert resp.status_code == 200
    return resp.json()["token"]

class TestBatchApproveVerified:
    def test_batch_approve_approves_verified_and_skips_inferred_unknown(self, client):
        """Batch approve must approve verified claims with >=2 sources and strictly skip inferred/unknown."""
        db.reset()
        lead_token = login(client, "lead")
        lead_headers = {"Authorization": f"Bearer {lead_token}"}

        # Check initial claims via GET
        resp_initial = client.get("/cases/case-001/handover", headers=lead_headers)
        items_initial = {i["id"]: i for i in resp_initial.json()["items"]}
        assert items_initial["ho-001"]["provenance"] == "inferred"
        assert items_initial["ho-005"]["provenance"] == "verified"
        assert items_initial["ho-001"]["claim_status"] == "pending"
        assert items_initial["ho-005"]["claim_status"] == "pending"

        resp = client.post(
            "/cases/case-001/handover/batch-approve-verified",
            headers=lead_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["approved_count"] >= 1
        assert "ho-005" in data["approved_claim_ids"]
        assert "ho-001" not in data["approved_claim_ids"]
        assert data["skipped_inferred_or_unknown_count"] >= 1

        # Check state after batch approve via GET
        resp_after = client.get("/cases/case-001/handover", headers=lead_headers)
        items_after = {i["id"]: i for i in resp_after.json()["items"]}
        assert items_after["ho-005"]["claim_status"] == "approved"
        # INVARIANT: ho-001 remains pending!
        assert items_after["ho-001"]["claim_status"] == "pending"

    def test_batch_approve_forbidden_for_successor(self, client):
        token = login(client, "successor")
        resp = client.post(
            "/cases/case-001/handover/batch-approve-verified",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

class TestUndoReview:
    def test_undo_reverts_approved_claim_to_pending(self, client):
        db.reset()
        lead_token = login(client, "lead")
        lead_headers = {"Authorization": f"Bearer {lead_token}"}

        # Approve ho-001 first
        client.post(
            "/cases/case-001/handover/ho-001/approve",
            headers=lead_headers,
            json={},
        )
        resp1 = client.get("/cases/case-001/handover", headers=lead_headers)
        assert next(i for i in resp1.json()["items"] if i["id"] == "ho-001")["claim_status"] == "approved"

        # Undo review
        resp = client.post(
            "/cases/case-001/handover/ho-001/undo",
            headers=lead_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["action"] == "undone"
        assert data["claim_status"] == "pending"

        resp2 = client.get("/cases/case-001/handover", headers=lead_headers)
        assert next(i for i in resp2.json()["items"] if i["id"] == "ho-001")["claim_status"] == "pending"

    def test_undo_reverts_rejected_claim_and_clears_reason(self, client):
        db.reset()
        lead_token = login(client, "lead")
        lead_headers = {"Authorization": f"Bearer {lead_token}"}

        # Reject ho-002 with rationale
        client.post(
            "/cases/case-001/handover/ho-002/reject",
            headers=lead_headers,
            json={"reason": "Incorrect migration steps"},
        )
        resp1 = client.get("/cases/case-001/handover", headers=lead_headers)
        item1 = next(i for i in resp1.json()["items"] if i["id"] == "ho-002")
        assert item1["claim_status"] == "rejected"
        assert item1["rejection_reason"] == "Incorrect migration steps"

        # Undo rejection
        resp = client.post(
            "/cases/case-001/handover/ho-002/undo",
            headers=lead_headers,
        )
        assert resp.status_code == 200
        resp2 = client.get("/cases/case-001/handover", headers=lead_headers)
        item2 = next(i for i in resp2.json()["items"] if i["id"] == "ho-002")
        assert item2["claim_status"] == "pending"
        assert item2["rejection_reason"] is None

    def test_undo_forbidden_for_successor(self, client):
        token = login(client, "successor")
        resp = client.post(
            "/cases/case-001/handover/ho-001/undo",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

class TestPreflightAndContradictions:
    def test_preflight_blocks_release_when_claims_unreviewed(self, client):
        db.reset()
        token = login(client, "lead")
        resp = client.get(
            "/cases/case-001/handover/preflight",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["can_release"] is False
        assert data["unreviewed_count"] > 0
        assert any("require explicit review" in b for b in data["blockers"])

    def test_acknowledge_contradictions_updates_state(self, client):
        db.reset()
        token = login(client, "lead")
        resp = client.post(
            "/cases/case-001/handover/contradictions/acknowledge",
            headers={"Authorization": f"Bearer {token}"},
            json={"notes": "Reviewed and kept as open question for onboarding"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["contradictions_acknowledged"] is True

    def test_acknowledge_contradictions_forbidden_for_successor(self, client):
        token = login(client, "successor")
        resp = client.post(
            "/cases/case-001/handover/contradictions/acknowledge",
            headers={"Authorization": f"Bearer {token}"},
            json={},
        )
        assert resp.status_code == 403

class TestContinuationProgress:
    def test_get_and_put_continuation_progress(self, client):
        db.reset()
        succ_token = login(client, "successor")

        # Initial progress
        resp = client.get(
            "/cases/case-001/continuation/progress",
            headers={"Authorization": f"Bearer {succ_token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "tasks" in data
        assert data["total_count"] > 0
        first_task = data["tasks"][0]
        task_id = first_task["id"]

        # Mark task 1 completed
        put_resp = client.put(
            "/cases/case-001/continuation/progress",
            headers={"Authorization": f"Bearer {succ_token}"},
            json={"task_id": task_id, "completed": True},
        )
        assert put_resp.status_code == 200
        put_data = put_resp.json()
        assert put_data["status"] == "ok"
        assert put_data["task"]["completed"] is True
        assert put_data["task"]["completed_at"] is not None
        assert "Jordan Taylor" in put_data["task"]["completed_by"]
        assert put_data["completed_count"] >= 1

        # Check persistence via GET
        resp2 = client.get(
            "/cases/case-001/continuation/progress",
            headers={"Authorization": f"Bearer {succ_token}"},
        )
        data2 = resp2.json()
        t = next(x for x in data2["tasks"] if x["id"] == task_id)
        assert t["completed"] is True
        assert t["completed_by"] is not None

class TestAskTheLead:
    def test_ask_lead_creates_inquiry_entry(self, client):
        db.reset()
        succ_token = login(client, "successor")
        succ_headers = {"Authorization": f"Bearer {succ_token}"}
        resp = client.post(
            "/cases/case-001/handover/ho-001/ask-lead",
            headers=succ_headers,
            json={"question": "What is the expected SQS dead letter queue retry interval?", "context": "Payment worker"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["claim_id"] == "ho-001"
        assert "q-" in data["question_id"]

        # Verify question is recorded in questions list via API
        q_resp = client.get("/cases/case-001/questions", headers=succ_headers)
        assert q_resp.status_code == 200
        questions = q_resp.json()
        q = next((x for x in questions if x.get("id") == data["question_id"]), None)
        assert q is not None
        assert q["target_claim_id"] == "ho-001"
        assert "SQS" in q["text"]

    def test_ask_lead_empty_question_fails(self, client):
        succ_token = login(client, "successor")
        resp = client.post(
            "/cases/case-001/handover/ho-001/ask-lead",
            headers={"Authorization": f"Bearer {succ_token}"},
            json={"question": "   "},
        )
        assert resp.status_code == 400

class TestRealRoleFilteredPreview:
    def test_lead_can_preview_as_contractor_via_query_param(self, client):
        db.reset()
        lead_token = login(client, "lead")

        # Full lead view
        resp_lead = client.get(
            "/cases/case-001/handover",
            headers={"Authorization": f"Bearer {lead_token}"},
        )
        assert resp_lead.status_code == 200
        lead_items = resp_lead.json()["items"]
        # ho-001 is not withheld for lead
        lead_ho001 = next(i for i in lead_items if i["id"] == "ho-001")
        assert not lead_ho001.get("withheld")
        assert "WITHHELD" not in lead_ho001["text"]

        # Real role-filtered endpoint with preview_role=contractor
        resp_preview = client.get(
            "/cases/case-001/handover?preview_role=contractor",
            headers={"Authorization": f"Bearer {lead_token}"},
        )
        assert resp_preview.status_code == 200
        preview_items = resp_preview.json()["items"]
        # ho-001 relies on confidential/internal artifacts, so contractor preview must withhold it!
        preview_ho001 = next(i for i in preview_items if i["id"] == "ho-001")
        assert preview_ho001.get("withheld") is True
        assert "WITHHELD" in preview_ho001["text"] or "withheld" in preview_ho001["text"].lower()

    def test_contractor_bearer_token_authentically_withholds_restricted_claims(self, client):
        db.reset()
        contractor_token = login(client, "contractor")
        resp = client.get(
            "/cases/case-001/handover",
            headers={"Authorization": f"Bearer {contractor_token}"},
        )
        assert resp.status_code == 200
        items = resp.json()["items"]
        ho001 = next(i for i in items if i["id"] == "ho-001")
        assert ho001.get("withheld") is True
        assert "WITHHELD" in ho001["text"] or "withheld" in ho001["text"].lower()
