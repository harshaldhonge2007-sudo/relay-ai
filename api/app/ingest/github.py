import aiohttp
import base64
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
from app.config import get_settings
from app.models import Person, Artifact, ArtifactType, SourceMode
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)
settings = get_settings()


class GitHubIngestor:
    def __init__(self, repo_url: str, token: Optional[str] = None):
        self.repo_url = repo_url
        self.token = token or settings.github_token
        self.api_url = settings.github_api_url
        self.owner = None
        self.repo = None
        self._parse_repo_url()

    def _parse_repo_url(self):
        """Parse GitHub URL to extract owner and repo."""
        if "github.com/" in self.repo_url:
            parts = self.repo_url.replace("https://github.com/", "").replace(".git", "").split("/")
            if len(parts) >= 2:
                self.owner = parts[0]
                self.repo = parts[1]

    async def ingest(self, session: AsyncSession, case_id) -> Dict[str, Any]:
        """Ingest commits, PRs, issues, and branches from GitHub."""
        if not self.owner or not self.repo:
            return {"status": "error", "message": "Could not parse repository URL"}

        results = {
            "commits": 0,
            "pull_requests": 0,
            "issues": 0,
            "branches": 0,
            "tags": 0,
            "errors": [],
        }

        try:
            results["commits"] += await self._ingest_commits(session, case_id)
            results["pull_requests"] += await self._ingest_pull_requests(session, case_id)
            results["issues"] += await self._ingest_issues(session, case_id)
            results["branches"] += await self._ingest_branches(session, case_id)
            results["tags"] += await self._ingest_tags(session, case_id)
        except Exception as e:
            results["errors"].append(str(e))
            logger.error(f"GitHub ingest error: {e}")

        return results

    async def _get(self, endpoint: str, params: Optional[Dict] = None) -> Optional[Dict]:
        """Make authenticated GitHub API request."""
        headers = {"Accept": "application/vnd.github.v3+json"}
        if self.token:
            headers["Authorization"] = f"token {self.token}"

        url = f"{self.api_url}/{endpoint}"
        async with aiohttp.ClientSession() as client:
            try:
                async with client.get(url, headers=headers, params=params) as resp:
                    if resp.status == 200:
                        return await resp.json()
                    elif resp.status == 404:
                        logger.warning(f"Not found: {url}")
                        return None
                    else:
                        logger.warning(f"GitHub API error {resp.status}: {url}")
                        return None
            except Exception as e:
                logger.error(f"Request error: {e}")
                return None

    async def _ingest_commits(self, session: AsyncSession, case_id) -> int:
        """Ingest all commits from default branch."""
        count = 0
        page = 1
        per_page = 100

        while True:
            commits = await self._get(
                f"repos/{self.owner}/{self.repo}/commits",
                {"page": page, "per_page": per_page},
            )
            if not commits:
                break

            for commit_data in commits:
                try:
                    commit_hash = commit_data["sha"]
                    commit_details = await self._get(f"repos/{self.owner}/{self.repo}/commits/{commit_hash}")
                    if not commit_details:
                        continue

                    author_data = commit_data.get("author", {})
                    author_email = commit_details.get("commit", {}).get("author", {}).get("email", "")

                    person = await self._get_or_create_person(
                        session,
                        author_data.get("login", "unknown"),
                        author_email,
                        "github",
                        author_data.get("login"),
                    )

                    message = commit_details.get("commit", {}).get("message", "")
                    occurred_at = commit_details.get("commit", {}).get("author", {}).get("date")
                    if occurred_at:
                        occurred_at = datetime.fromisoformat(occurred_at.replace("Z", "+00:00"))

                    files = [f.get("filename", "") for f in commit_details.get("files", [])]

                    artifact = Artifact(
                        case_id=case_id,
                        source="github",
                        source_mode=SourceMode.LIVE,
                        type=ArtifactType.COMMIT,
                        external_id=commit_hash,
                        author_id=person.id if person else None,
                        occurred_at=occurred_at or datetime.utcnow(),
                        url=commit_data.get("html_url", ""),
                        title=message.split("\n")[0][:200],
                        body=message,
                        raw={
                            "sha": commit_hash,
                            "message": message,
                            "files": files,
                            "author": author_data,
                        },
                        acl_tag="readable",
                    )
                    session.add(artifact)
                    count += 1
                except Exception as e:
                    logger.error(f"Error ingesting commit {commit_hash}: {e}")

            if len(commits) < per_page:
                break
            page += 1

        await session.flush()
        return count

    async def _ingest_pull_requests(self, session: AsyncSession, case_id) -> int:
        """Ingest all pull requests (open and closed)."""
        count = 0
        for state in ["open", "closed"]:
            page = 1
            per_page = 100

            while True:
                prs = await self._get(
                    f"repos/{self.owner}/{self.repo}/pulls",
                    {"state": state, "page": page, "per_page": per_page},
                )
                if not prs:
                    break

                for pr_data in prs:
                    try:
                        pr_number = pr_data["number"]
                        author_data = pr_data.get("user", {})

                        person = await self._get_or_create_person(
                            session,
                            author_data.get("login", "unknown"),
                            author_data.get("email", ""),
                            "github",
                            author_data.get("login"),
                        )

                        body = pr_data.get("body", "")
                        occurred_at = pr_data.get("created_at")
                        if occurred_at:
                            occurred_at = datetime.fromisoformat(occurred_at.replace("Z", "+00:00"))

                        artifact = Artifact(
                            case_id=case_id,
                            source="github",
                            source_mode=SourceMode.LIVE,
                            type=ArtifactType.PULL_REQUEST,
                            external_id=str(pr_number),
                            author_id=person.id if person else None,
                            occurred_at=occurred_at or datetime.utcnow(),
                            url=pr_data.get("html_url", ""),
                            title=pr_data.get("title", "")[:200],
                            body=body,
                            raw={
                                "number": pr_number,
                                "title": pr_data.get("title", ""),
                                "state": pr_data.get("state"),
                                "draft": pr_data.get("draft", False),
                                "merged": pr_data.get("merged", False),
                                "user": author_data,
                            },
                            acl_tag="readable",
                        )
                        session.add(artifact)
                        count += 1
                    except Exception as e:
                        logger.error(f"Error ingesting PR {pr_number}: {e}")

                if len(prs) < per_page:
                    break
                page += 1

        await session.flush()
        return count

    async def _ingest_issues(self, session: AsyncSession, case_id) -> int:
        """Ingest all issues."""
        count = 0
        page = 1
        per_page = 100

        while True:
            issues = await self._get(
                f"repos/{self.owner}/{self.repo}/issues",
                {"state": "all", "page": page, "per_page": per_page},
            )
            if not issues:
                break

            for issue_data in issues:
                try:
                    if issue_data.get("pull_request"):
                        continue

                    issue_number = issue_data["number"]
                    author_data = issue_data.get("user", {})

                    person = await self._get_or_create_person(
                        session,
                        author_data.get("login", "unknown"),
                        author_data.get("email", ""),
                        "github",
                        author_data.get("login"),
                    )

                    body = issue_data.get("body", "")
                    occurred_at = issue_data.get("created_at")
                    if occurred_at:
                        occurred_at = datetime.fromisoformat(occurred_at.replace("Z", "+00:00"))

                    artifact = Artifact(
                        case_id=case_id,
                        source="github",
                        source_mode=SourceMode.LIVE,
                        type=ArtifactType.ISSUE,
                        external_id=str(issue_number),
                        author_id=person.id if person else None,
                        occurred_at=occurred_at or datetime.utcnow(),
                        url=issue_data.get("html_url", ""),
                        title=issue_data.get("title", "")[:200],
                        body=body,
                        raw={
                            "number": issue_number,
                            "title": issue_data.get("title", ""),
                            "state": issue_data.get("state"),
                            "labels": [l.get("name") for l in issue_data.get("labels", [])],
                            "user": author_data,
                        },
                        acl_tag="readable",
                    )
                    session.add(artifact)
                    count += 1
                except Exception as e:
                    logger.error(f"Error ingesting issue {issue_number}: {e}")

            if len(issues) < per_page:
                break
            page += 1

        await session.flush()
        return count

    async def _ingest_branches(self, session: AsyncSession, case_id) -> int:
        """Ingest branches."""
        count = 0
        page = 1
        per_page = 100

        while True:
            branches = await self._get(
                f"repos/{self.owner}/{self.repo}/branches",
                {"page": page, "per_page": per_page},
            )
            if not branches:
                break

            for branch_data in branches:
                try:
                    branch_name = branch_data["name"]
                    commit_data = branch_data.get("commit", {})

                    artifact = Artifact(
                        case_id=case_id,
                        source="github",
                        source_mode=SourceMode.LIVE,
                        type=ArtifactType.BRANCH,
                        external_id=branch_name,
                        author_id=None,
                        occurred_at=datetime.utcnow(),
                        url=f"{self.repo_url}/tree/{branch_name}",
                        title=f"Branch: {branch_name}",
                        body="",
                        raw={
                            "name": branch_name,
                            "commit": commit_data,
                        },
                        acl_tag="readable",
                    )
                    session.add(artifact)
                    count += 1
                except Exception as e:
                    logger.error(f"Error ingesting branch {branch_name}: {e}")

            if len(branches) < per_page:
                break
            page += 1

        await session.flush()
        return count

    async def _ingest_tags(self, session: AsyncSession, case_id) -> int:
        """Ingest tags."""
        count = 0
        page = 1
        per_page = 100

        while True:
            tags = await self._get(
                f"repos/{self.owner}/{self.repo}/tags",
                {"page": page, "per_page": per_page},
            )
            if not tags:
                break

            for tag_data in tags:
                try:
                    tag_name = tag_data["name"]
                    commit_data = tag_data.get("commit", {})

                    artifact = Artifact(
                        case_id=case_id,
                        source="github",
                        source_mode=SourceMode.LIVE,
                        type=ArtifactType.TAG,
                        external_id=tag_name,
                        author_id=None,
                        occurred_at=datetime.utcnow(),
                        url=f"{self.repo_url}/releases/tag/{tag_name}",
                        title=f"Tag: {tag_name}",
                        body="",
                        raw={
                            "name": tag_name,
                            "commit": commit_data,
                        },
                        acl_tag="readable",
                    )
                    session.add(artifact)
                    count += 1
                except Exception as e:
                    logger.error(f"Error ingesting tag {tag_name}: {e}")

            if len(tags) < per_page:
                break
            page += 1

        await session.flush()
        return count

    async def _get_or_create_person(
        self,
        session: AsyncSession,
        display_name: str,
        email: str,
        source: str,
        handle: Optional[str],
    ) -> Optional[Person]:
        """Get or create a person with GitHub identity."""
        from sqlalchemy import select

        stmt = select(Person).where(
            Person.identities.contains([{"source": source, "handle": handle}])
        )
        existing = await session.execute(stmt)
        person = existing.scalars().first()

        if person:
            return person

        identity = {"source": source, "id": handle, "handle": handle}
        if email:
            identity["email"] = email

        person = Person(
            display_name=display_name or handle or "Unknown",
            identities=[identity],
            is_leaver=False,
        )
        session.add(person)
        await session.flush()
        return person
