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

export interface HandoverDiffEntry {
  claim_id: string
  section: string
  change_type: 'modified' | 'unchanged' | 'added' | 'removed'
  v1: {
    status?: string
    text?: string
  } | null
  v2: {
    status?: string
    text?: string
  } | null
}

export interface HandoverDiffResponse {
  v1: number
  v2: number
  v1_meta: { author: string; timestamp: string; summary: string; is_released?: boolean }
  v2_meta: { author: string; timestamp: string; summary: string; is_released?: boolean }
  diff: HandoverDiffEntry[]
  summary: string
}
