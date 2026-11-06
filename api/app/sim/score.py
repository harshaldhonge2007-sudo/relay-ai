import logging
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Case, RequiredFact, SimRun, SimTask
from app.llm import llm
from app.llm import llm as llm_wrapper
from app.sim.agent import BlindAgent

logger = logging.getLogger(__name__)


class CompletenessScorer:
    """Score handover completeness via blind agent."""

    def __init__(self):
        self.agent = BlindAgent()

    async def score(
        self,
        session: AsyncSession,
        case_id: str,
        task_id: str = "Deploy the service to a fresh environment",
        handover_version: str = "1.0",
        runs: int = 3,
    ) -> Dict[str, Any]:
        """Run completeness test multiple times and report mean/spread."""
        case = (await session.execute(
            select(Case).where(Case.id == case_id)
        )).scalar()

        if not case:
            return {"error": "Case not found"}

        from app.handover.build import HandoverBuilder
        builder = HandoverBuilder()
        handover_text = await builder.build_handover(session, case_id)

        required_facts = (await session.execute(
            select(RequiredFact).where(RequiredFact.case_id == case_id)
        )).scalars().all()

        results = []
        for i in range(runs):
            try:
                plan = await self.agent.plan(session, case_id, task_id, handover_text)
                found, missing = await self._check_coverage(plan, required_facts)
                score = len(found) / len(required_facts) if required_facts else 1.0

                sim_run = SimRun(
                    case_id=case_id,
                    task_id=task_id,
                    handover_version=handover_version,
                    found_fact_ids=[f.id for f in found],
                    missing_fact_ids=[f.id for f in missing],
                    blockers=plan.get("missing_info", []),
                    score=score,
                    transcript=[plan],
                    mode="blind",
                )
                session.add(sim_run)
                results.append(score)
            except Exception as e:
                logger.error(f"Run {i+1} failed: {e}")

        await session.flush()

        mean = sum(results) / len(results) if results else 0
        spread = max(results) - min(results) if results else 0

        return {
            "mean": mean,
            "spread": spread,
            "runs": results,
            "required_count": len(required_facts),
            "missing_fact_ids": [],
        }

    async def _check_coverage(
        self,
        plan: Dict[str, Any],
        required_facts: List[RequiredFact],
    ) -> tuple:
        """Check which required facts are covered by the plan."""
        found = []
        missing = []

        plan_text = str(plan).lower()

        for fact in required_facts:
            if fact.key.lower() in plan_text:
                found.append(fact)
            else:
                missing.append(fact)

        return found, missing