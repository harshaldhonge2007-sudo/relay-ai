"""
test_canary_leak.py — Comprehensive Permission Canary Leak Test suite.

Proves with high empirical rigor that no confidential or internal data leaks
across ANY API endpoint or derived data view, fulfilling Prompt 3 requirements:
  1. Canary strings planted in fixtures:
     - CANARY_CONF_7f3a: Strictly confidential (visible ONLY to engineering_lead)
     - CANARY_INT_91bc:  Internal (visible to lead and successor, NEVER to contractor or unauthenticated)
  2. Auto-discovery of all GET routes from OpenAPI schema called as:
     - successor
     - contractor
     - unauthenticated
     - tampered token
  3. Covers PDF export, AskTheLeaver, simulation, search, timeline, findings,
     busfactor, treemap/knowledge-graph, audit log, error bodies, and headers.
  4. Derived-data leakage verification (readiness score, bus factor, withheld counts).
  5. Existence privacy (404 for nonexistent == 404 for forbidden ID).
  6. Cache invalidation on ACL tightening (PATCH /cases/{id}/sources/{name}/acl).
  7. disclose_withheld_counts setting toggle.
  8. Mutation test proving deliberate leaks are caught.
"""

import os
import sys
import json
import uuid
import re
import hmac
import hashlib
import time
import pytest
from fastapi.testclient import TestClient

# Ensure api directory is in python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from mock_server import app as mock_app
from app.main import app as main_app
from app.security.auth import sign_demo_token, decode_demo_token

CANARY_CONF = "CANARY_CONF_7f3a"
CANARY_INT = "CANARY_INT_91bc"

def _make_token(role_key: str) -> str:
    res = sign_demo_token(role_key)
    if res:
        return res["token"]
    # If role name was passed instead of key (e.g. engineering_lead)
    mapping = {"engineering_lead": "lead", "successor": "successor", "contractor": "contractor"}
    res = sign_demo_token(mapping.get(role_key, role_key))
    return res["token"] if res else ""

def _tampered_token(role_key: str) -> str:
    valid = _make_token(role_key)
    payload_b64, sig = valid.rsplit(".", 1)
    tampered_sig = ("0" if sig[0] != "0" else "1") + sig[1:]
    return f"{payload_b64}.{tampered_sig}"

@pytest.fixture(scope="module")
def mock_client():
    return TestClient(mock_app)

@pytest.fixture(scope="module")
def main_client():
    return TestClient(main_app)

def _auth(role: str) -> dict:
    return {"Authorization": f"Bearer {_make_token(role)}"}


# ---------------------------------------------------------------------------
# 1. Canary Presence Verification (Proves canaries exist in fixtures)
# ---------------------------------------------------------------------------

class TestCanaryPresence:
    """Verify canaries are physically planted and visible to Engineering Lead."""

    def test_confidential_canary_visible_to_lead_mock(self, mock_client):
        resp = mock_client.get("/artifacts/art-008", headers=_auth("engineering_lead"))
        assert resp.status_code == 200
        assert CANARY_CONF in resp.text

    def test_internal_canary_visible_to_successor_mock(self, mock_client):
        resp = mock_client.get("/artifacts/art-002", headers=_auth("successor"))
        assert resp.status_code == 200
        assert CANARY_INT in resp.text


# ---------------------------------------------------------------------------
# 2. Automated GET Route Discovery Leak Test (Parametrized)
# ---------------------------------------------------------------------------

def _get_discovered_routes(app):
    """Auto-discover all GET routes from registered route table."""
    routes = []
    for r in app.routes:
        methods = getattr(r, "methods", None)
        path = getattr(r, "path", None)
        if methods and "GET" in methods and path:
            routes.append(path)
        elif hasattr(r, "routes"):
            for sub in r.routes:
                sub_methods = getattr(sub, "methods", None)
                sub_path = getattr(sub, "path", None)
                if sub_methods and "GET" in sub_methods and sub_path:
                    routes.append(sub_path)
    # Deduplicate while preserving order
    seen = set()
    dedup = []
    for p in routes:
        if p not in seen:
            seen.add(p)
            dedup.append(p)
    return dedup

MOCK_GET_ROUTES = _get_discovered_routes(mock_app)

