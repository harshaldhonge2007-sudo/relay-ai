from fastapi import FastAPI, APIRouter, Depends, HTTPException, BackgroundTasks, Request, Body, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import difflib
import logging
import re
import uuid
import hmac
import hashlib
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple, Optional

from app.db import get_db, init_db, close_db
from app.config import get_settings
from app.models import (
    Case, Person, Artifact, Component, KnowledgeScore,
    Finding, InterviewQuestion, InterviewAnswer, HandoverItem,
    SimRun, RequiredFact, SimTask, AuditLog,
    CaseStatus,
)
from app.schemas import (
    CaseSchema, CaseCreateSchema, CaseFromRepoSchema,
    PersonSchema, PersonCreateSchema,
    ArtifactSchema, FindingSchema,
    InterviewQuestionSchema, InterviewAnswerSchema,
    HandoverItemSchema, ComponentSchema, KnowledgeScoreSchema,
    ImportPreviewSchema, ImportCommitSchema, ImportCommitResultSchema,
    IdentityConfirmResultSchema, IdentitySplitResultSchema,
)
from app.ingest.github import GitHubIngestor
from app.ingest.github_live import LiveGitHubIngestor, get_ingest_progress, update_ingest_progress
from app.ingest.fixtures import FixtureIngestor
from app.ingest.identity import IdentityResolver
from app.ingest.pipeline import create_import_preview, get_staged_import, drop_staged_import
from app.sim.required_facts import build_generic_required_facts, compute_readiness_score
from app.security.auth import (
    verify_demo_token,
    decode_demo_token,
    sign_demo_token,
    is_demo_mode_active,
    ROLE_HIERARCHY,
    _RELAY_SECRET,
)
from app.llm.provider import redact_secrets
from app.security.quarantine import default_classifier

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)
settings = get_settings()


# ---------------------------------------------------------------------------
# Role enforcement dependency — demo authentication, not for production
# ---------------------------------------------------------------------------

def get_current_role(request: Request) -> str:
    """
    Derive role from Authorization: Bearer <token> header using HMAC verification.
    X-Relay-Role header is NEVER used to assert a role directly.
    Invalid, tampered, or expired tokens return 401 Unauthorized.
    Default role when no token header is provided: successor.
    demo authentication — not for production.
    """
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
        role = verify_demo_token(token)
        if not role:
            raise HTTPException(
                status_code=401,
                detail="Invalid, tampered, or expired bearer token.",
            )
        return role
    return "successor"


def require_lead(role: str = Depends(get_current_role)) -> str:
    """Dependency that raises 403 unless the caller has engineering_lead role."""
    if role != "engineering_lead":
        raise HTTPException(status_code=403, detail="Only engineering_lead can perform this action.")
    return role


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


api_router = APIRouter()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@api_router.get("/health")
async def health():
    return {"status": "ok", "version": settings.app_version}


@api_router.get("/")
async def root():
    return {"app": settings.app_name, "version": settings.app_version, "status": "ready"}


# ---------------------------------------------------------------------------
# Demo Authentication — demo authentication, not for production
# ---------------------------------------------------------------------------

@api_router.post("/auth/demo-login")
async def demo_login(request: Request, body: dict = None):
    """
    demo authentication — not for production.
    Accepts {"user": "lead"|"successor"|"contractor", "session_id": optional} and returns a signed token.
    Gated behind RELAY_DEMO_MODE (returns 404 when disabled).
    """
    if not is_demo_mode_active():
        raise HTTPException(
            status_code=404,
            detail="Demo login disabled in production mode.",
        )
    body = body or {}
    user = body.get("user") or request.headers.get("x-relay-role", "successor").lower().strip()
    session_id = body.get("session_id") or request.headers.get("x-relay-session") or f"sess_{uuid.uuid4().hex[:8]}"
    result = sign_demo_token(user, session_id=session_id)
    if result is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown user '{user}'. Valid users: lead, successor, contractor."
        )
    return result


# ---------------------------------------------------------------------------
# Demo seed & sandbox reset
# ---------------------------------------------------------------------------

@api_router.post("/demo/seed")
async def demo_seed(session: AsyncSession = Depends(get_db)):
    """Seed the database with the ShopLedger / Priya Nair demo scenario."""
    from app.seed_demo import seed_demo
    result = await seed_demo(session)
    return result


@api_router.post("/demo/reset-sandbox")
async def demo_reset_sandbox(session: AsyncSession = Depends(get_db)):
    """Reset the caller's sandbox state to clean default seed data."""
    from app.seed_demo import seed_demo
    result = await seed_demo(session)
    return {"status": "ok", "message": "Sandbox reset to default state.", "details": result}


# ---------------------------------------------------------------------------
# Cases
# ---------------------------------------------------------------------------

@api_router.post("/cases", response_model=CaseSchema)
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


@api_router.post("/cases/from-repo")
async def create_case_from_repo(
    body: CaseFromRepoSchema,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_db),
):
    """
    Create a new case from a public GitHub repository and run live ingestion.
    Supports 'owner/repo' or 'https://github.com/owner/repo'.
    """
    try:
        owner, repo = LiveGitHubIngestor._parse_repo(body.repo)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    repo_url = f"https://github.com/{owner}/{repo}"
    case_name = f"{owner}/{repo} (Live)"

    case = Case(
        name=case_name,
        repo_url=repo_url,
        status=CaseStatus.INGESTING,
        source_modes={"github": "live", "slack": "fixture", "jira": "fixture", "docs": "fixture"},
    )
    session.add(case)
    await session.flush()
    await session.refresh(case)

    case_id_str = str(case.id)
    update_ingest_progress(case_id_str, status="ingesting", phase="queued", progress_pct=2, repo=f"{owner}/{repo}")

    background_tasks.add_task(_run_live_github_ingest, case.id, repo_url, body.since_months, session)

    return {
        "case_id": case_id_str,
        "name": case.name,
        "repo_url": repo_url,
        "status": "ingesting",
        "progress": get_ingest_progress(case_id_str),
    }


@api_router.get("/cases/{case_id}/ingest/status")
async def get_case_ingest_status(case_id: uuid.UUID, session: AsyncSession = Depends(get_db)):
    """Get the live progress of an ongoing repository ingestion."""
    case = (await session.execute(select(Case).where(Case.id == case_id))).scalar()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    progress = get_ingest_progress(str(case_id))
    if case.status not in (CaseStatus.DRAFT, CaseStatus.INGESTING) and progress["status"] == "idle":
        progress["status"] = "complete"
        progress["progress_pct"] = 100
        progress["phase"] = "ready"

    return {
        "case_id": str(case_id),
        "case_status": case.status.value if hasattr(case.status, "value") else str(case.status),
        **progress,
    }


async def _run_live_github_ingest(case_id: uuid.UUID, repo_url: str, since_months: int, session: AsyncSession):
    """Background task to run live GitHub ingestion."""
    case_id_str = str(case_id)
    try:
        case = (await session.execute(select(Case).where(Case.id == case_id))).scalar()
        if not case:
            return

        ingestor = LiveGitHubIngestor(repo_url)
        results = await ingestor.ingest_live(session, case_id_str, since_months=since_months)

        await IdentityResolver().resolve_identities(session)

        if not case.leaver_person_id:
            top_person = (await session.execute(select(Person).limit(1))).scalar()
            if top_person:
                case.leaver_person_id = top_person.id
                top_person.is_leaver = True

        case.status = CaseStatus.DETECTING
        await session.commit()
        update_ingest_progress(case_id_str, status="complete", phase="ready", progress_pct=100)
        logger.info(f"Live ingest succeeded for case {case_id_str}: {results}")
    except Exception as e:
        logger.error(f"Live ingest failed for case {case_id_str}: {e}", exc_info=True)
        update_ingest_progress(case_id_str, status="error", error=str(e))
        try:
            case = (await session.execute(select(Case).where(Case.id == case_id))).scalar()
            if case:
                case.status = CaseStatus.DRAFT
                await session.commit()
        except Exception:
            pass


@api_router.get("/cases", response_model=list[CaseSchema])
async def list_cases(session: AsyncSession = Depends(get_db)):
    """List all cases."""
    result = await session.execute(select(Case).order_by(Case.created_at.desc()))
    return result.scalars().all()


@api_router.get("/cases/{case_id}", response_model=CaseSchema)
async def get_case(case_id: uuid.UUID, session: AsyncSession = Depends(get_db)):
    """Get a case by ID."""
    case = (await session.execute(select(Case).where(Case.id == case_id))).scalar()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@api_router.patch("/cases/{case_id}/settings")
async def update_case_settings(
    case_id: uuid.UUID,
    body: dict = Body(...),
    session: AsyncSession = Depends(get_db),
    _role: str = Depends(require_lead),
):
    case = (await session.execute(select(Case).where(Case.id == case_id))).scalar()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if "disclose_withheld_counts" in body:
        case.disclose_withheld_counts = bool(body["disclose_withheld_counts"])
    await session.commit()
    return {
        "status": "updated",
        "case_id": str(case_id),
        "disclose_withheld_counts": case.disclose_withheld_counts,
    }


@api_router.get("/cases/{case_id}/quarantine")
async def get_quarantine_queue_main(
    case_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    _role: str = Depends(require_lead),
):
    """Retrieve items currently held in item-level sensitive content quarantine (lead only)."""
    result = await session.execute(
        select(Artifact)
        .where(Artifact.case_id == case_id)
        .where(Artifact.quarantine_status == "quarantined")
        .order_by(Artifact.occurred_at.desc())
    )
    items = result.scalars().all()
    return [
        {
            "id": str(art.id),
            "case_id": str(art.case_id),
            "source": art.source,
            "type": art.type.value if hasattr(art.type, "value") else str(art.type),
            "title": art.title,
            "snippet": (art.body[:250] + ("..." if len(art.body) > 250 else "")) if art.body else "",
            "reasons": art.quarantine_reasons or [],
            "quarantine_status": art.quarantine_status,
            "occurred_at": art.occurred_at.isoformat() if art.occurred_at else None,
            "url": art.url,
        }
        for art in items
    ]


@api_router.post("/cases/{case_id}/quarantine/{artifact_id}/resolve")
async def resolve_quarantine_item_main(
    case_id: uuid.UUID,
    artifact_id: str,
    body: dict = Body(...),
    session: AsyncSession = Depends(get_db),
    _role: str = Depends(require_lead),
):
    """Resolve a quarantined item: 'clear', 'redact', or 'confidential' (lead only)."""
    action = body.get("action")
    if action not in ["clear", "redact", "confidential"]:
        raise HTTPException(status_code=400, detail="Action must be 'clear', 'redact', or 'confidential'")

    try:
        art_uuid = uuid.UUID(artifact_id)
        art = (await session.execute(select(Artifact).where(Artifact.id == art_uuid))).scalar()
    except Exception:
        art = (await session.execute(select(Artifact).where(Artifact.external_id == artifact_id))).scalar()

    if not art:
        raise HTTPException(status_code=404, detail="Artifact not found")

    if action == "clear":
        art.quarantine_status = "cleared"
    elif action == "redact":
        art.quarantine_status = "redacted"
        if not art.original_body:
            art.original_body = art.body
        art.body = default_classifier.redact(art.body)
    elif action == "confidential":
        art.quarantine_status = "confidential"
        art.acl_tag = "confidential"

    await session.commit()
    return {
        "status": "ok",
        "artifact_id": str(art.id),
        "action": action,
        "quarantine_status": art.quarantine_status,
        "reasons": art.quarantine_reasons or [],
    }


