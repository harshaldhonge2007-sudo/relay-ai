"""
api/app/ingest/github_live.py
Live GitHub repository ingestor with rate-limit backoff, ETag conditional requests,
PR review graph extraction, CODEOWNERS parsing, and thread-safe progress tracking.
"""

import aiohttp
import asyncio
import base64
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple

from app.config import get_settings
from app.models import Person, Artifact, ArtifactType, SourceMode, Component, Case, CaseStatus
from app.llm.provider import redact_secrets
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

logger = logging.getLogger(__name__)
settings = get_settings()

# In-memory progress tracking for active ingest tasks: case_id -> progress dict
INGEST_PROGRESS: Dict[str, Dict[str, Any]] = {}


def get_ingest_progress(case_id: str) -> Dict[str, Any]:
    """Retrieve the current ingestion progress for a case."""
    return INGEST_PROGRESS.get(
        case_id,
        {
            "status": "idle",
            "phase": "pending",
            "progress_pct": 0,
            "commits": 0,
            "pull_requests": 0,
            "reviews": 0,
            "issues": 0,
            "codeowners_found": False,
            "error": None,
        },
    )


def update_ingest_progress(case_id: str, **kwargs):
    """Update progress tracking fields for a case."""
    if case_id not in INGEST_PROGRESS:
        INGEST_PROGRESS[case_id] = {
            "status": "ingesting",
            "phase": "starting",
            "progress_pct": 0,
            "commits": 0,
            "pull_requests": 0,
            "reviews": 0,
            "issues": 0,
            "codeowners_found": False,
            "error": None,
        }
    INGEST_PROGRESS[case_id].update(kwargs)


