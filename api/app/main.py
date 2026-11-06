from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging
import uuid
from datetime import datetime

from app.db import get_db, init_db, close_db
from app.config import get_settings
from app.models import (
    Case, Person, Artifact, Component, KnowledgeScore,
    Finding, InterviewQuestion, InterviewAnswer, HandoverItem,
    CaseStatus,
)
from app.schemas import (
    CaseSchema, CaseCreateSchema,
    PersonSchema, PersonCreateSchema,
    ArtifactSchema, FindingSchema,
    InterviewQuestionSchema, InterviewAnswerSchema,
    HandoverItemSchema, ComponentSchema, KnowledgeScoreSchema,
)
from app.ingest.github import GitHubIngestor
from app.ingest.fixtures import FixtureIngestor
from app.ingest.identity import IdentityResolver

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)
settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    logger.info("Starting RELAY AI")
    await init_db()


@app.on_event("shutdown")
async def shutdown():
    logger.info("Shutting down RELAY AI")
    await close_db()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.app_version}


@app.get("/")
async def root():
    return {"app": settings.app_name, "version": settings.app_version, "status": "ready"}


# ---------------------------------------------------------------------------
# Demo seed
# ---------------------------------------------------------------------------

@app.post("/demo/seed")
async def demo_seed(session: AsyncSession = Depends(get_db)):
    """Seed the database with the ShopLedger / Priya Nair demo scenario."""
    from app.seed_demo import seed_demo
    result = await seed_demo(session)
    return result


# ---------------------------------------------------------------------------
# Cases
# ---------------------------------------------------------------------------

@app.post("/cases", response_model=CaseSchema)
async def create_case(case_data: CaseCreateSchema, session: AsyncSession = Depends(get_db)):
    """Create a new case."""
    case = Case(
        name=case_data.name,
        repo_url=case_data.repo_url,
        leaver_person_id=case_data.leaver_person_id,
        status=CaseStatus.DRAFT,
        source_modes=case_data.source_modes or {
            "github": "live", "slack": "fixture", "jira": "fixture", "docs": "fixture",
        },
    )
    session.add(case)
    await session.flush()
    await session.refresh(case)
    return case


@app.get("/cases", response_model=list[CaseSchema])
async def list_cases(session: AsyncSession = Depends(get_db)):
    """List all cases."""
    result = await session.execute(select(Case).order_by(Case.created_at.desc()))
    return result.scalars().all()


@app.get("/cases/{case_id}", response_model=CaseSchema)
async def get_case(case_id: uuid.UUID, session: AsyncSession = Depends(get_db)):
    """Get a case by ID."""
    case = (await session.execute(select(Case).where(Case.id == case_id))).scalar()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@app.post("/cases/{case_id}/ingest")
async def ingest_case(
    case_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_db),
):
    """Start ingestion for a case."""
    case = (await session.execute(select(Case).where(Case.id == case_id))).scalar()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    case.status = CaseStatus.INGESTING
    await session.flush()
    background_tasks.add_task(_run_ingest, case_id, session)
    return {"case_id": case_id, "status": "ingesting", "message": "Ingestion started"}


async def _run_ingest(case_id: uuid.UUID, session: AsyncSession):
    """Background task to run ingestion."""
    try:
        case = (await session.execute(select(Case).where(Case.id == case_id))).scalar()
        if not case:
            return

        results = {"github": 0, "slack": 0, "jira": 0, "docs": 0}

        if case.source_modes.get("github") == "live":
            github = GitHubIngestor(case.repo_url)
            r = await github.ingest(session, case_id)
            results["github"] = r.get("commits", 0) + r.get("pull_requests", 0) + r.get("issues", 0)

        if case.source_modes.get("slack") == "fixture":
            results["slack"] = await FixtureIngestor().ingest_slack(session, case_id)

        if case.source_modes.get("jira") == "fixture":
            results["jira"] = await FixtureIngestor().ingest_jira(session, case_id)

        if case.source_modes.get("docs") == "fixture":
            results["docs"] = await FixtureIngestor().ingest_docs(session, case_id)

        await IdentityResolver().resolve_identities(session)
        case.status = CaseStatus.DETECTING
        await session.commit()
        logger.info(f"Ingestion complete for case {case_id}: {results}")
    except Exception as e:
        logger.error(f"Ingestion error for case {case_id}: {e}", exc_info=True)
        case = (await session.execute(select(Case).where(Case.id == case_id))).scalar()
        if case:
            case.status = CaseStatus.DRAFT


