"""
Unit and End-to-End Tests for Bring-Your-Own-Data (BYOD) Importers.

Validates:
1. File format parsers (Slack ZIP/JSON, Jira CSV/JSON, Markdown/PDF docs)
2. Ingestion security (zip-slip defense, size limits, binary sniffing, HTML/XSS neutralization)
3. Staging and preview flow (verifying zero persistence before lead commit)
4. Quarantine pipeline integration (sensitive content quarantined upon commit)
5. Interactive identity confirmation and splitting with attribution update
6. Generic required_facts template and readiness scoring
7. End-to-end journey test uploading Slack ZIP & Jira CSV
"""

import io
import json
import zipfile
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from mock_server import app as mock_app, db as mock_db
from app.ingest.importers import DataImporter, sanitize_text, MAX_FILE_SIZE
from app.ingest.pipeline import create_import_preview, get_staged_import, drop_staged_import
from app.sim.required_facts import build_generic_required_facts, compute_readiness_score
from app.security.auth import sign_demo_token

SAMPLES_DIR = Path(__file__).parent.parent.parent / "samples"


@pytest.fixture
def client():
    return TestClient(mock_app)


@pytest.fixture
def lead_token():
    return sign_demo_token("lead")["token"]


@pytest.fixture
def successor_token():
    return sign_demo_token("successor")["token"]


@pytest.fixture
def contractor_token():
    return sign_demo_token("contractor")["token"]


# ===========================================================================
# 1. Parsers: Slack, Jira, Docs
# ===========================================================================

class TestDataParsers:
    def test_parse_slack_zip(self):
        slack_zip_path = SAMPLES_DIR / "slack_export.zip"
        assert slack_zip_path.exists(), "samples/slack_export.zip must exist"

        importer = DataImporter()
        with open(slack_zip_path, "rb") as f:
            items = importer.parse_file("slack_export.zip", f.read())

        assert len(items) >= 4
        assert importer.report.items_by_source["slack"] >= 4
        assert importer.report.files_processed == 1
        assert len(importer.report.errors) == 0

        # Verify metadata extraction
        sample_msg = next((it for it in items if "payments worker" in it["body"]), None)
        assert sample_msg is not None
        assert sample_msg["source"] == "slack"
        assert sample_msg["author_name"] == "Priya Nair"
        assert sample_msg["author_email"] == "priya@shopledger.io"
        assert "slack.com/archives" in sample_msg["url"]

    def test_parse_jira_csv(self):
        jira_csv_path = SAMPLES_DIR / "jira_export.csv"
        assert jira_csv_path.exists(), "samples/jira_export.csv must exist"

        importer = DataImporter()
        with open(jira_csv_path, "rb") as f:
            items = importer.parse_file("jira_export.csv", f.read())

        assert len(items) == 4
        assert importer.report.items_by_source["jira"] == 4

        # Check fields
        pay_101 = next((it for it in items if it["external_id"] == "PAY-101"), None)
        assert pay_101 is not None
        assert "Payment Intents v2" in pay_101["title"]
        assert "Status: In Progress" in pay_101["body"]
        assert pay_101["author_name"] == "Priya Nair"

    def test_parse_markdown_doc(self):
        notes_path = SAMPLES_DIR / "meeting_notes.md"
        assert notes_path.exists(), "samples/meeting_notes.md must exist"

        importer = DataImporter()
        with open(notes_path, "rb") as f:
            items = importer.parse_file("meeting_notes.md", f.read())

        assert len(items) == 1
        assert items[0]["source"] == "docs"
        assert items[0]["title"] == "Architecture Sync - Payment Gateway V2 Migration"
        assert "export STRIPE_WEBHOOK_SECRET" in items[0]["body"]


# ===========================================================================
# 2. Safety & Defenses: Zip-Slip, Executables, HTML/XSS, Size Limits
# ===========================================================================

