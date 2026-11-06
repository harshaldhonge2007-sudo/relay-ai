import uuid
from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Finding, FindingKind, FindingStatus, Artifact, ArtifactType, 
)


async def detect_gaps(
    session: AsyncSession, 
    case_id: uuid.UUID
) -> List[Finding]:
    findings = []
    
    commit_result = await session.execute(
        select(Artifact).where(
            Artifact.case_id == case_id,
            Artifact.type == ArtifactType.COMMIT,
        ).order_by(Artifact.occurred_at.desc())
    )
    commits = commit_result.scalars().all()
    
    pr_result = await session.execute(
        select(Artifact).where(
            Artifact.case_id == case_id,
            Artifact.type == ArtifactType.PULL_REQUEST,
        ).order_by(Artifact.occurred_at.desc())
    )
    prs = pr_result.scalars().all()
    
    jira_result = await session.execute(
        select(Artifact).where(
            Artifact.case_id == case_id,
            Artifact.type == ArtifactType.JIRA_TICKET,
        )
    )
    jira_tickets = jira_result.scalars().all()
    
    LARGE_DIFF_THRESHOLD = 500
    
    for commit in commits:
        diff_stats = commit.raw.get("stats", {})
        additions = diff_stats.get("additions", 0)
        deletions = diff_stats.get("deletions", 0)
        total_changes = additions + deletions
        
        if total_changes > LARGE_DIFF_THRESHOLD:
            commit_msg = commit.raw.get("message", "")
            
            linked_ticket = None
            for ticket in jira_tickets:
                if ticket.external_id in commit_msg:
                    linked_ticket = ticket
                    break
            
            linked_pr = None
            for pr in prs:
                pr_commits = pr.raw.get("commits", [])
                for pc in pr_commits:
                    if commit.external_id in str(pc):
                        linked_pr = pr
                        break
                if linked_pr:
                    break
            
            has_rationale = False
            rationale_keywords = ["because", "reason", "rationale", "why", "decision", "justification"]
            
            if linked_pr and linked_pr.body:
                if any(kw in linked_pr.body.lower() for kw in rationale_keywords):
                    has_rationale = True
            
            if linked_ticket and linked_ticket.body:
                if any(kw in linked_ticket.body.lower() for kw in rationale_keywords):
                    has_rationale = True
            
            if commit_msg:
                if any(kw in commit_msg.lower() for kw in rationale_keywords):
                    has_rationale = True
            
            if not has_rationale and not linked_ticket:
                evidence = [
                    {
                        "artifact_id": str(commit.id),
                        "span": f"Large diff: +{additions}/-{deletions} lines",
                        "role": "large_diff",
                        "additions": additions,
                        "deletions": deletions,
                        "total_changes": total_changes,
                        "commit_sha": commit.external_id[:8],
                        "url": commit.url,
                    },
                ]
                
                if linked_pr:
                    evidence.append({
                        "artifact_id": str(linked_pr.id),
                        "span": f"PR: {linked_pr.title}",
                        "role": "linked_pr",
                        "url": linked_pr.url,
                    })
                
                confidence = min(0.95, 0.6 + (total_changes / 5000))
                
                finding = Finding(
                    id=uuid.uuid4(),
                    case_id=case_id,
                    kind=FindingKind.UNDOCUMENTED_DECISION,
                    severity=0.6,
                    confidence=confidence,
                    title="Large change without linked rationale",
                    summary=f"Commit {commit.external_id[:8]} has {total_changes} line changes but no linked ticket or rationale documentation. This may indicate an undocumented decision.",
                    evidence=evidence,
                    status=FindingStatus.OPEN,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                findings.append(finding)
    
    for commit in commits:
        commit_msg = commit.raw.get("message", "").lower()
        
        is_revert = (
            "revert" in commit_msg or 
            "roll back" in commit_msg or 
            "rollback" in commit_msg
        )
        
        if is_revert:
            reverted_sha = None
            for word in commit_msg.split():
                if len(word) >= 7 and all(c in '0123456789abcdef' for c in word.lower()):
                    reverted_sha = word
                    break
            
            reverted_commit = None
            if reverted_sha:
                for c in commits:
                    if c.external_id.startswith(reverted_sha):
                        reverted_commit = c
                        break
            
            linked_ticket = None
            for ticket in jira_tickets:
                ticket_key = ticket.external_id.lower()
                if ticket_key in commit_msg:
                    linked_ticket = ticket
                    break
            
            linked_pr = None
            for pr in prs:
                pr_commits = pr.raw.get("commits", [])
                for pc in pr_commits:
                    if commit.external_id in str(pc):
                        linked_pr = pr
                        break
                if linked_pr:
                    break
            
            has_rationale = False
            rationale_keywords = ["because", "reason", "rationale", "why", "decision", "justification", "due to", "broken"]
            
            if linked_pr and linked_pr.body:
                if any(kw in linked_pr.body.lower() for kw in rationale_keywords):
                    has_rationale = True
            
            if linked_ticket and linked_ticket.body:
                if any(kw in linked_ticket.body.lower() for kw in rationale_keywords):
                    has_rationale = True
            
            if commit_msg:
                if any(kw in commit_msg for kw in rationale_keywords):
                    has_rationale = True
            
            if not has_rationale and not linked_ticket:
                evidence = [
                    {
                        "artifact_id": str(commit.id),
                        "span": f"Revert commit: {commit.raw.get('message', '')[:100]}",
                        "role": "revert",
                        "commit_sha": commit.external_id[:8],
                        "url": commit.url,
                    },
                ]
                
                if reverted_commit:
                    evidence.append({
                        "artifact_id": str(reverted_commit.id),
                        "span": f"Reverted commit: {reverted_commit.external_id[:8]}",
                        "role": "reverted_commit",
                        "url": reverted_commit.url,
                    })
                
                if linked_pr:
                    evidence.append({
                        "artifact_id": str(linked_pr.id),
                        "span": f"PR: {linked_pr.title}",
                        "role": "linked_pr",
                        "url": linked_pr.url,
                    })
                
                finding = Finding(
                    id=uuid.uuid4(),
                    case_id=case_id,
                    kind=FindingKind.UNDOCUMENTED_DECISION,
                    severity=0.7,
                    confidence=0.85,
                    title="Revert without documented rationale",
                    summary=f"Commit {commit.external_id[:8]} is a revert but has no linked ticket or rationale. This indicates an undocumented decision or incident.",
                    evidence=evidence,
                    status=FindingStatus.OPEN,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                findings.append(finding)
    
    return findings