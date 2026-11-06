import re
import logging
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Artifact, RequiredFact
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class FactExtractor:
    """Extract required facts from artifacts deterministically."""

    ENV_VAR_PATTERN = re.compile(r"\$(?:\{?([A-Z_][A-Z0-9_]*)\}?)")
    DOCKER_PATTERN = re.compile(r"(?:ENV |ARG )([A-Z_][A-Z0-9_]*)")
    HOSTNAME_PATTERN = re.compile(r"(?:https?://|postgres://|redis://|mysql://)([^/\s:]+)")
    MIGRATION_PATTERN = re.compile(r"(?:migrate|upgrade|alter).*?table", re.IGNORECASE)

    async def extract(self, session: AsyncSession, case_id) -> List[RequiredFact]:
        """Extract all required facts from artifacts."""
        artifacts = (await session.execute(
            select(Artifact).where(Artifact.case_id == case_id)
        )).scalars().all()

        facts = []
        seen = set()

        for artifact in artifacts:
            text = f"{artifact.title or ''} {artifact.body or ''}"

            for match in self.ENV_VAR_PATTERN.finditer(text):
                key = match.group(1)
                fact_key = f"env_var:{key}"
                if fact_key not in seen:
                    seen.add(fact_key)
                    facts.append(RequiredFact(
                        case_id=case_id,
                        task_id="deploy",
                        kind="env_var",
                        key=key,
                        derived_from=[{"artifact_id": str(artifact.id), "pattern": f"${key}"}],
                    ))

            for match in self.DOCKER_PATTERN.finditer(text):
                key = match.group(1)
                fact_key = f"env_var:{key}"
                if fact_key not in seen:
                    seen.add(fact_key)
                    facts.append(RequiredFact(
                        case_id=case_id,
                        task_id="deploy",
                        kind="env_var",
                        key=key,
                        derived_from=[{"artifact_id": str(artifact.id), "pattern": f"ENV/ARG {key}"}],
                    ))

            if "dockerfile" in artifact.external_id.lower() or artifact.external_id.endswith(".yml"):
                for match in self.ENV_VAR_PATTERN.finditer(text):
                    key = match.group(1)
                    fact_key = f"env_var:{key}"
                    if fact_key not in seen:
                        seen.add(fact_key)
                        facts.append(RequiredFact(
                            case_id=case_id,
                            task_id="deploy",
                            kind="env_var",
                            key=key,
                            derived_from=[{"artifact_id": str(artifact.id), "pattern": f"${key}"}],
                        ))

        for fact in facts:
            session.add(fact)

        await session.flush()
        logger.info(f"Extracted {len(facts)} required facts")
        return facts