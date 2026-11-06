import logging
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models import Person, Component, KnowledgeScore, Case

logger = logging.getLogger(__name__)


class RiskScorer:
    """Compute knowledge-loss risk scores."""

    def __init__(self, doc_coverage_weight: float = 0.6):
        self.doc_coverage_weight = doc_coverage_weight

    async def compute_risk(
        self,
        session: AsyncSession,
        case_id,
        without_person_id=None,
    ) -> List[Dict[str, Any]]:
        """Compute risk for all components."""
        case = (await session.execute(
            select(Case).where(Case.id == case_id)
        )).scalar()

        if not case or not case.leaver_person_id:
            return []

        leaver_id = case.leaver_person_id

        components = (await session.execute(
            select(Component).where(Component.case_id == case_id)
        )).scalars().all()

        results = []

        for component in components:
            scores = (await session.execute(
                select(KnowledgeScore).where(KnowledgeScore.component_id == component.id)
            )).scalars().all()

            if not scores:
                continue

            leaver_score = next((s for s in scores if s.person_id == leaver_id), None)
            if not leaver_score:
                continue

            remaining_scores = [s for s in scores if s.person_id != leaver_id and s.person_id != without_person_id]

            total_k = sum(s.score for s in scores)
            leaver_share = leaver_score.score / total_k if total_k > 0 else 0

            max_remaining = max((s.score for s in remaining_scores), default=0)
            bench_strength = min(1.0, max_remaining / leaver_score.score) if leaver_score.score > 0 else 0

            doc_coverage = await self._get_doc_coverage(session, component)

            criticality = component.criticality

            risk = criticality * leaver_share * (1 - bench_strength) * (1 - self.doc_coverage_weight * doc_coverage)

            results.append({
                "component_id": component.id,
                "component_name": component.name,
                "criticality": criticality,
                "leaver_share": leaver_share,
                "bench_strength": bench_strength,
                "doc_coverage": doc_coverage,
                "risk": risk,
                "formula": f"Risk = {criticality:.2f} × {leaver_share:.2f} × (1 - {bench_strength:.2f}) × (1 - {self.doc_coverage_weight} × {doc_coverage:.2f}) = {risk:.3f}",
            })

        return sorted(results, key=lambda x: x["risk"], reverse=True)

    async def _get_doc_coverage(self, session: AsyncSession, component: Component) -> float:
        """Get documentation coverage for component."""
        return 0.5
