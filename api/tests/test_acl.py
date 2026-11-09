"""
Tests for RELAY AI Role-Based Access Control (ACL) & Security Guarantees
"""
import pytest
from fastapi.testclient import TestClient
from mock_server import app, generate_default_data, db

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_db():
    global db
    db.clear()
    db.update(generate_default_data())

def test_engineering_lead_can_see_all_artifacts():
    res = client.get("/cases/case-001/artifacts", headers={"x-relay-role": "engineering_lead"})
    assert res.status_code == 200
    data = res.json()
    assert data["withheld_count"] == 0
    assert data["withheld_notice"] is None
    ids = [a["id"] for a in data["items"]]
    assert "art-008" in ids  # finance-private
    assert "art-010" in ids  # ENV_KEYS.md

def test_successor_cannot_see_confidential_artifacts():
    res = client.get("/cases/case-001/artifacts", headers={"x-relay-role": "successor"})
    assert res.status_code == 200
    data = res.json()
    assert data["withheld_count"] > 0
    assert "withheld due to access restrictions" in data["withheld_notice"]
    ids = [a["id"] for a in data["items"]]
    assert "art-008" not in ids
    assert "art-009" not in ids
    assert "art-010" not in ids
    # But successor CAN see internal Slack & PRs
    assert "art-001" in ids
    assert "art-002" in ids

def test_contractor_can_only_see_public_artifacts():
    res = client.get("/cases/case-001/artifacts", headers={"x-relay-role": "contractor"})
    assert res.status_code == 200
    data = res.json()
    assert data["withheld_count"] > 0
    ids = [a["id"] for a in data["items"]]
    # Public PR & public commit are visible
    assert "art-001" in ids
    assert "art-006" in ids
    # Internal Slack is NOT visible to contractor
    assert "art-002" not in ids
    assert "art-004" not in ids

def test_direct_artifact_access_forbidden_for_unauthorized_role():
    # Successor attempts to access confidential finance artifact
    res = client.get("/artifacts/art-008", headers={"x-relay-role": "successor"})
    assert res.status_code == 403
    assert "Access denied" in res.json()["detail"]

    # Engineering lead can access it
    res = client.get("/artifacts/art-008", headers={"x-relay-role": "engineering_lead"})
    assert res.status_code == 200

def test_secrets_redacted_in_artifact_bodies():
    res = client.get("/artifacts/art-010", headers={"x-relay-role": "engineering_lead"})
    assert res.status_code == 200
    body = res.json()["body"]
    assert "sk_live_[REDACTED]" in body
    assert "AWS_SECRET_ACCESS_KEY=[REDACTED]" in body
    assert "DATABASE_URL=[REDACTED]" in body
    assert "super-secret" not in body

def test_claim_level_review_permissions():
    # Successor cannot approve or reject claims
    res = client.post("/cases/case-001/handover/ho-001/approve", headers={"x-relay-role": "successor"})
    assert res.status_code == 403

    # Engineering lead can approve claim
    res = client.post("/cases/case-001/handover/ho-001/approve", headers={"x-relay-role": "engineering_lead"})
    assert res.status_code == 200
    assert res.json()["claim"]["claim_status"] == "approved"

    # Engineering lead can reject claim with reason
    res = client.post(
        "/cases/case-001/handover/ho-002/reject",
        headers={"x-relay-role": "engineering_lead"},
        json={"reason": "Migration strategy superseded by blue-green cutover"}
    )
    assert res.status_code == 200
    assert res.json()["claim"]["claim_status"] == "rejected"
    assert res.json()["claim"]["rejection_reason"] == "Migration strategy superseded by blue-green cutover"

def test_closed_loop_simulation_lifecycle():
    # 1. Initial completeness is 71% with missing facts
    res = client.get("/cases/case-001/completeness")
    assert res.status_code == 200
    initial = res.json()
    assert initial["score"] == 0.71
    missing = [f for f in initial["required_facts"] if f["status"] == "missing"]
    assert len(missing) == 2

    # 2. Fix missing facts triggers question generation
    res = client.post("/cases/case-001/completeness/fix-missing")
    assert res.status_code == 200
    fix_data = res.json()
    assert fix_data["count"] == 2

    # 3. Regenerate handover answers the questions and jumps score to 96%
    res = client.post("/cases/case-001/completeness/regenerate-handover", json={})
    assert res.status_code == 200
    after = res.json()
    assert after["previous_score"] == 0.71
    assert after["new_score"] == 0.96
    assert after["completeness"]["blockers"] == []
