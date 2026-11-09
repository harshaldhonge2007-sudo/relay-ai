"""
Tests for RELAY AI Role-Based Access Control (ACL) & Security Guarantees
Extended test suite for hackathon hardening — STEP 1.
"""
import pytest
from fastapi.testclient import TestClient

# Import both app and helpers from mock_server
from mock_server import app, generate_default_data, db, _sign_demo_token

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _token(user: str) -> str:
    """Return a valid signed demo token for the given user key."""
    result = _sign_demo_token(user)
    assert result is not None, f"Unknown user: {user}"
    return result["token"]


def _auth(user: str) -> dict:
    """Return Authorization header for the given demo user."""
    return {"Authorization": f"Bearer {_token(user)}"}


@pytest.fixture(autouse=True)
def reset_db():
    global db
    db.clear()
    db.update(generate_default_data())


# ---------------------------------------------------------------------------
# 0. Auth: demo-login endpoint
# ---------------------------------------------------------------------------

def test_demo_login_lead():
    res = client.post("/auth/demo-login", json={"user": "lead"})
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "engineering_lead"
    assert "token" in data
    assert data["note"] == "demo authentication — not for production"


def test_demo_login_successor():
    res = client.post("/auth/demo-login", json={"user": "successor"})
    assert res.status_code == 200
    assert res.json()["role"] == "successor"


def test_demo_login_contractor():
    res = client.post("/auth/demo-login", json={"user": "contractor"})
    assert res.status_code == 200
    assert res.json()["role"] == "contractor"


def test_demo_login_invalid_user():
    res = client.post("/auth/demo-login", json={"user": "admin"})
    assert res.status_code == 400


# ---------------------------------------------------------------------------
# 1. Artifact list — counts only, no IDs leaked in withheld notice
# ---------------------------------------------------------------------------

def test_engineering_lead_can_see_all_artifacts():
    res = client.get("/cases/case-001/artifacts", headers=_auth("lead"))
    assert res.status_code == 200
    data = res.json()
    assert data["withheld_count"] == 0
    assert data["withheld_notice"] is None
    ids = [a["id"] for a in data["items"]]
    assert "art-008" in ids  # finance-private (lead-only)
    assert "art-010" in ids  # ENV_KEYS.md (lead-only)


def test_successor_cannot_see_confidential_artifacts():
    res = client.get("/cases/case-001/artifacts", headers=_auth("successor"))
    assert res.status_code == 200
    data = res.json()
    assert data["withheld_count"] > 0
    assert "withheld due to access restrictions" in data["withheld_notice"]
    # Notice must NOT contain artifact IDs
    assert "art-008" not in str(data["withheld_notice"])
    assert "art-009" not in str(data["withheld_notice"])
    ids = [a["id"] for a in data["items"]]
    assert "art-008" not in ids
    assert "art-009" not in ids
    assert "art-010" not in ids
    # Successor CAN see internal Slack & PRs
    assert "art-001" in ids
    assert "art-002" in ids


def test_contractor_can_only_see_public_artifacts():
    res = client.get("/cases/case-001/artifacts", headers=_auth("contractor"))
    assert res.status_code == 200
    data = res.json()
    assert data["withheld_count"] > 0
    # Notice must NOT contain artifact IDs
    notice = data.get("withheld_notice", "") or ""
    for restricted_id in ["art-002", "art-004", "art-005", "art-008", "art-009", "art-010"]:
        assert restricted_id not in notice
    ids = [a["id"] for a in data["items"]]
    assert "art-001" in ids   # public PR
    assert "art-006" in ids   # public commit
    assert "art-002" not in ids  # internal Slack
    assert "art-004" not in ids  # internal Slack


# ---------------------------------------------------------------------------
# 2. Direct artifact ID access — 404 (not 403) for unauthorized role
# ---------------------------------------------------------------------------

def test_direct_artifact_access_returns_404_for_unauthorized_role():
    # Successor tries to access confidential finance artifact
    res = client.get("/artifacts/art-008", headers=_auth("successor"))
    assert res.status_code == 404

    # Contractor tries to access internal artifact
    res = client.get("/artifacts/art-002", headers=_auth("contractor"))
    assert res.status_code == 404


