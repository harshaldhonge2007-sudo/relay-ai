"""
Evidence Retrieval & Grounding Engine for 'Ask the Leaver'.

Indexes artifacts (commits, PRs, Slack discussions, Jira tickets, meeting notes)
with role-based access control (RBAC), extracts citations, and verifies claims.
"""

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Set

from app.llm.provider import redact_secrets, get_llm_provider

logger = logging.getLogger(__name__)


@dataclass
class EvidenceChunk:
    """A granular chunk of evidence from the leaver's digital footprint."""
    chunk_id: str
    source_type: str        # 'commit', 'pr', 'slack', 'jira', 'doc'
    source_id: str          # e.g. 'commit-a1b2c3d', 'pr-142', 'SL-287'
    title: str
    content: str
    url: str
    author: str
    timestamp: str
    allowed_roles: List[str] = field(default_factory=lambda: ["engineering_lead", "successor", "contractor"])
    keywords: Set[str] = field(default_factory=set)

    def matches_role(self, role: str) -> bool:
        """Check if the requesting role is authorized to view this chunk."""
        if role == "engineering_lead":
            return True
        return role in self.allowed_roles


# Pre-seeded sample case ground-truth footprint for Priya Nair (ShopLedger)
SAMPLE_CASE_EVIDENCE: List[EvidenceChunk] = [
    EvidenceChunk(
        chunk_id="chunk-001",
        source_type="commit",
        source_id="a1b2c3d",
        title="Reduce JWT lifetime from 2h to 15m",
        content="auth: reduce JWT access token expiration from 2 hours to 15 minutes to limit replay attack windows. Refresh tokens remain 7 days.",
        url="https://github.com/shopledger/api/commit/a1b2c3d",
        author="Priya Nair",
        timestamp="2026-09-12T14:22:00Z",
        allowed_roles=["engineering_lead", "successor", "contractor"],
        keywords={"jwt", "token", "expire", "expiration", "15m", "auth", "replay", "lifetime"},
    ),
    EvidenceChunk(
        chunk_id="chunk-002",
        source_type="pr",
        source_id="142",
        title="PR #142: Enhanced JWT token revocation and sliding session expiration",
        content="Implements token blacklist via Redis for explicit logout. Closes security audit item SEC-89. Reviewed and approved by Alex Chen.",
        url="https://github.com/shopledger/api/pull/142",
        author="Priya Nair",
        timestamp="2026-09-15T11:05:00Z",
        allowed_roles=["engineering_lead", "successor", "contractor"],
        keywords={"pr", "142", "token", "jwt", "redis", "revocation", "logout", "sec-89"},
    ),
    EvidenceChunk(
        chunk_id="chunk-003",
        source_type="jira",
        source_id="SL-287",
        title="SL-287: Multi-currency billing rollout & rollback",
        content="SL-287: Multi-currency conversion deployed to staging. Rolled back same day due to floating-point rounding mismatches in Stripe webhook ledger.",
        url="https://jira.internal/browse/SL-287",
        author="Priya Nair",
        timestamp="2026-10-04T09:30:00Z",
        allowed_roles=["engineering_lead", "successor", "contractor"],
        keywords={"currency", "sl-287", "revert", "rollback", "stripe", "ledger", "floating-point"},
    ),
    EvidenceChunk(
        chunk_id="chunk-004",
        source_type="pr",
        source_id="189",
        title="PR #189: Stripe webhook idempotency & exponential backoff",
        content="Caches idempotency keys in Redis for 48 hours. Configures exponential backoff with max 5 retries over 24 hours.",
        url="https://github.com/shopledger/api/pull/189",
        author="Priya Nair",
        timestamp="2026-10-18T16:45:00Z",
        allowed_roles=["engineering_lead", "successor", "contractor"],
        keywords={"webhook", "stripe", "idempotency", "redis", "retry", "backoff", "189"},
    ),
    EvidenceChunk(
        chunk_id="chunk-005",
        source_type="slack",
        source_id="msg-slack-901",
        title="#proj-payments: Priya explains database migration policy (CANARY_INT_91bc)",
        content="Reminder: database migrations must use two-phase zero-downtime additions (CANARY_INT_91bc). Add new columns as nullable first before deploying code that reads them.",
        url="https://slack.internal/archives/C0123/p1697200000",
        author="Priya Nair",
        timestamp="2026-10-22T10:15:00Z",
        allowed_roles=["engineering_lead", "successor"],  # Internal channel: not visible to contractors
        keywords={"database", "migration", "alembic", "zero-downtime", "columns", "postgres", "canary_int_91bc"},
    ),
    EvidenceChunk(
        chunk_id="chunk-conf-001",
        source_type="slack",
        source_id="msg-fin-001",
        title="#finance-private: Severance package notes (CANARY_CONF_7f3a)",
        content="Severance schedule confirmed for Priya departure (CANARY_CONF_7f3a). Confidential payment details restricted to engineering lead.",
        url="https://slack.internal/archives/C_FINANCE/p1728565200",
        author="Priya Nair",
        timestamp="2026-10-10T14:00:00Z",
        allowed_roles=["engineering_lead"],  # Strictly confidential: Lead only
        keywords={"severance", "finance", "payout", "canary_conf_7f3a"},
    ),
    EvidenceChunk(
        chunk_id="chunk-006",
        source_type="doc",
        source_id="doc-arch-payments",
        title="Architecture Runbook: Payment Gateway Failover",
        content="Primary payment gateway is Stripe; secondary failover route is Adyen. Circuit breaker opens after 5 consecutive 5xx errors.",
        url="https://wiki.internal/engineering/payments/failover",
        author="Priya Nair",
        timestamp="2026-08-30T17:00:00Z",
        allowed_roles=["engineering_lead", "successor", "contractor"],
        keywords={"gateway", "stripe", "adyen", "failover", "circuit", "breaker", "5xx"},
    ),
]


