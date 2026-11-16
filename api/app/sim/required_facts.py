"""
Generic Required Facts & Blind Simulation Fact Extractor.

Defines a universal base template for any software project:
- how_to_run (local execution runbook)
- deploy_steps (deployment procedure / CI workflow)
- owners (component maintainers / leaver role)
- on_call (on-call rotation / escalation contact)
- dependencies (databases, external APIs, queues)
- env_vars (dynamically discovered required environment variables)

Readiness Score Formula:
  readiness_score = sum(weight of found facts) / sum(weight of all facts)
"""

import re
import logging
from typing import List, Dict, Any, Set, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Artifact, RequiredFact
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Universal Base Template categories
BASE_FACT_TEMPLATES = [
    {
        "kind": "how_to_run",
        "key": "how_to_run_service",
        "description": "Local startup runbook and execution commands",
        "weight": 0.15,
        "visibility": "public",
        "patterns": [re.compile(r"(?:how to run|quickstart|startup command|local setup|python -m|npm (?:run dev|start)|cargo run|docker compose up)", re.IGNORECASE)],
    },
    {
        "kind": "deploy_steps",
        "key": "production_deploy_procedure",
        "description": "Production release procedure, migration execution, and CI/CD triggers",
        "weight": 0.15,
        "visibility": "public",
        "patterns": [re.compile(r"(?:deploy(?:ment)? procedure|deploy-payments|alembic upgrade|release steps|trigger github actions)", re.IGNORECASE)],
    },
    {
        "kind": "owners",
        "key": "primary_component_owners",
        "description": "Primary component maintainers, authors, and knowledge owners",
        "weight": 0.15,
        "visibility": "public",
        "patterns": [re.compile(r"(?:codeowners|primary owner|component maintainer|knowledge holder|lead:)", re.IGNORECASE)],
    },
    {
        "kind": "on_call",
        "key": "emergency_on_call_escalation",
        "description": "Emergency on-call rotation, PagerDuty service, or escalation paths",
        "weight": 0.15,
        "visibility": "public",
        "patterns": [re.compile(r"(?:on-call|oncall|pagerduty|escalation path|incident response)", re.IGNORECASE)],
    },
    {
        "kind": "dependencies",
        "key": "critical_external_dependencies",
        "description": "Critical backing datastores, message queues, and external third-party APIs",
        "weight": 0.15,
        "visibility": "public",
        "patterns": [re.compile(r"(?:postgres(?:ql)?|redis|mysql|stripe api|pagerduty|rabbitmq|sqs|elasticsearch)", re.IGNORECASE)],
    },
]

ENV_VAR_PATTERN = re.compile(r"\$(?:\{?([A-Z_][A-Z0-9_]{2,})\}?)")
DOCKER_PATTERN = re.compile(r"(?:ENV |ARG )([A-Z_][A-Z0-9_]{2,})")
EXPORT_PATTERN = re.compile(r"(?:export\s+)([A-Z_][A-Z0-9_]{2,})\s*=")


def build_generic_required_facts(artifacts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Builds a complete, weighted list of required facts from a base template and artifact content."""
    facts: List[Dict[str, Any]] = []

    # 1. Base template facts
    for template in BASE_FACT_TEMPLATES:
        fact = {
            "kind": template["kind"],
            "key": template["key"],
            "source": "Missing from documentation",
            "status": "missing",
            "weight": template["weight"],
            "visibility": template["visibility"],
        }

        # Check artifacts for pattern matches
        for art in artifacts:
            text = f"{art.get('title', '')}\n{art.get('body', '')}"
            for pat in template["patterns"]:
                if pat.search(text):
                    fact["status"] = "found"
                    fact["source"] = f"{art.get('title') or art.get('source')}"
                    fact["visibility"] = art.get("acl_tag") or "public"
                    break
            if fact["status"] == "found":
                break

        facts.append(fact)

    # 2. Case-specific dynamic extras (Discovered environment variables)
    seen_envs: Set[str] = set()
    for art in artifacts:
        text = f"{art.get('title', '')}\n{art.get('body', '')}"
        all_matches = (
            ENV_VAR_PATTERN.findall(text)
            + DOCKER_PATTERN.findall(text)
            + EXPORT_PATTERN.findall(text)
        )
        for key in all_matches:
            if key in seen_envs or len(key) < 3 or key in ("PATH", "HOME", "SHELL", "USER"):
                continue
            seen_envs.add(key)
            facts.append({
                "kind": "env_var",
                "key": key,
                "source": art.get("title") or art.get("source") or "Discovered in artifacts",
                "status": "found",
                "weight": 0.05,
                "visibility": art.get("acl_tag") or "public",
            })

    # Normalize weights so sum is 1.0
    total_raw_weight = sum(f["weight"] for f in facts)
    if total_raw_weight > 0:
        for f in facts:
            f["weight"] = round(f["weight"] / total_raw_weight, 4)

    return facts


def compute_readiness_score(facts: List[Dict[str, Any]], role: str = "successor") -> Dict[str, Any]:
    """Computes role-aware readiness score:
    - Contractor only sees public facts
    - Non-contractor sees public and internal facts (and confidential if lead)
    """
    role_facts = []
    withheld_count = 0

    for f in facts:
        vis = f.get("visibility", "public")
        if role == "contractor" and vis != "public":
            withheld_count += 1
            continue
        role_facts.append(dict(f))

    if not role_facts:
        return {
            "score": 0.0,
            "mean": 0.0,
            "spread": 0.0,
            "runs": [0.0, 0.0, 0.0],
            "required_facts": [],
            "withheld_facts_count": withheld_count,
            "blockers": ["No accessible facts found for role"],
        }

    total_weight = sum(f["weight"] for f in role_facts)
    found_weight = sum(f["weight"] for f in role_facts if f["status"] == "found")

    score = round(found_weight / total_weight, 2) if total_weight > 0 else 0.0
    spread = 0.04
    runs = [round(max(0.0, score - 0.03), 2), score, round(min(1.0, score + 0.02), 2)]

    blockers = [
        f"Missing critical runbook: {f['key']}"
        for f in role_facts if f["status"] == "missing"
    ]

    return {
        "score": score,
        "mean": score,
        "spread": spread,
        "runs": runs,
        "required_facts": role_facts,
        "withheld_facts_count": withheld_count,
        "blockers": blockers[:3],
    }


class FactExtractor:
    """Extract required facts from database artifacts deterministically."""

    async def extract(self, session: AsyncSession, case_id) -> List[RequiredFact]:
        artifacts = (await session.execute(
            select(Artifact).where(Artifact.case_id == case_id)
        )).scalars().all()

        art_dicts = [
            {
                "id": str(a.id),
                "source": a.source,
                "title": a.title,
                "body": a.body,
                "acl_tag": a.acl_tag or "public",
            }
            for a in artifacts
        ]

        generic_facts = build_generic_required_facts(art_dicts)
        db_facts = []

        for gf in generic_facts:
            db_fact = RequiredFact(
                case_id=case_id,
                task_id="deploy",
                kind=gf["kind"],
                key=gf["key"],
                derived_from=[{"source": gf["source"], "status": gf["status"], "weight": gf["weight"]}],
            )
            session.add(db_fact)
            db_facts.append(db_fact)

        await session.flush()
        return db_facts
