"""
Tests for api/app/ingest/github_live.py
Unit tests with recorded mock HTTP responses (zero live network calls in CI).
"""

import pytest
import aiohttp
from unittest.mock import AsyncMock, patch, MagicMock
from app.ingest.github_live import (
    LiveGitHubIngestor,
    get_ingest_progress,
    update_ingest_progress,
    INGEST_PROGRESS,
)


class TestLiveGitHubIngestor:
    """Test URL parsing, CODEOWNERS parsing, ETag caching, and rate limiting."""

    def test_parse_repo_various_formats(self):
        # Shorthand format
        owner, repo = LiveGitHubIngestor._parse_repo("pallets/flask")
        assert owner == "pallets"
        assert repo == "flask"

        # Full HTTPS URL
        owner, repo = LiveGitHubIngestor._parse_repo("https://github.com/fastapi/fastapi")
        assert owner == "fastapi"
        assert repo == "fastapi"

        # URL with .git suffix
        owner, repo = LiveGitHubIngestor._parse_repo("https://github.com/psf/requests.git")
        assert owner == "psf"
        assert repo == "requests"

        # URL with trailing slash
        owner, repo = LiveGitHubIngestor._parse_repo("https://github.com/shopledger/api/")
        assert owner == "shopledger"
        assert repo == "api"

    def test_parse_repo_invalid_raises(self):
        with pytest.raises(ValueError):
            LiveGitHubIngestor._parse_repo("just-a-string")

        with pytest.raises(ValueError):
            LiveGitHubIngestor._parse_repo("http://gitlab.com/invalid/extra/parts")

    def test_parse_codeowners(self):
        ingestor = LiveGitHubIngestor("owner/repo")
        raw = """
        # Core maintainers
        * @core-team @lead-dev
        
        # Payment service
        src/payments/ @priya @alexc
        
        # Auth docs
        docs/auth/ @priya
        """
        rules = ingestor.parse_codeowners(raw)
        assert len(rules) == 3
        assert rules[0]["pattern"] == "*"
        assert rules[0]["owners"] == ["@core-team", "@lead-dev"]
        assert rules[1]["pattern"] == "src/payments/"
        assert rules[1]["owners"] == ["@priya", "@alexc"]
        assert rules[2]["pattern"] == "docs/auth/"
        assert rules[2]["owners"] == ["@priya"]

    def test_progress_tracking(self):
        case_id = "test-case-123"
        update_ingest_progress(
            case_id,
            status="ingesting",
            phase="fetching_commits",
            commits=42,
            pull_requests=10,
            progress_pct=35,
        )

        p = get_ingest_progress(case_id)
        assert p["status"] == "ingesting"
        assert p["phase"] == "fetching_commits"
        assert p["commits"] == 42
        assert p["pull_requests"] == 10
        assert p["progress_pct"] == 35

        # Update again
        update_ingest_progress(case_id, progress_pct=100, status="complete")
        p2 = get_ingest_progress(case_id)
        assert p2["progress_pct"] == 100
        assert p2["status"] == "complete"

    def test_etag_caching(self):
        import asyncio
        from unittest.mock import MagicMock

        async def _run():
            ingestor = LiveGitHubIngestor("owner/repo")
            mock_session = MagicMock()

            # First request returns 200 with ETag
            resp1 = MagicMock()
            resp1.status = 200
            resp1.headers = {"ETag": 'W/"12345"', "x-ratelimit-remaining": "4999"}
            resp1.json = AsyncMock(return_value={"id": 1, "name": "repo"})
            cm1 = MagicMock()
            cm1.__aenter__ = AsyncMock(return_value=resp1)
            cm1.__aexit__ = AsyncMock(return_value=None)
            mock_session.get.return_value = cm1

            data1, status1 = await ingestor._request(mock_session, "repos/owner/repo")
            assert status1 == 200
            assert data1 == {"id": 1, "name": "repo"}

            # Second request with same ETag returns 304 Not Modified
            resp2 = MagicMock()
            resp2.status = 304
            resp2.headers = {"x-ratelimit-remaining": "4998"}
            cm2 = MagicMock()
            cm2.__aenter__ = AsyncMock(return_value=resp2)
            cm2.__aexit__ = AsyncMock(return_value=None)
            mock_session.get.return_value = cm2

            data2, status2 = await ingestor._request(mock_session, "repos/owner/repo")
            assert status2 == 304
            assert data2 == {"id": 1, "name": "repo"}

        asyncio.run(_run())
