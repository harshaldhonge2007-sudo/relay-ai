import logging
from typing import List, Set
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import InterviewQuestion, InterviewAnswer, QuestionStatus

logger = logging.getLogger(__name__)


class QuestionDeduplicator:
    """Deduplicate interview questions."""

    async def filter_questions(
        self,
        session: AsyncSession,
        case_id,
        new_questions: List[InterviewQuestion],
    ) -> List[InterviewQuestion]:
        """Remove questions already answered or covered."""
        answered_texts = await self._get_answered_texts(session, case_id)
        deduped = []

        for question in new_questions:
            if not self._is_similar(question.text, answered_texts):
                deduped.append(question)

        logger.info(f"Deduped {len(new_questions) - len(deduped)} questions")
        return deduped

    async def _get_answered_texts(self, session: AsyncSession, case_id) -> Set[str]:
        """Get texts from answered questions and handover items."""
        texts = set()

        answers = (await session.execute(
            select(InterviewAnswer)
            .join(InterviewQuestion)
            .where(InterviewQuestion.case_id == case_id)
        )).scalars().all()

        for answer in answers:
            texts.add(answer.text.lower())

        return texts

    def _is_similar(self, text: str, existing_texts: Set[str], threshold: float = 0.8) -> bool:
        """Check if text is similar to any existing text."""
        from difflib import SequenceMatcher

        text_lower = text.lower()
        for existing in existing_texts:
            ratio = SequenceMatcher(None, text_lower, existing.lower()).ratio()
            if ratio >= threshold:
                return True
        return False