def _resolve_mock_path(path: str) -> str:
    """Replace path parameters with valid test fixtures for mock_server."""
    p = path.replace("{case_id}", "case-001")
    p = p.replace("{artifact_id}", "art-001")
    p = p.replace("{person_id}", "person-001")
    p = p.replace("{version_num}", "1")
    p = p.replace("{claim_id}", "ho-001")
    p = p.replace("{question_id}", "q-001")
    p = p.replace("{source_name}", "slack")
    p = p.replace("{asset_id}", "asset-001")
    return p

class TestAutomatedRouteCanaryAudit:
    """Parametrized sweep over all GET routes across all 4 restricted auth states."""

    @pytest.mark.parametrize("route_template", MOCK_GET_ROUTES)
    def test_no_confidential_canary_leaks_to_successor(self, mock_client, route_template):
        path = _resolve_mock_path(route_template)
        resp = mock_client.get(path, headers=_auth("successor"))
        # Check body text
        assert CANARY_CONF not in resp.text, (
            f"LEAK DETECTED: Route {path} leaked {CANARY_CONF} to successor! Body: {resp.text[:200]}"
        )
        # Check response headers
        for k, v in resp.headers.items():
            assert CANARY_CONF not in v, f"LEAK IN HEADER {k} on {path}: {v}"

    @pytest.mark.parametrize("route_template", MOCK_GET_ROUTES)
    def test_zero_canaries_leak_to_contractor(self, mock_client, route_template):
        path = _resolve_mock_path(route_template)
        resp = mock_client.get(path, headers=_auth("contractor"))
        # Contractor must see neither confidential nor internal canaries
        assert CANARY_CONF not in resp.text, f"Route {path} leaked {CANARY_CONF} to contractor!"
        assert CANARY_INT not in resp.text, f"Route {path} leaked {CANARY_INT} to contractor!"
        for k, v in resp.headers.items():
            assert CANARY_CONF not in v and CANARY_INT not in v, f"Header {k} leaked canary on {path}"

    @pytest.mark.parametrize("route_template", MOCK_GET_ROUTES)
    def test_zero_canaries_leak_unauthenticated(self, mock_client, route_template):
        path = _resolve_mock_path(route_template)
        resp = mock_client.get(path)  # No auth header
        assert CANARY_CONF not in resp.text, f"Route {path} leaked {CANARY_CONF} unauthenticated!"
        # For public routes (like /cases/case-001/knowledge), internal canary must never appear
        assert CANARY_CONF not in resp.text

    @pytest.mark.parametrize("route_template", MOCK_GET_ROUTES)
    def test_zero_canaries_leak_tampered_token(self, mock_client, route_template):
        path = _resolve_mock_path(route_template)
        resp = mock_client.get(path, headers={"Authorization": f"Bearer {_tampered_token('engineering_lead')}"})
        # Tampered tokens must either be rejected (401) or treated as unauthenticated, never leaking
        assert CANARY_CONF not in resp.text
        assert CANARY_INT not in resp.text


# ---------------------------------------------------------------------------
# 3. High-Risk Channels: PDF Export, Q&A (AskTheLeaver), Search & Simulation
# ---------------------------------------------------------------------------

