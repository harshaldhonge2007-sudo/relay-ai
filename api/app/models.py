import uuid
from sqlalchemy import Column, String, Integer, DateTime, Float, Boolean, JSON, ForeignKey, Text, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.db import Base


class ArtifactType(str, enum.Enum):
    COMMIT = "commit"
    PULL_REQUEST = "pull_request"
    ISSUE = "issue"
    BRANCH = "branch"
    TAG = "tag"
    SLACK_MESSAGE = "slack_message"
    SLACK_THREAD = "slack_thread"
    JIRA_TICKET = "jira_ticket"
    DOCUMENT = "document"


class SourceMode(str, enum.Enum):
    LIVE = "live"
    FIXTURE = "fixture"
    REPLAY = "replay"


class CaseStatus(str, enum.Enum):
    DRAFT = "draft"
    INGESTING = "ingesting"
    DETECTING = "detecting"
    INTERVIEWING = "interviewing"
    HANDBUILD = "handbuild"
    LAVER_APPROVAL = "leaver_approval"
    RELEASED = "released"
    ARCHIVED = "archived"


class FindingKind(str, enum.Enum):
    INFLIGHT = "inflight"
    HIDDEN_DEPENDENCY = "hidden_dependency"
    CONTRADICTION = "contradiction"
    UNDOCUMENTED_DECISION = "undocumented_decision"
    RISK = "risk"
    RECURRING_PROBLEM = "recurring_problem"


class FindingStatus(str, enum.Enum):
    OPEN = "open"
    ASKED = "asked"
    ANSWERED = "answered"
    ACCEPTED = "accepted"
    DISMISSED = "dismissed"


class QuestionStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    ANSWERED = "answered"
    INCORPORATED = "incorporated"
    SKIPPED = "skipped"


class Provenance(str, enum.Enum):
    INFERRED = "inferred"
    STATED = "stated"
    VERIFIED = "verified"


class Case(Base):
    __tablename__ = "cases"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    repo_url = Column(String(500), nullable=False)
    leaver_person_id = Column(UUID(as_uuid=True), ForeignKey("people.id"))
    status = Column(Enum(CaseStatus), default=CaseStatus.DRAFT)
    source_modes = Column(JSONB, nullable=False, default={"github": "live", "slack": "fixture", "jira": "fixture"})
    disclose_withheld_counts = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    leaver = relationship("Person", foreign_keys=[leaver_person_id])
    artifacts = relationship("Artifact", back_populates="case")
    findings = relationship("Finding", back_populates="case")
    components = relationship("Component", back_populates="case")
    questions = relationship("InterviewQuestion", back_populates="case")
    handover_items = relationship("HandoverItem", back_populates="case")


class Person(Base):
    __tablename__ = "people"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    display_name = Column(String(200), nullable=False)
    identities = Column(JSONB, nullable=False, default=[])  # [{"source": "github", "id": "...", "email": "..."}, ...]
    is_leaver = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Artifact(Base):
    __tablename__ = "artifacts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    source = Column(String(50), nullable=False)  # "github", "slack", "jira", "docs"
    source_mode = Column(Enum(SourceMode), nullable=False)
    type = Column(Enum(ArtifactType), nullable=False)
    external_id = Column(String(500), nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey("people.id"))
    occurred_at = Column(DateTime, nullable=False)
    url = Column(String(1000))
    title = Column(String(500))
    body = Column(Text)
    raw = Column(JSONB, nullable=False)
    acl_tag = Column(String(100), default="readable")
    quarantine_status = Column(String(50), default="active")  # "active", "quarantined", "cleared", "redacted", "confidential"
    quarantine_reasons = Column(JSONB, default=[])
    original_body = Column(Text, nullable=True)
    embedding = Column(String)  # Will use pgvector type in migrations
    created_at = Column(DateTime, default=datetime.utcnow)
    
    case = relationship("Case", back_populates="artifacts")
    author = relationship("Person")
    src_links = relationship("Link", foreign_keys="Link.src_id", back_populates="src")
    dst_links = relationship("Link", foreign_keys="Link.dst_id", back_populates="dst")
    claims = relationship("Claim", back_populates="artifact")