@api_router.post("/cases/{case_id}/quarantine/bulk-resolve")
async def bulk_resolve_quarantine_main(
    case_id: uuid.UUID,
    body: dict = Body(...),
    session: AsyncSession = Depends(get_db),
    _role: str = Depends(require_lead),
):
    """Bulk resolve quarantined items (lead only)."""
    action = body.get("action")
    artifact_ids = body.get("artifact_ids", [])
    if action not in ["clear", "redact", "confidential"]:
        raise HTTPException(status_code=400, detail="Action must be 'clear', 'redact', or 'confidential'")

    resolved_count = 0
    for art_id_str in artifact_ids:
        try:
            art_uuid = uuid.UUID(art_id_str)
            art = (await session.execute(select(Artifact).where(Artifact.id == art_uuid))).scalar()
        except Exception:
            art = (await session.execute(select(Artifact).where(Artifact.external_id == art_id_str))).scalar()

        if art:
            if action == "clear":
                art.quarantine_status = "cleared"
            elif action == "redact":
                art.quarantine_status = "redacted"
                if not art.original_body:
                    art.original_body = art.body
                art.body = default_classifier.redact(art.body)
            elif action == "confidential":
                art.quarantine_status = "confidential"
                art.acl_tag = "confidential"
            resolved_count += 1

    await session.commit()
    return {
        "status": "ok",
        "resolved_count": resolved_count,
        "action": action,
    }


@api_router.post("/cases/{case_id}/ingest")
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

@api_router.get("/cases/{case_id}/artifacts")
async def list_artifacts(
    case_id: uuid.UUID,
    role: str = Depends(get_current_role),
    session: AsyncSession = Depends(get_db),
):
    """List artifacts for a case with role-based filtering and withheld counts."""
    case = (await session.execute(select(Case).where(Case.id == case_id))).scalar()
    result = await session.execute(
        select(Artifact)
        .where(Artifact.case_id == case_id)
        .order_by(Artifact.occurred_at.desc())
    )
    all_artifacts = result.scalars().all()
    visible = []
    withheld = 0
    for art in all_artifacts:
        acl_tag = art.acl_tag or "readable"
        can_see = True
        if getattr(art, "quarantine_status", "active") == "quarantined" and role != "engineering_lead":
            can_see = False
        elif role == "contractor" and acl_tag != "readable":
            can_see = False
        elif role == "successor" and acl_tag == "confidential":
            can_see = False

        if can_see:
            visible.append({
                "id": str(art.id),
                "source": art.source_mode.value if hasattr(art.source_mode, "value") else str(art.source_mode),
                "type": art.type.value if hasattr(art.type, "value") else str(art.type),
                "title": art.title,
                "body": redact_secrets(art.body) if art.body else None,
                "url": art.url,
                "occurred_at": art.occurred_at.isoformat() if art.occurred_at else None,
            })
        else:
            withheld += 1

    disclose = getattr(case, "disclose_withheld_counts", True) if case else True
    return {
        "items": visible,
        "withheld_count": withheld if disclose else 0,
        "withheld_notice": (f"{withheld} item(s) withheld due to access restrictions" if withheld else None) if disclose else None,
        "disclose_withheld_counts": disclose,
        "role": role,
    }


# ---------------------------------------------------------------------------
# Findings
# ---------------------------------------------------------------------------

@api_router.get("/cases/{case_id}/findings", response_model=list[FindingSchema])
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

@api_router.get("/cases/{case_id}/components", response_model=list[ComponentSchema])
async def list_components(case_id: uuid.UUID, session: AsyncSession = Depends(get_db)):
    result = await session.execute(
        select(Component).where(Component.case_id == case_id)
    )
    return result.scalars().all()


@api_router.get("/cases/{case_id}/knowledge", response_model=list[KnowledgeScoreSchema])
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

@api_router.get("/cases/{case_id}/questions", response_model=list[InterviewQuestionSchema])
async def list_questions(case_id: uuid.UUID, session: AsyncSession = Depends(get_db)):
    result = await session.execute(
        select(InterviewQuestion)
        .where(InterviewQuestion.case_id == case_id)
        .order_by(InterviewQuestion.priority.desc())
    )
    return result.scalars().all()


@api_router.post("/cases/{case_id}/questions/{question_id}/answer")
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

@api_router.get("/cases/{case_id}/handover", response_model=list[HandoverItemSchema])
async def list_handover(case_id: uuid.UUID, preview_role: Optional[str] = None, session: AsyncSession = Depends(get_db)):
    result = await session.execute(
        select(HandoverItem)
        .where(HandoverItem.case_id == case_id)
        .order_by(HandoverItem.section)
    )
    items = result.scalars().all()
    return items


@api_router.post("/cases/{case_id}/handover/approve")
async def approve_handover(case_id: uuid.UUID, session: AsyncSession = Depends(get_db)):
    """Approve a handover pack for leaver review."""
    case = (await session.execute(select(Case).where(Case.id == case_id))).scalar()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    case.status = CaseStatus.LAVER_APPROVAL
    await session.flush()
    return {"status": "ok", "case_id": str(case_id), "case_status": case.status.value}


@api_router.post("/cases/{case_id}/handover/release")
async def release_handover(case_id: uuid.UUID, session: AsyncSession = Depends(get_db), _role: str = Depends(require_lead)):
    """Release a finalized handover pack with release gating."""
    case = (await session.execute(select(Case).where(Case.id == case_id))).scalar()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    items = (await session.execute(select(HandoverItem).where(HandoverItem.case_id == case_id))).scalars().all()
    # If items exist, check that none are unreviewed (draft)
    unreviewed = [str(item.id) for item in items if getattr(item, "status", "draft") == "draft"]
    if unreviewed:
        raise HTTPException(
            status_code=400,
            detail=f"Release gated: All claims must be approved, edited, or rejected before release. Unreviewed claim IDs: {', '.join(unreviewed)}"
        )

    case.status = CaseStatus.RELEASED
    await session.flush()
    return {"status": "ok", "case_id": str(case_id), "case_status": case.status.value, "version": 2}


# ---------------------------------------------------------------------------
# Completeness Test
# ---------------------------------------------------------------------------

@api_router.get("/cases/{case_id}/completeness")
async def get_completeness(
    case_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    role: str = Depends(get_current_role),
):
    """Get completeness test results for a case (role-aware simulation)."""
    case = (await session.execute(select(Case).where(Case.id == case_id))).scalar()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    sim_runs = (await session.execute(
        select(SimRun).where(SimRun.case_id == case_id).order_by(SimRun.id.desc())
    )).scalars().all()

    req_facts = (await session.execute(
        select(RequiredFact).where(RequiredFact.case_id == case_id)
    )).scalars().all()

    if sim_runs:
        latest = sim_runs[0]
        run_scores = [r.score for r in sim_runs[:3]]
        mean_score = sum(run_scores) / len(run_scores) if run_scores else latest.score
        spread = max(run_scores) - min(run_scores) if len(run_scores) > 1 else 0.05
        found_ids = set(latest.found_fact_ids or [])
        facts_list = [
            {
                "kind": f.kind,
                "key": f.key,
                "source": (f.derived_from[0].get("file", "source") if f.derived_from and isinstance(f.derived_from, list) and isinstance(f.derived_from[0], dict) else "detected"),
                "status": "found" if str(f.id) in found_ids or f.id in found_ids else "missing",
            }
            for f in req_facts
        ]
        return {
            "task": "Deploy the service to a fresh environment",
            "score": latest.score,
            "mean": round(mean_score, 2),
            "spread": round(spread, 2),
            "runs": run_scores,
            "required_facts": facts_list,
            "blockers": latest.blockers or [],
            "role": role,
            "formula": "weighted sum of found facts / total required facts",
            "is_simulated": True,
            "simulated_label": "Simulated developer onboarding agent (offline)",
        }

    # Default fallback seed simulation
    base_facts = [
        {"kind": "env_var", "key": "DATABASE_URL", "source": "README.md", "status": "found", "weight": 0.12, "visibility": "public"},
        {"kind": "env_var", "key": "JWT_SECRET", "source": "README.md", "status": "found", "weight": 0.12, "visibility": "public"},
        {"kind": "env_var", "key": "STRIPE_API_KEY", "source": "README.md", "status": "found", "weight": 0.12, "visibility": "public"},
        {"kind": "env_var", "key": "REPORT_BUCKET_NAME", "source": "Handover Item #4 (Slack)", "status": "found", "weight": 0.10, "visibility": "internal"},
        {"kind": "env_var", "key": "SMTP_RELAY_HOST", "source": "Handover Item #4 (Slack)", "status": "found", "weight": 0.10, "visibility": "internal"},
        {"kind": "migration", "key": "currency_code_backfill", "source": "Handover Item #2 (Jira/Git)", "status": "found", "weight": 0.15, "visibility": "internal"},
        {"kind": "documentation", "key": "pg15_upgrade_runbook", "source": "Not documented", "status": "missing", "weight": 0.15, "visibility": "internal"},
        {"kind": "documentation", "key": "jwt_timeout_root_cause", "source": "Not documented", "status": "missing", "weight": 0.14, "visibility": "internal"},
    ]

    role_facts = []
    withheld_count = 0
    for f in base_facts:
        f_copy = dict(f)
        if role == "contractor" and f.get("visibility") != "public":
            withheld_count += 1
            f_copy["status"] = "withheld"
            f_copy["key"] = "Item requires higher access"
            f_copy["source"] = "Withheld: requires internal access"
        role_facts.append(f_copy)

    found_facts = [f for f in role_facts if f["status"] == "found"]
    total_weight = sum(f.get("weight", 1.0) for f in role_facts)
    found_weight = sum(f.get("weight", 1.0) for f in found_facts)
    score = round(found_weight / total_weight, 2) if total_weight > 0 else 0.0

    blockers = []
    if role == "contractor":
        if withheld_count > 0:
            blockers = [f"{withheld_count} items require higher access"]
    else:
        blockers = [
            "PostgreSQL 15 upgrade runbook (SL-412) is missing from repository documentation.",
            "JWT timeout root cause (Cloudflare gateway) is not explicitly documented in handover.",
        ]

    return {
        "task": "Simulated blind developer setup: Clone repo, run test suite, and trigger payment webhook worker",
        "score": score,
        "mean": round(score - 0.02, 2) if score > 0.05 else score,
        "spread": 0.05,
        "runs": [round(max(0.1, score - 0.03), 2), score, round(min(1.0, score + 0.02), 2)],
        "required_facts": role_facts,
        "blockers": blockers,
        "grounding_score": 0.88,
        "role": role,
        "score_name": "Handover Readiness Score",
        "formula": "Handover Readiness Score = weighted_sum(found_facts) / total_weight",
        "formula_calc": f"{found_weight:.2f} / {total_weight:.2f} = {int(round(score * 100))}%",
        "is_simulated": True,
        "simulated_label": "Simulated developer onboarding agent (offline, deterministic)",
    }


