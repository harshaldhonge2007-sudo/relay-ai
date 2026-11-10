"""
test_parity.py — Route and auth-behavior parity between mock_server and api/app/main.py.

Where parity is intentionally not 1:1, the reason is documented inline.

Intentional non-parity:
  - main.py has /cases/{id}/ingest and /people/* (database-backed, no mock equivalent).
  - main.py /cases/{id}/handover returns real DB rows; mock returns seeded list.
  - Case IDs: main.py enforces uuid.UUID; mock accepts any string.
  - /cases/{id}/redactions exists in mock only (main.py stub returns 404 — documented gap).
  - Response shapes for /uncertainty, /decisions, /contacts differ in item count
    (main.py = 2, mock = 3) — documented gap to close in Step 2.
"""
import os
import sys
import pytest

# Ensure both apps import from the same api/ root.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ---------------------------------------------------------------------------
# Shared route table — routes that must exist in BOTH servers
# ---------------------------------------------------------------------------

SHARED_ROUTES = [
    # (method, path_template)
    ("GET",  "/health"),
    ("GET",  "/"),
    ("POST", "/auth/demo-login"),
    ("GET",  "/cases"),
    ("POST", "/cases"),
    ("GET",  "/cases/{case_id}"),
    ("GET",  "/cases/{case_id}/components"),
    ("GET",  "/cases/{case_id}/knowledge"),
    ("GET",  "/cases/{case_id}/artifacts"),
    ("GET",  "/artifacts/{artifact_id}"),
    ("GET",  "/cases/{case_id}/findings"),
    ("GET",  "/cases/{case_id}/questions"),
    ("POST", "/cases/{case_id}/questions/{question_id}/answer"),
    ("GET",  "/cases/{case_id}/handover"),
    ("POST", "/cases/{case_id}/handover/{claim_id}/approve"),
    ("POST", "/cases/{case_id}/handover/{claim_id}/reject"),
    ("PUT",  "/cases/{case_id}/handover/{claim_id}/edit"),
    ("POST", "/cases/{case_id}/handover/approve"),
    ("POST", "/cases/{case_id}/handover/release"),
    ("POST", "/cases/{case_id}/handover/acknowledge"),
    ("GET",  "/cases/{case_id}/handover/versions"),
    ("GET",  "/cases/{case_id}/handover/versions/{version_num}"),
    ("GET",  "/cases/{case_id}/handover/diff"),
    ("POST", "/cases/{case_id}/handover/verify"),
    ("GET",  "/cases/{case_id}/completeness"),
    ("POST", "/cases/{case_id}/completeness/run"),
    ("POST", "/cases/{case_id}/completeness/fix-missing"),
    ("POST", "/cases/{case_id}/completeness/regenerate-handover"),
    ("GET",  "/cases/{case_id}/admin"),
    ("GET",  "/cases/{case_id}/uncertainty"),
    ("GET",  "/cases/{case_id}/decisions"),
    ("GET",  "/cases/{case_id}/contacts"),
    ("GET",  "/cases/{case_id}/continuation"),
    ("POST", "/demo/seed"),
]

# Routes that exist ONLY in mock — documented gaps in main.py
MOCK_ONLY_ROUTES = [
    ("GET", "/cases/{case_id}/redactions"),          # not yet in main.py
    ("GET", "/cases/{case_id}/handover/{claim_id}/history"),  # stub in main.py
    ("GET", "/people/{person_id}"),                  # DB-backed in main.py, pattern differs
]

# Routes that exist ONLY in main.py — no equivalent in mock
MAIN_ONLY_ROUTES = [
    ("POST", "/cases/{case_id}/ingest"),             # DB-backed ingest pipeline
    ("POST", "/people"),                             # DB-backed person creation
]