class Link(Base):
    __tablename__ = "links"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    src_id = Column(UUID(as_uuid=True), ForeignKey("artifacts.id"), nullable=False)
    dst_id = Column(UUID(as_uuid=True), ForeignKey("artifacts.id"), nullable=False)
    link_type = Column(String(50), nullable=False)  # "references", "related_to", "follows", "contradicts"
    method = Column(String(50), nullable=False)  # "explicit", "path_match", "time_proximity", "embedding", "llm_confirm"
    confidence = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    src = relationship("Artifact", foreign_keys=[src_id], back_populates="src_links")
    dst = relationship("Artifact", foreign_keys=[dst_id], back_populates="dst_links")


class Component(Base):
    __tablename__ = "components"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    name = Column(String(200), nullable=False)
    path_globs = Column(Text, nullable=False)  # JSON array as text
    criticality = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    case = relationship("Case", back_populates="components")
    knowledge_scores = relationship("KnowledgeScore", back_populates="component")


class KnowledgeScore(Base):
    __tablename__ = "knowledge_scores"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    component_id = Column(UUID(as_uuid=True), ForeignKey("components.id"), nullable=False)
    person_id = Column(UUID(as_uuid=True), ForeignKey("people.id"), nullable=False)
    score = Column(Float, nullable=False, default=0.0)
    breakdown = Column(JSONB, nullable=False, default={})  # {"edits": 0.3, "reviews": 0.1, "discussion": 0.1}
    created_at = Column(DateTime, default=datetime.utcnow)
    
    component = relationship("Component", back_populates="knowledge_scores")
    person = relationship("Person")


class Claim(Base):
    __tablename__ = "claims"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    artifact_id = Column(UUID(as_uuid=True), ForeignKey("artifacts.id"), nullable=False)
    subject = Column(String(200), nullable=False)
    predicate = Column(String(200), nullable=False)
    value = Column(String(200), nullable=False)
    quoted_span = Column(Text, nullable=False)
    occurred_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    artifact = relationship("Artifact", back_populates="claims")


class Finding(Base):
    __tablename__ = "findings"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    kind = Column(Enum(FindingKind), nullable=False)
    severity = Column(Float, nullable=False, default=0.0)
    confidence = Column(Float, nullable=False, default=0.0)
    title = Column(String(200), nullable=False)
    summary = Column(Text, nullable=False)
    evidence = Column(JSONB, nullable=False, default=[])  # [{"artifact_id": "...", "span": "...", "role": "..."}, ...]
    status = Column(Enum(FindingStatus), default=FindingStatus.OPEN)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    case = relationship("Case", back_populates="findings")
    questions = relationship("InterviewQuestion", back_populates="finding")


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    finding_id = Column(UUID(as_uuid=True), ForeignKey("findings.id"))
    text = Column(Text, nullable=False)
    evidence = Column(JSONB, nullable=False, default=[])
    priority = Column(Float, nullable=False, default=0.0)
    status = Column(Enum(QuestionStatus), default=QuestionStatus.DRAFT)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    case = relationship("Case", back_populates="questions")
    finding = relationship("Finding", back_populates="questions")
    answers = relationship("InterviewAnswer", back_populates="question")


class InterviewAnswer(Base):
    __tablename__ = "interview_answers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question_id = Column(UUID(as_uuid=True), ForeignKey("interview_questions.id"), nullable=False)
    text = Column(Text, nullable=False)
    answered_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    question = relationship("InterviewQuestion", back_populates="answers")