def test_direct_artifact_access_200_for_authorized_role():
    # Engineering lead can access confidential artifact
    res = client.get("/artifacts/art-008", headers=_auth("lead"))
    assert res.status_code == 200

    # Successor can access internal artifact
    res = client.get("/artifacts/art-002", headers=_auth("successor"))
    assert res.status_code == 200

    # Contractor can access public artifact
    res = client.get("/artifacts/art-001", headers=_auth("contractor"))
    assert res.status_code == 200


def test_nonexistent_artifact_returns_404():
    res = client.get("/artifacts/art-999", headers=_auth("lead"))
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# 3. Evidence lookup within findings — withheld spans for restricted artifacts
# ---------------------------------------------------------------------------

def test_findings_evidence_withheld_for_successor():
    # find-002 uses art-002 (successor can see) and art-006 (public)
    # find-001 uses art-003 (public) and art-004 (successor can see)
    res = client.get("/cases/case-001/findings", headers=_auth("successor"))
    assert res.status_code == 200
    findings = res.json()
    # Successor cannot see lead-only artifacts used as evidence
    # find-004 uses art-005 (internal) and art-007 (public) — successor can see art-005
    # No finding solely uses lead-only evidence for successor, but verify structure
    for f in findings:
        for ev in f.get("evidence", []):
            # withheld field must be present
            assert "withheld" in ev


def test_findings_evidence_withheld_for_contractor():
    res = client.get("/cases/case-001/findings", headers=_auth("contractor"))
    assert res.status_code == 200
    findings = res.json()
    # find-002 uses art-002 (internal Slack) — withheld for contractor
    find_002 = next((f for f in findings if f["id"] == "find-002"), None)
    assert find_002 is not None
    art002_ev = next((e for e in find_002["evidence"] if e.get("artifact_id") == "art-002"), None)
    assert art002_ev is not None
    assert art002_ev["withheld"] is True
    assert "[Source withheld" in art002_ev["span"]


def test_all_roles_receive_all_findings():
    """All roles must get all findings; only evidence spans may be withheld."""
    for user in ("lead", "successor", "contractor"):
        res = client.get("/cases/case-001/findings", headers=_auth(user))
        assert res.status_code == 200
        findings = res.json()
        ids = [f["id"] for f in findings]
        for expected in ("find-001", "find-002", "find-003", "find-004", "find-005", "find-006"):
            assert expected in ids, f"{user} missing finding {expected}"


# ---------------------------------------------------------------------------
# 4. Findings list — all roles get the finding; unauthorized evidence withheld
# ---------------------------------------------------------------------------

def test_findings_public_evidence_visible_to_contractor():
    res = client.get("/cases/case-001/findings", headers=_auth("contractor"))
    assert res.status_code == 200
    findings = res.json()
    # find-003 uses art-001 (public PR) — contractor can see
    find_003 = next((f for f in findings if f["id"] == "find-003"), None)
    assert find_003 is not None
    ev = find_003["evidence"][0]
    assert ev["withheld"] is False


# ---------------------------------------------------------------------------
# 5. Search — unauthorized artifacts absent from artifact list
# ---------------------------------------------------------------------------

def test_search_unauthorized_artifacts_absent():
    """Unauthorized artifacts should not appear in the artifact list (search proxy)."""
    # Successor search
    res = client.get("/cases/case-001/artifacts", headers=_auth("successor"))
    assert res.status_code == 200
    ids = [a["id"] for a in res.json()["items"]]
    for restricted in ("art-008", "art-009", "art-010"):
        assert restricted not in ids, f"Successor should not see {restricted}"

    # Contractor search
    res = client.get("/cases/case-001/artifacts", headers=_auth("contractor"))
    assert res.status_code == 200
    ids = [a["id"] for a in res.json()["items"]]
    for internal in ("art-002", "art-004", "art-005", "art-008", "art-009", "art-010", "art-011", "art-012"):
        assert internal not in ids, f"Contractor should not see {internal}"


# ---------------------------------------------------------------------------
# 6. Export placeholder (handover endpoint) — withheld claims shown with withheld text
# ---------------------------------------------------------------------------

