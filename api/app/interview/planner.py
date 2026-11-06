import logging
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Case, InterviewQuestion, Finding, QuestionStatus
from app.llm import llm
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class InterviewPlanner:
    """Generate interview questions from findings."""

    async def generate_questions(
        self,
        session: AsyncSession,
        case_id,
        max_questions: int = None,
    ) -> List[InterviewQuestion]:
        """Generate prioritized questions from open findings."""
        max_questions = max_questions or settings.max_interview_questions

        case = (await session.execute(
            select(Case).where(Case.id == case_id)
        )).scalar()

        if not case:
            return []

        findings = (await session.execute(
            select(Finding).where(
                Finding.case_id == case_id,
                Finding.status == "open",
            )
        )).scalars().all()

        if not findings:
            return []

        questions = []
        for finding in findings[:max_questions]:
            question = await self._generate_question(session, case_id, finding)
            if question:
                questions.append(question)
                session.add(question)

        await session.flush()
        logger.info(f"Generated {len(questions)} questions for case {case_id}")
        return questions

    async def _generate_question(
        self,
        session: AsyncSession,
        case_id,
        finding: Finding,
    ) -> InterviewQuestion:
        """Generate a single question from a finding."""
        try:
            evidence_summary = ", ".join([
                f"{e.get('role', 'evidence')}: {e.get('span', '')}"
                for e in finding.evidence[:2]
            ])

            prompt = f"""Generate a concise question for the departing developer based on this finding:

Finding: {finding.title}
Summary: {finding.summary}
Evidence: {evidence_summary}

The question should:
- Be specific to the gap or risk identified
- Reference the evidence briefly
- Be answerable with a short response

Question:"""

            text = await llm.generate(prompt)
            text = text.strip()

            priority = finding.severity * (1 - finding.confidence)

            return InterviewQuestion(
                case_id=case_id,
                finding_id=finding.id,
                text=text,
                evidence=finding.evidence,
                priority=priority,
                status=QuestionStatus.DRAFT,
            )
        except Exception as e:
            logger.error(f"Error generating question for finding {finding.id}: {e}")
            return None