class HandoverItem(Base):
    __tablename__ = "handover_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    section = Column(String(100), nullable=False)
    text = Column(Text, nullable=False)
    evidence_ids = Column(JSONB, nullable=False, default=[])  # UUID array
    provenance = Column(Enum(Provenance), nullable=False)
    confidence = Column(Float, nullable=False, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    case = relationship("Case", back_populates="handover_items")


class RequiredFact(Base):
    __tablename__ = "required_facts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    task_id = Column(String(100), nullable=False)
    kind = Column(String(50), nullable=False)  # "env_var", "service", "command", "dependency"
    key = Column(String(200), nullable=False)
    derived_from = Column(JSONB, nullable=False, default=[])  # [{"file": "...", "line": "...", "pattern": "..."}]
    created_at = Column(DateTime, default=datetime.utcnow)


class SimTask(Base):
    __tablename__ = "sim_tasks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class SimRun(Base):
    __tablename__ = "sim_runs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    task_id = Column(UUID(as_uuid=True), ForeignKey("sim_tasks.id"))
    handover_version = Column(String(50), nullable=False)
    found_fact_ids = Column(JSONB, nullable=False, default=[])
    missing_fact_ids = Column(JSONB, nullable=False, default=[])
    blockers = Column(JSONB, nullable=False, default=[])
    score = Column(Float, nullable=False, default=0.0)
    transcript = Column(JSONB, nullable=False, default=[])
    mode = Column(String(50), nullable=False, default="blind")
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_log"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor = Column(String(200), nullable=False)
    action = Column(String(100), nullable=False)
    subject = Column(JSONB, nullable=False, default={})  # {"type": "...", "id": "...", "details": "..."}
    created_at = Column(DateTime, default=datetime.utcnow)


class WebhookEvent(Base):
    """Tracks ingested webhook events for idempotency."""
    __tablename__ = "webhook_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source = Column(String(50), nullable=False)  # "github"
    event_type = Column(String(100), nullable=False)  # "push", "pull_request", "issues"
    idempotency_key = Column(String(500), nullable=False, unique=True)  # sha or delivery_id
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=True)
    payload_summary = Column(JSONB, nullable=False, default={})
    processed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class LivingMemory(Base):
    """Continuously updated project intelligence snapshot."""
    __tablename__ = "living_memory"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False, unique=True)
    overall_risk_score = Column(Float, nullable=False, default=0.0)
    bus_factor_score = Column(Float, nullable=False, default=0.0)
    knowledge_continuity_score = Column(Float, nullable=False, default=0.0)
    total_events_processed = Column(Integer, nullable=False, default=0)
    last_event_at = Column(DateTime, nullable=True)
    last_updated = Column(DateTime, default=datetime.utcnow)
    summary = Column(JSONB, nullable=False, default={})  # cached intelligence summary
    created_at = Column(DateTime, default=datetime.utcnow)


class ComponentRelationship(Base):
    """Knowledge graph edges between components."""
    __tablename__ = "component_relationships"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    src_component_id = Column(UUID(as_uuid=True), ForeignKey("components.id"), nullable=False)
    dst_component_id = Column(UUID(as_uuid=True), ForeignKey("components.id"), nullable=False)
    relation_type = Column(String(100), nullable=False)  # "depends_on", "calls", "imports"
    strength = Column(Float, nullable=False, default=0.5)
    evidence = Column(JSONB, nullable=False, default=[])
    created_at = Column(DateTime, default=datetime.utcnow)


class BusFactorAlert(Base):
    """Generated bus-factor risk alerts."""
    __tablename__ = "bus_factor_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    component_id = Column(UUID(as_uuid=True), ForeignKey("components.id"), nullable=False)
    alert_type = Column(String(100), nullable=False)  # "single_maintainer", "low_diversity", "poor_docs", "critical_undocumented"
    severity = Column(Float, nullable=False, default=0.0)  # 0-1
    primary_developer = Column(String(200), nullable=True)
    primary_developer_share = Column(Float, nullable=True)
    contributor_count = Column(Integer, nullable=False, default=0)
    doc_coverage = Column(Float, nullable=False, default=0.0)
    risk_score = Column(Float, nullable=False, default=0.0)
    explanation = Column(Text, nullable=False, default="")
    recommendation = Column(Text, nullable=False, default="")
    signals = Column(JSONB, nullable=False, default={})
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ProjectAsset(Base):
    """Indexed project documentation assets from cloud storage."""
    __tablename__ = "project_assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    name = Column(String(500), nullable=False)
    file_type = Column(String(100), nullable=False)  # "pdf", "docx", "sheet", "diagram", etc.
    platform = Column(String(100), nullable=False)  # "google_drive", "onedrive", "local", "demo"
    url = Column(String(2000), nullable=True)
    owner = Column(String(200), nullable=True)
    last_modified = Column(DateTime, nullable=True)
    relevance_score = Column(Float, nullable=False, default=0.5)
    category = Column(String(100), nullable=False, default="general")  # "architecture", "api_docs", "requirements", etc.
    is_selected = Column(Boolean, nullable=False, default=False)
    is_demo = Column(Boolean, nullable=False, default=False)
    metadata = Column(JSONB, nullable=False, default={})
    created_at = Column(DateTime, default=datetime.utcnow)