# ---------------------------------------------------------------------------
# Artifacts
# ---------------------------------------------------------------------------

@app.get("/cases/{case_id}/artifacts", response_model=list[ArtifactSchema])
async def list_artifacts(case_id: uuid.UUID, session: AsyncSession = Depends(get_db)):
    """List all artifacts for a case."""
    result = await session.execute(
        select(Artifact)
        .where(Artifact.case_id == case_id)
        .order_by(Artifact.occurred_at.desc())
    )
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Findings
# ---------------------------------------------------------------------------

@app.get("/cases/{case_id}/findings", response_model=list[FindingSchema])
async def list_findings(case_id: uuid.UUID, session: AsyncSession = Depends(get_db)):
    """List all findings for a case."""
    result = await session.execute(
        select(Finding)
        .where(Finding.case_id == case_id)
        .order_by(Finding.severity.desc())
    )
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Components & Knowledge
# ---------------------------------------------------------------------------

@app.get("/cases/{case_id}/components", response_model=list[ComponentSchema])
async def list_components(case_id: uuid.UUID, session: AsyncSession = Depends(get_db)):
    result = await session.execute(
        select(Component).where(Component.case_id == case_id)
    )
    return result.scalars().all()


@app.get("/cases/{case_id}/knowledge", response_model=list[KnowledgeScoreSchema])
async def list_knowledge_scores(case_id: uuid.UUID, session: AsyncSession = Depends(get_db)):
    result = await session.execute(
        select(KnowledgeScore)
        .join(Component, KnowledgeScore.component_id == Component.id)
        .where(Component.case_id == case_id)
    )
    return result.scalars().all()


# ---------------------------------------------------------------------------
# Interview
# ---------------------------------------------------------------------------

@app.get("/cases/{case_id}/questions", response_model=list[InterviewQuestionSchema])
async def list_questions(case_id: uuid.UUID, session: AsyncSession = Depends(get_db)):
    result = await session.execute(
        select(InterviewQuestion)
        .where(InterviewQuestion.case_id == case_id)
        .order_by(InterviewQuestion.priority.desc())
    )
    return result.scalars().all()


@app.post("/cases/{case_id}/questions/{question_id}/answer")
async def answer_question(
    case_id: uuid.UUID,
    question_id: uuid.UUID,
    body: dict,
    session: AsyncSession = Depends(get_db),
):
    """Submit an answer to an interview question."""
    q = (await session.execute(
        select(InterviewQuestion).where(
            InterviewQuestion.id == question_id,
            InterviewQuestion.case_id == case_id,
        )
    )).scalar()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    answer = InterviewAnswer(
        question_id=q.id,
        text=body.get("text", ""),
        answered_at=datetime.utcnow(),
    )
    q.status = "answered"
    session.add(answer)
    await session.flush()
    return {"status": "ok", "answer_id": str(answer.id)}


# ---------------------------------------------------------------------------
# Handover
# ---------------------------------------------------------------------------

@app.get("/cases/{case_id}/handover", response_model=list[HandoverItemSchema])
async def list_handover(case_id: uuid.UUID, session: AsyncSession = Depends(get_db)):
    result = await session.execute(
        select(HandoverItem)
        .where(HandoverItem.case_id == case_id)
        .order_by(HandoverItem.section)
    )
    return result.scalars().all()


# ---------------------------------------------------------------------------
# People
# ---------------------------------------------------------------------------

@app.post("/people", response_model=PersonSchema)
async def create_person(person_data: PersonCreateSchema, session: AsyncSession = Depends(get_db)):
    person = Person(
        display_name=person_data.display_name,
        identities=person_data.identities,
        is_leaver=person_data.is_leaver,
    )
    session.add(person)
    await session.flush()
    await session.refresh(person)
    return person


@app.get("/people/{person_id}", response_model=PersonSchema)
async def get_person(person_id: uuid.UUID, session: AsyncSession = Depends(get_db)):
    person = (await session.execute(select(Person).where(Person.id == person_id))).scalar()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return person


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
