import logging
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Link
from app.llm import llm

logger = logging.getLogger(__name__)


class LLMConfirmLinker:
    """Confirm low-confidence links via LLM."""

    async def confirm(self, session: AsyncSession, links: List[Link]) -> List[Link]:
        """Ask LLM to confirm uncertain links."""
        confirmed = []

        for link in links:
            if link.confidence >= 0.7:
                link.method = "llm_confirmed"
                confirmed.append(link)
                continue

            try:
                src = await session.get(Link, link.src_id)
                dst = await session.get(Link, link.dst_id)

                prompt = f"""Are these two artifacts related?

Source: {src.title}
{src.body[:200]}

Target: {dst.title}
{dst.body[:200]}

Answer only "yes" or "no"."""

                response = await llm.generate(prompt)
                is_related = "yes" in response.lower()

                if is_related:
                    link.method = "llm_confirm"
                    link.confidence = 0.85
                    confirmed.append(link)
                else:
                    await session.delete(link)

            except Exception as e:
                logger.error(f"LLM confirmation error: {e}")

        await session.flush()
        return confirmed