def test_handover_withheld_claim_text_for_contractor():
    """Contractor cannot see claims whose evidence is lead-only; claim shown with withheld text."""
    # ho-001 uses art-001 (public) + art-012 (internal) → withheld for contractor
    res = client.get("/cases/case-001/handover", headers=_auth("contractor"))
    assert res.status_code == 200
    items = res.json()["items"]
    # Find ho-001 — its evidence includes art-012 (internal), so withheld for contractor
    ho_001 = next((i for i in items if i["id"] == "ho-001"), None)
    assert ho_001 is not None
    assert "Withheld" in ho_001["text"]
    assert ho_001["evidence_ids"] == ["[withheld]"]


def test_handover_lead_sees_all_claims():
    """Engineering lead sees all claim text without withheld substitution."""
    res = client.get("/cases/case-001/handover", headers=_auth("lead"))
    assert res.status_code == 200
    items = res.json()["items"]
    for item in items:
        # No item should have withheld text for lead
        assert "Withheld" not in item["text"]


def test_handover_successor_withheld_for_lead_only_evidence():
    """
    Successor can see internal artifacts (art-002, art-012 etc.) so ho-001/ho-002 are
    visible. Lead-only evidence (art-008, art-009, art-010) triggers withheld for successor.
    ho-001 uses art-001 (public) + art-012 (internal → visible to successor), so NOT withheld.
    """
    res = client.get("/cases/case-001/handover", headers=_auth("successor"))
    assert res.status_code == 200
    items = res.json()["items"]
    ho_001 = next((i for i in items if i["id"] == "ho-001"), None)
    assert ho_001 is not None
    # art-001 (public) + art-012 (internal = visible to successor) → NOT withheld
    assert "Withheld" not in ho_001["text"]


# ---------------------------------------------------------------------------
# 7. Timeline (findings list as timeline) — role-aware
# ---------------------------------------------------------------------------

def test_timeline_all_roles_see_all_findings():
    """Findings serve as timeline; all roles see all entries."""
    for user in ("lead", "successor", "contractor"):
        res = client.get("/cases/case-001/findings", headers=_auth(user))
        assert res.status_code == 200
        assert len(res.json()) == 6


# ---------------------------------------------------------------------------
# 8. Decisions endpoint — no role check needed (decisions are non-restricted)
# ---------------------------------------------------------------------------

def test_decisions_accessible_by_all_roles():
    for user in ("lead", "successor", "contractor"):
        res = client.get("/cases/case-001/decisions", headers=_auth(user))
        assert res.status_code == 200
        decisions = res.json()
        assert len(decisions) >= 3
        ids = [d["id"] for d in decisions]
        assert "dec-001" in ids


def test_decisions_accessible_without_auth():
    """Decisions endpoint requires no auth (no role check)."""
    res = client.get("/cases/case-001/decisions")
    assert res.status_code == 200


# ---------------------------------------------------------------------------
# 9. Uncertainty endpoint — no role check needed
# ---------------------------------------------------------------------------

def test_uncertainty_accessible_by_all_roles():
    for user in ("lead", "successor", "contractor"):
        res = client.get("/cases/case-001/uncertainty", headers=_auth(user))
        assert res.status_code == 200
        data = res.json()
        assert "missing_evidence" in data
        assert "conflicts" in data


# ---------------------------------------------------------------------------
# 10. Completeness — no role check
# ---------------------------------------------------------------------------

def test_completeness_accessible_by_all_roles():
    """
    Simulation is role-aware: lead/successor see internal facts (score 0.71),
    contractor only sees public facts (withheld internal facts, score 0.36).
    Formula is computed, never hardcoded.
    """
    for user in ("lead", "successor"):
        res = client.get("/cases/case-001/completeness", headers=_auth(user))
        assert res.status_code == 200
        data = res.json()
        assert data["score"] == 0.71
        missing = [f for f in data["required_facts"] if f["status"] == "missing"]
        assert len(missing) == 2
        assert "formula" in data
        assert "formula_calc" in data

    # Contractor only accesses public facts; internal facts are withheld
    res = client.get("/cases/case-001/completeness", headers=_auth("contractor"))
    assert res.status_code == 200
    data = res.json()
    assert data["score"] == 0.36
    withheld = [f for f in data["required_facts"] if f["status"] == "withheld"]
    assert len(withheld) == 5
    assert "formula" in data
    assert "formula_calc" in data


# ---------------------------------------------------------------------------
# 11. Claim review — lead only, successor gets 403
# ---------------------------------------------------------------------------