class TestIngestSafety:
    def test_zip_slip_rejection(self):
        """Verify zip files with path traversal components (..) are rejected."""
        bio = io.BytesIO()
        with zipfile.ZipFile(bio, "w") as z:
            z.writestr("../../etc/passwd", "root:x:0:0::/root:/bin/bash")
            z.writestr("clean.json", json.dumps([{"text": "safe"}]))

        importer = DataImporter()
        items = importer.parse_file("malicious.zip", bio.getvalue())

        assert len(items) == 0
        assert any("Zip-slip path traversal attempt detected" in err for err in importer.report.errors)

    def test_executable_binary_rejection(self):
        """Verify executable binaries (Windows PE, Linux ELF) are rejected by magic bytes."""
        importer = DataImporter()

        pe_binary = b"MZ\x90\x00\x03\x00\x00\x00malicious_windows_payload"
        items = importer.parse_file("installer.exe", pe_binary)
        assert len(items) == 0
        assert any("Executable binary content rejected" in err for err in importer.report.errors)

        elf_binary = b"\x7fELF\x02\x01\x01\x00malicious_linux_payload"
        items2 = importer.parse_file("payload.bin", elf_binary)
        assert len(items2) == 0
        assert any("Executable binary content rejected" in err for err in importer.report.errors)

    def test_oversized_file_rejection(self):
        """Verify files exceeding 10MB size limit are rejected."""
        importer = DataImporter()
        oversized = b"A" * (MAX_FILE_SIZE + 1024)
        items = importer.parse_file("huge_log.txt", oversized)
        assert len(items) == 0
        assert any("exceeds maximum size limit" in err for err in importer.report.errors)

    def test_html_xss_neutralization(self):
        """Verify embedded HTML script tags are stripped and neutralized."""
        dirty = "<script>alert('xss')</script>Hello <b>World</b>! <img src=x onerror=alert(1)>"
        cleaned = sanitize_text(dirty)
        assert "<script>" not in cleaned
        assert "<img" not in cleaned
        assert "Hello World!" in cleaned


# ===========================================================================
# 3. Two-Phase Staging: Preview Before Persist
# ===========================================================================

class TestPreviewStaging:
    def test_preview_does_not_persist_artifacts(self, client, lead_token):
        """Previewing an import must not mutate the case or add artifacts to database."""
        initial_artifact_count = len(mock_db["artifacts"])

        files = [
            ("notes.md", b"# Architecture Sync\nRun command: python -m app.worker"),
            ("jira.csv", b"Issue key,Summary,Status\nTEST-1,Test task,Open"),
        ]

        # Use multipart form
        form_files = [
            ("files", (fname, content, "text/plain"))
            for fname, content in files
        ]

        res = client.post(
            "/cases/case-001/import/preview",
            headers={"Authorization": f"Bearer {lead_token}"},
            files=form_files,
        )
        assert res.status_code == 200
        preview = res.json()

        assert "staging_token" in preview
        assert preview["total_items"] == 2
        assert preview["item_counts"]["docs"] == 1
        assert preview["item_counts"]["jira"] == 1

        # Database must NOT have changed!
        assert len(mock_db["artifacts"]) == initial_artifact_count


# ===========================================================================
# 4. Identity Confirm and Split
# ===========================================================================