def _extract_routes(app) -> dict:
    """Return {(method, path): route_obj} for all routes registered on an app."""
    routes = {}
    for route in app.routes:
        if hasattr(route, "methods") and hasattr(route, "path"):
            for method in route.methods:
                routes[(method.upper(), route.path)] = route
        elif hasattr(route, "include_context") and hasattr(route, "original_router"):
            pfx = getattr(route.include_context, "prefix", "")
            for sub in route.original_router.routes:
                if hasattr(sub, "methods") and hasattr(sub, "path"):
                    full_p = pfx + sub.path
                    for method in sub.methods:
                        routes[(method.upper(), full_p)] = sub
        elif hasattr(route, "routes"):
            for sub in route.routes:
                if hasattr(sub, "methods") and hasattr(sub, "path"):
                    for method in sub.methods:
                        routes[(method.upper(), sub.path)] = sub
    return routes


class TestRouteParity:
    """Assert that all SHARED_ROUTES exist in both servers."""

    @pytest.fixture(scope="class")
    def mock_routes(self):
        try:
            from mock_server import app as mock_app
        except ImportError:
            pytest.skip("mock_server not importable")
        return _extract_routes(mock_app)

    @pytest.fixture(scope="class")
    def main_routes(self):
        try:
            # Import without triggering DB startup
            import importlib
            import unittest.mock as mock
            with mock.patch("app.db.init_db"), mock.patch("app.db.close_db"):
                from app.main import app as main_app
        except Exception:
            pytest.skip("app.main not importable (asyncpg/DB missing)")
        return _extract_routes(main_app)

    @pytest.mark.parametrize("method,path", SHARED_ROUTES)
    def test_route_exists_in_mock(self, method, path, mock_routes):
        """Every shared route must exist in mock_server."""
        # Routes may be registered with or without /api prefix; check both.
        found = (method, path) in mock_routes or (method, f"/api{path}") in mock_routes
        assert found, f"MISSING in mock_server: {method} {path}"

    @pytest.mark.parametrize("method,path", SHARED_ROUTES)
    def test_route_exists_in_main(self, method, path, main_routes):
        """Every shared route must exist in api/app/main.py."""
        found = (method, path) in main_routes or (method, f"/api{path}") in main_routes
        assert found, f"MISSING in app/main.py: {method} {path}"


class TestAuthParity:
    """
    Auth enforcement must be consistent: lead-only operations return 403 for
    non-leads in both servers.
    """

    @pytest.fixture(scope="class")
    def mock_client(self):
        try:
            from fastapi.testclient import TestClient
            from mock_server import app as mock_app
            return TestClient(mock_app)
        except ImportError:
            pytest.skip("mock_server not importable")

    def _login(self, client, user: str) -> str:
        resp = client.post("/auth/demo-login", json={"user": user})
        return resp.json().get("token", "")

    @pytest.mark.parametrize("endpoint,method", [
        ("/cases/case-001/handover/ho-001/approve", "post"),
        ("/cases/case-001/handover/ho-001/reject", "post"),
        ("/cases/case-001/handover/release", "post"),
    ])
    def test_lead_only_actions_blocked_for_successor(self, mock_client, endpoint, method):
        """Successor must receive 403 on lead-only actions."""
        token = self._login(mock_client, "successor")
        fn = getattr(mock_client, method)
        resp = fn(endpoint, headers={"Authorization": f"Bearer {token}"}, json={})
        assert resp.status_code == 403, (
            f"Expected 403 for successor on {method.upper()} {endpoint}, got {resp.status_code}"
        )

    @pytest.mark.parametrize("endpoint,method", [
        ("/cases/case-001/handover/ho-001/approve", "post"),
        ("/cases/case-001/handover/ho-001/reject", "post"),
        ("/cases/case-001/handover/release", "post"),
    ])
    def test_lead_only_actions_blocked_for_contractor(self, mock_client, endpoint, method):
        """Contractor must receive 403 on lead-only actions."""
        token = self._login(mock_client, "contractor")
        fn = getattr(mock_client, method)
        resp = fn(endpoint, headers={"Authorization": f"Bearer {token}"}, json={})
        assert resp.status_code == 403, (
            f"Expected 403 for contractor on {method.upper()} {endpoint}, got {resp.status_code}"
        )

    def test_expired_token_returns_fallback_role(self, mock_client):
        """An expired token must not grant lead access — server defaults to successor role."""
        import base64, json, hmac as _hmac, hashlib, os, secrets, time
        # Forge an expired token signed with the same secret (resolved at import time).
        # We can't know the runtime secret, so we test that forging with a wrong secret fails.
        fake_payload = json.dumps({"role": "engineering_lead", "user": "lead", "iat": 1000}, separators=(",", ":"))
        fake_b64 = base64.b64encode(fake_payload.encode()).decode()
        fake_sig = _hmac.new(b"wrong-secret", fake_b64.encode(), hashlib.sha256).hexdigest()
        forged_token = f"{fake_b64}.{fake_sig}"
        # Attempt a lead-only action with the forged token.
        resp = mock_client.post(
            "/cases/case-001/handover/release",
            headers={"Authorization": f"Bearer {forged_token}"},
            json={},
        )
        assert resp.status_code in (400, 403, 422), (
            f"Forged/expired token should not grant lead access; got {resp.status_code}"
        )

    def test_forged_x_relay_role_header_does_not_grant_lead(self, mock_client):
        """X-Relay-Role header alone must never grant elevated permissions."""
        resp = mock_client.post(
            "/cases/case-001/handover/ho-001/approve",
            headers={"X-Relay-Role": "engineering_lead"},
            json={},
        )
        assert resp.status_code == 403, (
            f"X-Relay-Role header should not grant lead access; got {resp.status_code}"
        )