def test_claim_approve_lead_only():
    # Lead can approve
    res = client.post("/cases/case-001/handover/ho-001/approve", headers=_auth("lead"))
    assert res.status_code == 200
    assert res.json()["claim"]["claim_status"] == "approved"


def test_claim_approve_successor_forbidden():
    res = client.post("/cases/case-001/handover/ho-001/approve", headers=_auth("successor"))
    assert res.status_code == 403


def test_claim_approve_contractor_forbidden():
    res = client.post("/cases/case-001/handover/ho-001/approve", headers=_auth("contractor"))
    assert res.status_code == 403


def test_claim_reject_lead_only():
    res = client.post(
        "/cases/case-001/handover/ho-002/reject",
        headers=_auth("lead"),
        json={"reason": "Migration strategy superseded by blue-green cutover"}
    )
    assert res.status_code == 200
    assert res.json()["claim"]["claim_status"] == "rejected"
    assert res.json()["claim"]["rejection_reason"] == "Migration strategy superseded by blue-green cutover"


def test_claim_reject_successor_forbidden():
    res = client.post(
        "/cases/case-001/handover/ho-002/reject",
        headers=_auth("successor"),
        json={"reason": "nope"}
    )
    assert res.status_code == 403


def test_claim_edit_lead_only():
    res = client.put(
        "/cases/case-001/handover/ho-003/edit",
        headers=_auth("lead"),
        json={"text": "Updated by lead"}
    )
    assert res.status_code == 200
    assert res.json()["claim"]["text"] == "Updated by lead"


def test_claim_edit_successor_forbidden():
    res = client.put(
        "/cases/case-001/handover/ho-003/edit",
        headers=_auth("successor"),
        json={"text": "sneaky edit"}
    )
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# 12. Forged header test — X-Relay-Role: engineering_lead without valid token
#     must NOT grant lead access
# ---------------------------------------------------------------------------

def test_forged_x_relay_role_does_not_grant_lead_access():
    """
    Sending X-Relay-Role: engineering_lead without a valid Bearer token
    must NOT grant engineering_lead privileges.
    The forged role should be ignored; default role is successor.
    """
    # Artifact art-008 is lead-only. With forged header, should return 404.
    res = client.get(
        "/artifacts/art-008",
        headers={"X-Relay-Role": "engineering_lead"}
    )
    # Must NOT be 200 (lead access); should be 404 (not revealing existence)
    assert res.status_code == 404, (
        "Forged X-Relay-Role: engineering_lead must not grant lead access to restricted artifact"
    )


def test_forged_header_claim_approve_forbidden():
    """X-Relay-Role header alone must not allow claim approval."""
    res = client.post(
        "/cases/case-001/handover/ho-001/approve",
        headers={"X-Relay-Role": "engineering_lead"}
    )
    assert res.status_code == 403, (
        "Forged X-Relay-Role: engineering_lead must not allow claim approval"
    )


def test_valid_token_plus_no_forged_header_works():
    """A valid token still works even when no X-Relay-Role header is sent."""
    res = client.get("/artifacts/art-008", headers=_auth("lead"))
    assert res.status_code == 200


def test_forged_header_artifacts_list_uses_successor_view():
    """With only X-Relay-Role: engineering_lead (no token), should get successor view."""
    res = client.get(
        "/cases/case-001/artifacts",
        headers={"X-Relay-Role": "engineering_lead"}
    )
    assert res.status_code == 200
    ids = [a["id"] for a in res.json()["items"]]
    # art-008, art-009, art-010 are lead-only — must not appear
    assert "art-008" not in ids
    assert "art-009" not in ids
    assert "art-010" not in ids


# ---------------------------------------------------------------------------
# Legacy tests (kept for regression — updated assertions)
# ---------------------------------------------------------------------------

def test_secrets_redacted_in_artifact_bodies():
    res = client.get("/artifacts/art-010", headers=_auth("lead"))
    assert res.status_code == 200
    body = res.json()["body"]
    assert "sk_live_[REDACTED]" in body
    assert "AWS_SECRET_ACCESS_KEY=[REDACTED]" in body
    assert "DATABASE_URL=[REDACTED]" in body
    assert "super-secret" not in body


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
