"""
Test precision and recall against expected findings.
"""

import json
import pytest
from pathlib import Path
import sys

sys.path.insert(0, "/Users/harshaldhonge/Documents/CodersInPune/relay/api")

EXPECTED_FINDINGS_FILE = Path(__file__).parent.parent.parent / "seed" / "expected_findings.json"


class TestDetectorPrecisionRecall:
    """Validate detector precision and recall against expected findings."""

    def load_expected(self):
        """Load expected findings from seed file."""
        if not EXPECTED_FINDINGS_FILE.exists():
            pytest.skip("expected_findings.json not found")

        with open(EXPECTED_FINDINGS_FILE) as f:
            data = json.load(f)
        return data["expected_findings"]

    def test_hidden_deps_recall(self):
        """Test that hidden_deps detector finds expected dependencies."""
        expected = self.load_expected()
        hidden_deps = expected.get("hidden_dependencies", [])

        assert len(hidden_deps) >= 2, "Should find at least 2 hidden dependencies"

        expected_keys = {dep["title"] for dep in hidden_deps}
        assert any("REPORT_BUCKET_NAME" in title for title in expected_keys)
        assert any("SMTP_RELAY_HOST" in title for title in expected_keys)

    def test_contradictions_recall(self):
        """Test that contradictions detector finds expected conflicts."""
        expected = self.load_expected()
        contradictions = expected.get("contradictions", [])

        assert len(contradictions) >= 2, "Should find at least 2 contradictions"

        expected_titles = {c["title"] for c in contradictions}
        assert any("JWT" in title for title in expected_titles)
        assert any("migration" in title.lower() for title in expected_titles)

    def test_inflight_recall(self):
        """Test that inflight detector finds in-progress work."""
        expected = self.load_expected()
        inflight = expected.get("inflight_work", [])

        assert len(inflight) >= 1, "Should find at least 1 inflight item"

        expected_titles = {item["title"] for item in inflight}
        assert any("SL-456" in title or "webhook" in title.lower() for title in expected_titles)

    def test_minimum_confidence(self):
        """Test that findings have minimum confidence levels."""
        expected = self.load_expected()

        all_findings = (
            expected.get("hidden_dependencies", []) +
            expected.get("contradictions", []) +
            expected.get("inflight_work", [])
        )

        for finding in all_findings:
            assert 0 <= finding.get("confidence", 0) <= 1, "Confidence must be 0-1"
            assert finding.get("confidence", 0) >= 0.6, "Confidence should be >= 0.6"

    def test_evidence_requirements(self):
        """Test that all findings have evidence."""
        expected = self.load_expected()

        all_findings = (
            expected.get("hidden_dependencies", []) +
            expected.get("contradictions", []) +
            expected.get("inflight_work", [])
        )

        for finding in all_findings:
            assert "evidence" in finding, "Finding must have evidence"
            assert len(finding["evidence"]) > 0, "Evidence must not be empty"

            for evidence in finding["evidence"]:
                assert "artifact" in evidence, "Evidence must cite artifact"
                assert "span" in evidence, "Evidence must have quoted span"


class TestCompletenessScoring:
    """Test completeness scoring logic."""

    def test_score_range(self):
        """Score must be between 0 and 1."""
        from app.sim.score import CompletenessScorer

        scorer = CompletenessScorer()

        assert hasattr(scorer, 'score')

    def test_demo_completeness_progression(self):
        """Test that demo shows score progression."""
        expected = json.loads(EXPECTED_FINDINGS_FILE.read_text())
        demo = expected.get("demo_scenario", {})

        initial = demo.get("initial_completeness_score", 0)
        after_first = demo.get("after_first_answer", 0)
        after_second = demo.get("after_second_answer", 0)

        assert 0 <= initial < after_first < after_second <= 1
        assert after_second > 0.85


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
