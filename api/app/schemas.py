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


class CaseSchema(BaseModel):
    id: uuid.UUID
    name: str
    repo_url: str
    leaver_person_id: Optional[uuid.UUID] = None
    status: str
    source_modes: Dict[str, str]
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
    created_at: datetime
    completed_at: Optional[datetime] = None
    result: Optional[Dict[str, Any]] = None
