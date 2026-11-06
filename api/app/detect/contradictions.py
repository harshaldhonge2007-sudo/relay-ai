import uuid
from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Finding, FindingKind, FindingStatus, Artifact, ArtifactType, 
)


async def detect_contradictions(
    session: AsyncSession, 
    case_id: uuid.UUID
) -> List[Finding]:
    findings = []
    
    jira_result = await session.execute(
        select(Artifact).where(
            Artifact.case_id == case_id,
            Artifact.type == ArtifactType.JIRA_TICKET,
        ).options(selectinload(Artifact.case))
    )
    jira_tickets = jira_result.scalars().all()
    
    pr_result = await session.execute(
        select(Artifact).where(
            Artifact.case_id == case_id,
            Artifact.type == ArtifactType.PULL_REQUEST,
        )
    )
    prs = pr_result.scalars().all()
    
    slack_result = await session.execute(
        select(Artifact).where(
            Artifact.case_id == case_id,
            Artifact.type == ArtifactType.SLACK_MESSAGE,
        ).order_by(Artifact.occurred_at.desc())
    )
    slack_messages = slack_result.scalars().all()
    
    doc_result = await session.execute(
        select(Artifact).where(
            Artifact.case_id == case_id,
            Artifact.type == ArtifactType.DOCUMENT,
        )
    )
    docs = doc_result.scalars().all()
    
    commit_result = await session.execute(
        select(Artifact).where(
            Artifact.case_id == case_id,
            Artifact.type == ArtifactType.COMMIT,
        ).order_by(Artifact.occurred_at.desc()).limit(50)
    )
    recent_commits = commit_result.scalars().all()
    
    for ticket in jira_tickets:
        status = ticket.raw.get("status", "").lower()
        
        if status in ("done", "completed", "closed", "resolved"):
            ticket_key = ticket.external_id
            linked_pr = None
            for pr in prs:
                pr_body = pr.body or ""
                pr_title = pr.title or ""
                if ticket_key in pr_body or ticket_key in pr_title:
                    linked_pr = pr
                    break
            
            if linked_pr:
                pr_state = linked_pr.raw.get("state", linked_pr.raw.get("status", "")).lower()
                pr_merged = linked_pr.raw.get("merged", False)
                pr_closed = pr_state in ("closed", "closed_without_merge")
                
                if pr_closed and not pr_merged:
                    evidence = [
                        {
                            "artifact_id": str(ticket.id),
                            "span": f"Jira status: {ticket.raw.get('status')}",
                            "role": "jira_done",
                            "url": ticket.url,
                        },
                        {
                            "artifact_id": str(linked_pr.id),
                            "span": f"PR status: {pr_state}, merged: {pr_merged}",
                            "role": "pr_unmerged",
                            "url": linked_pr.url,
                        },
                    ]
                    
                    finding = Finding(
                        id=uuid.uuid4(),
                        case_id=case_id,
                        kind=FindingKind.CONTRADICTION,
                        severity=0.8,
                        confidence=0.9,
                        title="Jira marked done but linked PR unmerged",
                        summary=f"Jira ticket {ticket_key} is marked as done, but linked PR {linked_pr.external_id} was closed without merge.",
                        evidence=evidence,
                        status=FindingStatus.OPEN,
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow(),
                    )
                    findings.append(finding)
    
    for ticket in jira_tickets:
        status = ticket.raw.get("status", "").lower()
        
        if status in ("done", "completed", "closed", "resolved"):
            done_timestamp = ticket.raw.get("resolution_date") or ticket.raw.get("updated_at")
            
            if done_timestamp:
                try:
                    if isinstance(done_timestamp, str):
                        done_time = datetime.fromisoformat(done_timestamp.replace("Z", "+00:00"))
                    else:
                        done_time = done_timestamp
                    
                    problem_keywords = ["broken", "not working", "failed", "error", "issue", "problem", "bug"]
                    
                    for msg in slack_messages:
                        if msg.occurred_at > done_time:
                            content = (msg.body or "").lower()
                            for keyword in problem_keywords:
                                if keyword in content:
                                    ticket_key = ticket.external_id.lower()
                                    if ticket_key in content or ticket.title.lower() in content:
                                        evidence = [
                                            {
                                                "artifact_id": str(ticket.id),
                                                "span": f"Jira done at: {done_time.isoformat()}",
                                                "role": "jira_done_time",
                                                "url": ticket.url,
                                            },
                                            {
                                                "artifact_id": str(msg.id),
                                                "span": f"Problem language after done: {msg.body[:100]}...",
                                                "role": "slack_problem",
                                                "occurred_at": msg.occurred_at.isoformat(),
                                                "url": msg.url,
                                            },
                                        ]
                                        
                                        finding = Finding(
                                            id=uuid.uuid4(),
                                            case_id=case_id,
                                            kind=FindingKind.CONTRADICTION,
                                            severity=0.7,
                                            confidence=0.75,
                                            title="Problem language after ticket marked done",
                                            summary=f"Jira ticket {ticket.external_id} marked done at {done_time}, but problem language found in Slack message at {msg.occurred_at}.",
                                            evidence=evidence,
                                            status=FindingStatus.OPEN,
                                            created_at=datetime.utcnow(),
                                            updated_at=datetime.utcnow(),
                                        )
                                        findings.append(finding)
                                        break
                except (ValueError, TypeError):
                    pass
    
    for ticket in jira_tickets:
        status = ticket.raw.get("status", "").lower()
        
        if status in ("done", "completed", "closed", "resolved"):
            for doc in docs:
                doc_content = (doc.body or "").lower()
                
                testing_incomplete_patterns = [
                    "testing incomplete",
                    "tests not complete",
                    "not fully tested",
                    "testing pending",
                    "needs testing",
                    "missing tests",
                    "test coverage low",
                ]
                
                for pattern in testing_incomplete_patterns:
                    if pattern in doc_content:
                        ticket_key = ticket.external_id.lower()
                        if ticket_key in doc_content or ticket.title.lower() in doc_content:
                            evidence = [
                                {
                                    "artifact_id": str(ticket.id),
                                    "span": f"Jira status: {ticket.raw.get('status')}",
                                    "role": "jira_done",
                                    "url": ticket.url,
                                },
                                {
                                    "artifact_id": str(doc.id),
                                    "span": f"Doc says: {pattern}",
                                    "role": "doc_incomplete_testing",
                                    "url": doc.url,
                                },
                            ]
                            
                            finding = Finding(
                                id=uuid.uuid4(),
                                case_id=case_id,
                                kind=FindingKind.CONTRADICTION,
                                severity=0.75,
                                confidence=0.85,
                                title="Docs state testing incomplete while ticket done",
                                summary=f"Jira ticket {ticket.external_id} is marked done, but documentation states testing is incomplete.",
                                evidence=evidence,
                                status=FindingStatus.OPEN,
                                created_at=datetime.utcnow(),
                                updated_at=datetime.utcnow(),
                            )
                            findings.append(finding)
                            break
    
    if recent_commits:
        default_branch_commits = [
            c for c in recent_commits
            if c.raw.get("branch", "") in ("main", "master", "develop")
        ]
        
        for commit in default_branch_commits[:5]:
            ci_status = commit.raw.get("ci_status", {})
            if ci_status:
                status = ci_status.get("status", "").lower() if isinstance(ci_status, dict) else str(ci_status).lower()
                
                if status in ("failed", "failure", "error"):
                    commit_ticket = None
                    commit_msg = commit.raw.get("message", "")
                    
                    for ticket in jira_tickets:
                        if ticket.external_id in commit_msg:
                            commit_ticket = ticket
                            break
                    
                    if commit_ticket:
                        ticket_status = commit_ticket.raw.get("status", "").lower()
                        
                        if ticket_status in ("done", "completed", "closed", "resolved"):
                            evidence = [
                                {
                                    "artifact_id": str(commit_ticket.id),
                                    "span": f"Jira status: {commit_ticket.raw.get('status')}",
                                    "role": "jira_done",
                                    "url": commit_ticket.url,
                                },
                                {
                                    "artifact_id": str(commit.id),
                                    "span": f"Commit CI status: {status}",
                                    "role": "ci_failed",
                                    "commit_sha": commit.external_id[:8],
                                    "url": commit.url,
                                },
                            ]
                            
                            finding = Finding(
                                id=uuid.uuid4(),
                                case_id=case_id,
                                kind=FindingKind.CONTRADICTION,
                                severity=0.8,
                                confidence=0.9,
                                title="Jira done but CI failing on default branch",
                                summary=f"Jira ticket {commit_ticket.external_id} marked done, but CI is failing on commit {commit.external_id[:8]} to default branch.",
                                evidence=evidence,
                                status=FindingStatus.OPEN,
                                created_at=datetime.utcnow(),
                                updated_at=datetime.utcnow(),
                            )
                            findings.append(finding)
    
    return findings