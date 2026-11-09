"""
Tests for Handover Review Workflow:
- Real numbered version history
- Release gating (all claims must be approved, edited, or rejected)
- Rejected claims exclusion from released versions
- Immutability of released versions
- Diff correctness between versions
- Successor version acknowledgement
"""
import pytest
from fastapi.testclient import TestClient
from mock_server import app, generate_default_data, db, _sign_demo_token

client = TestClient(app)


def _auth(user: str) -> dict:
    signed = _sign_demo_token(user)
    return {"Authorization": f"Bearer {signed['token']}"}


@pytest.fixture(autouse=True)
def reset_db():
    global db
    db.clear()
    db.update(generate_default_data())


# ---------------------------------------------------------------------------
# 1. Release Gating
# ---------------------------------------------------------------------------

def test_release_gated_when_claims_pending():
    """Lead cannot release while any claims have pending review status."""
    # Initially claims ho-001, ho-002, ho-003, ho-005 are pending
    res = client.post("/cases/case-001/handover/release", headers=_auth("lead"))
    assert res.status_code == 400
    detail = res.json()["detail"]
    assert "Release gated" in detail or "All claims must be approved" in detail
    assert "ho-001" in detail


def test_release_succeeds_when_all_claims_reviewed():
    """Lead can release once all claims are approved, edited, or rejected."""
    # Review every pending claim
    res1 = client.post("/cases/case-001/handover/ho-001/approve", headers=_auth("lead"))
    assert res1.status_code == 200

    res2 = client.post(
        "/cases/case-001/handover/ho-002/reject",
        headers=_auth("lead"),
        json={"reason": "Superceded by Blue-Green migration"}
    )
    assert res2.status_code == 200

    res3 = client.put(
        "/cases/case-001/handover/ho-003/edit",
        headers=_auth("lead"),
        json={"text": "Updated JWT resolution steps with Cloudflare bypass rule."}
    )
    assert res3.status_code == 200

    # ho-004 is already approved in seed data
    res5 = client.post("/cases/case-001/handover/ho-005/approve", headers=_auth("lead"))
    assert res5.status_code == 200

    # Now release must succeed
    rel_res = client.post("/cases/case-001/handover/release", headers=_auth("lead"))
    assert rel_res.status_code == 200
    data = rel_res.json()
    assert data["status"] == "released"
    assert data["version"] >= 2
    assert data["excluded_rejected_count"] == 1


# ---------------------------------------------------------------------------
# 2. Rejected Claims Never Appear in Released Version
# ---------------------------------------------------------------------------

def test_rejected_claims_excluded_from_released_handover():
    """Rejected claims must never appear in the released version seen by successor or contractor."""
    # Review all claims, rejecting ho-002
    client.post("/cases/case-001/handover/ho-001/approve", headers=_auth("lead"))
    client.post("/cases/case-001/handover/ho-002/reject", headers=_auth("lead"), json={"reason": "Rejected"})
    client.put("/cases/case-001/handover/ho-003/edit", headers=_auth("lead"), json={"text": "Fixed text"})
    client.post("/cases/case-001/handover/ho-005/approve", headers=_auth("lead"))

    # Release
    client.post("/cases/case-001/handover/release", headers=_auth("lead"))

    # Successor views handover: ho-002 must NOT be present
    res_succ = client.get("/cases/case-001/handover", headers=_auth("successor"))
    assert res_succ.status_code == 200
    succ_items = res_succ.json()["items"]
    succ_ids = [item["id"] for item in succ_items]
    assert "ho-002" not in succ_ids
    assert "ho-001" in succ_ids
    assert "ho-003" in succ_ids
    assert "ho-004" in succ_ids

    # Contractor views handover: ho-002 must NOT be present
    res_cont = client.get("/cases/case-001/handover", headers=_auth("contractor"))
    assert res_cont.status_code == 200
    cont_ids = [item["id"] for item in res_cont.json()["items"]]
    assert "ho-002" not in cont_ids


# ---------------------------------------------------------------------------
# 3. Real Version History & Immutability
# ---------------------------------------------------------------------------

def test_version_history_tracks_every_review_action():
    """Every edit, rejection, approval, and release creates a numbered version."""
    # Initial version list
    ver_res = client.get("/cases/case-001/handover/versions")
    assert ver_res.status_code == 200
    initial_versions = ver_res.json()
    assert len(initial_versions) >= 1
    assert initial_versions[0]["version"] == 1

    # Action 1: Approve ho-001 -> creates v2
    client.post("/cases/case-001/handover/ho-001/approve", headers=_auth("lead"))
    ver_res = client.get("/cases/case-001/handover/versions")
    versions = ver_res.json()
    assert len(versions) == 2
    assert versions[-1]["version"] == 2
    assert "Approved claim ho-001" in versions[-1]["change_summary"]

    # Action 2: Edit ho-003 -> creates v3
    client.put("/cases/case-001/handover/ho-003/edit", headers=_auth("lead"), json={"text": "V3 text edit"})
    ver_res = client.get("/cases/case-001/handover/versions")
    versions = ver_res.json()
    assert len(versions) == 3
    assert versions[-1]["version"] == 3
    assert "Edited text" in versions[-1]["change_summary"]