class RetrievalEngine:
    """Manages evidence indexing, vector/keyword matching, and citation assembly."""

    def __init__(self, custom_chunks: Optional[List[EvidenceChunk]] = None):
        self.chunks = custom_chunks or list(SAMPLE_CASE_EVIDENCE)

    def search(self, query: str, role: str = "successor", top_k: int = 4) -> List[Dict[str, Any]]:
        """
        Retrieves relevant evidence chunks matching user query and authorized role.
        Applies secret redaction to all returned snippets.
        """
        query_words = set(re.findall(r"\w+", query.lower()))
        matched = []

        for chunk in self.chunks:
            # Respect RBAC
            if not chunk.matches_role(role):
                continue

            # Compute term overlap score
            text = (chunk.title + " " + chunk.content).lower()
            overlap = sum(1 for w in query_words if w in text or w in chunk.keywords)
            
            # Bonus for exact identifier matches (e.g. SL-287, PR #142)
            for w in query_words:
                if w in chunk.source_id.lower():
                    overlap += 3

            if overlap > 0:
                score = overlap / max(1, len(query_words))
                matched.append((chunk, score))

        # Sort by score descending
        matched.sort(key=lambda x: x[1], reverse=True)
        results = []

        for chunk, score in matched[:top_k]:
            clean_content = redact_secrets(chunk.content)
            results.append({
                "chunk_id": chunk.chunk_id,
                "source_type": chunk.source_type,
                "source_id": chunk.source_id,
                "title": chunk.title,
                "content": clean_content,
                "url": chunk.url,
                "author": chunk.author,
                "timestamp": chunk.timestamp,
                "relevance_score": round(score, 3),
                "citation_label": f"[{chunk.source_type.upper()} {chunk.source_id}]",
            })

        return results


class GroundingVerifier:
    """
    Verifies that generated answers are grounded in the retrieved evidence footprint.
    Rejects hallucinations and automatically signals when to abstain and escalate to interview.
    """

    @staticmethod
    def verify(
        question: str,
        answer: str,
        retrieved_chunks: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Verifies answer grounding against retrieved chunks.
        Returns: { abstained: bool, confidence: float, citations: list, reason: str }
        """
        ans_lower = answer.lower()

        # Check explicit abstention signals
        abstention_signals = [
            "not enough evidence",
            "not enough written trace",
            "insufficient evidence",
            "no written documentation",
            "cannot be verified from the leaver's evidence",
        ]
        if any(sig in ans_lower for sig in abstention_signals) or not retrieved_chunks:
            return {
                "abstained": True,
                "confidence": 0.0,
                "citations": [],
                "reason": "The departing engineer left insufficient written evidence regarding this inquiry.",
            }

        # Match citations strictly entailed by the answer
        citations = []
        for chunk in retrieved_chunks:
            sid = chunk["source_id"].lower()
            # Must have source_id explicitly mentioned or high relevance with title words in answer
            title_words = set(re.findall(r"\w+", chunk["title"].lower()))
            overlap_in_answer = sum(1 for w in title_words if len(w) > 3 and w in ans_lower)
            if sid in ans_lower or overlap_in_answer >= 2:
                citations.append({
                    "id": chunk["source_id"],
                    "type": chunk["source_type"],
                    "label": chunk["citation_label"],
                    "title": chunk["title"],
                    "url": chunk["url"],
                    "snippet": chunk["content"][:180] + ("..." if len(chunk["content"]) > 180 else ""),
                })

        # Calculate grounding confidence
        if citations:
            confidence = min(0.98, 0.70 + 0.10 * len(citations))
            return {
                "abstained": False,
                "confidence": round(confidence, 2),
                "citations": citations,
                "reason": "Claims grounded in verified leaver commits, PRs, and tickets.",
            }

        # If an answer was generated but no citations could be grounded, abstain
        return {
            "abstained": True,
            "confidence": 0.20,
            "citations": [],
            "reason": "Generated claims could not be verified against the leaver's evidence footprint.",
        }