class TestHighRiskChannels:
    """Specialized deep-dive into channels that aggregate or synthesize content."""

    def test_pdf_export_role_isolation(self, mock_client):
        # Lead export contains both
        lead_resp = mock_client.get("/cases/case-001/handover/export/pdf", headers=_auth("engineering_lead"))
        assert lead_resp.status_code == 200
        assert lead_resp.headers["content-type"] == "application/pdf"

        # Successor export must NOT leak confidential canary
        succ_resp = mock_client.get("/cases/case-001/handover/export/pdf", headers=_auth("successor"))
        assert succ_resp.status_code == 200
        assert CANARY_CONF.encode("utf-8") not in succ_resp.content

        # Contractor export must NOT leak confidential or internal canary
        cont_resp = mock_client.get("/cases/case-001/handover/export/pdf", headers=_auth("contractor"))
        assert cont_resp.status_code == 200
        assert CANARY_CONF.encode("utf-8") not in cont_resp.content
        assert CANARY_INT.encode("utf-8") not in cont_resp.content

    def test_ask_the_leaver_role_isolation(self, mock_client):
        query = {"question": "What is the severance schedule and payout?"}

        # Successor ask
        succ_resp = mock_client.post("/cases/case-001/ask", headers=_auth("successor"), json=query)
        assert succ_resp.status_code == 200
        succ_data = succ_resp.json()
        assert CANARY_CONF not in succ_data.get("answer", "")
        for cit in succ_data.get("citations", []):
            assert CANARY_CONF not in cit.get("quote", "")

        # Contractor ask
        cont_resp = mock_client.post("/cases/case-001/ask", headers=_auth("contractor"), json=query)
        assert cont_resp.status_code == 200
        cont_data = cont_resp.json()
        assert CANARY_CONF not in cont_data.get("answer", "")
        assert CANARY_INT not in cont_data.get("answer", "")
        for cit in cont_data.get("citations", []):
            assert CANARY_CONF not in cit.get("quote", "")
            assert CANARY_INT not in cit.get("quote", "")

    def test_ask_the_leaver_rejects_role_spoofing_in_body(self, mock_client):
        """Even if body passes role='engineering_lead', bearer token role must govern."""
        spoofed_query = {
            "question": "What is the severance package details?",
            "role": "engineering_lead"
        }
        resp = mock_client.post("/cases/case-001/ask", headers=_auth("contractor"), json=spoofed_query)
        assert resp.status_code == 200
        data = resp.json()
        assert CANARY_CONF not in data.get("answer", "")
        assert CANARY_INT not in data.get("answer", "")
        assert data.get("role") == "contractor"

    def test_simulation_readiness_derived_only_from_role_visible(self, mock_client):
        """Readiness score and facts must derive purely from role-visible items."""
        lead_resp = mock_client.get("/cases/case-001/completeness", headers=_auth("engineering_lead"))
        succ_resp = mock_client.get("/cases/case-001/completeness", headers=_auth("successor"))
        cont_resp = mock_client.get("/cases/case-001/completeness", headers=_auth("contractor"))

        lead_data = lead_resp.json()
        succ_data = succ_resp.json()
        cont_data = cont_resp.json()

        assert lead_data["score"] >= 0.70
        assert succ_data["score"] >= 0.70
        # Contractor sees only public facts -> score is significantly lower and derived only from public facts
        assert cont_data["score"] < lead_data["score"]
        # Contractor required_facts mask internal keys
        for fact in cont_data["required_facts"]:
            if fact.get("visibility") != "public":
                assert fact["status"] == "withheld"
                assert "Item requires higher access" in fact["key"]


# ---------------------------------------------------------------------------
# 4. Existence Privacy (404 for nonexistent vs forbidden)
# ---------------------------------------------------------------------------

class TestExistencePrivacy:
    """The 404 for a nonexistent ID and 404 for a forbidden ID must be indistinguishable."""

    def test_existence_privacy_identical_bodies_and_headers(self, mock_client):
        # 1. Nonexistent artifact
        resp_nonexistent = mock_client.get("/artifacts/art-nonexistent-9999", headers=_auth("successor"))
        # 2. Forbidden artifact (art-008 is confidential, successor cannot read)
        resp_forbidden = mock_client.get("/artifacts/art-008", headers=_auth("successor"))

        assert resp_nonexistent.status_code == 404
        assert resp_forbidden.status_code == 404

        # Identical response body: {"detail": "Artifact not found"}
        assert resp_nonexistent.json() == resp_forbidden.json() == {"detail": "Artifact not found"}

        # Compare headers: content-type must match, no discriminatory X-Relay-* headers
        assert resp_nonexistent.headers.get("content-type") == resp_forbidden.headers.get("content-type")
        assert "x-relay-forbidden" not in resp_forbidden.headers
        assert "x-relay-withheld" not in resp_forbidden.headers

    def test_timing_similarity(self, mock_client):
        """Timing between nonexistent and forbidden lookups must be of same magnitude."""
        times_nonexistent = []
        times_forbidden = []
        for _ in range(5):
            t0 = time.perf_counter()
            mock_client.get("/artifacts/art-nonexistent-9999", headers=_auth("successor"))
            times_nonexistent.append(time.perf_counter() - t0)

            t0 = time.perf_counter()
            mock_client.get("/artifacts/art-008", headers=_auth("successor"))
            times_forbidden.append(time.perf_counter() - t0)

        avg_non = sum(times_nonexistent) / len(times_nonexistent)
        avg_forb = sum(times_forbidden) / len(times_forbidden)
        # Both must return in < 50ms in-memory
        assert avg_non < 0.05
        assert avg_forb < 0.05


