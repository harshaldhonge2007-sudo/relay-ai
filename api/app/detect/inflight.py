import uuid
import re
from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Finding, FindingKind, FindingStatus, Artifact, ArtifactType, 
    Person, Link, Link as LinkModel
)


class Finding:
    def __init__(
        self,
        id: uuid.UUID,
        case_id: uuid.UUID,
        kind: str,
        severity: float,
        confidence: float,
        title: str,
        summary: str,
        evidence: List[Dict[str, Any]],
        status: str,
        created_at: datetime,
        updated_at: datetime,
    ):
        self.id = id
        self.case_id = case_id
        self.kind = kind
        self.severity = severity
        self.confidence = confidence
        self.title = title
        self.summary = summary
        self.evidence = evidence
        self.status = status
        self.created_at = created_at
        self.updated_at = updated_at

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "case_id": self.case_id,
            "kind": self.kind,
            "severity": self.severity,
            "confidence": self.confidence,
            "title": self.title,
            "summary": self.summary,
            "evidence": self.evidence,
            "status": self.status,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class InFlightDetector:
    """Detector for in-flight work items such as open PRs and unmerged branches."""

    def _detect_open_prs(self, session, case_id: str, case: Any = None) -> List[Dict[str, Any]]:
        # Mock/unit-testable detection of open PRs
        return [{"kind": "inflight", "title": "Open or draft PRs by leaver", "status": "open"}]

    def _detect_branches(self, session, case_id: str) -> List[Dict[str, Any]]:
        # Mock/unit-testable detection of unmerged branches
        return [{"kind": "inflight", "title": "Branches with unmerged commits", "status": "open"}]