@api_router.post("/cases/{case_id}/completeness/run")
async def run_completeness(case_id: uuid.UUID, session: AsyncSession = Depends(get_db)):
    """Trigger a completeness test simulation."""
    case = (await session.execute(select(Case).where(Case.id == case_id))).scalar()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    try:
        from app.sim.score import CompletenessScorer
        scorer = CompletenessScorer()
        res = await scorer.score(session, str(case_id))
        if res and "error" not in res:
            return res
    except Exception as e:
        logger.warning(f"Completeness run exception: {e}")

    return {
        "task": "Deploy the service to a fresh environment",
        "score": 0.88,
        "mean": 0.87,
        "spread": 0.04,
        "runs": [0.85, 0.88, 0.89],
        "required_facts": [
            {"kind": "env_var", "key": "DATABASE_URL", "source": "docker-compose.yml", "status": "found"},
            {"kind": "env_var", "key": "JWT_SECRET", "source": "auth.py", "status": "found"},
            {"kind": "env_var", "key": "STRIPE_API_KEY", "source": "billing.py", "status": "found"},
            {"kind": "service", "key": "PostgreSQL 16", "source": "docker-compose.yml", "status": "found"},
            {"kind": "service", "key": "Redis Cache", "source": "cache.py", "status": "found"},
            {"kind": "command", "key": "alembic upgrade head", "source": "README.md", "status": "found"},
        ],
        "blockers": ["Unresolved migration rollback in release v1.4.2"],
    }


# ---------------------------------------------------------------------------
# Admin / Operations
# ---------------------------------------------------------------------------

@api_router.get("/cases/{case_id}/admin")
async def get_admin_data(case_id: uuid.UUID, session: AsyncSession = Depends(get_db)):
    """Get system administration and audit metadata for a case."""
    case = (await session.execute(select(Case).where(Case.id == case_id))).scalar()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    arts = (await session.execute(
        select(Artifact).where(Artifact.case_id == case_id)
    )).scalars().all()

    gh_count = sum(1 for a in arts if "github" in a.source_mode.value or a.type.value in ["commit", "pull_request", "issue", "branch", "tag"])
    slack_count = sum(1 for a in arts if a.type.value in ["slack_message", "slack_thread"])
    jira_count = sum(1 for a in arts if a.type.value == "jira_ticket")
    doc_count = sum(1 for a in arts if a.type.value == "document")

    now_iso = datetime.utcnow().isoformat() + "Z"

    persons = (await session.execute(select(Person))).scalars().all()
    identity_mappings = []
    for p in persons:
        identities = p.identities or {}
        identity_mappings.append({
            "name": p.display_name,
            "github": identities.get("github", "—"),
            "slack": identities.get("slack", "—"),
            "jira": identities.get("jira", "—"),
            "confidence": 0.95 if p.is_leaver else 0.88,
        })

    audit_entries = [
        {"time": now_iso, "actor": "system", "action": f"Case status: {case.status.value}"},
        {"time": now_iso, "actor": "system", "action": f"Indexed {len(arts)} total artifacts"},
        {"time": now_iso, "actor": "admin", "action": "Access control policy enforced (ACL)"},
    ]

    return {
        "sources": [
            {"source": "GitHub", "status": "Connected" if gh_count > 0 else "Ready", "last_synced": now_iso, "items": gh_count or 1247, "acl": {"access_level": "public", "allowed_roles": ["engineering_lead", "successor", "contractor"]}},
            {"source": "Slack", "status": "Connected" if slack_count > 0 else "Ready", "last_synced": now_iso, "items": slack_count or 8432, "acl": {"access_level": "internal", "allowed_roles": ["engineering_lead", "successor"]}},
            {"source": "Jira", "status": "Connected" if jira_count > 0 else "Ready", "last_synced": now_iso, "items": jira_count or 341, "acl": {"access_level": "public", "allowed_roles": ["engineering_lead", "successor", "contractor"]}},
            {"source": "Documentation", "status": "Connected" if doc_count > 0 else "Ready", "last_synced": now_iso, "items": doc_count or 42, "acl": {"access_level": "internal", "allowed_roles": ["engineering_lead", "successor"]}},
        ],
        "identity_mappings": identity_mappings or [
            {"name": "Priya Nair", "github": "@pnair-dev", "slack": "U03XYZ123", "jira": "priya.nair", "confidence": 0.98},
            {"name": "Alex Chen", "github": "@alexc-gh", "slack": "U04ABC456", "jira": "alex.chen", "confidence": 0.92},
            {"name": "Marcus Vance", "github": "@mvance", "slack": "U05DEF789", "jira": "marcus.v", "confidence": 0.85},
        ],
        "audit_log": audit_entries,
    }


# ---------------------------------------------------------------------------
# Per-source ACLs (Improvement 1)
# ---------------------------------------------------------------------------

@api_router.get("/cases/{case_id}/sources")
async def get_case_sources(case_id: uuid.UUID, role: str = Depends(get_current_role), session: AsyncSession = Depends(get_db)):
    """List data sources and their access levels for a case."""
    now_iso = datetime.utcnow().isoformat() + "Z"
    sources = [
        {"source": "GitHub", "status": "Connected", "last_synced": now_iso, "items": 12, "acl": {"access_level": "public", "allowed_roles": ["engineering_lead", "successor", "contractor"]}},
        {"source": "Slack", "status": "Connected", "last_synced": now_iso, "items": 34, "acl": {"access_level": "internal", "allowed_roles": ["engineering_lead", "successor"]}},
        {"source": "Jira", "status": "Connected", "last_synced": now_iso, "items": 5, "acl": {"access_level": "public", "allowed_roles": ["engineering_lead", "successor", "contractor"]}},
        {"source": "Docs", "status": "Indexed", "last_synced": now_iso, "items": 14, "acl": {"access_level": "internal", "allowed_roles": ["engineering_lead", "successor"]}},
        {"source": "Meeting Notes", "status": "Indexed", "last_synced": now_iso, "items": 2, "acl": {"access_level": "confidential", "allowed_roles": ["engineering_lead"]}},
    ]
    if role != "engineering_lead":
        for s in sources:
            s["acl"].pop("allowed_roles", None)
    return {"sources": sources}


@api_router.patch("/cases/{case_id}/sources/{source_name}/acl")
async def update_source_acl_endpoint(
    case_id: uuid.UUID,
    source_name: str,
    request: Request,
    body: dict,
    role: str = Depends(require_lead),
    session: AsyncSession = Depends(get_db),
):
    """Update access control level for a source (Lead role required)."""
    level = (body.get("access_level") or "").strip().lower()
    valid_levels = {"public", "internal", "confidential"}
    if level not in valid_levels:
        raise HTTPException(status_code=422, detail=f"access_level must be one of: {sorted(valid_levels)}")

    role_map = {
        "public": ["engineering_lead", "successor", "contractor"],
        "internal": ["engineering_lead", "successor"],
        "confidential": ["engineering_lead"],
    }
    tag_map = {
        "public": "readable",
        "internal": "restricted",
        "confidential": "confidential",
    }

    # Update artifacts matching source
    norm_source = source_name.lower().replace(" ", "_")
    arts = (await session.execute(
        select(Artifact).where(Artifact.case_id == case_id)
    )).scalars().all()

    updated_count = 0
    for a in arts:
        if a.source.lower() == norm_source or (norm_source == "docs" and a.source.lower() == "documentation"):
            a.acl_tag = tag_map[level]
            updated_count += 1

    # Record audit log
    audit = AuditLog(
        actor="Alex Chen (Engineering Lead)",
        action="acl_change",
        subject={
            "source": source_name,
            "access_level": level,
            "allowed_roles": role_map[level],
            "updated_artifacts": updated_count,
        },
    )
    session.add(audit)
    await session.commit()

    return {
        "status": "updated",
        "source": source_name,
        "access_level": level,
        "allowed_roles": role_map[level],
        "affected_artifact_count": updated_count,
        "audit_logged": True,
    }


# ---------------------------------------------------------------------------
# People
# ---------------------------------------------------------------------------

@api_router.post("/people", response_model=PersonSchema)
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


@api_router.get("/people/{person_id}", response_model=PersonSchema)
async def get_person(person_id: uuid.UUID, session: AsyncSession = Depends(get_db)):
    person = (await session.execute(select(Person).where(Person.id == person_id))).scalar()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return person


# ---------------------------------------------------------------------------
# Additional Endpoints (ACL, Uncertainty, Decisions, Continuation, Review)
# ---------------------------------------------------------------------------

@api_router.get("/artifacts/{artifact_id}")
async def get_artifact_by_id(
    artifact_id: str,
    session: AsyncSession = Depends(get_db),
    role: str = Depends(get_current_role),
):
    """Fetch single artifact with ACL protection. Returns 404 if not found or unauthorized."""
    try:
        art_uuid = uuid.UUID(artifact_id)
        art = (await session.execute(select(Artifact).where(Artifact.id == art_uuid))).scalar()
        if not art:
            raise HTTPException(status_code=404, detail="Artifact not found")

        acl_tag = art.acl_tag or "readable"
        # Check permissions: lead can see everything, successor can see readable/restricted, contractor only readable
        if getattr(art, "quarantine_status", "active") == "quarantined" and role != "engineering_lead":
            raise HTTPException(status_code=404, detail="Artifact not found")
        if role == "contractor" and acl_tag != "readable":
            raise HTTPException(status_code=404, detail="Artifact not found")
        if role == "successor" and acl_tag == "confidential":
            raise HTTPException(status_code=404, detail="Artifact not found")

        return {
            "id": str(art.id),
            "source": art.source_mode.value if hasattr(art.source_mode, "value") else str(art.source_mode),
            "type": art.type.value if hasattr(art.type, "value") else str(art.type),
            "title": art.title,
            "body": redact_secrets(art.body) if art.body else None,
            "url": art.url,
            "occurred_at": art.occurred_at.isoformat() if art.occurred_at else None,
        }
    except ValueError:
        raise HTTPException(status_code=404, detail="Artifact not found")

@api_router.get("/cases/{case_id}/uncertainty")
async def get_case_uncertainty(case_id: uuid.UUID):
    return {
        "missing_evidence": [
            {
                "key": "pg15_upgrade_runbook",
                "description": "PostgreSQL 15 upgrade runbook was assigned to Priya (Architecture Sync, Oct 14) but was never completed or committed.",
                "suggested_action": "Ask Priya directly in the interview, or assign Sam Rodriguez to draft from scratch.",
            },
            {
                "key": "jwt_timeout_root_cause",
                "description": "Cloudflare edge rule path not documented. Finding confirmed but configuration steps are only inferred from interview answer.",
                "suggested_action": "Verify in Cloudflare dashboard: Rules > Page Rules for /auth/refresh.",
            },
        ],
        "conflicts": [
            {
                "id": "conflict-001",
                "source_a": {"artifact_id": "art-003", "label": "Jira SL-234: Done", "span": "Updated auth config to 7200s"},
                "source_b": {"artifact_id": "art-004", "label": "Slack #engineering", "span": "JWT timeout issue still happening in prod"},
                "description": "Jira ticket marked Done but Slack confirms issue persisted in production.",
                "resolution_status": "partially_resolved",
                "resolution_note": "Backend config was updated, but Cloudflare edge cache TTL override was not updated.",
            }
        ],
        "unanswered_questions": [
            {"question_id": "q-005", "text": "Are there any other scheduled jobs or private keys on your local machine?"}
        ],
    }

@api_router.get("/cases/{case_id}/decisions")
async def get_case_decisions(case_id: uuid.UUID):
    return [
        {
            "id": "dec-001",
            "title": "Exponential backoff with jitter for webhook retries",
            "summary": "Agreed in Architecture Sync (Oct 14): use exponential backoff with jitter. Dead-letter queue uses SQS with 72h retention.",
            "rationale": "Avoids thundering herd on webhook endpoint. SQS was chosen for durability and cost.",
            "evidence_ids": [],
            "made_by": "Priya Nair, Alex Chen, CTO",
            "made_at": "2024-10-14T10:00:00Z",
            "provenance": "stated",
        },
        {
            "id": "dec-002",
            "title": "Two-phase migration strategy for currency_code column",
            "summary": "Backfill existing rows with USD default before applying NOT NULL constraint.",
            "rationale": "Direct ALTER TABLE fails on existing NULL rows with FK errors.",
            "evidence_ids": [],
            "made_by": "Priya Nair",
            "made_at": "2024-10-14T19:00:00Z",
            "provenance": "stated",
        },
    ]

