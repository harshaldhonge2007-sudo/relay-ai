"""
Tests for Grounding Verifier & Sentence-Level Verification:
- Deterministic lexical and entity overlap verification
- Downgrades unsupported sentences to INFERRED or UNKNOWN and flags them
- Grounding score computation with method stated
- Tests with deliberately unsupported sentences
"""
import pytest
from fastapi.testclient import TestClient
from mock_server import app, generate_default_data, db, _sign_demo_token
from app.handover.verifier import GroundingVerifier

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
# Unit Tests for GroundingVerifier
# ---------------------------------------------------------------------------

def test_grounded_sentence_passes_verification():
    """Sentence supported by evidence passes verification and maintains VERIFIED provenance."""
    verifier = GroundingVerifier()

    evidence_text = (
        "PR #47 implements webhook retry logic with exponential backoff. "
        "Agreed in Architecture Sync (Oct 14): SQS dead-letter queue with 72h retention. "
        "Alert threshold is 3 consecutive failures to PagerDuty P2."
    )

    sentence = "PR #47 contains exponential backoff with SQS dead-letter queue and 72h retention."
    res = verifier.verify_sentence(sentence, evidence_text)

    assert res["is_grounded"] is True
    assert res["provenance"] == "verified"
    assert res["score"] >= 0.65
    assert len(res["missing_entities"]) == 0


def test_deliberately_unsupported_sentence_is_downgraded_and_flagged():
    """Sentence with fabricated claims is downgraded to INFERRED/UNKNOWN and flagged."""
    verifier = GroundingVerifier()

    evidence_text = (
        "Fixed in Jira SL-234: Updated auth service session timeout configuration to 7200s."
    )

    # Deliberately unsupported sentence containing hallucinated facts:
    # 99.999% SLA, Kafka cluster on port 9092, Alice Johnson
    unsupported_sentence = (
        "Alice Johnson deployed a Kafka streaming cluster on port 9092 offering 99.999% uptime guarantee."
    )

    res = verifier.verify_sentence(unsupported_sentence, evidence_text)

    assert res["is_grounded"] is False
    assert res["provenance"] in ("inferred", "unknown")
    assert res["score"] < 0.40
    # Hallucinated entities must be flagged as missing from evidence
    missing_lower = [m.lower() for m in res["missing_entities"]]
    assert any("kafka" in m or "9092" in m or "alice" in m for m in missing_lower)
    assert "Unsupported" in res["reason"] or "Missing entities" in res["reason"]


def test_sentence_without_evidence_is_unknown():
    """Sentence with no cited evidence is marked unknown with score 0."""
    verifier = GroundingVerifier()
    sentence = "This claim has no evidence citations whatsoever."
    res = verifier.verify_sentence(sentence, "")

    assert res["is_grounded"] is False
    assert res["provenance"] == "unknown"
    assert res["score"] == 0.0
    assert "No evidence cited" in res["reason"]


def test_verify_claim_sentence_breakdown():
    """Claim verification returns per-sentence breakdown and aggregated score."""
    verifier = GroundingVerifier()
    evidence_text = [
        "Jira SL-234: Auth config set to 7200s.",
        "Slack: Users still timing out after 15 minutes due to Cloudflare page rule."
    ]

    claim_text = (
        "Though backend config was set to 7200s (SL-234), users time out after 15 minutes. "
        "Cloudflare edge rule overrides the cache headers."
    )

    result = verifier.verify_claim(claim_text, evidence_text)
    assert result["is_grounded"] is True
    assert result["provenance"] == "verified"
    assert result["score"] >= 0.70
    assert len(result["sentences"]) >= 2
    assert result["method"] == GroundingVerifier.METHOD


# ---------------------------------------------------------------------------
# API Integration Tests
# ---------------------------------------------------------------------------

def test_handover_endpoint_returns_grounding_score_and_method():
    """GET /cases/{id}/handover returns computed grounding score and stated method."""
    res = client.get("/cases/case-001/handover", headers=_auth("lead"))
    assert res.status_code == 200
    data = res.json()

    # Grounding score must be present and valid
    assert "grounding_score" in data
    assert 0.0 <= data["grounding_score"] <= 1.0
    assert data["grounding_score"] > 0.70

    # Grounding method must be explicitly stated
    assert "grounding_method" in data
    assert "deterministic lexical and entity overlap" in data["grounding_method"]

    # Each claim includes verification details
    for item in data["items"]:
        if not item["text"].startswith("Withheld:"):
            assert "grounding" in item
            assert "method" in item["grounding"]


def test_verify_endpoint_with_custom_text():
    """POST /cases/{id}/handover/verify runs ad-hoc sentence verification."""
    payload = {
        "text": "The payments table migration was reverted due to FK errors on October 14.",
        "evidence_ids": ["art-002", "art-006"]
    }
    res = client.post("/cases/case-001/handover/verify", headers=_auth("lead"), json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["method"] == GroundingVerifier.METHOD
    ver = data["verification"]
    assert ver["is_grounded"] is True
    assert ver["provenance"] == "verified"


def test_tampered_claim_is_flagged_as_unsupported_in_handover():
    """If a claim contains unsupported claims, it is flagged and downgraded."""
    # Edit ho-001 with hallucinated facts
    tampered_text = "PR #47 requires deployment of an Oracle 19c Enterprise cluster on AWS port 1521."
    res = client.put("/cases/case-001/handover/ho-001/edit", headers=_auth("lead"), json={"text": tampered_text})
    assert res.status_code == 200

    # Fetch handover
    ho_res = client.get("/cases/case-001/handover", headers=_auth("lead"))
    assert ho_res.status_code == 200
    ho_data = ho_res.json()

    tampered_claim = next(i for i in ho_data["items"] if i["id"] == "ho-001")
    assert tampered_claim["unsupported_flag"] is True
    assert tampered_claim["provenance"] in ("inferred", "unknown")
    assert "unsupported_reason" in tampered_claim