class LiveGitHubIngestor:
    """
    Ingests live GitHub repositories with defensive rate-limiting, ETag caching,
    review graph extraction, and CODEOWNERS discovery.
    """

    def __init__(self, repo_str: str, token: Optional[str] = None):
        self.repo_str = repo_str.strip()
        self.token = token or settings.github_token
        self.api_url = settings.github_api_url.rstrip("/")
        self.owner, self.repo = self._parse_repo(self.repo_str)
        self.etags: Dict[str, str] = {}
        self.etag_cache: Dict[str, Any] = {}

    @staticmethod
    def _parse_repo(repo_str: str) -> Tuple[str, str]:
        """Extract owner and repo from various string formats."""
        cleaned = repo_str.strip().rstrip("/")
        if cleaned.endswith(".git"):
            cleaned = cleaned[:-4]

        # Handle full URL or shorthand owner/repo
        match = re.search(r"github\.com[/:]([^/]+)/([^/]+)", cleaned)
        if match:
            return match.group(1), match.group(2)

        parts = cleaned.split("/")
        if len(parts) == 2 and parts[0] and parts[1]:
            return parts[0], parts[1]

        raise ValueError(f"Invalid GitHub repository format: '{repo_str}'. Expected 'owner/repo' or 'https://github.com/owner/repo'.")

    def _headers(self, etag: Optional[str] = None) -> Dict[str, str]:
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "RELAY-AI-Ingestor",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        if etag:
            headers["If-None-Match"] = etag
        return headers

    async def _request(
        self,
        session: aiohttp.ClientSession,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        use_etag: bool = True,
        max_retries: int = 3,
    ) -> Tuple[Optional[Any], int]:
        """
        Execute request with rate-limit detection, backoff, and ETag conditional support.
        Returns (data, status_code).
        """
        url = f"{self.api_url}/{endpoint.lstrip('/')}"
        cache_key = f"{url}?{sorted((params or {}).items())}"
        cached_etag = self.etags.get(cache_key) if use_etag else None
        headers = self._headers(etag=cached_etag)

        delay = 1.0
        for attempt in range(max_retries + 1):
            try:
                async with session.get(url, headers=headers, params=params, timeout=aiohttp.ClientTimeout(total=20)) as resp:
                    status = resp.status

                    # Check rate limits
                    remaining = resp.headers.get("x-ratelimit-remaining")
                    if remaining is not None and int(remaining) == 0:
                        reset_ts = resp.headers.get("x-ratelimit-reset")
                        wait_seconds = max(1, int(reset_ts) - int(datetime.now(timezone.utc).timestamp())) if reset_ts else 60
                        logger.warning(f"GitHub rate limit exceeded. Reset in {wait_seconds}s.")
                        if attempt < max_retries and wait_seconds <= 10:
                            await asyncio.sleep(wait_seconds + 0.5)
                            continue

                    # Rate limited or secondary limit backoff
                    if status in (429, 403) and attempt < max_retries:
                        retry_after = resp.headers.get("retry-after")
                        wait_time = int(retry_after) if retry_after else delay
                        logger.info(f"GitHub secondary rate limit hit ({status}). Backing off {wait_time}s (attempt {attempt+1}/{max_retries}).")
                        await asyncio.sleep(wait_time)
                        delay *= 2
                        continue

                    if status == 304 and use_etag and cache_key in self.etag_cache:
                        # Not Modified — return cached response
                        return self.etag_cache[cache_key], 304

                    if status == 200:
                        new_etag = resp.headers.get("ETag")
                        data = await resp.json()
                        if use_etag and new_etag:
                            self.etags[cache_key] = new_etag
                            self.etag_cache[cache_key] = data
                        return data, 200

                    if status == 404:
                        return None, 404

                    text = await resp.text()
                    logger.warning(f"GitHub request {url} returned status {status}: {text[:200]}")
                    return None, status

            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                if attempt < max_retries:
                    await asyncio.sleep(delay)
                    delay *= 2
                    continue
                logger.error(f"GitHub request exception for {url}: {e}")
                return None, 500

        return None, 500

    async def fetch_codeowners(self, session: aiohttp.ClientSession) -> Optional[str]:
        """Fetch CODEOWNERS file from standard GitHub locations."""
        for path in [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"]:
            data, status = await self._request(session, f"repos/{self.owner}/{self.repo}/contents/{path}")
            if status == 200 and isinstance(data, dict) and data.get("content"):
                try:
                    content = base64.b64decode(data["content"]).decode("utf-8")
                    return content
                except Exception:
                    pass
        return None

    def parse_codeowners(self, content: str) -> List[Dict[str, Any]]:
        """Parse CODEOWNERS syntax into component path rule mappings."""
        rules = []
        for line in content.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) >= 2:
                pattern = parts[0]
                owners = parts[1:]
                rules.append({"pattern": pattern, "owners": owners})
        return rules

    async def ingest_live(
        self,
        db_session: AsyncSession,
        case_id: str,
        since_months: int = 6,
        max_commits: int = 150,
        max_prs: int = 50,
        max_issues: int = 50,
    ) -> Dict[str, Any]:
        """
        Run end-to-end ingestion of commits, PRs, reviews, issues, and CODEOWNERS.
        Reports progress to INGEST_PROGRESS[case_id].
        """
        case_uuid = datetime.now()  # placeholder to verify
        update_ingest_progress(case_id, status="ingesting", phase="connecting", progress_pct=5)

        since_dt = datetime.now(timezone.utc) - timedelta(days=since_months * 30)
        since_iso = since_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        results = {
            "owner": self.owner,
            "repo": self.repo,
            "commits": 0,
            "pull_requests": 0,
            "reviews": 0,
            "issues": 0,
            "codeowners_rules": 0,
            "errors": [],
        }

        async with aiohttp.ClientSession() as http:
            # 1. Verify repo accessibility & CODEOWNERS
            update_ingest_progress(case_id, phase="inspecting_repository", progress_pct=10)
            repo_info, status = await self._request(http, f"repos/{self.owner}/{self.repo}")
            if status != 200 or not repo_info:
                err_msg = f"Repository '{self.owner}/{self.repo}' not found or inaccessible (HTTP {status})."
                update_ingest_progress(case_id, status="error", error=err_msg)
                results["errors"].append(err_msg)
                return results

            # Fetch CODEOWNERS
            codeowners_raw = await self.fetch_codeowners(http)
            if codeowners_raw:
                rules = self.parse_codeowners(codeowners_raw)
                results["codeowners_rules"] = len(rules)
                update_ingest_progress(case_id, codeowners_found=True)
                # Store CODEOWNERS as artifact
                art = Artifact(
                    case_id=case_id,
                    source="github",
                    source_mode=SourceMode.LIVE,
                    type=ArtifactType.DOCUMENT,
                    external_id=f"{self.owner}/{self.repo}/CODEOWNERS",
                    occurred_at=datetime.now(timezone.utc),
                    title=f"CODEOWNERS ({self.owner}/{self.repo})",
                    body=codeowners_raw,
                    raw={"rules": rules},
                    acl_tag="readable",
                )
                db_session.add(art)

            # 2. Ingest Commits
            update_ingest_progress(case_id, phase="fetching_commits", progress_pct=25)
            commits_url = f"repos/{self.owner}/{self.repo}/commits"
            page = 1
            commit_count = 0
            while commit_count < max_commits:
                data, status = await self._request(http, commits_url, {"since": since_iso, "page": page, "per_page": 50})
                if not data or not isinstance(data, list):
                    break

                for c in data:
                    commit_sha = c.get("sha", "")
                    commit_obj = c.get("commit", {})
                    author_obj = commit_obj.get("author", {}) or {}
                    github_user = c.get("author") or {}

                    author_name = author_obj.get("name") or github_user.get("login") or "Unknown"
                    author_email = author_obj.get("email") or ""
                    commit_msg = commit_obj.get("message") or ""

                    date_str = author_obj.get("date")
                    try:
                        occurred_at = datetime.fromisoformat(date_str.replace("Z", "+00:00")) if date_str else datetime.now(timezone.utc)
                    except Exception:
                        occurred_at = datetime.now(timezone.utc)

                    # Get or create person
                    person = await self._get_or_create_person(
                        db_session,
                        display_name=author_name,
                        email=author_email,
                        github_login=github_user.get("login"),
                    )

                    art = Artifact(
                        case_id=case_id,
                        source="github",
                        source_mode=SourceMode.LIVE,
                        type=ArtifactType.COMMIT,
                        external_id=commit_sha,
                        author_id=person.id if person else None,
                        occurred_at=occurred_at,
                        url=c.get("html_url", f"https://github.com/{self.owner}/{self.repo}/commit/{commit_sha}"),
                        title=commit_msg.splitlines()[0][:200] if commit_msg else f"Commit {commit_sha[:7]}",
                        body=redact_secrets(commit_msg),
                        raw=c,
                        acl_tag="readable",
                    )
                    db_session.add(art)
                    commit_count += 1

                page += 1
                update_ingest_progress(case_id, commits=commit_count, progress_pct=min(50, 25 + int((commit_count / max_commits) * 25)))
                if len(data) < 50:
                    break

            results["commits"] = commit_count

            # 3. Ingest Pull Requests & Reviews
            update_ingest_progress(case_id, phase="fetching_pull_requests", progress_pct=55)
            prs_url = f"repos/{self.owner}/{self.repo}/pulls"
            page = 1
            pr_count = 0
            review_count = 0
            while pr_count < max_prs:
                data, status = await self._request(http, prs_url, {"state": "all", "sort": "updated", "direction": "desc", "page": page, "per_page": 25})
                if not data or not isinstance(data, list):
                    break

                for pr in data:
                    pr_num = pr.get("number")
                    pr_title = pr.get("title", "")
                    pr_body = redact_secrets(pr.get("body") or "")
                    pr_user = pr.get("user") or {}
                    user_login = pr_user.get("login", "unknown")

                    created_str = pr.get("created_at")
                    try:
                        occurred_at = datetime.fromisoformat(created_str.replace("Z", "+00:00")) if created_str else datetime.now(timezone.utc)
                    except Exception:
                        occurred_at = datetime.now(timezone.utc)

                    person = await self._get_or_create_person(
                        db_session,
                        display_name=user_login,
                        email="",
                        github_login=user_login,
                    )

                    pr_art = Artifact(
                        case_id=case_id,
                        source="github",
                        source_mode=SourceMode.LIVE,
                        type=ArtifactType.PULL_REQUEST,
                        external_id=str(pr_num),
                        author_id=person.id if person else None,
                        occurred_at=occurred_at,
                        url=pr.get("html_url", f"https://github.com/{self.owner}/{self.repo}/pull/{pr_num}"),
                        title=f"PR #{pr_num}: {pr_title}"[:200],
                        body=pr_body,
                        raw=pr,
                        acl_tag="readable",
                    )
                    db_session.add(pr_art)
                    pr_count += 1

                    # Fetch PR reviews (for review graph)
                    reviews_data, r_status = await self._request(http, f"repos/{self.owner}/{self.repo}/pulls/{pr_num}/reviews")
                    if r_status == 200 and isinstance(reviews_data, list):
                        for rev in reviews_data:
                            reviewer_login = (rev.get("user") or {}).get("login", "unknown")
                            rev_person = await self._get_or_create_person(db_session, reviewer_login, "", reviewer_login)
                            rev_art = Artifact(
                                case_id=case_id,
                                source="github",
                                source_mode=SourceMode.LIVE,
                                type=ArtifactType.SLACK_MESSAGE,  # reuse message type or doc for reviews
                                external_id=f"pr_review_{rev.get('id', review_count)}",
                                author_id=rev_person.id if rev_person else None,
                                occurred_at=occurred_at,
                                url=pr.get("html_url", ""),
                                title=f"Review on PR #{pr_num} by {reviewer_login}: {rev.get('state', '')}",
                                body=redact_secrets(rev.get("body", "")),
                                raw={"pr_number": pr_num, "state": rev.get("state"), "reviewer": reviewer_login},
                                acl_tag="readable",
                            )
                            db_session.add(rev_art)
                            review_count += 1

                page += 1
                update_ingest_progress(case_id, pull_requests=pr_count, reviews=review_count, progress_pct=min(75, 55 + int((pr_count / max_prs) * 20)))
                if len(data) < 25:
                    break

            results["pull_requests"] = pr_count
            results["reviews"] = review_count

            # 4. Ingest Issues (excluding PRs)
            update_ingest_progress(case_id, phase="fetching_issues", progress_pct=80)
            issues_url = f"repos/{self.owner}/{self.repo}/issues"
            page = 1
            issue_count = 0
            while issue_count < max_issues:
                data, status = await self._request(http, issues_url, {"state": "all", "sort": "updated", "direction": "desc", "page": page, "per_page": 25})
                if not data or not isinstance(data, list):
                    break

                for iss in data:
                    if "pull_request" in iss:
                        continue  # Skip pull requests returned by issues endpoint

                    iss_num = iss.get("number")
                    iss_title = iss.get("title", "")
                    iss_body = redact_secrets(iss.get("body") or "")
                    iss_user = iss.get("user") or {}
                    user_login = iss_user.get("login", "unknown")

                    created_str = iss.get("created_at")
                    try:
                        occurred_at = datetime.fromisoformat(created_str.replace("Z", "+00:00")) if created_str else datetime.now(timezone.utc)
                    except Exception:
                        occurred_at = datetime.now(timezone.utc)

                    person = await self._get_or_create_person(
                        db_session,
                        display_name=user_login,
                        email="",
                        github_login=user_login,
                    )

                    art = Artifact(
                        case_id=case_id,
                        source="github",
                        source_mode=SourceMode.LIVE,
                        type=ArtifactType.ISSUE,
                        external_id=str(iss_num),
                        author_id=person.id if person else None,
                        occurred_at=occurred_at,
                        url=iss.get("html_url", f"https://github.com/{self.owner}/{self.repo}/issues/{iss_num}"),
                        title=f"Issue #{iss_num}: {iss_title}"[:200],
                        body=iss_body,
                        raw=iss,
                        acl_tag="readable",
                    )
                    db_session.add(art)
                    issue_count += 1

                page += 1
                update_ingest_progress(case_id, issues=issue_count, progress_pct=min(95, 80 + int((issue_count / max_issues) * 15)))
                if len(data) < 25:
                    break

            results["issues"] = issue_count

            # Auto-infer components based on top directory folders if no components exist
            await self._infer_initial_components(db_session, case_id)

            await db_session.commit()
            update_ingest_progress(case_id, status="complete", phase="ready", progress_pct=100)
            logger.info(f"Live GitHub ingestion complete for {self.owner}/{self.repo}: {results}")

        return results

    async def _get_or_create_person(
        self,
        session: AsyncSession,
        display_name: str,
        email: str,
        github_login: Optional[str] = None,
    ) -> Optional[Person]:
        """Fetch or create person based on github handle or email."""
        identifier = github_login or display_name
        try:
            # Query by identity handle
            res = await session.execute(select(Person))
            people = res.scalars().all()
            for p in people:
                for ident in p.identities or []:
                    if ident.get("source") == "github" and (ident.get("id") == identifier or ident.get("handle") == identifier):
                        return p

            # Not found — create new Person
            person = Person(
                display_name=display_name or identifier,
                identities=[
                    {
                        "source": "github",
                        "id": identifier,
                        "handle": identifier,
                        "email": email or None,
                    }
                ],
                is_leaver=False,
            )
            session.add(person)
            await session.flush()
            return person
        except Exception as e:
            logger.warning(f"Error fetching/creating person for {identifier}: {e}")
            return None

    async def _infer_initial_components(self, session: AsyncSession, case_id: str):
        """Create basic components based on common repository directory patterns."""
        try:
            existing = (await session.execute(
                select(Component).where(Component.case_id == case_id)
            )).scalars().all()
            if existing:
                return

            default_components = [
                ("Core Service", '["src/core/**", "core/**", "app/**"]', 0.9),
                ("API & Endpoints", '["src/api/**", "api/**", "routes/**"]', 0.85),
                ("Infrastructure & Config", '["docker*", ".github/**", "k8s/**"]', 0.7),
            ]
            for name, globs, crit in default_components:
                c = Component(
                    case_id=case_id,
                    name=name,
                    path_globs=globs,
                    criticality=crit,
                )
                session.add(c)
            await session.flush()
        except Exception as e:
            logger.warning(f"Error creating initial components: {e}")