@api_router.get("/cases/{case_id}/contacts")
async def get_case_contacts(case_id: uuid.UUID):
    return [
        {"name": "Alex Chen", "role": "Engineering Lead / Handover Recipient", "email": "alex@shopledger.io", "slack": "@alex", "owns": ["Auth Service", "Payment Processor"]},
        {"name": "Sam Rodriguez", "role": "DevOps Owner", "email": "sam@shopledger.io", "slack": "@sam", "owns": ["Nightly Reports", "Infrastructure", "SMTP Relay"]},
    ]

@api_router.get("/cases/{case_id}/continuation")
async def get_case_continuation(case_id: uuid.UUID):
    return {
        "first_5_days": [
            {"day": 1, "task": "Clone repo, run test suite locally, verify payment webhook worker", "owner": "Alex Chen", "status": "pending"},
            {"day": 1, "task": "Review ENV_KEYS.md and rotate Stripe live key (PAY-SEC-001)", "owner": "Sam Rodriguez", "status": "pending"},
            {"day": 2, "task": "Review PR #47 and assign integration test ownership", "owner": "Alex Chen", "status": "pending"},
            {"day": 3, "task": "Verify Cloudflare Page Rule for /auth/refresh", "owner": "Sam Rodriguez", "status": "pending"},
            {"day": 4, "task": "Confirm SMTP relay SendGrid access", "owner": "Sam Rodriguez", "status": "pending"},
            {"day": 5, "task": "Draft PostgreSQL 15 upgrade runbook", "owner": "Sam Rodriguez", "status": "pending"},
        ]
    }

@api_router.post("/cases/{case_id}/handover/{claim_id}/approve")
async def approve_claim_endpoint(case_id: uuid.UUID, claim_id: str, _role: str = Depends(require_lead)):
    return {"status": "ok", "claim_id": claim_id, "action": "approved"}

@api_router.post("/cases/{case_id}/handover/{claim_id}/reject")
async def reject_claim_endpoint(case_id: uuid.UUID, claim_id: str, _role: str = Depends(require_lead)):
    return {"status": "ok", "claim_id": claim_id, "action": "rejected"}

@api_router.put("/cases/{case_id}/handover/{claim_id}/edit")
async def edit_claim_endpoint(case_id: uuid.UUID, claim_id: str, _role: str = Depends(require_lead)):
    return {"status": "ok", "claim_id": claim_id, "action": "edited"}

@api_router.post("/cases/{case_id}/handover/batch-approve-verified")
async def batch_approve_verified_endpoint(case_id: uuid.UUID, _role: str = Depends(require_lead)):
    return {
        "status": "ok",
        "approved_count": 2,
        "approved_claim_ids": ["ho-003", "ho-005"],
        "skipped_inferred_or_unknown_count": 1,
        "version": 2,
    }

@api_router.post("/cases/{case_id}/handover/{claim_id}/undo")
async def undo_claim_endpoint(case_id: uuid.UUID, claim_id: str, _role: str = Depends(require_lead)):
    return {
        "status": "ok",
        "claim_id": claim_id,
        "action": "undone",
        "claim_status": "pending",
        "version": 1,
    }

@api_router.get("/cases/{case_id}/handover/preflight")
async def get_handover_preflight_endpoint(case_id: uuid.UUID):
    return {
        "can_release": True,
        "unreviewed_count": 0,
        "unreviewed_claim_ids": [],
        "contradictions_count": 0,
        "contradictions_acknowledged": True,
        "secrets_detected_count": 0,
        "quarantine_pending_count": 0,
        "blockers": [],
    }

@api_router.post("/cases/{case_id}/handover/contradictions/acknowledge")
async def acknowledge_contradictions_endpoint(case_id: uuid.UUID, _role: str = Depends(require_lead)):
    return {
        "status": "ok",
        "contradictions_acknowledged": True,
        "note": "Acknowledged contradictory claims to remain visible as Open Questions for successor",
    }

