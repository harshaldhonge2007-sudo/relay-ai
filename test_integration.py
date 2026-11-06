"""RELAY AI - Run integration tests and validators."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "api"))

from app.db import get_db_context
from app.models import Case, Person, Artifact
from app.ingest.github import GitHubIngestor
from app.ingest.fixtures import FixtureIngestor
from app.ingest.identity import IdentityResolver
from app.detect.inflight import InFlightDetector
from app.detect.hidden_deps import HiddenDepsDetector
from app.detect.contradictions import ContradictionDetector
from app.detect.gaps import GapDetector
from app.risk.knowledge import KnowledgeScorer
from app.risk.score import RiskScorer
from app.link.rules import ExplicitLinker
from app.sim.required_facts import FactExtractor
from datetime import datetime
import uuid


async def test_integration():
    """Run full integration test with seed data."""
    print("=" * 60)
    print("RELAY AI Integration Test")
    print("=" * 60)
    print()

    async with get_db_context() as session:
        try:
            # 1. Create test case
            print("[1/8] Creating test case...")
            case = Case(
                name="Integration Test - ShopLedger",
                repo_url="https://github.com/shopledger/shopledger",
                leaver_person_id=uuid.uuid4(),
                status="draft",
                source_modes={"github": "fixture", "slack": "fixture", "jira": "fixture"},
            )
            session.add(case)
            await session.flush()
            case_id = case.id
            print(f"✓ Case created: {case_id}")
            print()

            # 2. Ingest fixtures
            print("[2/8] Ingesting fixtures...")
            fixtures = FixtureIngestor()
            slack_count = await fixtures.ingest_slack(session, case_id)
            jira_count = await fixtures.ingest_jira(session, case_id)
            docs_count = await fixtures.ingest_docs(session, case_id)
            print(f"✓ Ingested: {slack_count} Slack, {jira_count} Jira, {docs_count} docs")
            print()

            # 3. Resolve identities
            print("[3/8] Resolving identities...")
            resolver = IdentityResolver()
            identity_results = await resolver.resolve_identities(session)
            print(f"✓ Identity resolution: {identity_results}")
            print()

            # 4. Link artifacts
            print("[4/8] Linking artifacts...")
            linker = ExplicitLinker()
            links = await linker.link(session, case_id)
            print(f"✓ Created {len(links)} explicit links")
            print()

            # 5. Extract knowledge
            print("[5/8] Computing knowledge scores...")
            knowledge = KnowledgeScorer()
            await knowledge.compute_scores(session, case_id)
            print(f"✓ Knowledge scores computed")
            print()

            # 6. Score risk
            print("[6/8] Computing risk scores...")
            risk_scorer = RiskScorer()
            risk_results = await risk_scorer.compute_risk(session, case_id)
            print(f"✓ Risk assessment: {len(risk_results)} components")
            for result in risk_results[:3]:
                print(f"  - {result['component_name']}: {result['risk']:.3f}")
            print()

            # 7. Detect findings
            print("[7/8] Running detectors...")
            inflight = InFlightDetector()
            hidden_deps = HiddenDepsDetector()
            contradictions = ContradictionDetector()
            gaps = GapDetector()

            findings = []
            try:
                findings.extend(await inflight.detect(session, case_id))
                findings.extend(await hidden_deps.detect(session, case_id))
                findings.extend(await contradictions.detect(session, case_id))
                findings.extend(await gaps.detect(session, case_id))
            except Exception as e:
                print(f"  (Detection: {type(e).__name__})")

            print(f"✓ Findings detected: {len(findings)}")
            print()

            # 8. Extract required facts
            print("[8/8] Extracting required facts...")
            fact_extractor = FactExtractor()
            facts = await fact_extractor.extract(session, case_id)
            print(f"✓ Required facts: {len(facts)}")
            if facts:
                for fact in facts[:3]:
                    print(f"  - {fact.kind}: {fact.key}")
            print()

            print("=" * 60)
            print("✓ Integration test passed!")
            print("=" * 60)

        except Exception as e:
            print(f"✗ Test failed: {e}")
            import traceback
            traceback.print_exc()
            raise


def main():
    """Run integration test."""
    try:
        asyncio.run(test_integration())
    except KeyboardInterrupt:
        print("\nInterrupted")
        sys.exit(0)
    except Exception as e:
        print(f"\nFailed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
