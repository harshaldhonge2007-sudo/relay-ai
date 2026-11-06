import sys
import asyncio
import logging
from datetime import datetime
from sqlalchemy import select
from app.db import get_db_context
from app.models import Person, Component, KnowledgeScore, Artifact, Case

logger = logging.getLogger(__name__)


async def backtest(repo_url: str, departure_date: str):
    """Backtest risk scores against post-departure churn."""
    async with get_db_context() as session:
        cases = (await session.execute(
            select(Case).where(Case.repo_url == repo_url)
        )).scalars().all()

        if not cases:
            print(f"No case found for {repo_url}")
            return

        case = cases[0]
        departure_dt = datetime.fromisoformat(departure_date)

        print(f"Backtesting {repo_url}")
        print(f"Departure date: {departure_date}")
        print()

        components = (await session.execute(
            select(Component).where(Component.case_id == case.id)
        )).scalars().all()

        scores = (await session.execute(
            select(KnowledgeScore).join(Component).where(Component.case_id == case.id)
        )).scalars().all()

        post_artifacts = (await session.execute(
            select(Artifact).where(
                Artifact.case_id == case.id,
                Artifact.occurred_at >= departure_dt,
                Artifact.type == "commit",
            )
        )).scalars().all()

        print(f"Components: {len(components)}")
        print(f"Post-departure commits: {len(post_artifacts)}")
        print()

        for comp in components[:5]:
            comp_scores = [s for s in scores if s.component_id == comp.id]
            if comp_scores:
                max_score = max(s.score for s in comp_scores)
                print(f"{comp.name}: max_score={max_score:.2f}, criticality={comp.criticality:.2f}")

        print()
        print("Rank correlation: TODO")


def main():
    if len(sys.argv) < 3:
        print("Usage: python -m app.risk.backtest <repo_url> <departure_date>")
        print("Example: python -m app.risk.backtest https://github.com/user/repo 2024-10-15")
        sys.exit(1)

    repo_url = sys.argv[1]
    departure_date = sys.argv[2]

    asyncio.run(backtest(repo_url, departure_date))


if __name__ == "__main__":
    main()
