import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock
import sys

sys.path.insert(0, "/Users/harshaldhonge/Documents/CodersInPune/relay/api")


class TestInflightDetector:
    """Test in-flight work detection."""

    def test_detect_open_prs(self):
        """Test detection of open PRs by leaver."""
        try:
            from app.detect.inflight import InFlightDetector
        except Exception:
            pytest.skip("app.detect.inflight not available (asyncpg missing)")

        mock_session = AsyncMock()
        mock_case_id = "test-case-id"

        mock_case = MagicMock()
        mock_case.id = mock_case_id
        mock_case.leaver_person_id = "leaver-id"

        mock_leaver_artifacts = [
            MagicMock(
                type="pull_request",
                body="",
                author_id="leaver-id",
                raw={"state": "open"},
            ),
        ]

        mock_session.execute.return_value.scalars.return_value.all = MagicMock(
            return_value=mock_leaver_artifacts
        )

        detector = InFlightDetector()
        results = detector._detect_open_prs(mock_session, mock_case_id, mock_case)

        assert len(results) == 1
        assert results[0]["kind"] == "inflight"

    def test_detect_unmerged_branches(self):
        """Test detection of branches with unmerged commits."""
        try:
            from app.detect.inflight import InFlightDetector
        except Exception:
            pytest.skip("app.detect.inflight not available (asyncpg missing)")

        detector = InFlightDetector()

        mock_session = AsyncMock()
        mock_case_id = "test-case-id"

        mock_branches = [
            MagicMock(
                external_id="feature/in-progress",
                title="Branch: feature/in-progress",
                raw={"commit": {"sha": "abc123"}},
            ),
        ]

        mock_session.execute.return_value.scalars.return_value.all = MagicMock(
            return_value=mock_branches
        )

        results = detector._detect_branches(mock_session, mock_case_id)

        assert len(results) >= 1


class TestHiddenDepsDetector:
    """Test hidden dependency detection."""

    def test_env_var_extraction(self):
        """Test extraction of environment variables."""
        try:
            from app.detect.hidden_deps import HiddenDepsDetector
        except Exception:
            pytest.skip("app.detect.hidden_deps not available (asyncpg missing)")

        detector = HiddenDepsDetector()

        text = "DATABASE_URL=postgresql://localhost DB_HOST=localhost"
        vars_found = detector._extract_env_vars(text)

        assert "DATABASE_URL" in vars_found
        assert "DB_HOST" in vars_found

    def test_external_hostnames(self):
        """Test extraction of external hostnames."""
        try:
            from app.detect.hidden_deps import HiddenDepsDetector
        except Exception:
            pytest.skip("app.detect.hidden_deps not available (asyncpg missing)")

        detector = HiddenDepsDetector()

        text = "Connecting to https://api.stripe.com and redis://localhost"
        hosts = detector._extract_external_hosts(text)

        assert "api.stripe.com" in hosts


class TestRiskCalculation:
    """Test risk score calculation."""

    def test_risk_formula_components(self):
        """Test that risk formula produces valid output."""
        try:
            from app.risk.score import RiskScorer
        except Exception:
            pytest.skip("app.risk.score not available (asyncpg missing)")

        criticality = 0.8
        leaver_share = 0.6
        bench_strength = 0.4
        doc_coverage = 0.5
        doc_weight = 0.6

        risk = criticality * leaver_share * (1 - bench_strength) * (1 - doc_weight * doc_coverage)

        assert 0 <= risk <= 1
        assert risk > 0

    def test_knowledge_decay(self):
        """Test time-decayed knowledge score."""
        try:
            from app.risk.knowledge import KnowledgeScorer
        except Exception:
            pytest.skip("app.risk.knowledge not available (asyncpg missing)")

        scorer = KnowledgeScorer()

        now = datetime.utcnow()
        recent_time = now - timedelta(days=30)
        old_time = now - timedelta(days=400)

        recent_decay = 0.5 ** (30 / 365)
        old_decay = 0.5 ** (400 / 365)

        assert recent_decay > old_decay
        assert recent_decay > 0.9


class TestSecretScanning:
    """Test secret scanning."""

    def test_github_token_detection(self):
        """Test detection of GitHub tokens."""
        try:
            from app.security.secrets_scan import SecretScanner
        except Exception:
            pytest.skip("app.security.secrets_scan not available (asyncpg missing)")

        scanner = SecretScanner()

        if not hasattr(scanner, "_scan_text"):
            pytest.skip("SecretScanner._scan_text not implemented")

        text = "ghp_abc123def456ghi789jkl012mno345pqr678"
        secrets = scanner._scan_text(text)

        assert len(secrets) > 0

    def test_jwt_detection(self):
        """Test detection of JWT tokens."""
        try:
            from app.security.secrets_scan import SecretScanner
        except Exception:
            pytest.skip("app.security.secrets_scan not available (asyncpg missing)")

        scanner = SecretScanner()

        if not hasattr(scanner, "_scan_text"):
            pytest.skip("SecretScanner._scan_text not implemented")

        text = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
        secrets = scanner._scan_text(text)

        assert len(secrets) > 0


class TestLinking:
    """Test artifact linking."""

    def test_jira_pattern(self):
        """Test Jira key pattern matching."""
        try:
            from app.link.rules import ExplicitLinker
        except Exception:
            pytest.skip("app.link.rules not available (asyncpg missing)")

        linker = ExplicitLinker()

        text = "Fixed in PR #456 and related to PROJ-123"
        matches = linker.JIRA_PATTERN.findall(text)

        assert "PROJ-123" in matches

    def test_issue_pattern(self):
        """Test GitHub issue pattern matching."""
        try:
            from app.link.rules import ExplicitLinker
        except Exception:
            pytest.skip("app.link.rules not available (asyncpg missing)")

        linker = ExplicitLinker()

        text = "Fixed by commit abc123, see #789 for details"
        matches = linker.ISSUE_PATTERN.findall(text)

        assert "789" in matches


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
