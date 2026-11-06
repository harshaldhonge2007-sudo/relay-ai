import uuid
import re
from datetime import datetime
from typing import List, Dict, Any, Set
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Finding, FindingKind, FindingStatus, Artifact, ArtifactType, 
)


async def detect_hidden_dependencies(
    session: AsyncSession, 
    case_id: uuid.UUID
) -> List[Finding]:
    findings = []
    
    code_result = await session.execute(
        select(Artifact).where(
            Artifact.case_id == case_id,
            Artifact.type == ArtifactType.COMMIT,
        )
    )
    code_artifacts = code_result.scalars().all()
    
    docs_result = await session.execute(
        select(Artifact).where(
            Artifact.case_id == case_id,
            Artifact.type == ArtifactType.DOCUMENT,
        )
    )
    doc_artifacts = docs_result.scalars().all()
    
    env_var_pattern = re.compile(
        r'(?:process\.env\.|os\.environ\[|getenv\(|\$ENV:|\$\{?[A-Z_][A-Z0-9_]*\}?)'
        r'([A-Z_][A-Z0-9_]{2,})',
        re.IGNORECASE
    )
    
    secret_pattern = re.compile(
        r'(?:api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|password|passwd|pwd)'
        r'[\s:=]+["\']?([^"\'\s]+)',
        re.IGNORECASE
    )
    
    cron_pattern = re.compile(
        r'(?:cron|schedule)[\s:=]+["\']?([^\s"\';\n]+)',
        re.IGNORECASE
    )
    
    host_pattern = re.compile(
        r'(?:https?://|host[\s:=]+|endpoint[\s:=]+)'
        r'([a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)+)',
        re.IGNORECASE
    )
    
    code_env_vars: Set[str] = set()
    code_secrets: Set[str] = set()
    code_crons: Set[str] = set()
    code_hosts: Set[str] = set()
    
    for artifact in code_artifacts:
        content = artifact.body or ""
        if artifact.raw:
            content += " " + str(artifact.raw.get("message", ""))
            content += " " + str(artifact.raw.get("diff", ""))
        
        env_matches = env_var_pattern.findall(content)
        code_env_vars.update(env_matches)
        
        secret_matches = secret_pattern.findall(content)
        code_secrets.update(secret_matches)
        
        cron_matches = cron_pattern.findall(content)
        code_crons.update(cron_matches)
        
        host_matches = host_pattern.findall(content)
        code_hosts.update(host_matches)
    
    doc_env_vars: Set[str] = set()
    doc_secrets: Set[str] = set()
    doc_crons: Set[str] = set()
    doc_hosts: Set[str] = set()
    
    for doc in doc_artifacts:
        content = doc.body or ""
        
        env_matches = env_var_pattern.findall(content)
        doc_env_vars.update(env_matches)
        
        secret_matches = secret_pattern.findall(content)
        doc_secrets.update(secret_matches)
        
        cron_matches = cron_pattern.findall(content)
        doc_crons.update(cron_matches)
        
        host_matches = host_pattern.findall(content)
        doc_hosts.update(host_matches)
    
    undoc_env_vars = code_env_vars - doc_env_vars
    if undoc_env_vars:
        evidence = []
        for env_var in undoc_env_vars:
            for artifact in code_artifacts:
                content = artifact.body or ""
                if artifact.raw:
                    content += " " + str(artifact.raw.get("diff", ""))
                if env_var in content:
                    evidence.append({
                        "artifact_id": str(artifact.id),
                        "span": f"Undocumented env var: {env_var}",
                        "role": "env_var",
                        "name": env_var,
                    })
        
        finding = Finding(
            id=uuid.uuid4(),
            case_id=case_id,
            kind=FindingKind.HIDDEN_DEPENDENCY,
            severity=0.7,
            confidence=0.85,
            title="Undocumented environment variables",
            summary=f"Found {len(undoc_env_vars)} environment variables in code but not documented.",
            evidence=evidence,
            status=FindingStatus.OPEN,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        findings.append(finding)
    
    undoc_secrets = code_secrets - doc_secrets
    if undoc_secrets:
        evidence = []
        for secret_name in undoc_secrets:
            for artifact in code_artifacts:
                content = artifact.body or ""
                if artifact.raw:
                    content += " " + str(artifact.raw.get("diff", ""))
                if secret_name in content and len(secret_name) > 3:
                    evidence.append({
                        "artifact_id": str(artifact.id),
                        "span": f"Undocumented secret reference: {secret_name[:2]}***",
                        "role": "secret",
                        "name_prefix": secret_name[:2],
                    })
        
        if evidence:
            finding = Finding(
                id=uuid.uuid4(),
                case_id=case_id,
                kind=FindingKind.HIDDEN_DEPENDENCY,
                severity=0.9,
                confidence=0.8,
                title="Undocumented secret references",
                summary=f"Found {len(undoc_secrets)} secret references in code but not documented. Secret values are never stored.",
                evidence=evidence,
                status=FindingStatus.OPEN,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            findings.append(finding)
    
    undoc_crons = code_crons - doc_crons
    if undoc_crons:
        evidence = []
        for cron in undoc_crons:
            for artifact in code_artifacts:
                content = artifact.body or ""
                if artifact.raw:
                    content += " " + str(artifact.raw.get("diff", ""))
                if cron in content:
                    evidence.append({
                        "artifact_id": str(artifact.id),
                        "span": f"Undocumented cron schedule: {cron}",
                        "role": "cron",
                        "schedule": cron,
                    })
        
        finding = Finding(
            id=uuid.uuid4(),
            case_id=case_id,
            kind=FindingKind.HIDDEN_DEPENDENCY,
            severity=0.6,
            confidence=0.85,
            title="Undocumented cron schedules",
            summary=f"Found {len(undoc_crons)} cron schedules in code but not documented.",
            evidence=evidence,
            status=FindingStatus.OPEN,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        findings.append(finding)
    
    localhost_pattern = re.compile(r'localhost|127\.0\.0\.1|\.local|\.internal', re.IGNORECASE)
    undoc_hosts = set()
    for host in code_hosts - doc_hosts:
        if not localhost_pattern.search(host):
            undoc_hosts.add(host)
    
    if undoc_hosts:
        evidence = []
        for host in undoc_hosts:
            for artifact in code_artifacts:
                content = artifact.body or ""
                if artifact.raw:
                    content += " " + str(artifact.raw.get("diff", ""))
                if host in content:
                    evidence.append({
                        "artifact_id": str(artifact.id),
                        "span": f"Undocumented external host: {host}",
                        "role": "host",
                        "host": host,
                    })
        
        finding = Finding(
            id=uuid.uuid4(),
            case_id=case_id,
            kind=FindingKind.HIDDEN_DEPENDENCY,
            severity=0.65,
            confidence=0.85,
            title="Undocumented external hosts",
            summary=f"Found {len(undoc_hosts)} external hosts in code but not documented.",
            evidence=evidence,
            status=FindingStatus.OPEN,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        findings.append(finding)
    
    docker_result = await session.execute(
        select(Artifact).where(
            Artifact.case_id == case_id,
            Artifact.external_id.ilike("%Dockerfile%"),
        )
    )
    docker_artifacts = docker_result.scalars().all()
    
    docker_env_vars: Set[str] = set()
    docker_secrets: Set[str] = set()
    
    for artifact in docker_artifacts:
        content = artifact.body or ""
        
        env_matches = env_var_pattern.findall(content)
        docker_env_vars.update(env_matches)
        
        secret_matches = secret_pattern.findall(content)
        docker_secrets.update(secret_matches)
    
    undoc_docker_env = docker_env_vars - doc_env_vars
    if undoc_docker_env:
        evidence = []
        for env_var in undoc_docker_env:
            for artifact in docker_artifacts:
                content = artifact.body or ""
                if env_var in content:
                    evidence.append({
                        "artifact_id": str(artifact.id),
                        "span": f"Undocumented Docker env var: {env_var}",
                        "role": "docker_env_var",
                        "name": env_var,
                    })
        
        finding = Finding(
            id=uuid.uuid4(),
            case_id=case_id,
            kind=FindingKind.HIDDEN_DEPENDENCY,
            severity=0.75,
            confidence=0.9,
            title="Undocumented Docker environment variables",
            summary=f"Found {len(undoc_docker_env)} environment variables in Docker files but not documented.",
            evidence=evidence,
            status=FindingStatus.OPEN,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        findings.append(finding)
    
    return findings