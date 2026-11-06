import logging
from typing import Dict, Any, List
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models import Person, Artifact, Component, KnowledgeScore

logger = logging.getLogger(__name__)


class KnowledgeScorer:
    """Calculate knowledge scores for person-component pairs."""

    HALF_LIFE_DAYS = 365

    async def compute_scores(self, session: AsyncSession, case_id):
        """Compute knowledge scores for all person-component pairs."""
        components = (await session.execute(
            select(Component).where(Component.case_id == case_id)
        )).scalars().all()

        people = (await session.execute(
            select(Person)
        )).scalars().all()

        for component in components:
            for person in people:
                score = await self._compute_score(session, component, person)
                if score["total"] > 0:
                    ks = KnowledgeScore(
                        component_id=component.id,
                        person_id=person.id,
                        score=score["total"],
                        breakdown=score["breakdown"],
                    )
                    session.add(ks)

        await session.flush()

    async def _compute_score(self, session: AsyncSession, component: Component, person: Person) -> Dict[str, Any]:
        """Compute time-decayed authorship score."""
        now = datetime.utcnow()
        cutoff = now - timedelta(days=self.HALF_LIFE_DAYS * 2)

        artifacts = (await session.execute(
            select(Artifact).where(
                Artifact.case_id == component.case_id,
                Artifact.author_id == person.id,
                Artifact.occurred_at >= cutoff,
            )
        )).scalars().all()

        edits = 0.0
        reviews = 0.0
        discussion = 0.0

        for artifact in artifacts:
            age_days = (now - artifact.occurred_at).days
            decay = 0.5 ** (age_days / self.HALF_LIFE_DAYS)

            if artifact.type == "commit":
                edits += 1.0 * decay
            elif artifact.type == "pull_request":
                reviews += 0.5 * decay
            elif artifact.type in ["slack_message", "jira_ticket"]:
                discussion += 0.3 * decay

        total = edits + reviews + discussion

        return {
            "total": total,
            "breakdown": {
                "edits": edits,
                "reviews": reviews,
                "discussion": discussion,
            },
        }