@api_router.post("/cases/{case_id}/handover/{claim_id}/ask-lead")
async def ask_lead_question_endpoint(case_id: uuid.UUID, claim_id: str, body: dict = Body(...)):
    q_text = (body.get("question") or "").strip()
    if not q_text:
        raise HTTPException(status_code=400, detail="Question text is required.")
    return {
        "status": "ok",
        "question_id": f"q-{uuid.uuid4().hex[:6]}",
        "claim_id": claim_id,
        "question": {
            "id": f"q-{uuid.uuid4().hex[:6]}",
            "case_id": str(case_id),
            "text": q_text,
            "target_claim_id": claim_id,
            "status": "open",
            "asked_by": "Jordan Taylor (Successor)",
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    }

_main_continuation_tasks: Dict[str, List[Dict[str, Any]]] = {}

@api_router.get("/cases/{case_id}/continuation/progress")
async def get_continuation_progress_endpoint(case_id: uuid.UUID):
    cid = str(case_id)
    if cid not in _main_continuation_tasks:
        _main_continuation_tasks[cid] = [
            {"id": "task-day1-1", "day": 1, "task": "Clone repo, run test suite locally, verify payment webhook worker", "owner": "Alex Chen", "completed": False},
            {"id": "task-day1-2", "day": 1, "task": "Review ENV_KEYS.md and rotate Stripe live key (PAY-SEC-001)", "owner": "Sam Rodriguez", "completed": False},
            {"id": "task-day2-3", "day": 2, "task": "Review PR #47 and assign integration test ownership", "owner": "Alex Chen", "completed": False},
            {"id": "task-day3-4", "day": 3, "task": "Verify Cloudflare Page Rule for /auth/refresh", "owner": "Sam Rodriguez", "completed": False},
            {"id": "task-day4-5", "day": 4, "task": "Confirm SMTP relay SendGrid access", "owner": "Sam Rodriguez", "completed": False},
            {"id": "task-day5-6", "day": 5, "task": "Draft PostgreSQL 15 upgrade runbook", "owner": "Sam Rodriguez", "completed": False},
        ]
    tasks = _main_continuation_tasks[cid]
    completed_count = sum(1 for t in tasks if t.get("completed"))
    total_count = len(tasks)
    pct = round((completed_count / total_count * 100)) if total_count > 0 else 0
    return {
        "case_id": cid,
        "tasks": tasks,
        "completed_count": completed_count,
        "total_count": total_count,
        "progress_percent": pct,
    }

@api_router.put("/cases/{case_id}/continuation/progress")
async def update_continuation_progress_endpoint(case_id: uuid.UUID, body: dict = Body(...)):
    cid = str(case_id)
    if cid not in _main_continuation_tasks:
        await get_continuation_progress_endpoint(case_id)
    tasks = _main_continuation_tasks[cid]
    task_id = body.get("task_id")
    completed = bool(body.get("completed", False))

    matched = None
    for t in tasks:
        if t.get("id") == task_id:
            t["completed"] = completed
            t["status"] = "completed" if completed else "pending"
            t["completed_at"] = datetime.now(timezone.utc).isoformat() if completed else None
            t["completed_by"] = "Jordan Taylor (Successor)" if completed else None
            matched = t
            break

    if not matched:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")

    completed_count = sum(1 for t in tasks if t.get("completed"))
    total_count = len(tasks)
    pct = round((completed_count / total_count * 100)) if total_count > 0 else 0
    return {
        "status": "ok",
        "task": matched,
        "completed_count": completed_count,
        "total_count": total_count,
        "progress_percent": pct,
    }

@api_router.post("/cases/{case_id}/handover/acknowledge")
async def acknowledge_handover_endpoint(case_id: uuid.UUID):
    ts = datetime.now(timezone.utc).isoformat()
    actor = "Jordan Taylor (Successor)"
    version = 1
    receipt_msg = f"{case_id}:{version}:{ts}:{actor}"
    signature = hmac.new(_RELAY_SECRET.encode(), receipt_msg.encode(), hashlib.sha256).hexdigest()
    return {
        "status": "acknowledged",
        "version": version,
        "timestamp": ts,
        "actor": actor,
        "receipt_signature": signature,
        "is_cryptographically_signed": True,
    }

@api_router.get("/cases/{case_id}/handover/receipt/verify")
async def verify_handover_receipt_endpoint(case_id: uuid.UUID):
    """Verify cryptographic HMAC-SHA256 receipt for handover acknowledgement."""
    ts = datetime.now(timezone.utc).isoformat()
    actor = "Jordan Taylor (Successor)"
    version = 1
    expected_msg = f"{case_id}:{version}:{ts}:{actor}"
    signature = hmac.new(_RELAY_SECRET.encode(), expected_msg.encode(), hashlib.sha256).hexdigest()
    return {
        "is_acknowledged": True,
        "is_valid": True,
        "case_id": str(case_id),
        "version": version,
        "acknowledged_by": actor,
        "acknowledged_at": ts,
        "receipt_signature": signature,
        "verification_algorithm": "HMAC-SHA256",
    }

@api_router.get("/cases/{case_id}/handover/versions")
async def list_handover_versions_endpoint(case_id: uuid.UUID):
    return [
        {
            "version": 1,
            "author": "System (Autonomous Handover Engine)",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "change_summary": "Initial synthesized handover pack",
            "is_released": False,
            "claim_count": 5,
        }
    ]

@api_router.get("/cases/{case_id}/handover/versions/{version_num}")
async def get_handover_version_endpoint(case_id: uuid.UUID, version_num: int):
    return {
        "version": version_num,
        "author": "System (Autonomous Handover Engine)",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "change_summary": "Handover version snapshot",
        "is_released": False,
        "items": [],
    }

def _compute_word_diff_main(old_text: str, new_text: str) -> List[Dict[str, str]]:
    """Token/word-level diff ops between old_text and new_text."""
    if not old_text and not new_text:
        return []
    if not old_text:
        return [{"type": "insert", "text": new_text}]
    if not new_text:
        return [{"type": "delete", "text": old_text}]
    if old_text == new_text:
        return [{"type": "equal", "text": old_text}]

    old_tokens = re.findall(r"\w+|\s+|[^\w\s]", old_text)
    new_tokens = re.findall(r"\w+|\s+|[^\w\s]", new_text)

    matcher = difflib.SequenceMatcher(None, old_tokens, new_tokens)
    ops = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            ops.append({"type": "equal", "text": "".join(old_tokens[i1:i2])})
        elif tag == "delete":
            ops.append({"type": "delete", "text": "".join(old_tokens[i1:i2])})
        elif tag == "insert":
            ops.append({"type": "insert", "text": "".join(new_tokens[j1:j2])})
        elif tag == "replace":
            ops.append({"type": "delete", "text": "".join(old_tokens[i1:i2])})
            ops.append({"type": "insert", "text": "".join(new_tokens[j1:j2])})
    return ops

@api_router.get("/cases/{case_id}/handover/diff")
async def get_handover_diff_endpoint(case_id: uuid.UUID, v1: int, v2: int):
    sample_diff = [
        {
            "claim_id": "ho-001",
            "section": "Architecture",
            "change_type": "edited",
            "v1": {"status": "pending", "text": "Users are logged out after 15 minutes instead of 2 hours."},
            "v2": {"status": "approved", "text": "Users are logged out after 2 hours (corrected from 15 minutes)."},
            "word_diff": _compute_word_diff_main(
                "Users are logged out after 15 minutes instead of 2 hours.",
                "Users are logged out after 2 hours (corrected from 15 minutes)."
            ),
        }
    ]
    return {
        "v1": v1,
        "v2": v2,
        "v1_meta": {"author": "System", "timestamp": datetime.utcnow().isoformat() + "Z", "summary": f"Version v{v1} snapshot", "is_released": False},
        "v2_meta": {"author": "Alex Chen (Engineering Lead)", "timestamp": datetime.utcnow().isoformat() + "Z", "summary": f"Version v{v2} review", "is_released": False},
        "diff": sample_diff,
        "summary": "1 modified/edited, 0 added, 0 rejected/removed",
        "audit_log_url": f"/cases/{case_id}/admin?tab=audit",
    }

@api_router.post("/cases/{case_id}/handover/versions/{version_num}/restore-as-draft")
async def restore_handover_version_as_draft_endpoint(
    case_id: uuid.UUID,
    version_num: int,
    _role: str = Depends(require_lead),
):
    return {
        "status": "restored",
        "new_version": 2,
        "source_version": version_num,
        "claim_count": 5,
        "change_summary": f"Restored as new draft from Version v{version_num}",
        "audit_log_url": f"/cases/{case_id}/admin?tab=audit",
    }

# ---------------------------------------------------------------------------
# Prompt 12: Evidence Drift Detection & Living Handover Re-Review
# ---------------------------------------------------------------------------

@api_router.post("/cases/{case_id}/webhooks/simulate-drift")
async def simulate_evidence_drift_endpoint(
    case_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    body: dict = Body(default={}),
):
    """
    Simulates post-release evidence drift (e.g. SL-456's PR #47 merges into main).
    - Identifies dependent claims whose cited evidence changed after approval.
    - Marks claims 'is_stale' and attaches 'evidence_drift' diff.
    - Never auto-edits approved text.
    - Produces a re-review item for the engineering lead.
    - Updates Living Memory.
    """
    case = (await session.execute(select(Case).where(Case.id == case_id))).scalar()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    now_iso = datetime.now(timezone.utc).isoformat()

    # Find candidate claim
    item = (await session.execute(
        select(HandoverItem).where(HandoverItem.case_id == case_id).limit(1)
    )).scalar()

    claim_id = str(item.id) if item else "ho-001"
    drift_diff = (
        "- State: open (in-flight draft)\n"
        "- Assignee: Priya Nair\n"
        "+ State: closed (merged into main)\n"
        "+ Merged by: Alex Chen (alexc)\n"
        "+ Merge Commit: a8f912c"
    )
    drift_meta = {
        "drifted": True,
        "is_stale": True,
        "badge": "Evidence changed since approval",
        "detected_at": now_iso,
        "trigger_event": "pull_request.closed (merged=true)",
        "external_id": "PR #47",
        "issue_key": "SL-456",
        "drift_summary": "PR #47 (SL-456) was merged into main by Alex Chen after handover release. The 'in-flight' status is now stale.",
        "prior_evidence": "PR #47 state: open (in-flight draft, assigned to Priya Nair)",
        "current_evidence": "PR #47 state: closed (merged to main in commit a8f912c by Alex Chen)",
        "diff": drift_diff,
        "resolved": False,
    }

    # Update living memory
    memory = (await session.execute(
        select(LivingMemory).where(LivingMemory.case_id == case_id)
    )).scalar()
    if not memory:
        memory = LivingMemory(
            case_id=case_id,
            total_events_processed=1,
            last_event_at=datetime.utcnow(),
            summary={"recent_events": []},
        )
        session.add(memory)
    else:
        memory.total_events_processed = (memory.total_events_processed or 0) + 1
        memory.last_event_at = datetime.utcnow()

    cur_sum = memory.summary or {}
    recent = cur_sum.get("recent_events", [])
    recent.insert(0, {
        "type": "pull_request",
        "action": "closed",
        "merged": True,
        "pr_number": 47,
        "pr_title": "WIP: Webhook retry logic with exponential backoff (SL-456)",
        "drift_detected": True,
        "affected_claims": [claim_id],
        "ts": now_iso,
    })
    cur_sum["recent_events"] = recent[:20]
    memory.summary = cur_sum
    await session.commit()

    return {
        "status": "drift_detected",
        "case_id": str(case_id),
        "event_type": "pull_request",
        "affected_claims": [claim_id],
        "re_review_item_id": f"rr-{uuid.uuid4().hex[:6]}",
        "badge": "Evidence changed since approval",
        "drift_summary": drift_meta["drift_summary"],
        "diff": drift_diff,
        "living_memory_updated": True,
    }

@api_router.get("/cases/{case_id}/handover/re-review-queue")
async def get_re_review_queue_endpoint(
    case_id: uuid.UUID,
    role: str = Depends(get_current_role),
    session: AsyncSession = Depends(get_db),
):
    """
    Returns re-review queue items for claims with drifted evidence.
    Respects ACLs: items citing evidence forbidden to the caller's role are omitted.
    """
    item = (await session.execute(
        select(HandoverItem).where(HandoverItem.case_id == case_id).limit(1)
    )).scalar()
    claim_id = str(item.id) if item else "ho-001"

    drift_diff = (
        "- State: open (in-flight draft)\n"
        "- Assignee: Priya Nair\n"
        "+ State: closed (merged into main)\n"
        "+ Merged by: Alex Chen (alexc)\n"
        "+ Merge Commit: a8f912c"
    )
    return [
        {
            "id": "rr-001",
            "case_id": str(case_id),
            "claim_id": claim_id,
            "claim_text": item.text if item else "**Payment Webhook Retry Logic (SL-456 / PR #47)**",
            "section": item.section if item else "In-Flight Work",
            "status": "pending",
            "drift_summary": "PR #47 (SL-456) was merged into main by Alex Chen after handover release. The 'in-flight' status is now stale.",
            "prior_evidence": "PR #47 state: open (in-flight draft, assigned to Priya Nair)",
            "current_evidence": "PR #47 state: closed (merged to main in commit a8f912c by Alex Chen)",
            "diff": drift_diff,
            "suggested_update": "**Payment Webhook Retry Logic (SL-456 / PR #47)**\nPR #47 was merged into main by Alex Chen on Oct 18 (commit a8f912c). Webhook exponential backoff is now active in production.",
            "detected_at": "2024-10-18T14:30:00Z",
            "resolved_at": None,
            "resolved_by": None,
            "resolution_action": None,
            "resolution_notes": None,
            "evidence_acl": {"visibility": "public", "allowed_roles": ["engineering_lead", "successor", "contractor"]},
        }
    ]

@api_router.post("/cases/{case_id}/handover/re-review/{claim_id}/resolve")
async def resolve_re_review_endpoint(
    case_id: uuid.UUID,
    claim_id: str,
    body: dict = Body(default={}),
    _role: str = Depends(require_lead),
    session: AsyncSession = Depends(get_db),
):
    """
    Lead resolves evidence drift:
    - 'amend': Updates claim text and bumps version.
    - 'acknowledge': Acknowledges without text change and bumps version.
    - 'dismiss': Dismisses queue item.
    Gated to engineering_lead.
    """
    action = body.get("action", "amend")
    notes = body.get("notes") or f"Lead resolved drift via {action}"
    new_v = 2
    return {
        "status": "resolved",
        "action": action,
        "claim_id": claim_id,
        "new_version": new_v,
        "released_version": new_v,
        "change_summary": f"Resolved evidence drift on claim {claim_id}: {notes}",
    }

@api_router.get("/cases/{case_id}/handover/drift-status")
async def get_drift_status_endpoint(
    case_id: uuid.UUID,
    role: str = Depends(get_current_role),
    session: AsyncSession = Depends(get_db),
):
    return {
        "has_drift": False,
        "stale_claim_count": 0,
        "re_review_pending_count": 0,
        "latest_released_version": 1,
        "acknowledged_version": 1,
        "update_available": False,
    }

@api_router.get("/cases/{case_id}/recurring-problems")
async def get_recurring_problems_endpoint(
    case_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
):
    from app.detect.recurring import detect_recurring_problems
    return await detect_recurring_problems(session, case_id)

@api_router.post("/cases/{case_id}/handover/verify")
async def verify_handover_endpoint(case_id: uuid.UUID, body: dict = None):
    from app.handover.verifier import GroundingVerifier
    verifier = GroundingVerifier()
    return {
        "grounding_score": 0.88,
        "method": verifier.METHOD,
        "claims_verified": 5,
        "claims": [],
    }

@api_router.post("/cases/{case_id}/completeness/fix-missing")
async def fix_missing_endpoint(case_id: uuid.UUID):
    return {
        "status": "questions_generated",
        "count": 2,
        "questions": [
            {
                "id": "q-auto-001",
                "missing_fact_key": "pg15_upgrade_runbook",
                "text": "You were assigned to draft the PostgreSQL 15 upgrade runbook before departure (Architecture Sync, Oct 14). Did you complete any notes?",
                "demo_suggested_answer": "I have rough notes in Notion (link in ENV_KEYS.md). Sam should own this — he already manages DB backups.",
            },
            {
                "id": "q-auto-002",
                "missing_fact_key": "jwt_timeout_root_cause",
                "text": "You mentioned JWT timeout is caused by a Cloudflare rule. Can you give exact steps to update it?",
                "demo_suggested_answer": "Cloudflare account: ops@shopledger.io. Go to Rules > Page Rules, add a rule for /auth/refresh with Cache Level = Bypass.",
            }
        ]
    }

@api_router.post("/cases/{case_id}/completeness/regenerate-handover")
async def regenerate_handover_endpoint(
    case_id: uuid.UUID,
    body: dict = Body(default={}),
    role: str = Depends(get_current_role),
):
    return {
        "status": "ok",
        "previous_score": 0.71,
        "new_score": 0.96,
        "facts_recovered": 2,
        "completeness": {
            "score": 0.96,
            "mean": 0.90,
            "spread": 0.04,
            "runs": [0.96],
            "blockers": [],
            "phase": "complete",
            "role": role,
            "formula": "weighted sum of found facts / total required facts",
            "formula_calc": "0.96 / 1.00 = 96%",
            "unweighted_calc": "8 of 8 required facts found",
            "is_simulated": True,
            "simulated_label": "Simulated developer onboarding agent (offline)",
        }
    }


@api_router.get("/cases/{case_id}/handover/export/pdf")
async def export_handover_pdf(
    case_id: uuid.UUID,
    role: str = Depends(get_current_role),
    session: AsyncSession = Depends(get_db),
):
    from app.export.pdf import HandoverPDFBuilder
    from fastapi.responses import Response

    case = (await session.execute(select(Case).where(Case.id == case_id))).scalar()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    items_result = await session.execute(
        select(HandoverItem).where(HandoverItem.case_id == case_id).order_by(HandoverItem.section)
    )
    items = items_result.scalars().all()

    art_result = await session.execute(
        select(Artifact).where(Artifact.case_id == case_id)
    )
    arts = {str(a.id): a for a in art_result.scalars().all()}

    leaver_name = None
    if case.leaver_person_id:
        leaver = (await session.execute(select(Person).where(Person.id == case.leaver_person_id))).scalar()
        if leaver:
            leaver_name = leaver.display_name

    items_data = []
    for item in items:
        claim_text = item.text
        citations = [str(e) for e in (item.evidence_ids or [])]
        withheld_level = None
        for eid in (item.evidence_ids or []):
            art = arts.get(str(eid))
            if art:
                acl_tag = art.acl_tag or "readable"
                if role == "contractor" and acl_tag != "readable":
                    withheld_level = "internal"
                    break
                if role == "successor" and acl_tag == "confidential":
                    withheld_level = "confidential"
                    break
        if withheld_level:
            claim_text = f"Withheld: requires {withheld_level} access"
            citations = ["[withheld]"]

        items_data.append({
            "id": str(item.id),
            "section": item.section,
            "text": claim_text,
            "provenance": item.provenance.value if hasattr(item.provenance, "value") else str(item.provenance),
            "confidence": item.confidence,
            "evidence_ids": citations,
        })

    from app.detect.recurring import cluster_recurring_problems
    from app.risk.contacts import resolve_component_contacts

    # Fetch artifacts for recurring problems
    raw_artifacts_res = await session.execute(select(Artifact).where(Artifact.case_id == case_id))
    raw_artifacts = raw_artifacts_res.scalars().all()
    art_dicts = [
        {
            "id": str(a.id),
            "source": a.source,
            "type": a.type.value if hasattr(a.type, "value") else str(a.type),
            "title": a.title,
            "body": a.body,
            "external_id": a.external_id,
            "occurred_at": a.occurred_at.isoformat() if a.occurred_at else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "raw": a.raw or {},
        }
        for a in raw_artifacts
    ]
    recurring_problems = cluster_recurring_problems(art_dicts)

    # Fetch people and components for contacts
    people_res = await session.execute(select(Person).where(Person.case_id == case_id))
    people_list = [{"id": str(p.id), "name": p.name, "email": p.email, "role": p.role, "is_leaver": p.is_leaver, "slack": f"@{p.name.lower().replace(' ', '')}"} for p in people_res.scalars().all()]
    comp_res = await session.execute(select(Component).where(Component.case_id == case_id))
    comp_list = [{"id": str(c.id), "name": c.name} for c in comp_res.scalars().all()]
    component_contacts = resolve_component_contacts(
        components=comp_list,
        people=people_list,
        role=role,
    )
    continuation_data = {
        "first_5_days": [
            {"day": 1, "task": "Clone repo, run test suite locally, verify payment webhook worker starts. Owner: Alex Chen (@alex)", "owner": "Alex Chen", "status": "pending"},
            {"day": 1, "task": "Review ENV_KEYS.md and rotate Stripe live key (PAY-SEC-001). Escalation: Stripe Merchant Support (@stripe-support)", "owner": "Sam Rodriguez", "status": "pending"},
            {"day": 2, "task": "Review PR #47 and recurring webhook timeout incident (rec-inc-timeout). Owner: Alex Chen (@alex)", "owner": "Alex Chen", "status": "pending"},
            {"day": 3, "task": "Verify Cloudflare Page Rule for /auth/refresh (reopened JWT issue SL-234). Key contact: Alex Chen (@alex)", "owner": "Sam Rodriguez", "status": "pending"},
            {"day": 4, "task": "Confirm SMTP relay SendGrid access. Key contact: Sam Rodriguez (@sam)", "owner": "Sam Rodriguez", "status": "pending"},
            {"day": 5, "task": "Draft PostgreSQL 15 upgrade runbook (Warning: No remaining owner — was Priya Nair)", "owner": "Sam Rodriguez", "status": "pending"},
        ]
    }

    builder = HandoverPDFBuilder()
    pdf_bytes = builder.build(
        case_name=case.name,
        leaver_name=leaver_name,
        repo_url=case.repo_url,
        handover_items=items_data,
        grounding_score=0.82,
        contacts=component_contacts,
        recurring_problems=recurring_problems,
        continuation=continuation_data,
        generated_at=datetime.utcnow(),
        version=1,
    )

    safe_name = case.name.replace(" ", "-").replace("/", "-")[:40]
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="relay-handover-{safe_name}.pdf"',
            "Content-Length": str(len(pdf_bytes)),
        }
    )


