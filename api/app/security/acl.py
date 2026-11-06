import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Artifact, AuditLog

logger = logging.getLogger(__name__)


class ACLChecker:
    """Check access control for artifacts."""

    async def can_read(
        self,
        session: AsyncSession,
        artifact_id: str,
        role: str = "user",
    ) -> bool:
        """Check if a role can read an artifact."""
        artifact = await session.get(Artifact, artifact_id)
        if not artifact:
            return False

        acl_tag = artifact.acl_tag or "readable"

        if role in ["admin", "leaver"]:
            return True

        if role == "incoming" and acl_tag in ["readable", "restricted"]:
            return True

        return False

    async def filter_readable(
        self,
        session: AsyncSession,
        artifact_ids: List[str],
        role: str = "user",
    ) -> List[str]:
        """Filter to only readable artifact IDs."""
        readable = []
        for artifact_id in artifact_ids:
            if await self.can_read(session, artifact_id, role):
                readable.append(artifact_id)
        return readable


class AuditLogger:
    """Log all access and LLM calls."""

    async def log(
        self,
        session: AsyncSession,
        actor: str,
        action: str,
        subject: dict,
    ):
        """Write an audit log entry."""
        if not self._should_log(action):
            return

        entry = AuditLog(
            actor=actor,
            action=action,
            subject=subject,
        )
        session.add(entry)
        await session.flush()

    def _should_log(self, action: str) -> bool:
        """Determine if action should be logged."""
        logged_actions = [
            "view_handover",
            "generate_handover",
            "approve_handover",
            "run_interview",
            "answer_question",
            "run_ingest",
            "llm_call",
        ]
        return action in logged_actions