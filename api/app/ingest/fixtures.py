import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Person, Artifact, ArtifactType, SourceMode

logger = logging.getLogger(__name__)

SEED_DIR = Path(__file__).parent.parent.parent.parent / "seed"


class FixtureIngestor:
    async def ingest_slack(self, session: AsyncSession, case_id) -> int:
        """Load Slack messages from seed/slack.json."""
        slack_file = SEED_DIR / "slack.json"
        if not slack_file.exists():
            logger.warning(f"Slack fixture not found: {slack_file}")
            return 0

        count = 0
        try:
            with open(slack_file) as f:
                slack_data = json.load(f)

            for message in slack_data.get("messages", []):
                try:
                    user_data = message.get("user", {})
                    person = await self._get_or_create_person(
                        session,
                        user_data.get("name", "unknown"),
                        user_data.get("email", ""),
                        "slack",
                        user_data.get("id"),
                    )

                    occurred_at = message.get("ts")
                    if occurred_at:
                        try:
                            occurred_at = datetime.fromtimestamp(float(occurred_at))
                        except (ValueError, TypeError):
                            occurred_at = datetime.utcnow()

                    artifact = Artifact(
                        case_id=case_id,
                        source="slack",
                        source_mode=SourceMode.FIXTURE,
                        type=ArtifactType.SLACK_MESSAGE,
                        external_id=message.get("id", f"slack_{count}"),
                        author_id=person.id if person else None,
                        occurred_at=occurred_at or datetime.utcnow(),
                        url=message.get("url", ""),
                        title=f"Slack: {user_data.get('name', 'unknown')}",
                        body=message.get("text", ""),
                        raw=message,
                        acl_tag="readable",
                    )
                    session.add(artifact)
                    count += 1
                except Exception as e:
                    logger.error(f"Error ingesting Slack message: {e}")

            await session.flush()
        except Exception as e:
            logger.error(f"Error loading Slack fixture: {e}")

        return count

    async def ingest_jira(self, session: AsyncSession, case_id) -> int:
        """Load Jira tickets from seed/jira.json."""
        jira_file = SEED_DIR / "jira.json"
        if not jira_file.exists():
            logger.warning(f"Jira fixture not found: {jira_file}")
            return 0

        count = 0
        try:
            with open(jira_file) as f:
                jira_data = json.load(f)

            for ticket in jira_data.get("tickets", []):
                try:
                    assignee = ticket.get("assignee", {})
                    person = await self._get_or_create_person(
                        session,
                        assignee.get("name", "unknown"),
                        assignee.get("email", ""),
                        "jira",
                        assignee.get("id"),
                    )

                    occurred_at = ticket.get("created")
                    if occurred_at:
                        try:
                            occurred_at = datetime.fromisoformat(occurred_at.replace("Z", "+00:00"))
                        except (ValueError, TypeError):
                            occurred_at = datetime.utcnow()

                    artifact = Artifact(
                        case_id=case_id,
                        source="jira",
                        source_mode=SourceMode.FIXTURE,
                        type=ArtifactType.JIRA_TICKET,
                        external_id=ticket.get("key", f"jira_{count}"),
                        author_id=person.id if person else None,
                        occurred_at=occurred_at or datetime.utcnow(),
                        url=ticket.get("url", ""),
                        title=ticket.get("summary", "")[:200],
                        body=ticket.get("description", ""),
                        raw=ticket,
                        acl_tag="readable",
                    )
                    session.add(artifact)
                    count += 1
                except Exception as e:
                    logger.error(f"Error ingesting Jira ticket: {e}")

            await session.flush()
        except Exception as e:
            logger.error(f"Error loading Jira fixture: {e}")

        return count

    async def ingest_docs(self, session: AsyncSession, case_id) -> int:
        """Load documentation from seed/docs/."""
        docs_dir = SEED_DIR / "docs"
        if not docs_dir.exists():
            logger.warning(f"Docs directory not found: {docs_dir}")
            return 0

        count = 0
        try:
            for doc_file in docs_dir.glob("**/*.md"):
                try:
                    with open(doc_file) as f:
                        content = f.read()

                    artifact = Artifact(
                        case_id=case_id,
                        source="docs",
                        source_mode=SourceMode.FIXTURE,
                        type=ArtifactType.DOCUMENT,
                        external_id=str(doc_file.relative_to(docs_dir)),
                        author_id=None,
                        occurred_at=datetime.utcnow(),
                        url="",
                        title=doc_file.name,
                        body=content,
                        raw={"path": str(doc_file.relative_to(docs_dir)), "content": content},
                        acl_tag="readable",
                    )
                    session.add(artifact)
                    count += 1
                except Exception as e:
                    logger.error(f"Error ingesting doc {doc_file}: {e}")

            await session.flush()
        except Exception as e:
            logger.error(f"Error loading docs: {e}")

        return count

    async def _get_or_create_person(
        self,
        session: AsyncSession,
        display_name: str,
        email: str,
        source: str,
        identity_id: Optional[str],
    ) -> Optional[Person]:
        """Get or create person with fixture identity."""
        from sqlalchemy import select

        if identity_id:
            stmt = select(Person).where(
                Person.identities.contains([{"source": source, "id": identity_id}])
            )
            existing = await session.execute(stmt)
            person = existing.scalars().first()
            if person:
                return person

        identity = {"source": source, "id": identity_id or "unknown"}
        if email:
            identity["email"] = email

        person = Person(
            display_name=display_name or "Unknown",
            identities=[identity],
            is_leaver=False,
        )
        session.add(person)
        await session.flush()
        return person