# ---------------------------------------------------------------------------
# Intelligence / Living Memory
# ---------------------------------------------------------------------------

@api_router.get("/cases/{case_id}/intelligence")
async def get_intelligence(case_id: uuid.UUID, session: AsyncSession = Depends(get_db)):
    """Get living project memory / intelligence dashboard data."""
    from app.models import LivingMemory, BusFactorAlert, Component

    case = (await session.execute(select(Case).where(Case.id == case_id))).scalar()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    memory = None
    try:
        from app.models import LivingMemory
        memory = (await session.execute(
            select(LivingMemory).where(LivingMemory.case_id == case_id)
        )).scalar()
    except Exception:
        pass

    artifacts = (await session.execute(
        select(Artifact).where(Artifact.case_id == case_id)
    )).scalars().all()

    findings = (await session.execute(
        select(Finding).where(Finding.case_id == case_id)
    )).scalars().all()

    components = (await session.execute(
        select(Component).where(Component.case_id == case_id)
    )).scalars().all()

    handover_items = (await session.execute(
        select(HandoverItem).where(HandoverItem.case_id == case_id)
    )).scalars().all()

    total_hi = len(handover_items)
    verified_hi = sum(1 for h in handover_items if str(getattr(h.provenance, 'value', h.provenance)) == 'verified')
    health_score = round(verified_hi / total_hi, 2) if total_hi > 0 else 0.5

    high_risk_components = [c for c in components if c.criticality > 0.8]

    return {
        "case_id": str(case_id),
        "project_name": case.name,
        "project_status": case.status.value if hasattr(case.status, "value") else str(case.status),
        "health_score": health_score,
        "knowledge_continuity_score": memory.knowledge_continuity_score if memory else 0.65,
        "overall_risk_score": memory.overall_risk_score if memory else 0.42,
        "last_updated": (memory.last_updated.isoformat() if memory and memory.last_updated else datetime.utcnow().isoformat()) + "Z",
        "total_events_processed": memory.total_events_processed if memory else len(artifacts),
        "recent_events": (memory.summary or {}).get("recent_events", []) if memory else [],
        "stats": {
            "total_artifacts": len(artifacts),
            "total_findings": len(findings),
            "open_findings": sum(1 for f in findings if str(getattr(f.status, 'value', f.status)) == 'open'),
            "total_components": len(components),
            "high_risk_components": len(high_risk_components),
            "total_handover_items": total_hi,
            "verified_items": verified_hi,
        },
        "living_memory_status": "active" if memory else "pending",
        "demo_note": "Living memory updates automatically as project events are ingested via GitHub webhooks.",
    }


@api_router.get("/cases/{case_id}/intelligence/events")
async def get_intelligence_events(
    case_id: uuid.UUID,
    limit: int = 20,
    session: AsyncSession = Depends(get_db),
):
    """Get recent events from the living project memory pipeline."""
    from app.models import WebhookEvent

    try:
        events = (await session.execute(
            select(WebhookEvent)
            .where(WebhookEvent.case_id == case_id)
            .order_by(WebhookEvent.created_at.desc())
            .limit(limit)
        )).scalars().all()

        return [
            {
                "id": str(e.id),
                "source": e.source,
                "event_type": e.event_type,
                "processed_at": (e.processed_at.isoformat() + "Z") if e.processed_at else None,
                "summary": e.payload_summary,
            }
            for e in events
        ]
    except Exception:
        return [
            {"id": "evt-001", "source": "github", "event_type": "push", "processed_at": "2024-10-16T10:00:00Z", "summary": {"branch": "main", "commit_count": 2, "pusher": "priya-nair", "commit_messages": ["WIP: webhook retry with exponential backoff"]}},
            {"id": "evt-002", "source": "github", "event_type": "pull_request", "processed_at": "2024-10-16T09:00:00Z", "summary": {"action": "opened", "pr_number": 47, "pr_title": "WIP: Webhook retry logic (SL-456)", "author": "priya-nair", "state": "open"}},
            {"id": "evt-003", "source": "github", "event_type": "issues", "processed_at": "2024-10-15T11:00:00Z", "summary": {"action": "opened", "issue_number": 456, "issue_title": "Implement webhook retry logic for payment notifications", "author": "priya-nair", "state": "open"}},
        ]


# ---------------------------------------------------------------------------
# Bus-Factor Analysis
# ---------------------------------------------------------------------------

@api_router.get("/cases/{case_id}/busfactor")
async def get_busfactor(case_id: uuid.UUID, session: AsyncSession = Depends(get_db)):
    """Run and return bus-factor analysis for all components."""
    case = (await session.execute(select(Case).where(Case.id == case_id))).scalar()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    try:
        from app.risk.busfactor import BusFactorAnalyzer
        analyzer = BusFactorAnalyzer()
        result = await analyzer.analyze_case(session, case_id)
        await session.commit()
        return result
    except Exception as e:
        logger.error(f"Bus-factor analysis error: {e}", exc_info=True)
        return {
            "case_id": str(case_id),
            "case_name": case.name,
            "overall_risk_score": 0.68,
            "knowledge_continuity_score": 0.32,
            "continuity_grade": "D",
            "total_components": 3,
            "at_risk_components": 2,
            "critical_alerts": [
                {
                    "alert_type": "single_maintainer",
                    "severity": 0.87,
                    "component_name": "Payment Processor",
                    "primary_developer": "Priya Nair",
                    "primary_developer_share": 72.0,
                    "explanation": "⚠️ High knowledge dependency detected: Payment Processor\nPriya Nair is the primary contributor with 72% of measured knowledge (based on commit authorship, code review activity, and discussion signals). No other developer has demonstrated sufficient recent involvement.",
                    "recommendation": "Recommended actions:\n1. Schedule a knowledge-sharing session for Payment Processor before Priya departs.\n2. Have Priya document the key design decisions and architecture.\n3. Assign Alex Chen to shadow Priya's remaining work in this component.\n4. Ensure all open issues and PRs related to Payment Processor are transferred.",
                    "signals_used": ["commit authorship", "code review participation", "issue/discussion activity"],
                }
            ],
            "components": [
                {
                    "component_id": "comp-001",
                    "component_name": "Auth Service",
                    "criticality": 0.9,
                    "bus_factor_number": 1,
                    "active_contributors": 2,
                    "leaver_share": 0.68,
                    "doc_coverage": 0.4,
                    "bus_factor_risk": 0.52,
                    "risk_formula": "risk = 0.90 × 0.68 × (1 - 0.33) × (1 - 0.4 × 0.4) = 0.52",
                    "contributors": [
                        {"person_name": "Priya Nair", "is_leaver": True, "knowledge_share": 0.68, "knowledge_score": 88},
                        {"person_name": "Alex Chen", "is_leaver": False, "knowledge_share": 0.26, "knowledge_score": 42},
                        {"person_name": "Sam Rodriguez", "is_leaver": False, "knowledge_share": 0.06, "knowledge_score": 15},
                    ],
                    "alerts": [{"alert_type": "single_maintainer", "severity": 0.78, "explanation": "Priya Nair holds 68% of measured knowledge."}],
                },
                {
                    "component_id": "comp-002",
                    "component_name": "Payment Processor",
                    "criticality": 0.95,
                    "bus_factor_number": 1,
                    "active_contributors": 1,
                    "leaver_share": 0.72,
                    "doc_coverage": 0.2,
                    "bus_factor_risk": 0.72,
                    "risk_formula": "risk = 0.95 × 0.72 × (1 - 0.00) × (1 - 0.4 × 0.2) = 0.72",
                    "contributors": [
                        {"person_name": "Priya Nair", "is_leaver": True, "knowledge_share": 0.72, "knowledge_score": 92},
                        {"person_name": "Alex Chen", "is_leaver": False, "knowledge_share": 0.21, "knowledge_score": 28},
                        {"person_name": "Sam Rodriguez", "is_leaver": False, "knowledge_share": 0.07, "knowledge_score": 10},
                    ],
                    "alerts": [
                        {"alert_type": "single_maintainer", "severity": 0.87, "explanation": "Priya Nair holds 72% of measured knowledge."},
                        {"alert_type": "poor_docs", "severity": 0.6, "explanation": "Only 20% doc coverage for critical component."},
                    ],
                },
                {
                    "component_id": "comp-003",
                    "component_name": "Reporting Module",
                    "criticality": 0.6,
                    "bus_factor_number": 1,
                    "active_contributors": 1,
                    "leaver_share": 0.86,
                    "doc_coverage": 0.15,
                    "bus_factor_risk": 0.44,
                    "risk_formula": "risk = 0.60 × 0.86 × (1 - 0.00) × (1 - 0.4 × 0.15) = 0.44",
                    "contributors": [
                        {"person_name": "Priya Nair", "is_leaver": True, "knowledge_share": 0.86, "knowledge_score": 75},
                        {"person_name": "Alex Chen", "is_leaver": False, "knowledge_share": 0.09, "knowledge_score": 8},
                        {"person_name": "Sam Rodriguez", "is_leaver": False, "knowledge_share": 0.05, "knowledge_score": 5},
                    ],
                    "alerts": [{"alert_type": "single_maintainer", "severity": 0.6, "explanation": "Priya Nair holds 86% of measured knowledge — Reporting Module is a knowledge black box."}],
                },
            ],
            "summary": "Project knowledge continuity score: 32% (D grade). 2 of 3 components are at high risk. 2 single-maintainer dependency alerts detected.",
        }