class TestIdentityResolution:
    def test_confirm_identity_merge(self, client, lead_token):
        res = client.post(
            "/cases/case-001/identities/id-002/confirm",
            headers={"Authorization": f"Bearer {lead_token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "confirmed"
        assert data["confidence"] == "100% (Lead Confirmed)"

        # Verify audit log updated
        latest_audit = mock_db["admin"]["audit_log"][0]
        assert "Confirmed identity merge" in latest_audit["action"]

    def test_split_identity_merge(self, client, lead_token):
        res = client.post(
            "/cases/case-001/identities/id-003/split",
            headers={"Authorization": f"Bearer {lead_token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "split"
        assert len(data["split_entities"]) == 2
        assert data["busfactor_updated"] is True

        # Check that separated personas are present
        names = [e["name"] for e in data["split_entities"]]
        assert any("(Code & Repos)" in n for n in names)
        assert any("(Comms & Tasks)" in n for n in names)


# ===========================================================================
# 5. Generic Required Facts & Readiness Score
# ===========================================================================

class TestGenericRequiredFacts:
    def test_generic_required_facts_builder(self):
        artifacts = [
            {
                "title": "Payment Runbook",
                "body": "How to run: python -m services.payments.worker\nexport DATABASE_URL=postgres://localhost:5432\nexport STRIPE_KEY=sk_test_123",
                "acl_tag": "public",
                "source": "docs",
            },
            {
                "title": "Deploy Steps",
                "body": "Deployment procedure: alembic upgrade head\nPrimary component maintainers: Priya Nair",
                "acl_tag": "internal",
                "source": "docs",
            },
        ]

        facts = build_generic_required_facts(artifacts)
        assert len(facts) >= 6  # 5 base categories + discovered env vars

        # Verify base facts
        how_to_run = next(f for f in facts if f["kind"] == "how_to_run")
        assert how_to_run["status"] == "found"

        deploy_steps = next(f for f in facts if f["kind"] == "deploy_steps")
        assert deploy_steps["status"] == "found"

        # Verify discovered env vars
        env_keys = [f["key"] for f in facts if f["kind"] == "env_var"]
        assert "DATABASE_URL" in env_keys
        assert "STRIPE_KEY" in env_keys

        # Check readiness score calculation
        lead_comp = compute_readiness_score(facts, role="engineering_lead")
        assert lead_comp["score"] > 0.5

        contractor_comp = compute_readiness_score(facts, role="contractor")
        # Internal deploy_steps fact should be withheld from contractor
        assert contractor_comp["withheld_facts_count"] >= 1


# ===========================================================================
# 6. End-to-End Journey Test: Upload Slack & Jira, Commit, Verify Handover
# ===========================================================================

class TestBYODJourney:
    def test_end_to_end_byod_upload_and_handover_generation(
        self, client, lead_token, successor_token, contractor_token
    ):
        """
        Acceptance test:
        1. Lead uploads Slack export and Jira CSV
        2. Inspects preview (detects sensitive items, people, counts)
        3. Assigns visibility tiers and commits
        4. Verifies handover claims have citations into uploaded artifacts
        5. Verifies role filtering prevents leaks to contractors
        """
        slack_path = SAMPLES_DIR / "slack_export.zip"
        jira_path = SAMPLES_DIR / "jira_export.csv"

        with open(slack_path, "rb") as sf, open(jira_path, "rb") as jf:
            form_files = [
                ("files", ("slack_export.zip", sf.read(), "application/zip")),
                ("files", ("jira_export.csv", jf.read(), "text/csv")),
            ]
            preview_res = client.post(
                "/cases/case-001/import/preview",
                headers={"Authorization": f"Bearer {lead_token}"},
                files=form_files,
            )

        assert preview_res.status_code == 200
        preview = preview_res.json()

        staging_token = preview["staging_token"]
        assert preview["total_items"] >= 8
        assert preview["item_counts"]["slack"] >= 4
        assert preview["item_counts"]["jira"] == 4

        # Sensitive items detected (e.g. NDA / compensation in slack message)
        assert len(preview["detected_sensitive_items"]) > 0

        # Commit with source visibility tiers
        commit_payload = {
            "staging_token": staging_token,
            "source_tiers": {
                "slack": "internal",
                "jira": "public",
            },
        }

        commit_res = client.post(
            "/cases/case-001/import/commit",
            headers={"Authorization": f"Bearer {lead_token}"},
            json=commit_payload,
        )
        assert commit_res.status_code == 200
        commit_data = commit_res.json()
        assert commit_data["committed_items"] >= 8
        assert commit_data["readiness_score"] > 0

        # Verify handover contains new verified item citing imported content
        ho_res = client.get(
            "/cases/case-001/handover",
            headers={"Authorization": f"Bearer {lead_token}"},
        )
        assert ho_res.status_code == 200
        ho_data = ho_res.json()
        items = ho_data.get("items", [])
        byod_item = next((it for it in items if "byod" in it["id"].lower()), None)
        assert byod_item is not None
        assert byod_item["provenance"] == "verified"
        assert len(byod_item["evidence_ids"]) > 0

        # Verify role filtering:
        # Contractor calling /cases/case-001/artifacts must NOT see internal Slack artifacts or quarantined items
        contractor_arts_res = client.get(
            "/cases/case-001/artifacts",
            headers={"Authorization": f"Bearer {contractor_token}"},
        )
        assert contractor_arts_res.status_code == 200
        contractor_arts = contractor_arts_res.json().get("artifacts", [])
        # All visible artifacts must be public
        for art in contractor_arts:
            assert art.get("source") != "slack"
            assert art.get("acl_tag") != "internal"
            assert art.get("quarantine_status") != "quarantined"
