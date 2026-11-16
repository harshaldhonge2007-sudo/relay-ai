export interface Case {
  id: string
  name: string
  repo_url: string
  leaver_person_id?: string
  status: string
  source_modes: Record<string, string>
  created_at: string
  updated_at: string
  artifacts?: Artifact[]
}

export interface Artifact {
  id: string
  case_id: string
  source: string
  source_mode: string
  type: string
  external_id: string
  author_id?: string
  occurred_at: string
  url?: string | null
  title?: string
  body?: string | null
  raw: Record<string, any>
  acl_tag?: string
  withheld?: boolean
  created_at: string
}

export interface Finding {
  id: string
  case_id: string
  kind: 'contradiction' | 'inflight' | 'hidden_dependency' | 'undocumented_decision' | string
  severity: number
  confidence: number
  title: string
  summary: string
  evidence: Array<{ artifact_id: string; span?: string; role?: string; withheld?: boolean }>
  status: string
  created_at: string
  updated_at?: string
}

export interface InterviewQuestion {
  id: string
  case_id: string
  finding_id?: string
  text: string
  evidence: any[]
  priority: number
  status: 'draft' | 'answered' | 'unanswered' | string
  answer?: string | null
  answer_provenance?: 'stated' | 'verified' | 'inferred' | string | null
  auto_generated?: boolean
  missing_fact_key?: string
  demo_suggested_answer?: string
  created_at: string
}

export interface ClaimHistoryEntry {
  actor: string
  action: 'approved' | 'rejected' | 'edited' | string
  timestamp: string
  note?: string | null
}

export interface EvidenceDriftMetadata {
  drifted: boolean
  is_stale: boolean
  badge: string
  detected_at: string
  trigger_event?: string
  artifact_id?: string
  external_id?: string
  issue_key?: string
  drift_summary: string
  prior_evidence: string
  current_evidence: string
  diff: string
  resolved?: boolean
  resolved_at?: string
  resolved_by?: string
}

export interface ReReviewQueueItem {
  id: string
  case_id: string
  claim_id: string
  claim_text: string
  section: string
  status: 'pending' | 'resolved' | 'dismissed'
  drift_summary: string
  prior_evidence: string
  current_evidence: string
  diff: string
  suggested_update?: string
  detected_at: string
  resolved_at?: string | null
  resolved_by?: string | null
  resolution_action?: string | null
  resolution_notes?: string | null
  evidence_acl?: {
    visibility: string
    allowed_roles: string[]
  }
}

export interface DriftStatus {
  has_drift: boolean
  stale_claim_count: number
  re_review_pending_count: number
  latest_released_version: number
  acknowledged_version: number | null
  update_available: boolean
  recent_drift_event?: any
}

export interface HandoverItem {
  id: string
  case_id: string
  section: string
  text: string
  evidence_ids: string[]
  provenance: 'inferred' | 'stated' | 'verified'
  confidence: number
  status?: string
  claim_status?: 'pending' | 'approved' | 'rejected' | 'edited'
  history?: ClaimHistoryEntry[]
  rejection_reason?: string | null
  original_text?: string | null
  unsupported_flag?: boolean
  unsupported_reason?: string
  is_stale?: boolean
  evidence_drift?: EvidenceDriftMetadata
  grounding?: {
    score: number
    method: string
    is_grounded: boolean
    provenance: string
    sentences?: Array<{
      sentence: string
      score: number
      is_grounded: boolean
      provenance: string
      reason: string
      missing_entities?: string[]
    }>
    flagged_count?: number
    flagged_reasons?: string[]
  }
  created_at: string
}

export interface RequiredFact {
  kind: string
  key: string
  source: string
  status: 'found' | 'missing' | 'withheld'
  weight?: number
  visibility?: string
}

export interface CompletenessData {
  task: string
  score: number
  mean: number
  spread: number
  runs: number[]
  phase?: string
  required_facts: RequiredFact[]
  blockers: string[]
  grounding_score?: number
  role?: string
  formula?: string
  formula_calc?: string
  unweighted_calc?: string
  is_simulated?: boolean
  simulated_label?: string
}

export interface MissingEvidence {
  key: string
  description: string
  suggested_action: string
}

export interface ConflictItem {
  id: string
  source_a: { artifact_id: string; label: string; span: string }
  source_b: { artifact_id: string; label: string; span: string }
  description: string
  resolution_status: 'open' | 'partially_resolved' | 'resolved'
  resolution_note?: string | null
}

export interface UncertaintyData {
  missing_evidence: MissingEvidence[]
  conflicts: ConflictItem[]
  unanswered_questions: Array<{ question_id: string; text: string }>
}

export interface DecisionItem {
  id: string
  title: string
  summary: string
  rationale: string
  evidence_ids: string[]
  made_by: string
  made_at: string
  provenance: string
}

export interface ContactItem {
  name: string
  role: string
  email: string
  slack: string
  owns: string[]
}

export interface ContinuationTask {
  day: number
  task: string
  owner: string
  status: string
}

export interface ContinuationData {
  first_5_days: ContinuationTask[]
}

export interface HandoverVersionSummary {
  version: number
  author: string
  timestamp: string
  change_summary: string
  is_released: boolean
  claim_count: number
}

export interface HandoverWordDiffToken {
  type: 'equal' | 'delete' | 'insert'
  text: string
}

export interface HandoverDiffEntry {
  claim_id: string
  section: string
  change_type: 'modified' | 'edited' | 'unchanged' | 'added' | 'removed' | 'rejected' | 'downgraded'
  v1: {
    status?: string
    text?: string
    provenance?: string
  } | null
  v2: {
    status?: string
    text?: string
    provenance?: string
  } | null
  word_diff?: HandoverWordDiffToken[]
}

export interface HandoverDiffResponse {
  v1: number
  v2: number
  v1_meta: { author: string; timestamp: string; summary: string; is_released?: boolean }
  v2_meta: { author: string; timestamp: string; summary: string; is_released?: boolean }
  diff: HandoverDiffEntry[]
  summary: string
  audit_log_url?: string
}

export interface RecurringProblem {
  id: string
  title: string
  category: 'code_churn' | 'reopened_bug' | 'repeated_incident' | 'flaky_test'
  description: string
  component: string
  frequency: number
  first_seen: string
  last_seen: string
  sources_corroborated: string[]
  provenance: 'VERIFIED' | 'INFERRED'
  evidence_ids: string[]
  suggested_action: string
}

export interface ComponentContactItem {
  name: string
  handle: string
  role: string
  source: string
  provenance: 'VERIFIED' | 'STATED' | 'INFERRED'
  contact_type: 'internal' | 'external_vendor'
  notes: string
  knowledge_score?: number
}

export interface ComponentContactsGroup {
  component_id?: string
  component_name: string
  has_remaining_owner: boolean
  warning?: string | null
  contacts_count: number
  contacts: ComponentContactItem[]
}