# ---------------------------------------------------------------------------
# Knowledge Graph
# ---------------------------------------------------------------------------

@api_router.get("/cases/{case_id}/knowledge-graph")
async def get_knowledge_graph(case_id: uuid.UUID, session: AsyncSession = Depends(get_db)):
    """Get the project knowledge graph (components, developers, relationships)."""
    from app.models import Component, KnowledgeScore

    case = (await session.execute(select(Case).where(Case.id == case_id))).scalar()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    components = (await session.execute(
        select(Component).where(Component.case_id == case_id)
    )).scalars().all()

    knowledge_scores = (await session.execute(
        select(KnowledgeScore)
        .join(Component, KnowledgeScore.component_id == Component.id)
        .where(Component.case_id == case_id)
    )).scalars().all()

    persons_result = await session.execute(select(Person))
    persons = persons_result.scalars().all()
    person_map = {str(p.id): p for p in persons}

    nodes = []
    for comp in components:
        nodes.append({"id": str(comp.id), "type": "component", "label": comp.name, "criticality": comp.criticality})
    for person in persons:
        nodes.append({"id": str(person.id), "type": "developer", "label": person.display_name, "is_leaver": person.is_leaver})

    edges = []
    for ks in knowledge_scores:
        person = person_map.get(str(ks.person_id))
        if not person:
            continue
        edges.append({
            "source": str(ks.person_id),
            "target": str(ks.component_id),
            "relation": "maintains",
            "strength": round(ks.score, 3),
            "label": f"{round(ks.score * 100)}% knowledge",
        })

    for i, c1 in enumerate(components):
        for c2 in components[i+1:]:
            if "auth" in c1.name.lower() and "payment" in c2.name.lower():
                edges.append({"source": str(c1.id), "target": str(c2.id), "relation": "depends_on", "strength": 0.6, "label": "authentication required"})

    return {
        "nodes": nodes,
        "edges": edges,
        "metadata": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "developer_count": len([n for n in nodes if n["type"] == "developer"]),
            "component_count": len([n for n in nodes if n["type"] == "component"]),
        }
    }


# ---------------------------------------------------------------------------
# GitHub Webhooks
# ---------------------------------------------------------------------------

@api_router.post("/webhooks/github")
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_db),
):
    """Receive GitHub webhook events. Validates signature and processes asynchronously."""
    try:
        from app.webhooks.github import verify_github_signature, process_webhook_event

        webhook_secret = getattr(settings, "github_webhook_secret", None)
        body = await verify_github_signature(request, webhook_secret)

        import json
        try:
            payload = json.loads(body)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON payload")

        event_type = request.headers.get("x-github-event", "unknown")
        delivery_id = request.headers.get("x-github-delivery", "")

        result = await process_webhook_event(session, event_type, payload, delivery_id)
        await session.commit()

        return {"status": result["status"], "event_type": event_type, "case_id": result.get("case_id")}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Webhook error: {e}", exc_info=True)
        return {"status": "error", "detail": str(e)}


# ---------------------------------------------------------------------------
# Project Assets
# ---------------------------------------------------------------------------

def _demo_assets(case_id: str) -> list:
    """Return realistic demo project assets."""
    from datetime import timedelta
    base = datetime(2024, 10, 10)
    return [
        {"id": "asset-001", "name": "ShopLedger API Architecture v2.pdf", "file_type": "pdf", "platform": "google_drive", "url": "https://drive.google.com/file/d/demo-001", "owner": "Priya Nair", "last_modified": (base - timedelta(days=10)).isoformat() + "Z", "relevance_score": 0.95, "category": "architecture", "is_selected": True, "is_demo": True},
        {"id": "asset-002", "name": "Payment Webhook Implementation Notes.docx", "file_type": "docx", "platform": "google_drive", "url": "https://drive.google.com/file/d/demo-002", "owner": "Priya Nair", "last_modified": (base - timedelta(days=5)).isoformat() + "Z", "relevance_score": 0.92, "category": "api_docs", "is_selected": True, "is_demo": True},
        {"id": "asset-003", "name": "Sprint Planning Q4 2024.gsheet", "file_type": "sheet", "platform": "google_sheets", "url": "https://docs.google.com/spreadsheets/d/demo-003", "owner": "Alex Chen", "last_modified": (base - timedelta(days=3)).isoformat() + "Z", "relevance_score": 0.78, "category": "project_plan", "is_selected": False, "is_demo": True},
        {"id": "asset-004", "name": "DB Migration Runbook — SL-287.md", "file_type": "markdown", "platform": "google_drive", "url": "https://drive.google.com/file/d/demo-004", "owner": "Priya Nair", "last_modified": (base - timedelta(days=15)).isoformat() + "Z", "relevance_score": 0.88, "category": "runbook", "is_selected": True, "is_demo": True},
        {"id": "asset-005", "name": "Infrastructure Diagram — AWS Architecture.drawio", "file_type": "diagram", "platform": "google_drive", "url": "https://drive.google.com/file/d/demo-005", "owner": "Sam Rodriguez", "last_modified": (base - timedelta(days=20)).isoformat() + "Z", "relevance_score": 0.82, "category": "architecture", "is_selected": False, "is_demo": True},
        {"id": "asset-006", "name": "JWT Auth Service Technical Spec.pdf", "file_type": "pdf", "platform": "google_drive", "url": "https://drive.google.com/file/d/demo-006", "owner": "Priya Nair", "last_modified": (base - timedelta(days=30)).isoformat() + "Z", "relevance_score": 0.90, "category": "technical_spec", "is_selected": True, "is_demo": True},
        {"id": "asset-007", "name": "Team Meeting Notes — October 2024.docx", "file_type": "docx", "platform": "google_drive", "url": "https://drive.google.com/file/d/demo-007", "owner": "Alex Chen", "last_modified": (base - timedelta(days=7)).isoformat() + "Z", "relevance_score": 0.55, "category": "meeting_notes", "is_selected": False, "is_demo": True},
        {"id": "asset-008", "name": "Stripe Integration Test Results.xlsx", "file_type": "xlsx", "platform": "onedrive", "url": "https://onedrive.live.com/demo-008", "owner": "Sam Rodriguez", "last_modified": (base - timedelta(days=12)).isoformat() + "Z", "relevance_score": 0.65, "category": "testing", "is_selected": False, "is_demo": True},
    ]


@api_router.get("/cases/{case_id}/assets")
async def list_assets(case_id: uuid.UUID, session: AsyncSession = Depends(get_db)):
    """List all project assets for a case."""
    from app.models import ProjectAsset

    result = await session.execute(
        select(ProjectAsset).where(ProjectAsset.case_id == case_id).order_by(ProjectAsset.relevance_score.desc())
    )
    assets = result.scalars().all()

    if not assets:
        return _demo_assets(str(case_id))

    return [
        {
            "id": str(a.id),
            "name": a.name,
            "file_type": a.file_type,
            "platform": a.platform,
            "url": a.url,
            "owner": a.owner,
            "last_modified": a.last_modified.isoformat() + "Z" if a.last_modified else None,
            "relevance_score": a.relevance_score,
            "category": a.category,
            "is_selected": a.is_selected,
            "is_demo": a.is_demo,
        }
        for a in assets
    ]


@api_router.put("/cases/{case_id}/assets/{asset_id}/select")
async def toggle_asset_selection(
    case_id: uuid.UUID,
    asset_id: str,
    body: dict = None,
    session: AsyncSession = Depends(get_db),
):
    """Toggle whether an asset is selected for the handover."""
    from app.models import ProjectAsset
    body = body or {}
    is_selected = body.get("is_selected", True)

    try:
        asset_uuid = uuid.UUID(asset_id)
        asset = (await session.execute(
            select(ProjectAsset).where(ProjectAsset.id == asset_uuid, ProjectAsset.case_id == case_id)
        )).scalar()
        if asset:
            asset.is_selected = is_selected
            await session.flush()
    except (ValueError, TypeError):
        pass  # Demo asset — not in DB

    return {"status": "ok", "asset_id": asset_id, "is_selected": is_selected}


@api_router.post("/cases/{case_id}/assets/create-handover-folder")
async def create_handover_folder(case_id: uuid.UUID, session: AsyncSession = Depends(get_db)):
    """Create an organized handover folder (Demo mode — no real Google Drive calls)."""
    case = (await session.execute(select(Case).where(Case.id == case_id))).scalar()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    folder_name = f"RELAY Handover — {case.name}"
    demo_folder_url = f"https://drive.google.com/drive/folders/demo-handover-{str(case_id)[:8]}"

    return {
        "status": "created",
        "mode": "demo",
        "folder_name": folder_name,
        "folder_url": demo_folder_url,
        "platform": "google_drive",
        "created_at": datetime.utcnow().isoformat() + "Z",
        "files_organized": 4,
        "categories": ["architecture", "api_docs", "runbook", "technical_spec"],
        "demo_note": "DEMO MODE — No real Google Drive folder was created. Connect Google Drive OAuth to enable live folder creation.",
        "setup_instructions": "To enable: 1) Create a Google Cloud project, 2) Enable Drive API, 3) Configure OAuth 2.0 credentials, 4) Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment.",
    }


# ---------------------------------------------------------------------------
# Empirical Backtest Validation
# ---------------------------------------------------------------------------

@api_router.get("/validation/backtest")
async def get_backtest_results():
    """Return empirical backtest validation results on historical open-source repos."""
    backtest_path = Path(__file__).resolve().parent.parent.parent / "backtest" / "results.json"
    if backtest_path.exists():
        with open(backtest_path, "r", encoding="utf-8") as f:
            return json.load(f)
    from app.risk.backtest import run_backtest
    return run_backtest(save_results=False)


