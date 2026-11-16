"""
Tests for Round 3 Features:
- Feature 1: Exportable Handover Documentation (PDF generation)
- Feature 2: Workspace & Cloud Storage Integration (Asset discovery & handover folder)
- Feature 3: Living Project Memory (Webhooks, Knowledge Graph, Bus-Factor)
"""

import pytest
from app.export.pdf import HandoverPDFBuilder
from app.webhooks.github import extract_event_summary
from app.risk.busfactor import BusFactorAnalyzer, BusFactorSignals


class TestPdfExport:
    """Test HandoverPDFBuilder generation and edge cases."""

    def test_pdf_generation_valid_output(self):
        builder = HandoverPDFBuilder()
        items = [
            {
                "id": "1",
                "section": "Architecture",
                "text": "Auth service uses **JWT tokens** signed with JWT_SECRET.",
                "provenance": "verified",
                "confidence": 0.95,
                "evidence_ids": ["art-001", "art-002"],
            },
            {
                "id": "2",
                "section": "Known Issues",
                "text": "JWT token expiry issue was reverted due to edge TTL conflict.",
                "provenance": "stated",
                "confidence": 0.85,
                "evidence_ids": ["art-003"],
            },
            {
                "id": "3",
                "section": "Pending Work",
                "text": "PR #47 implements webhook retry logic with exponential backoff.",
                "provenance": "inferred",
                "confidence": 0.75,
                "evidence_ids": [],
            },
        ]
        pdf_bytes = builder.build(
            case_name="ShopLedger API",
            leaver_name="Priya Nair",
            repo_url="https://github.com/shopledger/api",
            handover_items=items,
            grounding_score=0.88,
            version=1,
        )

        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 1000
        assert pdf_bytes.startswith(b"%PDF")

    def test_pdf_handles_empty_items(self):
        builder = HandoverPDFBuilder()
        pdf_bytes = builder.build(
            case_name="Empty Project",
            leaver_name=None,
            repo_url="https://github.com/example/repo",
            handover_items=[],
        )
        assert isinstance(pdf_bytes, bytes)
        assert pdf_bytes.startswith(b"%PDF")

    def test_pdf_handles_missing_leaver(self):
        builder = HandoverPDFBuilder()
        pdf_bytes = builder.build(
            case_name="No Leaver Specified",
            leaver_name=None,
            repo_url="https://github.com/example/repo",
            handover_items=[{"id": "1", "section": "General", "text": "Some text", "provenance": "inferred", "confidence": 0.8, "evidence_ids": []}],
        )
        assert pdf_bytes.startswith(b"%PDF")


class TestBusFactorAnalysis:
    """Test Bus-Factor calculation and proactive risk alerts."""

    def test_composite_signals_weighting(self):
        signals = BusFactorSignals(
            commit_share=0.80,
            review_share=0.60,
            discussion_share=0.40,
            is_primary_author=True,
        )
        # Expected: 0.80*0.35 + 0.60*0.35 + 0.40*0.30 = 0.28 + 0.21 + 0.12 = 0.61
        assert round(signals.composite_score, 2) == 0.61

    def test_continuity_grading(self):
        analyzer = BusFactorAnalyzer()
        assert analyzer._grade(0.90) == "A"
        assert analyzer._grade(0.75) == "B"
        assert analyzer._grade(0.60) == "C"
        assert analyzer._grade(0.45) == "D"
        assert analyzer._grade(0.30) == "F"

    def test_alert_generation_single_maintainer(self):
        analyzer = BusFactorAnalyzer()
        from unittest.mock import MagicMock
        component = MagicMock()
        component.name = "Payment Processor"
        component.criticality = 0.95

        contributors = [
            {
                "person_name": "Priya Nair",
                "is_leaver": True,
                "knowledge_share": 0.72,
                "knowledge_score": 92,
            },
            {
                "person_name": "Alex Chen",
                "is_leaver": False,
                "knowledge_share": 0.28,
                "knowledge_score": 28,
            },
        ]

        alerts = analyzer._generate_alerts(
            component=component,
            contributors=contributors,
            doc_coverage=0.20,
            active_contributors=1,
            bus_factor_num=1,
            case=MagicMock(),
        )

        alert_types = [a["alert_type"] for a in alerts]
        assert "single_maintainer" in alert_types
        assert "poor_docs" in alert_types

        single_alert = next(a for a in alerts if a["alert_type"] == "single_maintainer")
        assert "Payment Processor" in single_alert["explanation"]
        assert single_alert["primary_developer"] == "Priya Nair"
        assert single_alert["primary_developer_share"] == 72.0


class TestWebhookProcessing:
    """Test webhook normalization and summary extraction."""

    def test_extract_push_summary(self):
        payload = {
            "repository": {"full_name": "shopledger/api"},
            "ref": "refs/heads/main",
            "pusher": {"name": "priya-nair"},
            "commits": [
                {"message": "WIP: webhook retry logic", "added": ["src/payments/retry.ts"], "modified": []},
            ],
        }
        summary = extract_event_summary("push", payload)
        assert summary["event_type"] == "push"
        assert summary["branch"] == "main"
        assert summary["pusher"] == "priya-nair"
        assert summary["commit_count"] == 1
        assert "src/payments/retry.ts" in summary["files_changed"]

    def test_extract_pr_summary(self):
        payload = {
            "repository": {"full_name": "shopledger/api"},
            "action": "opened",
            "pull_request": {
                "number": 47,
                "title": "WIP: Webhook retry logic",
                "user": {"login": "priya-nair"},
                "state": "open",
                "merged": False,
            },
        }
        summary = extract_event_summary("pull_request", payload)
        assert summary["pr_number"] == 47
        assert summary["action"] == "opened"
        assert summary["author"] == "priya-nair"
        assert summary["state"] == "open"