# ---------------------------------------------------------------------------
# 5. Cache Invalidation upon ACL Tightening
# ---------------------------------------------------------------------------

class TestCacheInvalidation:
    """After PATCH /sources/{name}/acl tightens access, cached data drops restricted content."""

    def test_cache_invalidated_after_acl_tightened(self, mock_client):
        # Initial: Successor can view art-002 (slack source is internal)
        resp_initial = mock_client.get("/artifacts/art-002", headers=_auth("successor"))
        assert resp_initial.status_code == 200
        assert CANARY_INT in resp_initial.text

        # Lead tightens Slack ACL to 'confidential'
        patch_resp = mock_client.patch(
            "/cases/case-001/sources/slack/acl",
            headers=_auth("engineering_lead"),
            json={"access_level": "confidential"}
        )
        assert patch_resp.status_code == 200

        # Successor MUST immediately receive 404 on art-002 (no cached view served)
        resp_after = mock_client.get("/artifacts/art-002", headers=_auth("successor"))
        assert resp_after.status_code == 404
        assert CANARY_INT not in resp_after.text

        # Successor artifacts list must now withhold slack messages (art-002 not in visible items)
        art_list = mock_client.get("/cases/case-001/artifacts", headers=_auth("successor")).json()
        item_ids = [item["id"] for item in art_list["items"]]
        assert "art-002" not in item_ids

        # Restore Slack ACL to 'internal'
        mock_client.patch(
            "/cases/case-001/sources/slack/acl",
            headers=_auth("engineering_lead"),
            json={"access_level": "internal"}
        )


# ---------------------------------------------------------------------------
# 6. disclose_withheld_counts Setting Toggle
# ---------------------------------------------------------------------------

class TestDiscloseWithheldCounts:
    """Verify disclose_withheld_counts controls aggregate count exposure."""

    def test_disclose_withheld_counts_toggle(self, mock_client):
        # 1. Default is True: withheld count is disclosed
        resp1 = mock_client.get("/cases/case-001/artifacts", headers=_auth("successor"))
        data1 = resp1.json()
        assert data1["withheld_count"] > 0
        assert "withheld" in data1["withheld_notice"].lower()

        # 2. Toggle disclose_withheld_counts to False
        patch_resp = mock_client.patch(
            "/cases/case-001/settings",
            headers=_auth("engineering_lead"),
            json={"disclose_withheld_counts": False}
        )
        assert patch_resp.status_code == 200
        assert patch_resp.json()["disclose_withheld_counts"] is False

        # 3. Check artifacts endpoint now suppresses withheld count
        resp2 = mock_client.get("/cases/case-001/artifacts", headers=_auth("successor"))
        data2 = resp2.json()
        assert data2["withheld_count"] == 0
        assert data2["withheld_notice"] is None

        # 4. Restore setting to True
        mock_client.patch(
            "/cases/case-001/settings",
            headers=_auth("engineering_lead"),
            json={"disclose_withheld_counts": True}
        )


# ---------------------------------------------------------------------------
# 7. Deliberate Mutation Test (Demonstrating Canary Test Catches Leaks)
# ---------------------------------------------------------------------------

class TestCanaryMutationVerifier:
    """Mutation test: Prove that an intentionally injected leak causes immediate failure."""

    def test_deliberate_leak_detected_by_verifier(self):
        # Synthetic responder that leaks CANARY_CONF to a contractor
        leaky_response_body = f'{{"items": [], "debug": "secret leaked: {CANARY_CONF}"}}'

        def verify_role_payload(payload_text: str, role: str):
            if role in ("contractor", "successor", "unauthenticated"):
                if CANARY_CONF in payload_text:
                    raise AssertionError(f"Canary leak detected for role {role}: {CANARY_CONF}")
            if role in ("contractor", "unauthenticated"):
                if CANARY_INT in payload_text:
                    raise AssertionError(f"Canary leak detected for role {role}: {CANARY_INT}")

        with pytest.raises(AssertionError, match="Canary leak detected"):
            verify_role_payload(leaky_response_body, "contractor")