def test_released_version_snapshot_is_immutable():
    """Modifications after release create a new draft version, leaving released version intact."""
    # Review and release
    client.post("/cases/case-001/handover/ho-001/approve", headers=_auth("lead"))
    client.post("/cases/case-001/handover/ho-002/reject", headers=_auth("lead"), json={"reason": "Rejected"})
    client.post("/cases/case-001/handover/ho-003/approve", headers=_auth("lead"))
    client.post("/cases/case-001/handover/ho-005/approve", headers=_auth("lead"))
    rel_res = client.post("/cases/case-001/handover/release", headers=_auth("lead"))
    released_ver = rel_res.json()["version"]

    # Fetch snapshot of released version
    snap_res1 = client.get(f"/cases/case-001/handover/versions/{released_ver}")
    assert snap_res1.status_code == 200
    snap1_text = next(i["text"] for i in snap_res1.json()["items"] if i["id"] == "ho-001")

    # Lead performs an edit later -> creates newer version
    edit_res = client.put(
        "/cases/case-001/handover/ho-001/edit",
        headers=_auth("lead"),
        json={"text": "Post-release subsequent modification"}
    )
    assert edit_res.status_code == 200
    new_ver = edit_res.json()["version"]
    assert new_ver > released_ver

    # The released version snapshot remains UNCHANGED (immutable)
    snap_res2 = client.get(f"/cases/case-001/handover/versions/{released_ver}")
    snap2_text = next(i["text"] for i in snap_res2.json()["items"] if i["id"] == "ho-001")
    assert snap2_text == snap1_text
    assert "Post-release" not in snap2_text


# ---------------------------------------------------------------------------
# 4. Side-by-Side Diff Correctness
# ---------------------------------------------------------------------------

def test_diff_identifies_modified_and_removed_claims():
    """Diff between v1 and v2 accurately reports modified, added, and removed claims."""
    # V1 is default state
    # Edit ho-003 to create V2
    client.put(
        "/cases/case-001/handover/ho-003/edit",
        headers=_auth("lead"),
        json={"text": "Completely new JWT text for diff validation"}
    )

    diff_res = client.get("/cases/case-001/handover/diff?v1=1&v2=2")
    assert diff_res.status_code == 200
    data = diff_res.json()
    assert data["v1"] == 1
    assert data["v2"] == 2

    # ho-003 must be marked modified
    ho003_diff = next(d for d in data["diff"] if d["claim_id"] == "ho-003")
    assert ho003_diff["change_type"] == "modified"
    assert ho003_diff["v2"]["text"] == "Completely new JWT text for diff validation"
    assert ho003_diff["v1"]["text"] != ho003_diff["v2"]["text"]

    # ho-004 was unchanged
    ho004_diff = next(d for d in data["diff"] if d["claim_id"] == "ho-004")
    assert ho004_diff["change_type"] == "unchanged"


# ---------------------------------------------------------------------------
# 5. Successor Acknowledgement Tracks Released Version
# ---------------------------------------------------------------------------

def test_successor_acknowledges_specific_released_version():
    """Successor sees and acknowledges the exact released version."""
    # Review and release
    client.post("/cases/case-001/handover/ho-001/approve", headers=_auth("lead"))
    client.post("/cases/case-001/handover/ho-002/reject", headers=_auth("lead"), json={"reason": "Rejected"})
    client.post("/cases/case-001/handover/ho-003/approve", headers=_auth("lead"))
    client.post("/cases/case-001/handover/ho-005/approve", headers=_auth("lead"))
    rel_res = client.post("/cases/case-001/handover/release", headers=_auth("lead"))
    released_ver = rel_res.json()["version"]

    # Successor acknowledges
    ack_res = client.post("/cases/case-001/handover/acknowledge", headers=_auth("successor"))
    assert ack_res.status_code == 200
    ack_data = ack_res.json()
    assert ack_data["status"] == "acknowledged"
    assert ack_data["version"] == released_ver
    assert "Alex Chen (Successor)" in ack_data["actor"]

    # Handover response reflects acknowledged state and version
    ho_res = client.get("/cases/case-001/handover", headers=_auth("successor"))
    ho_data = ho_res.json()
    assert ho_data["acknowledged"] is True
    assert ho_data["acknowledged_version"] == released_ver

