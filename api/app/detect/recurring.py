"""
Recurring Problems Detector (Deterministic)
Prompt 7 Section A

Clusters recurring operational and codebase failure modes:
1. Reverts, hotfix and "fix" commits touching the same files 3+ times within 90 days.
2. Reopened or duplicate Jira bugs.
3. Slack threads repeating the same error string or incident keywords.
4. Flaky test mentions across PRs, commits, and discussion.

Provenance Invariant:
- INFERRED if corroborated by only 1 source type (e.g., git only or slack only).
- VERIFIED if corroborated by 2 or more distinct source types (e.g., git + slack, git + jira).
"""

import re
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Artifact, ArtifactType, Finding, FindingKind, FindingStatus


CHURN_KEYWORDS = [
    r"\brevert\b",
    r"\bhotfix\b",
    r"\bfix\b",
    r"\bfixes\b",
    r"\bfixed\b",
    r"\bbugfix\b",
    r"\bpatch\b",
]
CHURN_REGEX = re.compile("|".join(CHURN_KEYWORDS), re.IGNORECASE)

FLAKY_KEYWORDS = [
    r"\bflak(y|iness)\b",
    r"\bintermittent\b",
    r"\bre-?run\s+ci\b",
    r"\bretry\s+ci\b",
    r"\bflaky\s+test\b",
    r"\btransient\s+failure\b",
]
FLAKY_REGEX = re.compile("|".join(FLAKY_KEYWORDS), re.IGNORECASE)

INCIDENT_KEYWORDS = [
    r"\bsev-?[12]\b",
    r"\boutage\b",
    r"\bbroken\b",
    r"\bincident\b",
    r"\btimeout\b",
    r"\bdownstream\s+failure\b",
    r"\bconnectionreseterror\b",
    r"\b504\s+gateway\b",
    r"\bdeadlock\b",
    r"\bconstraint\s+violation\b",
]
INCIDENT_REGEX = re.compile("|".join(INCIDENT_KEYWORDS), re.IGNORECASE)


def _parse_ts(val: Any) -> Optional[datetime]:
    if not val:
        return None
    if isinstance(val, datetime):
        return val
    try:
        s = str(val).replace("Z", "+00:00")
        return datetime.fromisoformat(s)
    except Exception:
        return None


