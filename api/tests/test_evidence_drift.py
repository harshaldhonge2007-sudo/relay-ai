"""
tests/test_evidence_drift.py — Prompt 12: Evidence Drift Detection & Living Handover Tests

Verifies:
1. Simulated ingestion event (e.g. SL-456's PR #47 merges after approval) flips dependent claim to stale.
2. Approved claim text is NEVER auto-edited.
3. Produces a re-review item for the engineering lead.
4. Lead action ('amend' / 'acknowledge') resolves drift and bumps the handover version to v2.
5. Successor sees 'update_available' ribbon when new version is released.
6. Role-based ACLs: contractor cannot resolve re-review queue and cannot view confidential drift.
7. Real GitHub webhook endpoint trigger.
8. Audit log records drift detection and lead resolution.
"""

import pytest
from fastapi.testclient import TestClient
from mock_server import app, db
from app.security.auth import sign_demo_token


@pytest.fixture
def client():
    # Fresh sandbox per test
    db.reset("test-drift")
    return TestClient(app)


def _auth(role: str) -> dict:
    key = "lead" if role in ("lead", "engineering_lead") else role
    res = sign_demo_token(key)
    return {"Authorization": f"Bearer {res['token']}"} if res else {}


class TestEvidenceDrift:
    def test_simulate_drift_flips_claim_to_stale(self, client):
        """Simulated PR #47 merge marks ho-001 as stale with diff."""
        # 1. Trigger simulated drift webhook
        resp = client.post(
            "/cases/case-001/webhooks/simulate-drift",
            headers=_auth("engineering_lead"),
            json={"pr_number": 47, "issue_key": "SL-456", "action": "closed", "merged": True},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["status"] == "drift_detected"
        assert "ho-001" in data["affected_claims"]
        assert data["badge"] == "Evidence changed since approval"
        assert data["living_memory_updated"] is True

        # 2. Check handover claims
        ho_resp = client.get("/cases/case-001/handover", headers=_auth("engineering_lead"))
        assert ho_resp.status_code == 200
        ho_data = ho_resp.json()
        items = ho_data.get("items", ho_data)
        ho_001 = next((i for i in items if i["id"] == "ho-001"), None)
        assert ho_001 is not None
        assert ho_001.get("is_stale") is True
        drift = ho_001.get("evidence_drift")
        assert drift is not None
        assert drift["badge"] == "Evidence changed since approval"
        assert "PR #47" in drift["diff"]
        assert "merged" in drift["diff"].lower()

    def test_approved_text_never_auto_edited(self, client):
        """In-flight approved text remains intact after drift event."""
        # Pre-capture original text
        orig_resp = client.get("/cases/case-001/handover", headers=_auth("engineering_lead"))
        orig_items = orig_resp.json().get("items", orig_resp.json())
        orig_ho_001 = next(i for i in orig_items if i["id"] == "ho-001")
        original_text = orig_ho_001["text"]

        # Trigger drift
        client.post("/cases/case-001/webhooks/simulate-drift", headers=_auth("engineering_lead"))

        # Post-check text
        post_resp = client.get("/cases/case-001/handover", headers=_auth("engineering_lead"))
        post_items = post_resp.json().get("items", post_resp.json())
        post_ho_001 = next(i for i in post_items if i["id"] == "ho-001")

        assert post_ho_001["text"] == original_text, "Approved text was auto-edited! Invariant violated."

    def test_re_review_queue_item_created_for_lead(self, client):
        """Drift generates a pending item in the re-review queue."""
        client.post("/cases/case-001/webhooks/simulate-drift", headers=_auth("engineering_lead"))

        queue_resp = client.get("/cases/case-001/handover/re-review-queue", headers=_auth("engineering_lead"))
        assert queue_resp.status_code == 200
        queue = queue_resp.json()
        assert len(queue) >= 1
        item = next((q for q in queue if q["claim_id"] == "ho-001"), None)
        assert item is not None
        assert item["status"] == "pending"
        assert item["suggested_update"] is not None
        assert "merged" in item["diff"].lower()

    def test_lead_amend_resolves_drift_and_bumps_version(self, client):
        """Lead resolves drift via 'amend', bumping the handover version to v2."""
        client.post("/cases/case-001/webhooks/simulate-drift", headers=_auth("engineering_lead"))

        new_text = (
            "**Payment Webhook Retry Logic (SL-456 / PR #47)**\n"
            "PR #47 merged into main on Oct 18. Webhook exponential backoff is now active in production. "
            "Remaining follow-up: SQS dead-letter queue with 72h retention."
        )

        res_resp = client.post(
            "/cases/case-001/handover/re-review/ho-001/resolve",
            headers=_auth("engineering_lead"),
            json={
                "action": "amend",
                "new_text": new_text,
                "notes": "Amended claim text after verifying PR #47 deployment",
            },
        )
        assert res_resp.status_code == 200, res_resp.text
        res_data = res_resp.json()
        assert res_data["status"] == "resolved"
        assert res_data["new_version"] == 2

        # Verify claim is no longer stale and text is amended
        ho_resp = client.get("/cases/case-001/handover", headers=_auth("engineering_lead"))
        ho_items = ho_resp.json().get("items", ho_resp.json())
        ho_001 = next(i for i in ho_items if i["id"] == "ho-001")
        assert ho_001.get("is_stale") is False
        assert ho_001["text"] == new_text

        # Verify version history has v2
        vers_resp = client.get("/cases/case-001/handover/versions", headers=_auth("engineering_lead"))
        assert vers_resp.status_code == 200
        versions = vers_resp.json()
        assert any(v["version"] == 2 for v in versions)

    def test_successor_drift_ribbon_and_update_available(self, client):
        """Successor sees update_available once version 2 is published."""
        # 1. Successor acknowledges version 1
        client.post("/cases/case-001/handover/release", headers=_auth("engineering_lead"))
        client.post("/cases/case-001/handover/acknowledge", headers=_auth("successor"))

        # Status before drift: up to date
        status_before = client.get("/cases/case-001/handover/drift-status", headers=_auth("successor")).json()
        assert status_before["update_available"] is False

        # 2. Ingest drift
        client.post("/cases/case-001/webhooks/simulate-drift", headers=_auth("engineering_lead"))

        # Successor checks drift status: has_drift is True
        status_drift = client.get("/cases/case-001/handover/drift-status", headers=_auth("successor")).json()
        assert status_drift["has_drift"] is True

        # 3. Lead resolves drift and bumps version to v2
        client.post(
            "/cases/case-001/handover/re-review/ho-001/resolve",
            headers=_auth("engineering_lead"),
            json={"action": "amend", "notes": "Production verified"},
        )

        # 4. Successor checks status: update_available is now True!
        status_after = client.get("/cases/case-001/handover/drift-status", headers=_auth("successor")).json()
        assert status_after["update_available"] is True
        assert status_after["latest_released_version"] > status_before["latest_released_version"]

    def test_contractor_blocked_from_resolving_and_confidential_drift_omitted(self, client):
        """Contractor cannot resolve re-review queue and cannot view confidential items."""
        # 1. Contractor cannot resolve queue
        resp = client.post(
            "/cases/case-001/handover/re-review/ho-001/resolve",
            headers=_auth("contractor"),
            json={"action": "amend"},
        )
        assert resp.status_code == 403

        # 2. Insert confidential re-review item
        db["re_review_queue"].append({
            "id": "rr-conf-999",
            "case_id": "case-001",
            "claim_id": "ho-conf-01",
            "claim_text": "Confidential payout details CANARY_CONF_7f3a",
            "section": "Confidential",
            "status": "pending",
            "drift_summary": "Secret compensation updated",
            "prior_evidence": "Old contract",
            "current_evidence": "New contract",
            "diff": "- Old\n+ New",
            "evidence_acl": {"visibility": "confidential", "allowed_roles": ["engineering_lead"]},
        })

        # Lead can see it
        lead_queue = client.get("/cases/case-001/handover/re-review-queue", headers=_auth("engineering_lead")).json()
        assert any(q["id"] == "rr-conf-999" for q in lead_queue)

        # Contractor cannot see it (omitted, zero leakage)
        contractor_queue = client.get("/cases/case-001/handover/re-review-queue", headers=_auth("contractor")).json()
        assert not any(q["id"] == "rr-conf-999" for q in contractor_queue)
        assert "CANARY_CONF_7f3a" not in str(contractor_queue)

    def test_github_webhook_triggers_drift(self, client):
        """Real GitHub webhook handler triggers evidence drift for merged PR."""
        resp = client.post(
            "/webhooks/github",
            headers={"x-github-event": "pull_request"},
            json={
                "action": "closed",
                "merged": True,
                "pull_request": {
                    "number": 47,
                    "title": "WIP: Webhook retry logic with exponential backoff (SL-456)",
                    "state": "closed",
                    "merged": True,
                },
            },
        )
        assert resp.status_code == 200
        assert resp.json().get("drift_detected") is True

        # Check that ho-001 flipped to stale
        ho_resp = client.get("/cases/case-001/handover", headers=_auth("engineering_lead"))
        ho_items = ho_resp.json().get("items", ho_resp.json())
        ho_001 = next(i for i in ho_items if i["id"] == "ho-001")
        assert ho_001.get("is_stale") is True

    def test_audit_log_records_drift_and_resolution(self, client):
        """Audit log contains drift detection and resolution entries."""
        client.post("/cases/case-001/webhooks/simulate-drift", headers=_auth("engineering_lead"))
        client.post(
            "/cases/case-001/handover/re-review/ho-001/resolve",
            headers=_auth("engineering_lead"),
            json={"action": "amend", "notes": "Merged in main"},
        )

        admin_resp = client.get("/cases/case-001/admin", headers=_auth("engineering_lead"))
        assert admin_resp.status_code == 200
        audit_log = admin_resp.json().get("audit_log", [])
        log_actions = [entry.get("action", "") for entry in audit_log]

        assert any("Evidence drift detected" in a for a in log_actions)
        assert any("Resolved evidence drift" in a for a in log_actions)