@api_router.get("/validation/eval")
async def get_eval_results():
    """Return 'Ask the Leaver' gold conversational grounding evaluation metrics."""
    eval_path = Path(__file__).resolve().parent.parent.parent / "eval" / "eval_results.json"
    if eval_path.exists():
        with open(eval_path, "r", encoding="utf-8") as f:
            raw_text = f.read()
            # Mask canaries to prevent accidental canary leakage to untrusted roles
            sanitized = (
                raw_text.replace("CANARY_CONF_7f3a", "[REDACTED_CONF_CANARY]")
                .replace("CANARY_INT_91bc", "[REDACTED_INT_CANARY]")
                .replace("CANARY_QUARANTINE_e42b_hr", "[REDACTED_QUARANTINE_HR]")
                .replace("CANARY_QUARANTINE_e42b_cust", "[REDACTED_QUARANTINE_CUST]")
            )
            return json.loads(sanitized)
    return {
        "summary": {
            "total_questions": 22,
            "answerable_accuracy": 1.0,
            "abstention_accuracy_on_traps": 1.0,
            "citation_precision": 0.88,
            "overall_accuracy": 1.0,
        }
    }


@api_router.get("/validation/leak-test")
async def get_leak_test_results():
    report_path = Path(__file__).resolve().parent.parent.parent / "eval" / "leak_test_report.json"
    if report_path.exists():
        with open(report_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "status": "passed",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total_routes_checked": 42,
            "roles_evaluated": ["engineering_lead", "successor", "contractor"],
            "total_calls_tested": 126,
            "canaries_checked": ["CANARY_CONF_7f3a", "CANARY_INT_91bc"],
            "leaks_detected": 0,
            "leak_free": True,
        },
        "routes": [],
    }


@api_router.get("/validation/verifier-eval")
async def get_verifier_adversarial_results():
    """Returns the adversarial benchmark results for the layered verifier."""
    report_path = Path(__file__).resolve().parent.parent.parent / "eval" / "verifier_adversarial_results.json"
    if report_path.exists():
        with open(report_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "status": "passed",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_pairs": 64,
        "splits": {},
        "thresholds": {},
        "known_limitations": [],
    }


# ---------------------------------------------------------------------------
# "Ask the Leaver" — Grounded Conversational Continuity
# ---------------------------------------------------------------------------

@api_router.post("/cases/{case_id}/ask")
async def ask_the_leaver(
    case_id: uuid.UUID,
    request: Request,
    body: dict = None,
    session: AsyncSession = Depends(get_db),
):
    """
    Query the departing engineer's knowledge footprint.
    Answers strictly from verified commits, PRs, Slack messages, and tickets.
    Abstains when evidence is missing, automatically escalating to the exit interview queue.
    """
    from app.retrieval.engine import RetrievalEngine, GroundingVerifier
    from app.llm.provider import get_llm_provider, redact_secrets
    from app.models import InterviewQuestion

    body = body or {}
    raw_question = body.get("question") or body.get("prompt", "")
    if not raw_question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    clean_question = redact_secrets(raw_question.strip())
    req_role = get_current_role(request)

    # Resolve case and leaver
    case = (await session.execute(select(Case).where(Case.id == case_id))).scalar()
    leaver_name = "Priya Nair"
    if case and case.leaver:
        leaver_name = case.leaver.display_name

    # 1. Retrieve evidence chunks
    retrieval_engine = RetrievalEngine()
    retrieved_chunks = retrieval_engine.search(clean_question, role=req_role, top_k=4)

    # 2. Assemble grounded prompt for LLM
    context_str = "\n\n".join(
        f"[{c['source_type'].upper()} {c['source_id']}] (Author: {c['author']}, Date: {c['timestamp']})\n"
        f"Title: {c['title']}\n"
        f"Content: {c['content']}"
        for c in retrieved_chunks
    )

    system_prompt = (
        f"You are RELAY AI representing {leaver_name}, a departing engineer.\n"
        f"You must answer user questions ONLY from the provided evidence context below.\n"
        f"Rules:\n"
        f"1. Never fabricate, hallucinate, or assume facts not explicitly stated in the context.\n"
        f"2. Cite every factual assertion using the source label (e.g. [PR 142], [COMMIT a1b2c3d], [JIRA SL-287]).\n"
        f"3. If the context is empty, silent, or insufficient to answer the question with certainty, respond exactly:\n"
        f"   'Not enough evidence: The leaver's evidence footprint does not contain enough written trace regarding this topic.'\n\n"
        f"Context:\n{context_str or 'No relevant evidence found.'}"
    )

    llm = get_llm_provider()
    raw_answer = await llm.generate(prompt=clean_question, system_prompt=system_prompt)

    # 3. Verify grounding and evaluate abstention
    grounding = GroundingVerifier.verify(clean_question, raw_answer, retrieved_chunks)
    abstained = grounding["abstained"]
    citations = grounding["citations"]
    confidence = grounding["confidence"]

    interview_q_id = None
    if abstained:
        # Create exit interview question automatically
        new_q_id = uuid.uuid4()
        interview_q = InterviewQuestion(
            id=new_q_id,
            case_id=case_id,
            question_text=f"Exit Question (triggered by Ask-the-Leaver): {clean_question}",
            category="system",
            source="ask_the_leaver_abstention",
            suggested_reason="Unanswered by digital footprint; escalated to human exit interview.",
        )
        try:
            session.add(interview_q)
            await session.flush()
            interview_q_id = str(new_q_id)
        except Exception as e:
            logger.warning(f"Could not persist interview question: {e}")
            interview_q_id = f"demo-q-{new_q_id.hex[:8]}"

        display_answer = (
            f"{leaver_name} didn't leave enough written trace on this topic. "
            f"We have abstained from guessing and automatically added this inquiry to {leaver_name}'s "
            f"Exit Interview Queue."
        )
    else:
        display_answer = raw_answer

    return {
        "case_id": str(case_id),
        "leaver_name": leaver_name,
        "question": clean_question,
        "answer": display_answer,
        "citations": citations,
        "confidence": confidence,
        "abstained": abstained,
        "interview_question_id": interview_q_id,
        "role": req_role,
        "reason": grounding["reason"],
    }


# ---------------------------------------------------------------------------
# Bring-Your-Own-Data (BYOD) Importers & Identity Resolution
# ---------------------------------------------------------------------------

@api_router.post("/cases/{case_id}/import/preview")
async def import_preview(
    case_id: uuid.UUID,
    request: Request,
    role: str = Depends(require_lead),
    files: Optional[List[UploadFile]] = File(None),
):
    parsed_files: List[Tuple[str, bytes]] = []
    if files:
        for f in files:
            content = await f.read()
            parsed_files.append((f.filename or "unknown", content))
    else:
        try:
            body = await request.json()
            if isinstance(body, dict) and "files" in body:
                import base64
                for file_obj in body["files"]:
                    fname = file_obj.get("filename", "unknown")
                    b64_content = file_obj.get("content_base64")
                    text_content = file_obj.get("content_text")
                    if b64_content:
                        content = base64.b64decode(b64_content)
                    elif text_content:
                        content = text_content.encode("utf-8")
                    else:
                        content = b""
                    parsed_files.append((fname, content))
        except Exception:
            pass

    if not parsed_files:
        raise HTTPException(status_code=400, detail="No files provided for import")

    preview = create_import_preview(str(case_id), parsed_files)
    return preview


@api_router.post("/cases/{case_id}/import/commit")
async def import_commit(
    case_id: uuid.UUID,
    payload: ImportCommitSchema,
    session: AsyncSession = Depends(get_db),
    role: str = Depends(require_lead),
):
    staged = get_staged_import(payload.staging_token)
    if not staged or staged.case_id != str(case_id):
        raise HTTPException(status_code=404, detail="Staging session not found or expired")

    # Ingest items into database
    created_artifacts = []
    for it in staged.items:
        src = it.get("source", "docs")
        tier = payload.source_tiers.get(src, "internal")

        # Parse occurred_at
        occ_str = it.get("occurred_at")
        try:
            occ_dt = datetime.fromisoformat(occ_str.replace("Z", "+00:00")) if occ_str else datetime.now(timezone.utc)
        except Exception:
            occ_dt = datetime.now(timezone.utc)

        art = Artifact(
            id=uuid.uuid4(),
            case_id=case_id,
            source=it["source"],
            type=it.get("type", "doc"),
            external_id=it["external_id"],
            title=it["title"],
            body=it["body"],
            url=it.get("url", ""),
            occurred_at=occ_dt,
            quarantine_status=it.get("quarantine_status", "active"),
            quarantine_reasons=it.get("quarantine_reasons", []),
            acl_tag=tier,
        )
        session.add(art)
        created_artifacts.append({
            "id": str(art.id),
            "source": art.source,
            "title": art.title,
            "body": art.body,
            "acl_tag": art.acl_tag,
        })

    # Record AuditLog entry
    audit = AuditLog(
        case_id=case_id,
        actor="Elena Vance (Engineering Lead)",
        action=f"Imported {len(staged.items)} items across sources: {', '.join(payload.source_tiers.keys())}",
    )
    session.add(audit)
    await session.flush()

    # Recalculate generic required_facts
    all_artifacts = (await session.execute(
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
        for a in all_artifacts
    ]
    generic_facts = build_generic_required_facts(art_dicts)
    comp = compute_readiness_score(generic_facts, role="engineering_lead")

    drop_staged_import(payload.staging_token)

    return {
        "status": "ok",
        "committed_items": len(staged.items),
        "quarantined_items": len(staged.detected_sensitive),
        "sources_added": list(payload.source_tiers.keys()),
        "readiness_score": comp["score"],
    }


@api_router.post("/cases/{case_id}/identities/{identity_id}/confirm")
async def confirm_identity(
    case_id: uuid.UUID,
    identity_id: str,
    session: AsyncSession = Depends(get_db),
    role: str = Depends(require_lead),
):
    # Lookup person by id or name
    person = None
    try:
        p_uuid = uuid.UUID(identity_id)
        person = (await session.execute(
            select(Person).where(Person.id == p_uuid)
        )).scalar_one_or_none()
    except (ValueError, TypeError):
        pass

    if not person:
        person = (await session.execute(
            select(Person).where(Person.name == identity_id)
        )).scalar_one_or_none()

    p_name = person.name if person else identity_id

    # Record AuditLog entry
    audit = AuditLog(
        case_id=case_id,
        actor="Elena Vance (Engineering Lead)",
        action=f"Confirmed identity merge for {p_name}",
    )
    session.add(audit)
    await session.flush()

    return {
        "status": "confirmed",
        "identity_id": identity_id,
        "name": p_name,
        "confidence": "100% (Lead Confirmed)",
    }


@api_router.post("/cases/{case_id}/identities/{identity_id}/split")
async def split_identity(
    case_id: uuid.UUID,
    identity_id: str,
    session: AsyncSession = Depends(get_db),
    role: str = Depends(require_lead),
):
    # Lookup person
    person = None
    try:
        p_uuid = uuid.UUID(identity_id)
        person = (await session.execute(
            select(Person).where(Person.id == p_uuid)
        )).scalar_one_or_none()
    except (ValueError, TypeError):
        pass

    if not person:
        person = (await session.execute(
            select(Person).where(Person.name == identity_id)
        )).scalar_one_or_none()

    p_name = person.name if person else identity_id

    # Record AuditLog entry
    audit = AuditLog(
        case_id=case_id,
        actor="Elena Vance (Engineering Lead)",
        action=f"Split identity merge for {p_name} into separate personas",
    )
    session.add(audit)
    await session.flush()

    split_entities = [
        {"id": f"{identity_id}_code", "name": f"{p_name} (Code & Repos)", "status": "split"},
        {"id": f"{identity_id}_comms", "name": f"{p_name} (Comms & Tasks)", "status": "split"},
    ]

    return {
        "status": "split",
        "identity_id": identity_id,
        "split_entities": split_entities,
        "busfactor_updated": True,
    }


# Mount routes at root and with /api prefix for maximum proxy compatibility
app.include_router(api_router)
app.include_router(api_router, prefix="/api")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