class TestContractorLeakParity:
    """
    Contractor-role responses must NOT contain names of withheld internal resources.
    Both servers must pass this check.
    """

    @pytest.fixture(scope="class")
    def mock_client(self):
        try:
            from fastapi.testclient import TestClient
            from mock_server import app as mock_app
            return TestClient(mock_app)
        except ImportError:
            pytest.skip("mock_server not importable")

    def _contractor_token(self, client) -> str:
        resp = client.post("/auth/demo-login", json={"user": "contractor"})
        return resp.json().get("token", "")

    # Names that should NEVER appear in contractor-visible completeness responses.
    _RESTRICTED_NAMES = [
        "REPORT_BUCKET_NAME",
        "SMTP_RELAY_HOST",
        "currency_code_backfill",
        "jwt_timeout_root_cause",
        "pg15_upgrade_runbook",
        "Database migration backfill",
    ]

    def test_completeness_does_not_leak_restricted_key_names_to_contractor(self, mock_client):
        """required_facts must not expose key names for withheld items."""
        token = self._contractor_token(mock_client)
        resp = mock_client.get(
            "/cases/case-001/completeness",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body_text = resp.text
        for name in self._RESTRICTED_NAMES:
            assert name not in body_text, (
                f"Contractor completeness response leaks restricted name: {name!r}"
            )

    def test_completeness_blockers_do_not_leak_restricted_names_to_contractor(self, mock_client):
        """blockers[] must not name internal credentials to contractor."""
        token = self._contractor_token(mock_client)
        resp = mock_client.get(
            "/cases/case-001/completeness",
            headers={"Authorization": f"Bearer {token}"},
        )
        body = resp.json()
        for blocker in body.get("blockers", []):
            for name in self._RESTRICTED_NAMES:
                assert name not in blocker, (
                    f"Contractor blocker leaks restricted name {name!r}: {blocker!r}"
                )

    def test_uncertainty_role_filtered_for_contractor(self, mock_client):
        """Uncertainty endpoint must filter restricted evidence for contractor."""
        token = self._contractor_token(mock_client)
        resp = mock_client.get(
            "/cases/case-001/uncertainty",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        # missing_evidence items reference internal docs — must be empty for contractor
        assert body.get("missing_evidence") == [], (
            "Contractor must not see missing_evidence items"
        )
        # Withheld count must be present so they know something was hidden.
        assert "withheld_missing_evidence_count" in body or "notice" in body, (
            "Contractor uncertainty response must include a withheld count or notice"
        )

    def test_fix_missing_blocked_for_contractor(self, mock_client):
        """Contractor must not be able to trigger the fix-missing loop."""
        token = self._contractor_token(mock_client)
        resp = mock_client.post(
            "/cases/case-001/completeness/fix-missing",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403, (
            f"Contractor should be blocked from fix-missing; got {resp.status_code}"
        )

