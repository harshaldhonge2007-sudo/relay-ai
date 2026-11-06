import logging
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Case, HandoverItem, SimRun, SimTask
from app.llm import llm
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class BlindAgent:
    """Simulate an incoming developer with only the handover."""

    async def plan(
        self,
        session: AsyncSession,
        case_id: str,
        task_id: str,
        handover_text: str,
    ) -> Dict[str, Any]:
        """Given only the handover, produce a step-by-step plan."""
        prompt = f"""You are an incoming developer given this handover document:

{handover_text}

Your task: {task_id}

Instructions:
1. List the steps you would take
2. Note any blockers or missing information
3. Format as JSON with keys: steps (array of objects with step, action, blocker), missing_info (array of strings)

JSON:"""

        try:
            response = await llm.generate(prompt)
            plan = llm.extract_json(response)
            return plan
        except Exception as e:
            logger.error(f"Blind agent error: {e}")
            return {
                "steps": [],
                "missing_info": ["Could not generate plan"],
            }