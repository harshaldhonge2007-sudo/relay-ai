import json
import logging
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Case, Person, HandoverItem, Handover, Provenance
from app.llm import llm
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class HandoverBuilder:
    """Build handover pack from artifacts and findings."""

    async def build_handover(self, session: AsyncSession, case_id: str) -> str:
        """Generate handover document."""
        case = (await session.execute(
            select(Case).where(Case.id == case_id)
        )).scalar()

        if not case:
            return ""

        leaver = (await session.execute(
            select(Person).where(Person.id == case.leaver_person_id)
        )).scalar()

        artifacts = (await session.execute(
            select(HandoverItem).where(HandoverItem.case_id == case_id)
        )).scalars().all()

        if artifacts:
            return self._render_handover(case, leaver, artifacts)

        artifacts = (await session.execute(
            select(HandoverItem).where(HandoverItem.case_id == case_id)
        )).scalars().all()

        handover = await self._generate_with_llm(case, leaver, artifacts)
        return handover

    async def _generate_with_llm(
        self,
        case: Case,
        leaver: Person,
        items: List[HandoverItem],
    ) -> str:
        """Use LLM to generate handover with evidence requirement."""
        prompt = f"""Generate a handover document for {leaver.display_name} departing from {case.name}.

Structure:
1. What the leaver owned
2. Work completed
3. Work in flight
4. Decisions and why
5. Hidden dependencies
6. Open conflicts to verify
7. Who to ask
8. First tasks for the successor

Every sentence must cite evidence_ids (UUIDs from the artifacts).
Provenance: inferred, stated (by leaver), or verified.

Handover:"""

        text = await llm.generate(prompt)
        return text

    def _render_handover(
        self,
        case: Case,
        leaver: Person,
        items: List[HandoverItem],
    ) -> str:
        """Render handover from stored items."""
        sections = {}
        for item in items:
            if item.section not in sections:
                sections[item.section] = []
            sections[item.section].append(item)

        lines = [f"# {case.name}", f"", f"**Leaver**: {leaver.display_name if leaver else 'Unknown'}", ""]

        for section, items in sections.items():
            lines.append(f"## {section}")
            for item in items:
                provenance_marker = {
                    "inferred": "(inferred)",
                    "stated": f"(stated by {leaver.display_name if leaver else 'leaver'})",
                    "verified": "(verified)",
                }.get(item.provenance, "")

                lines.append(f"- {item.text} {provenance_marker}".strip())

            lines.append("")

        return "\n".join(lines)