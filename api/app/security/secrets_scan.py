import logging
from typing import List, Set, Dict
import re
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Artifact

logger = logging.getLogger(__name__)

SECRET_PATTERNS = [
    re.compile(r"(?i)(api_?key|apikey)[\s=:>\"']+([a-zA-Z0-9_\-]{20,})", re.IGNORECASE),
    re.compile(r"(?i)secret[\s=:>\"']+([a-zA-Z0-9_\-]{16,})"),
    re.compile(r"(?i)password[\s=:>\"']+([^\s\"']{8,})"),
    re.compile(r"ghp_[a-zA-Z0-9]{36}"),
    re.compile(r"gho_[a-zA-Z0-9]{36}"),
    re.compile(r"eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*"),
]


class SecretScanner:
    """Scan artifacts for secrets without storing them."""

    async def scan(self, artifact: Artifact) -> List[str]:
        """Return secret names found, never values."""
        secrets = []
        text = f"{artifact.title or ''} {artifact.body or ''}"

        for pattern in SECRET_PATTERNS:
            matches = pattern.findall(text)
            for match in matches:
                if isinstance(match, tuple):
                    name = match[0]
                else:
                    name = match[:10] + "..."
                if name not in secrets:
                    secrets.append(name)

        return secrets

    async def scan_all(self, session: AsyncSession, case_id) -> Dict[str, List[str]]:
        """Scan all artifacts for secrets."""
        artifacts = (await session.execute(
            select(Artifact).where(Artifact.case_id == case_id)
        )).scalars().all()

        results = {}
        for artifact in artifacts:
            names = await self.scan(artifact)
            if names:
                results[artifact.id] = names

        logger.info(f"Found secrets in {len(results)} artifacts")
        return results