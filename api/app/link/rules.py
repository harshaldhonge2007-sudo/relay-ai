import re
import logging
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Artifact, Link

logger = logging.getLogger(__name__)


class ExplicitLinker:
    """Link artifacts via explicit references."""

    JIRA_PATTERN = re.compile(r"\b([A-Z]{2,10}-\d{1,6})\b")
    ISSUE_PATTERN = re.compile(r"#(\d+)")
    URL_PATTERN = re.compile(r"https?://[^\s<]+")
    PR_BRANCH_PATTERN = re.compile(r"[\w-]+/[\w-]+")

    async def link(self, session: AsyncSession, case_id) -> List[Link]:
        """Find explicit links between artifacts."""
        links = []

        artifacts = (await session.execute(
            select(Artifact).where(Artifact.case_id == case_id)
        )).scalars().all()

        artifact_map = {a.external_id: a for a in artifacts}

        for artifact in artifacts:
            text = f"{artifact.title or ''} {artifact.body or ''}"

            for jira_key in self.JIRA_PATTERN.findall(text):
                jira_key = jira_key.upper()
                if jira_key in artifact_map:
                    dst = artifact_map[jira_key]
                    if dst.id != artifact.id:
                        links.append(Link(
                            src_id=artifact.id,
                            dst_id=dst.id,
                            link_type="references",
                            method="explicit",
                            confidence=1.0,
                        ))

            for issue_num in self.ISSUE_PATTERN.findall(text):
                external_id = issue_num
                if external_id in artifact_map:
                    dst = artifact_map[external_id]
                    if dst.id != artifact.id:
                        links.append(Link(
                            src_id=artifact.id,
                            dst_id=dst.id,
                            link_type="references",
                            method="explicit",
                            confidence=1.0,
                        ))

        for link in links:
            session.add(link)

        await session.flush()
        logger.info(f"Created {len(links)} explicit links")
        return links
