from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import uuid


class SourceModeEnum(str, Enum):
    LIVE = "live"
    FIXTURE = "fixture"
    REPLAY = "replay"


class ProvenanceEnum(str, Enum):
    INFERRED = "inferred"
    STATED = "stated"
    VERIFIED = "verified"


class PersonIdentity(BaseModel):
    source: str
    id: str
    email: Optional[str] = None
    handle: Optional[str] = None


class PersonSchema(BaseModel):
    id: uuid.UUID
    display_name: str
    identities: List[PersonIdentity]
    is_leaver: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PersonCreateSchema(BaseModel):
    display_name: str
    identities: List[PersonIdentity] = Field(default_factory=list)
    is_leaver: bool = False


class ArtifactSchema(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    source: str
    source_mode: SourceModeEnum
    type: str
    external_id: str
    author_id: Optional[uuid.UUID] = None
    occurred_at: datetime
    url: Optional[str] = None
    title: Optional[str] = None
    body: Optional[str] = None
    raw: Dict[str, Any]
    acl_tag: str
    quarantine_status: Optional[str] = "active"
    quarantine_reasons: Optional[List[str]] = Field(default_factory=list)
    original_body: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LinkSchema(BaseModel):
    id: uuid.UUID
    src_id: uuid.UUID
    dst_id: uuid.UUID
    link_type: str
    method: str
    confidence: float
    created_at: datetime

    class Config:
        from_attributes = True


class ComponentSchema(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    name: str
    path_globs: str
    criticality: float
    created_at: datetime

    class Config:
        from_attributes = True


class KnowledgeScoreSchema(BaseModel):
    id: uuid.UUID
    component_id: uuid.UUID
    person_id: uuid.UUID
    score: float
    breakdown: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True


class FindingSchema(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    kind: str
    severity: float
    confidence: float
    title: str
    summary: str
    evidence: List[Dict[str, Any]]
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InterviewQuestionSchema(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    finding_id: Optional[uuid.UUID] = None
    text: str
    evidence: List[Dict[str, Any]]
    priority: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class InterviewAnswerSchema(BaseModel):
    id: uuid.UUID
    question_id: uuid.UUID
    text: str
    answered_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class HandoverItemSchema(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    section: str
    text: str
    evidence_ids: List[uuid.UUID]
    provenance: ProvenanceEnum
    confidence: float
    created_at: datetime

    class Config:
        from_attributes = True


class CaseCreateSchema(BaseModel):
    name: str
    repo_url: str
    leaver_person_id: Optional[uuid.UUID] = None
    source_modes: Optional[Dict[str, str]] = None


class CaseFromRepoSchema(BaseModel):
    repo: str
    since_months: int = 6


class CaseSchema(BaseModel):
    id: uuid.UUID
    name: str
    repo_url: str
    leaver_person_id: Optional[uuid.UUID] = None
    status: str
    source_modes: Dict[str, str]
    disclose_withheld_counts: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TimelineEntrySchema(BaseModel):
    artifact_id: uuid.UUID
    type: str
    title: str
    occurred_at: datetime
    author_id: Optional[uuid.UUID] = None
    related: List[Dict[str, Any]]  # Links with their method


class JobStatusSchema(BaseModel):
    id: uuid.UUID
    case_id: uuid.UUID
    status: str
    progress: float


class QuarantineResolveSchema(BaseModel):
    action: str = Field(..., description="'clear', 'redact', or 'confidential'")
    note: Optional[str] = None


class QuarantineBulkResolveSchema(BaseModel):
    action: str = Field(..., description="'clear', 'redact', or 'confidential'")
    artifact_ids: List[str]
    note: Optional[str] = None


class ImportPreviewSchema(BaseModel):
    staging_token: str
    case_id: str
    total_items: int
    item_counts: Dict[str, int]
    date_range: Dict[str, str]
    sample_items: List[Dict[str, Any]]
    detected_people: List[Dict[str, Any]]
    detected_sensitive_items: List[Dict[str, Any]]
    ingest_report: Dict[str, Any]


class ImportCommitSchema(BaseModel):
    staging_token: str
    source_tiers: Dict[str, str] = Field(default_factory=dict, description="Map of source -> visibility level (public, internal, confidential)")


class ImportCommitResultSchema(BaseModel):
    status: str
    committed_items: int
    quarantined_items: int
    sources_added: List[str]
    readiness_score: float


class IdentityConfirmResultSchema(BaseModel):
    status: str
    identity_id: str
    name: str
    confidence: str


class IdentitySplitResultSchema(BaseModel):
    status: str
    identity_id: str
    split_entities: List[Dict[str, Any]]
    busfactor_updated: bool