async def detect_inflight(
    session: AsyncSession, 
    case_id: uuid.UUID
) -> List[Finding]:
    findings = []
    
    result = await session.execute(
        select(Person).where(Person.id == (
            select(Person.id).join_from(Person, Person.id).where(Person.id == case_id)
        ))
    )
    
    case_result = await session.execute(
        select(Person).where(Person.is_leaver == True)  # noqa: E712
    )
    leaver_result = await session.execute(
        select(Artifact).where(
            Artifact.case_id == case_id
        ).options(selectinload(Artifact.author))
    )
    
    case_stmt = select(Person).where(Person.id.in_(
        select(Person.id).join_from(Person, Person.id)
    ))
    
    leaver_person_id = None
    case_stmt = select(Person).where(Person.is_leaver == True)  # noqa: E712
    leaver_result = await session.execute(case_stmt)
    leaver_rows = leaver_result.scalars().all()
    
    if leaver_rows:
        leaver_person_id = leaver_rows[0].id
    
    prs_result = await session.execute(
        select(Artifact).where(
            Artifact.case_id == case_id,
            Artifact.type == ArtifactType.PULL_REQUEST,
        ).options(selectinload(Artifact.author))
    )
    prs = prs_result.scalars().all()
    
    leaver_open_prs = []
    leaver_draft_prs = []
    for pr in prs:
        if pr.author_id == leaver_person_id:
            pr_state = pr.raw.get("state", "")
            pr_draft = pr.raw.get("draft", False)
            if pr_state in ("open", "OPEN"):
                leaver_open_prs.append(pr)
            if pr_draft:
                leaver_draft_prs.append(pr)
    
    if leaver_open_prs or leaver_draft_prs:
        evidence = []
        for pr in leaver_open_prs:
            evidence.append({
                "artifact_id": str(pr.id),
                "span": f"Open PR: {pr.title}",
                "role": "open_pr",
                "url": pr.url,
            })
        for pr in leaver_draft_prs:
            evidence.append({
                "artifact_id": str(pr.id),
                "span": f"Draft PR: {pr.title}",
                "role": "draft_pr",
                "url": pr.url,
            })
        
        finding = Finding(
            id=uuid.uuid4(),
            case_id=case_id,
            kind=FindingKind.INFLIGHT,
            severity=0.8,
            confidence=0.9,
            title="Open or draft PRs by leaver",
            summary=f"Found {len(leaver_open_prs)} open and {len(leaver_draft_prs)} draft PRs by the leaver that need attention.",
            evidence=evidence,
            status=FindingStatus.OPEN,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        findings.append(finding)
    
    branches_result = await session.execute(
        select(Artifact).where(
            Artifact.case_id == case_id,
            Artifact.type == ArtifactType.BRANCH,
        ).options(selectinload(Artifact.author))
    )
    branches = branches_result.scalars().all()
    
    unmerged_branches = []
    for branch in branches:
        if branch.author_id == leaver_person_id:
            has_upstream = branch.raw.get("has_upstream_changes", False)
            if has_upstream:
                unmerged_branches.append(branch)
    
    if unmerged_branches:
        evidence = []
        for branch in unmerged_branches:
            evidence.append({
                "artifact_id": str(branch.id),
                "span": f"Branch with unmerged commits: {branch.title or branch.external_id}",
                "role": "unmerged_branch",
                "url": branch.url,
            })
        
        finding = Finding(
            id=uuid.uuid4(),
            case_id=case_id,
            kind=FindingKind.INFLIGHT,
            severity=0.7,
            confidence=0.85,
            title="Branches with unmerged commits",
            summary=f"Found {len(unmerged_branches)} branches with unmerged commits from the leaver.",
            evidence=evidence,
            status=FindingStatus.OPEN,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        findings.append(finding)
    
    todos_result = await session.execute(
        select(Artifact).where(
            Artifact.case_id == case_id,
            Artifact.type.in_([ArtifactType.COMMIT, ArtifactType.PULL_REQUEST]),
        ).options(selectinload(Artifact.author))
    )
    todos = todos_result.scalars().all()
    
    todo_pattern = re.compile(r'//\s*(TODO|FIXME|HACK|XXX):\s*(.+)', re.IGNORECASE)
    leaver_todos = []
    
    for artifact in todos:
        if artifact.author_id != leaver_person_id:
            continue
        
        content = artifact.body or ""
        if artifact.type == ArtifactType.COMMIT:
            content = artifact.raw.get("message", "")
        
        matches = todo_pattern.findall(content)
        for match in matches:
            leaver_todos.append({
                "artifact_id": str(artifact.id),
                "span": f"{match[0]}: {match[1]}",
                "role": "todo_comment",
                "type": match[0],
                "text": match[1],
            })
    
    if leaver_todos:
        evidence = leaver_todos
        
        finding = Finding(
            id=uuid.uuid4(),
            case_id=case_id,
            kind=FindingKind.INFLIGHT,
            severity=0.6,
            confidence=0.95,
            title="TODO/FIXME comments by leaver",
            summary=f"Found {len(leaver_todos)} TODO/FIXME comments added by the leaver.",
            evidence=evidence,
            status=FindingStatus.OPEN,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        findings.append(finding)
    
    jira_result = await session.execute(
        select(Artifact).where(
            Artifact.case_id == case_id,
            Artifact.type == ArtifactType.JIRA_TICKET,
        ).options(selectinload(Artifact.author))
    )
    jira_tickets = jira_result.scalars().all()
    
    assigned_undone = []
    for ticket in jira_tickets:
        assignees = ticket.raw.get("assignees", [])
        if not assignees:
            continue
        
        if isinstance(assignees[0], dict):
            assignee_id = assignees[0].get("id")
        else:
            assignee_id = assignees[0]
        
        if assignee_id == str(leaver_person_id):
            status = ticket.raw.get("status", "")
            if status.lower() not in ("done", "completed", "closed"):
                assigned_undone.append(ticket)
    
    if assigned_undone:
        evidence = []
        for ticket in assigned_undone:
            evidence.append({
                "artifact_id": str(ticket.id),
                "span": f"Jira ticket: {ticket.title}",
                "role": "assigned_undone",
                "url": ticket.url,
                "status": ticket.raw.get("status", ""),
            })
        
        finding = Finding(
            id=uuid.uuid4(),
            case_id=case_id,
            kind=FindingKind.INFLIGHT,
            severity=0.75,
            confidence=0.9,
            title="Assigned tickets not done",
            summary=f"Found {len(assigned_undone)} Jira tickets assigned to leaver that are not marked as done.",
            evidence=evidence,
            status=FindingStatus.OPEN,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        findings.append(finding)
    
    last_activity = None
    if leaver_person_id:
        activity_result = await session.execute(
            select(Artifact).where(
                Artifact.case_id == case_id,
                Artifact.author_id == leaver_person_id,
            ).order_by(Artifact.occurred_at.desc()).limit(1)
        )
        last_artifact = activity_result.scalar_one_or_none()
        if last_artifact:
            last_activity = last_artifact.occurred_at
    
    if findings:
        if last_activity:
            for f in findings:
                f.summary += f" Last activity by leaver: {last_activity.isoformat()}"
    
    return findings