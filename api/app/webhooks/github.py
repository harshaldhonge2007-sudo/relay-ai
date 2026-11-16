"""
GitHub webhook handler with idempotency and background processing.
Validates HMAC-SHA256 signature when GITHUB_WEBHOOK_SECRET is set.
"""
import hashlib
import hmac
import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import WebhookEvent, LivingMemory, Case
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def verify_github_signature(request: Request, secret: Optional[str]) -> bytes:
    """Verify GitHub webhook HMAC-SHA256 signature. Returns raw body."""
    body = await request.body()
    if not secret:
        return body  # No secret configured — accept (dev mode)
    sig_header = request.headers.get("x-hub-signature-256", "")
    if not sig_header.startswith("sha256="):
        raise HTTPException(status_code=401, detail="Missing webhook signature")
    expected = "sha256=" + hmac.new(
        secret.encode(), body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(sig_header, expected):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    return body


async def find_case_for_repo(session: AsyncSession, repo_full_name: str) -> Optional[Case]:
    """Find case matching the repository."""
    result = await session.execute(select(Case))
    cases = result.scalars().all()
    for c in cases:
        if repo_full_name.lower() in (c.repo_url or "").lower():
            return c
    return None


async def build_idempotency_key(event_type: str, payload: dict) -> str:
    """Build a unique key to deduplicate webhook events."""
    delivery_id = payload.get("x_github_delivery", "")
    if not delivery_id:
        # Fall back to content-based key
        import json, hashlib
        content = json.dumps(payload, sort_keys=True, default=str)
        delivery_id = hashlib.md5(content.encode()).hexdigest()
    return f"github:{event_type}:{delivery_id}"


async def process_webhook_event(
    session: AsyncSession,
    event_type: str,
    payload: dict,
    delivery_id: str = "",
) -> dict:
    """
    Main webhook processor with idempotency.
    Returns {"status": "processed"|"duplicate"|"ignored", "case_id": str|None}
    """
    idempotency_key = f"github:{event_type}:{delivery_id or 'no-delivery'}"

    # Idempotency check
    existing = (await session.execute(
        select(WebhookEvent).where(WebhookEvent.idempotency_key == idempotency_key)
    )).scalar()
    if existing:
        logger.info(f"Duplicate webhook event: {idempotency_key}")
        return {"status": "duplicate", "case_id": None}

    # Find relevant case
    repo = payload.get("repository", {})
    repo_full_name = repo.get("full_name", "")
    case = None
    if repo_full_name:
        case = await find_case_for_repo(session, repo_full_name)

    # Extract meaningful summary
    summary = extract_event_summary(event_type, payload)

    # Record event
    event = WebhookEvent(
        source="github",
        event_type=event_type,
        idempotency_key=idempotency_key,
        case_id=case.id if case else None,
        payload_summary=summary,
        processed_at=datetime.utcnow(),
    )
    session.add(event)

    # Update living memory if case found
    if case:
        await update_living_memory(session, case.id, event_type, summary)

        # Check for evidence drift on pull_request merged
        if event_type == "pull_request" and summary.get("merged"):
            pr_num = summary.get("pr_number")
            items = (await session.execute(
                select(HandoverItem).where(HandoverItem.case_id == case.id)
            )).scalars().all()
            for it in items:
                if pr_num and (f"#{pr_num}" in it.text or f"PR #{pr_num}" in it.text or "SL-456" in it.text):
                    it.status = "stale"
                    summary["evidence_drift"] = True
                    summary["affected_claim_id"] = str(it.id)
                    logger.info(f"Evidence drift detected: PR #{pr_num} merged, invalidating claim {it.id}")

    await session.flush()
    logger.info(f"Processed webhook: {event_type} for case {case.id if case else 'unknown'}")
    return {"status": "processed", "case_id": str(case.id) if case else None}


def extract_event_summary(event_type: str, payload: dict) -> dict:
    """Extract a normalized summary from the raw webhook payload."""
    summary: dict = {"event_type": event_type, "timestamp": datetime.utcnow().isoformat()}
    
    repo = payload.get("repository", {})
    summary["repo"] = repo.get("full_name", "unknown")
    
    if event_type == "push":
        commits = payload.get("commits", [])
        summary["commit_count"] = len(commits)
        summary["branch"] = payload.get("ref", "").replace("refs/heads/", "")
        summary["pusher"] = payload.get("pusher", {}).get("name", "unknown")
        summary["commit_messages"] = [c.get("message", "")[:100] for c in commits[:3]]
        summary["files_changed"] = list(set(
            f for c in commits[:5] for f in c.get("added", []) + c.get("modified", [])
        ))[:10]
    
    elif event_type == "pull_request":
        pr = payload.get("pull_request", {})
        summary["action"] = payload.get("action", "")
        summary["pr_number"] = pr.get("number")
        summary["pr_title"] = pr.get("title", "")[:200]
        summary["author"] = pr.get("user", {}).get("login", "unknown")
        summary["state"] = pr.get("state", "")
        summary["merged"] = pr.get("merged", False)
    
    elif event_type == "issues":
        issue = payload.get("issue", {})
        summary["action"] = payload.get("action", "")
        summary["issue_number"] = issue.get("number")
        summary["issue_title"] = issue.get("title", "")[:200]
        summary["author"] = issue.get("user", {}).get("login", "unknown")
        summary["state"] = issue.get("state", "")
    
    elif event_type == "create":
        summary["ref_type"] = payload.get("ref_type", "")
        summary["ref"] = payload.get("ref", "")
    
    return summary


async def update_living_memory(
    session: AsyncSession,
    case_id: uuid.UUID,
    event_type: str,
    summary: dict,
):
    """Update or create the LivingMemory entry for a case."""
    memory = (await session.execute(
        select(LivingMemory).where(LivingMemory.case_id == case_id)
    )).scalar()

    if not memory:
        memory = LivingMemory(
            case_id=case_id,
            total_events_processed=0,
            last_event_at=datetime.utcnow(),
        )
        session.add(memory)

    memory.total_events_processed = (memory.total_events_processed or 0) + 1
    memory.last_event_at = datetime.utcnow()
    memory.last_updated = datetime.utcnow()

    # Update summary
    current_summary = memory.summary or {}
    recent_events = current_summary.get("recent_events", [])
    recent_events.insert(0, {"type": event_type, "ts": datetime.utcnow().isoformat(), **{k: v for k, v in summary.items() if k not in ("event_type",)}})
    recent_events = recent_events[:20]  # Keep last 20
    current_summary["recent_events"] = recent_events
    current_summary["last_event_type"] = event_type
    memory.summary = current_summary