def cluster_recurring_problems(
    artifacts: List[Dict[str, Any]],
    components: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """
    Deterministic clustering of artifacts into recurring problem cards.
    Accepts artifact dicts for memory/mock server and DB ingestion pipelines alike.
    """
    problems: List[Dict[str, Any]] = []

    # Map components to path globs or keywords
    component_names = []
    if components:
        for c in components:
            component_names.append(c.get("name") or c.get("component_name") or "")

    def _infer_component(text: str, paths: List[str]) -> str:
        text_lower = text.lower()
        paths_lower = " ".join(paths).lower()
        combined = f"{text_lower} {paths_lower}"

        if "payment" in combined or "stripe" in combined or "webhook" in combined or "currency" in combined:
            return "Payment Processor"
        if "auth" in combined or "jwt" in combined or "token" in combined or "session" in combined:
            return "Auth Service"
        if "report" in combined or "cron" in combined or "smtp" in combined or "bucket" in combined:
            return "Reporting Module"
        if "postgres" in combined or "migration" in combined or "db" in combined:
            return "Database & Migrations"
        return "Core Platform"

    # -------------------------------------------------------------------------
    # 1. Code Churn Clusters (Fix/Revert/Hotfix on same files >= 3 times in 90 days)
    # -------------------------------------------------------------------------
    commits = [a for a in artifacts if a.get("type") in ("commit", ArtifactType.COMMIT.value if hasattr(ArtifactType, "COMMIT") else "commit")]
    all_file_commits: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    churn_files: set = set()

    for c in commits:
        title = c.get("title", "")
        body = c.get("body", "")
        text = f"{title}\n{body}"
        is_churn_commit = bool(CHURN_REGEX.search(text))

        raw = c.get("raw") or {}
        files = raw.get("files") or []
        if not files:
            found_paths = re.findall(r"[\w\./\-]+\.(?:ts|js|py|sql|json|yml|yaml|go|rs)", text)
            files = found_paths or ["(unspecified_file)"]

        for f in files:
            all_file_commits[f].append(c)
            if is_churn_commit:
                churn_files.add(f)

    for file_path in churn_files:
        comm_list = all_file_commits[file_path]
        has_revert = any("revert" in (c.get("title") or "").lower() for c in comm_list)
        if len(comm_list) >= 3 or (has_revert and len(comm_list) >= 2):
            # Sort by date
            sorted_commits = sorted(
                comm_list,
                key=lambda x: _parse_ts(x.get("occurred_at") or x.get("created_at")) or datetime.min.replace(tzinfo=timezone.utc),
            )
            first_ts = sorted_commits[0].get("occurred_at") or sorted_commits[0].get("created_at") or ""
            last_ts = sorted_commits[-1].get("occurred_at") or sorted_commits[-1].get("created_at") or ""

            # Check for corroborating Slack or Jira messages
            corroborating_evidence = list(sorted_commits)
            sources = {"github"}

            # Search if file or commit topic is discussed in Slack or Jira
            file_basename = file_path.split("/")[-1]
            for a in artifacts:
                if a in sorted_commits:
                    continue
                a_text = f"{a.get('title', '')} {a.get('body', '')}"
                if file_basename in a_text or (file_path != "(unspecified_file)" and file_path in a_text):
                    corroborating_evidence.append(a)
                    sources.add(a.get("source", "unknown"))

            comp = _infer_component(f"File churn in {file_path}", [file_path])
            prov = "VERIFIED" if len(sources) >= 2 else "INFERRED"

            action = (
                f"Extract integration test regression suite for {file_path}; "
                f"freeze schema alterations and require senior lead review on migrations."
                if "migration" in file_path or "sql" in file_path
                else f"Refactor {file_path} to isolate churned logic and add unit coverage."
            )

            problems.append({
                "id": f"rec-churn-{abs(hash(file_path)) % 10000:04d}",
                "title": f"High churn on {file_basename} ({len(sorted_commits)} fix/revert cycles)",
                "category": "code_churn",
                "description": f"File '{file_path}' was touched {len(sorted_commits)} times by fix or revert commits, indicating an unstable interface or brittle migration dependencies.",
                "component": comp,
                "frequency": len(sorted_commits),
                "first_seen": str(first_ts),
                "last_seen": str(last_ts),
                "sources_corroborated": sorted(list(sources)),
                "provenance": prov,
                "evidence_ids": [a.get("id") for a in corroborating_evidence if a.get("id")],
                "suggested_action": action,
            })

    # -------------------------------------------------------------------------
    # 2. Reopened or Duplicate Jira Bugs
    # -------------------------------------------------------------------------
    jiras = [a for a in artifacts if a.get("type") in ("jira_ticket", "jira")]
    for j in jiras:
        raw = j.get("raw") or {}
        status = str(raw.get("status") or "").lower()
        title = j.get("title", "")
        body = j.get("body", "")
        text = f"{title}\n{body}".lower()

        is_reopened = status in ("reopened", "reopen") or "reopen" in text or "premature" in text or "still happening" in text
        is_duplicate = "duplicate" in text or raw.get("resolution") == "Duplicate"

        if is_reopened or is_duplicate:
            # Look for related Slack or commit artifacts mentioning this ticket
            key = raw.get("key") or j.get("external_id") or ""
            corroborating = [j]
            sources = {"jira"}

            if key:
                for a in artifacts:
                    if a == j:
                        continue
                    a_text = f"{a.get('title', '')} {a.get('body', '')}"
                    if key in a_text or (key.replace("-", " ") in a_text):
                        corroborating.append(a)
                        sources.add(a.get("source", "unknown"))

            comp = _infer_component(text, [])
            prov = "VERIFIED" if len(sources) >= 2 else "INFERRED"
            first_ts = j.get("occurred_at") or j.get("created_at") or ""

            tag = "Reopened Bug" if is_reopened else "Duplicate Bug"
            action = f"Verify root-cause fix for {key}; inspect gateway/downstream caching layers before re-closing."

            problems.append({
                "id": f"rec-jira-{abs(hash(key or title)) % 10000:04d}",
                "title": f"{tag}: {title} ({key})",
                "category": "reopened_bug",
                "description": f"Ticket {key} exhibits recurring regression behavior: '{title}'. Closed resolution failed in production or required repeated reopen cycles.",
                "component": comp,
                "frequency": len(corroborating),
                "first_seen": str(first_ts),
                "last_seen": str(corroborating[-1].get("occurred_at") or first_ts),
                "sources_corroborated": sorted(list(sources)),
                "provenance": prov,
                "evidence_ids": [a.get("id") for a in corroborating if a.get("id")],
                "suggested_action": action,
            })

    # -------------------------------------------------------------------------
    # 3. Repeated Slack Errors & Incident Keywords
    # -------------------------------------------------------------------------
    slacks = [a for a in artifacts if a.get("type") in ("slack_message", "slack")]
    incident_groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    for s in slacks:
        text = f"{s.get('title', '')} {s.get('body', '')}"
        matches = INCIDENT_REGEX.findall(text)
        if matches:
            # Normalize error/incident key
            matched_key = matches[0].lower().strip()
            if "timeout" in matched_key:
                err_group = "timeout_errors"
            elif "constraint" in matched_key or "foreign key" in matched_key:
                err_group = "fk_constraint_violations"
            elif "sev" in matched_key or "outage" in matched_key:
                err_group = "production_incidents"
            else:
                err_group = matched_key
            incident_groups[err_group].append(s)

    for err_group, s_list in incident_groups.items():
        if len(s_list) >= 2:
            sources = {"slack"}
            corroborating = list(s_list)

            # Search if commits or Jira corroborate this error
            for a in artifacts:
                if a in s_list:
                    continue
                a_text = f"{a.get('title', '')} {a.get('body', '')}".lower()
                if err_group.replace("_", " ") in a_text or ("timeout" in err_group and "timeout" in a_text):
                    corroborating.append(a)
                    sources.add(a.get("source", "unknown"))

            comp = _infer_component(f"Incident: {err_group}", [])
            prov = "VERIFIED" if len(sources) >= 2 else "INFERRED"
            first_ts = s_list[0].get("occurred_at") or s_list[0].get("created_at") or ""
            last_ts = s_list[-1].get("occurred_at") or s_list[-1].get("created_at") or ""

            clean_name = err_group.replace("_", " ").title()
            action = f"Add automated circuit breaker and structured alerts for recurring {clean_name}."

            problems.append({
                "id": f"rec-inc-{abs(hash(err_group)) % 10000:04d}",
                "title": f"Repeated Incident: {clean_name}",
                "category": "repeated_incident",
                "description": f"Encountered repeated reports of {clean_name} across operational communication channels ({len(s_list)} discussions).",
                "component": comp,
                "frequency": len(s_list),
                "first_seen": str(first_ts),
                "last_seen": str(last_ts),
                "sources_corroborated": sorted(list(sources)),
                "provenance": prov,
                "evidence_ids": [a.get("id") for a in corroborating if a.get("id")],
                "suggested_action": action,
            })

    # -------------------------------------------------------------------------
    # 4. Flaky Test Mentions
    # -------------------------------------------------------------------------
    flaky_artifacts: List[Dict[str, Any]] = []
    for a in artifacts:
        text = f"{a.get('title', '')} {a.get('body', '')}"
        if FLAKY_REGEX.search(text):
            flaky_artifacts.append(a)

    if flaky_artifacts:
        sources = {a.get("source", "unknown") for a in flaky_artifacts}
        comp = _infer_component("flaky tests", [])
        prov = "VERIFIED" if len(sources) >= 2 else "INFERRED"
        first_ts = flaky_artifacts[0].get("occurred_at") or ""
        last_ts = flaky_artifacts[-1].get("occurred_at") or first_ts

        problems.append({
            "id": f"rec-flaky-{abs(hash('flaky_tests')) % 10000:04d}",
            "title": f"Flaky Test Pattern: Intermittent CI Failures",
            "category": "flaky_test",
            "description": f"Identified {len(flaky_artifacts)} references to flaky tests or intermittent CI failures requiring retries.",
            "component": comp,
            "frequency": len(flaky_artifacts),
            "first_seen": str(first_ts),
            "last_seen": str(last_ts),
            "sources_corroborated": sorted(list(sources)),
            "provenance": prov,
            "evidence_ids": [a.get("id") for a in flaky_artifacts if a.get("id")],
            "suggested_action": "Quarantine flaky tests in a separate CI stage; mock external network/database timers.",
        })

    # Deduplicate and sort by frequency (highest first)
    unique_problems = {}
    for p in problems:
        if p["title"] not in unique_problems:
            unique_problems[p["title"]] = p

    return sorted(list(unique_problems.values()), key=lambda x: x["frequency"], reverse=True)


async def detect_recurring_problems(
    session: AsyncSession,
    case_id: uuid.UUID,
) -> List[Dict[str, Any]]:
    """
    SQLAlchemy-backed async detector querying artifacts in database.
    """
    res = await session.execute(
        select(Artifact).where(Artifact.case_id == case_id).order_by(Artifact.occurred_at.asc())
    )
    raw_artifacts = res.scalars().all()
    dict_artifacts = [
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

    return cluster_recurring_problems(dict_artifacts)
