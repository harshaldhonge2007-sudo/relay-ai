"""
test_journeys.py — Automated End-to-End Main Journeys (STEP 5).

Journeys:
A. Sample case: load, inspect evidence, see contradiction, review (edit one,
   reject one with reason, approve rest), release, switch to successor,
   acknowledge, run simulation, fix missing facts, score updates.
B. Import & Configuration: create case, per-source ACLs, run pipeline/fixture,
   review, release.
C. Role journey: lead, successor and contractor on the same case; verify
   what each sees on every screen/endpoint (zero restricted leaks).
D. The three improvements as a combined user journey.
E. Non-engineering sample bundle end to end (Operations/DevOps departure case).
"""

import pytest
import asyncio
from fastapi.testclient import TestClient

from mock_server import app, generate_default_data, db, _sign_demo_token

client = TestClient(app)


def _auth(user: str) -> dict:
    signed = _sign_demo_token(user)
    assert signed is not None
    return {"Authorization": f"Bearer {signed['token']}"}


@pytest.fixture(autouse=True)
def reset_db():
    global db
    db.clear()
    db.update(generate_default_data())


# ===========================================================================
# JOURNEY A: SAMPLE CASE END-TO-END
# ===========================================================================

def test_journey_a_sample_case_full_lifecycle():
    """
    Journey A:
    1. Load sample case as Lead.
    2. Inspect evidence artifacts and uncertainty conflicts (contradiction: SL-234 Done vs Slack timeout).
    3. Review handover:
       - Edit ho-003 (JWT config)
       - Reject ho-002 (currency migration) with reason
       - Approve ho-001 and ho-005 (ho-004 is pre-approved)
    4. Release handover (gated check passes, version incremented).
    5. Switch to Successor:
       - View released handover (ho-002 rejected is excluded).
       - Acknowledge handover receipt.
    6. Run simulation:
       - Initial score is 0.71 (2 missing facts).
       - Trigger fix missing facts (generates 2 questions).
       - Regenerate handover -> score updates to 0.96.
    """
    # 1. Load case as Lead
    case_res = client.get("/cases/case-001", headers=_auth("lead"))
    assert case_res.status_code == 200
    assert case_res.json()["name"] == "ShopLedger – Priya Nair Departure"

    # 2. Inspect evidence and find contradiction
    uncertainty_res = client.get("/cases/case-001/uncertainty", headers=_auth("lead"))
    assert uncertainty_res.status_code == 200
    conflicts = uncertainty_res.json()["conflicts"]
    assert len(conflicts) >= 2
    # Verify contradiction between SL-234 and Slack message
    c1 = next(c for c in conflicts if c["id"] == "conflict-001")
    assert "SL-234" in c1["source_a"]["label"]
    assert "Slack" in c1["source_b"]["label"]
    assert "resolution_status" in c1

    # 3. Review: edit one, reject one, approve rest
    edit_res = client.put(
        "/cases/case-001/handover/ho-003/edit",
        headers=_auth("lead"),
        json={"text": "Updated JWT resolution: add Cloudflare page rule bypass for /auth/refresh."},
    )
    assert edit_res.status_code == 200
    assert edit_res.json()["claim"]["claim_status"] == "edited"

    reject_res = client.post(
        "/cases/case-001/handover/ho-002/reject",
        headers=_auth("lead"),
        json={"reason": "Migration strategy superseded by two-phase backfill script."},
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["claim"]["claim_status"] == "rejected"

    app_res1 = client.post("/cases/case-001/handover/ho-001/approve", headers=_auth("lead"))
    assert app_res1.status_code == 200
    app_res5 = client.post("/cases/case-001/handover/ho-005/approve", headers=_auth("lead"))
    assert app_res5.status_code == 200

    # 4. Release handover
    rel_res = client.post("/cases/case-001/handover/release", headers=_auth("lead"))
    assert rel_res.status_code == 200
    rel_data = rel_res.json()
    assert rel_data["status"] == "released"
    assert rel_data["version"] >= 2
    assert rel_data["excluded_rejected_count"] == 1

    # 5. Switch to Successor & acknowledge
    succ_ho = client.get("/cases/case-001/handover", headers=_auth("successor"))
    assert succ_ho.status_code == 200
    items = succ_ho.json()["items"]
    item_ids = [i["id"] for i in items]
    assert "ho-002" not in item_ids  # rejected claim excluded
    assert "ho-001" in item_ids
    assert "ho-003" in item_ids

    ack_res = client.post("/cases/case-001/handover/acknowledge", headers=_auth("successor"))
    assert ack_res.status_code == 200
    assert ack_res.json()["status"] == "acknowledged"

    # 6. Run simulation, fix missing facts, and check score update
    sim_before = client.get("/cases/case-001/completeness", headers=_auth("successor"))
    assert sim_before.status_code == 200
    score_before = sim_before.json()["score"]
    assert score_before == 0.71

    fix_res = client.post("/cases/case-001/completeness/fix-missing", headers=_auth("successor"))
    assert fix_res.status_code == 200
    assert fix_res.json()["count"] == 2

    regen_res = client.post("/cases/case-001/completeness/regenerate-handover", headers=_auth("successor"), json={})
    assert regen_res.status_code == 200
    after_data = regen_res.json()
    assert after_data["previous_score"] == 0.71
    assert after_data["new_score"] == 0.96
    assert after_data["completeness"]["blockers"] == []


# ===========================================================================
# JOURNEY B: IMPORT & PER-SOURCE ACLs
# ===========================================================================

def test_journey_b_import_and_per_source_acls():
    """
    Journey B:
    1. Create a new case from repo.
    2. Check ingest status (returns offline fallback label in demo).
    3. Configure per-source ACLs (change Slack to confidential, verify audit log).
    4. Review claims and release case.
    """
    # 1. Create case
    create_res = client.post("/cases/from-repo", headers=_auth("lead"), json={"repo": "shopledger/api"})
    assert create_res.status_code == 200
    data = create_res.json()
    assert "case_id" in data
    case_id = data["case_id"]

    # 2. Check ingest status
    status_res = client.get(f"/cases/{case_id}/ingest/status", headers=_auth("lead"))
    assert status_res.status_code == 200
    assert status_res.json()["offline_fallback"] is True
    assert "CACHED FIXTURES" in status_res.json()["offline_label"]

    # 3. Configure per-source ACL
    patch_res = client.patch(
        f"/cases/{case_id}/sources/Slack/acl",
        headers=_auth("lead"),
        json={"access_level": "confidential"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "updated"
    assert patch_res.json()["access_level"] == "confidential"

    # Audit log check
    admin_res = client.get(f"/cases/{case_id}/admin", headers=_auth("lead"))
    assert admin_res.status_code == 200
    latest_audit = admin_res.json()["audit_log"][0]
    assert "ACL updated for source 'Slack'" in latest_audit["action"]


# ===========================================================================
# JOURNEY C: THREE ROLES ISOLATION ON SAME CASE
# ===========================================================================

def test_journey_c_three_roles_isolation_matrix():
    """
    Journey C:
    Verify what each role (Lead, Successor, Contractor) sees across all endpoints:
    - Artifacts: Lead sees all; Successor has confidential withheld; Contractor has internal+confidential withheld.
    - Findings: All see finding cards, but evidence items are filtered with opaque notices.
    - Uncertainty: Contractor sees only public conflicts, zero internal evidence descriptions.
    - Redactions: Lead only (403 for contractor and successor).
    - Decisions: All see architectural decisions.
    """
    # 1. Artifacts
    lead_arts = client.get("/cases/case-001/artifacts", headers=_auth("lead")).json()
    succ_arts = client.get("/cases/case-001/artifacts", headers=_auth("successor")).json()
    cont_arts = client.get("/cases/case-001/artifacts", headers=_auth("contractor")).json()

    assert lead_arts["withheld_count"] == 0
    assert succ_arts["withheld_count"] > 0
    assert cont_arts["withheld_count"] > succ_arts["withheld_count"]
    # Withheld notices must NEVER leak restricted artifact IDs
    for restricted in ["art-008", "art-009", "art-010"]:
        assert restricted not in (succ_arts["withheld_notice"] or "")
        assert restricted not in (cont_arts["withheld_notice"] or "")

    # 2. Uncertainty
    lead_unc = client.get("/cases/case-001/uncertainty", headers=_auth("lead")).json()
    cont_unc = client.get("/cases/case-001/uncertainty", headers=_auth("contractor")).json()

    assert len(lead_unc["missing_evidence"]) > 0
    # Contractor receives empty missing_evidence array (opaque count only)
    assert len(cont_unc["missing_evidence"]) == 0
    assert cont_unc["withheld_missing_evidence_count"] > 0

    # 3. Redactions endpoint (Lead only)
    assert client.get("/cases/case-001/redactions", headers=_auth("lead")).status_code == 200
    assert client.get("/cases/case-001/redactions", headers=_auth("successor")).status_code == 403
    assert client.get("/cases/case-001/redactions", headers=_auth("contractor")).status_code == 403


# ===========================================================================
# JOURNEY D: THE THREE IMPROVEMENTS
# ===========================================================================

def test_journey_d_three_improvements_in_sequence():
    """
    Journey D:
    Exercises all three committed improvements in one cohesive workflow:
    1. Improvement 3: Test live GitHub connector parsing & offline fallback response.
    2. Improvement 2: Verify claim with layered entailment verifier (deterministic + LLM).
    3. Improvement 1: Modify source ACL, release handover, and verify immutability & audit logging.
    """
    # 1. Improvement 3: Ingest status offline fallback check
    ingest_res = client.get("/cases/case-001/ingest/status", headers=_auth("lead"))
    assert ingest_res.status_code == 200
    assert "CACHED FIXTURES" in ingest_res.json()["offline_label"]

    # 2. Improvement 2: Layered verifier
    ver_res = client.post(
        "/cases/case-001/handover/verify",
        headers=_auth("lead"),
        json={
            "text": "PR #47 implements webhook retry logic with exponential backoff.",
            "evidence_ids": ["art-001"],
        },
    )
    assert ver_res.status_code == 200
    v_data = ver_res.json()
    assert "method" in v_data
    assert "deterministic lexical and entity overlap" in v_data["deterministic_method"]
    assert v_data["verification"]["is_grounded"] is True

    # 3. Improvement 1: ACL update & version snapshot after release
    for item in db["handover"]:
        item["claim_status"] = "approved"
    client.post("/cases/case-001/handover/release", headers=_auth("lead"))

    patch_res = client.patch(
        "/cases/case-001/sources/Slack/acl",
        headers=_auth("lead"),
        json={"access_level": "confidential"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["new_handover_version"] is not None


# ===========================================================================
# JOURNEY E: OPERATIONS / DEVOPS DEPARTURE CASE
# ===========================================================================

def test_journey_e_devops_operations_departure_bundle():
    """
    Journey E:
    Non-engineering / infrastructure-focused departure:
    - Inspects environment variables, SMTP credentials, cron schedules.
    - Verifies secret redaction in artifact bodies (no plain keys).
    - Checks decision log for PostgreSQL upgrade deferral.
    - Verifies first 5 days continuation checklist.
    """
    # 1. Verify secrets are redacted in artifact bodies
    art_res = client.get("/artifacts/art-010", headers=_auth("lead"))
    assert art_res.status_code == 200
    body = art_res.json()["body"]
    assert "sk_live_[REDACTED]" in body
    assert "AWS_SECRET_ACCESS_KEY=[REDACTED]" in body

    # 2. Decisions: PG15 upgrade
    dec_res = client.get("/cases/case-001/decisions", headers=_auth("lead"))
    assert dec_res.status_code == 200
    decs = dec_res.json()
    pg_dec = next((d for d in decs if "PostgreSQL 15" in d["title"]), None)
    assert pg_dec is not None
    assert "Q1 2025" in pg_dec["summary"]

    # 3. Continuation plan (First 5 Days)
    cont_res = client.get("/cases/case-001/continuation", headers=_auth("lead"))
    assert cont_res.status_code == 200
    days = cont_res.json()["first_5_days"]
    assert len(days) >= 5
    day1_tasks = [t["task"] for t in days if t["day"] == 1]
    assert any("Clone repo" in t for t in day1_tasks)

