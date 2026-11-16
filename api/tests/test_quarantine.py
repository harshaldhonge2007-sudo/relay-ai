"""
RELAY AI — Item-Level Sensitive-Content Quarantine Tests
Validates classifier accuracy, evaluation benchmark metrics, API endpoints,
and strict role isolation (quarantined items never leak to successor or contractor).
"""

import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.security.quarantine import SensitiveClassifier, shannon_entropy, luhn_verify, default_classifier
from app.security.auth import sign_demo_token
from mock_server import app as mock_app


BENCHMARK_PATH = Path(__file__).resolve().parent.parent.parent / "eval" / "quarantine_benchmark.json"


@pytest.fixture
def client():
    return TestClient(mock_app)


@pytest.fixture
def lead_headers():
    token = sign_demo_token("lead")["token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def successor_headers():
    token = sign_demo_token("successor")["token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def contractor_headers():
    token = sign_demo_token("contractor")["token"]
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# 1. Deterministic Classifier Unit Tests
# ---------------------------------------------------------------------------

class TestQuarantineClassifier:
    def test_shannon_entropy_calculation(self):
        # Uniform text has lower entropy
        low_ent = shannon_entropy("aaaaaaaaaaaaaaaaaaaaaaaa")
        assert low_ent == 0.0

        # High-entropy random hex or base64 token
        high_ent = shannon_entropy("4b8c9d2f1a7e5c3b8a9d0e2f1b4c7a")
        assert high_ent > 3.5

    def test_luhn_credit_card_verifier(self):
        # Valid Visa test number
        assert luhn_verify("4532 0150 1234 5671") is True
        assert luhn_verify("4532015012345671") is True

        # Invalid card numbers (fails mod 10 checksum)
        assert luhn_verify("4532 0150 1234 5670") is False
        assert luhn_verify("1234567890123456") is False

    def test_secrets_classification(self):
        classifier = SensitiveClassifier()
        text = "Found AWS key AKIAIOSFODNN7EXAMPLE and GitHub pat ghp_111122223333444455556666777788889999"
        is_q, reasons, matches = classifier.classify_text(text)
        assert is_q is True
        assert any("secret" in r for r in reasons)
        assert len(matches) >= 2

    def test_pii_classification(self):
        classifier = SensitiveClassifier()
        text = "Contact john.smith@company.org or call (415) 555-0199 for assistance."
        is_q, reasons, matches = classifier.classify_text(text)
        assert is_q is True
        assert "pii:email" in reasons
        assert "pii:phone" in reasons

    def test_hr_legal_classification(self):
        classifier = SensitiveClassifier()
        text = "Priya's salary was set to $185,000 before the performance improvement plan (PIP) and termination."
        is_q, reasons, matches = classifier.classify_text(text)
        assert is_q is True
        assert "hr:salary" in reasons
        assert "hr:performance" in reasons
        assert "hr:termination" in reasons

    def test_customer_id_classification(self):
        classifier = SensitiveClassifier()
        text = "Customer account CID-88219 has tenant_id: tenant-corp-alpha-9021."
        is_q, reasons, matches = classifier.classify_text(text)
        assert is_q is True
        assert "customer:id" in reasons

    def test_redaction_replaces_with_stable_placeholders(self):
        classifier = SensitiveClassifier()
        text = "Email alice@example.com regarding salary $150k and CID-99214"
        redacted = classifier.redact(text)
        assert "[REDACTED:email]" in redacted
        assert "[REDACTED:salary]" in redacted
        assert "[REDACTED:customer_id]" in redacted
        assert "alice@example.com" not in redacted


# ---------------------------------------------------------------------------
# 2. Benchmark Precision & Recall Evaluation
# ---------------------------------------------------------------------------

class TestQuarantineBenchmark:
    def test_precision_recall_benchmark(self):
        assert BENCHMARK_PATH.exists(), f"Benchmark file {BENCHMARK_PATH} missing"
        with open(BENCHMARK_PATH, "r") as f:
            samples = json.load(f)

        classifier = default_classifier

        tp = 0
        fp = 0
        tn = 0
        fn = 0

        for item in samples:
            text = item["text"]
            expected = item["expected_quarantine"]
            is_q, reasons, _ = classifier.classify_text(text)

            if is_q and expected:
                tp += 1
            elif is_q and not expected:
                fp += 1
            elif not is_q and expected:
                fn += 1
            else:
                tn += 1

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

        print(f"\nQuarantine Benchmark: TP={tp}, FP={fp}, TN={tn}, FN={fn}")
        print(f"Precision: {precision:.4f}, Recall: {recall:.4f}, F1: {f1:.4f}")

        # Assert high accuracy bounds
        assert precision >= 0.90, f"Precision below 90%: {precision:.2%}"
        assert recall >= 0.90, f"Recall below 90%: {recall:.2%}"


# ---------------------------------------------------------------------------
# 3. Role Isolation & Anti-Leak Tests (Canaries in Quarantine)
# ---------------------------------------------------------------------------

class TestQuarantineRoleIsolation:
    HR_CANARY = "CANARY_QUARANTINE_e42b_hr"
    CUST_CANARY = "CANARY_QUARANTINE_e42b_cust"

    def test_lead_can_access_quarantine_queue(self, client, lead_headers):
        resp = client.get("/cases/case-001/quarantine", headers=lead_headers)
        assert resp.status_code == 200
        items = resp.json()
        assert isinstance(items, list)
        assert len(items) >= 2
        ids = [i["id"] for i in items]
        assert "art-014" in ids
        assert "art-015" in ids

    def test_non_lead_cannot_access_quarantine_queue(self, client, successor_headers, contractor_headers):
        # Successor blocked (403)
        resp_succ = client.get("/cases/case-001/quarantine", headers=successor_headers)
        assert resp_succ.status_code == 403

        # Contractor blocked (403)
        resp_cont = client.get("/cases/case-001/quarantine", headers=contractor_headers)
        assert resp_cont.status_code == 403

    def test_quarantined_canaries_never_leak_in_artifacts_list(self, client, successor_headers, contractor_headers):
        # Successor view
        resp_succ = client.get("/cases/case-001/artifacts", headers=successor_headers)
        assert resp_succ.status_code == 200
        body_succ = resp_succ.text
        assert self.HR_CANARY not in body_succ
        assert self.CUST_CANARY not in body_succ

        # Contractor view
        resp_cont = client.get("/cases/case-001/artifacts", headers=contractor_headers)
        assert resp_cont.status_code == 200
        body_cont = resp_cont.text
        assert self.HR_CANARY not in body_cont
        assert self.CUST_CANARY not in body_cont

    def test_direct_id_access_to_quarantined_returns_404(self, client, successor_headers, contractor_headers):
        # Non-leads receive 404 for quarantined artifacts, ensuring existence privacy
        for art_id in ["art-014", "art-015"]:
            resp_s = client.get(f"/artifacts/{art_id}", headers=successor_headers)
            assert resp_s.status_code == 404
            assert resp_s.json() == {"detail": "Artifact not found"}

            resp_c = client.get(f"/artifacts/{art_id}", headers=contractor_headers)
            assert resp_c.status_code == 404
            assert resp_c.json() == {"detail": "Artifact not found"}

    def test_quarantined_items_never_leak_in_ask_the_leaver(self, client, successor_headers):
        resp = client.post(
            "/cases/case-001/ask",
            headers=successor_headers,
            json={"question": "What is Priya's compensation, retention bonus, and customer complaints?"},
        )
        assert resp.status_code == 200
        resp_text = json.dumps(resp.json())
        assert self.HR_CANARY not in resp_text
        assert self.CUST_CANARY not in resp_text

    def test_quarantined_items_never_leak_in_timeline_or_findings(self, client, successor_headers):
        # Artifacts list (timeline source)
        art_resp = client.get("/cases/case-001/artifacts", headers=successor_headers)
        assert art_resp.status_code == 200
        art_text = art_resp.text
        assert self.HR_CANARY not in art_text
        assert self.CUST_CANARY not in art_text

        # Findings
        f_resp = client.get("/cases/case-001/findings", headers=successor_headers)
        assert f_resp.status_code == 200
        f_text = f_resp.text
        assert self.HR_CANARY not in f_text
        assert self.CUST_CANARY not in f_text


# ---------------------------------------------------------------------------
# 4. Lead Quarantine Resolution Lifecycle
# ---------------------------------------------------------------------------

class TestQuarantineResolutionLifecycle:
    def test_redact_and_keep_action(self, client, lead_headers, successor_headers):
        # 1. Lead resolves art-014 with "redact"
        resolve_resp = client.post(
            "/cases/case-001/quarantine/art-014/resolve",
            headers=lead_headers,
            json={"action": "redact", "note": "Redacted HR sensitive compensation terms"},
        )
        assert resolve_resp.status_code == 200
        data = resolve_resp.json()
        assert data["status"] == "ok"
        assert data["quarantine_status"] == "redacted"

        # 2. Successor can now read art-014, with sensitive fields masked
        art_resp = client.get("/artifacts/art-014", headers=successor_headers)
        assert art_resp.status_code == 200
        body = art_resp.json()["body"]
        assert "[REDACTED:salary]" in body
        assert "[REDACTED:legal]" in body
        # Raw canary must NOT leak
        assert "CANARY_QUARANTINE_e42b_hr" not in body

    def test_clear_action(self, client, lead_headers, successor_headers):
        # Lead resolves art-015 with "clear"
        resolve_resp = client.post(
            "/cases/case-001/quarantine/art-015/resolve",
            headers=lead_headers,
            json={"action": "clear", "note": "Customer support escalation cleared for team visibility"},
        )
        assert resolve_resp.status_code == 200
        assert resolve_resp.json()["quarantine_status"] == "cleared"

        # Successor (who can view internal channel) can now view art-015
        art_resp = client.get("/artifacts/art-015", headers=successor_headers)
        assert art_resp.status_code == 200

    def test_bulk_resolve_action(self, client, lead_headers):
        resp = client.post(
            "/cases/case-001/quarantine/bulk-resolve",
            headers=lead_headers,
            json={"action": "confidential", "artifact_ids": ["art-014", "art-015"]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["resolved_count"] == 2

    def test_audit_log_records_quarantine_decisions(self, client, lead_headers):
        admin_resp = client.get("/cases/case-001/admin", headers=lead_headers)
        assert admin_resp.status_code == 200
        audit_log = admin_resp.json()["audit_log"]
        actions = [entry["action"] for entry in audit_log]
        assert any("Quarantine resolution" in a for a in actions)
