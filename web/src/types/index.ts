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
  url?: string
  title?: string
  body?: string
  raw: Record<string, any>
  acl_tag: string
  created_at: string
}

export interface Finding {
  id: string
  case_id: string
  kind: string
  severity: number
  confidence: number
  title: string
  summary: string
  evidence: Array<{ artifact_id: string; span?: string; role?: string }>
  status: string
  created_at: string
  updated_at: string
}

export interface InterviewQuestion {
  id: string
  case_id: string
  finding_id?: string
  text: string
  evidence: any[]
  priority: number
  status: string
  created_at: string
}

export interface HandoverItem {
  id: string
  case_id: string
  section: string
  text: string
  evidence_ids: string[]
  provenance: string
  confidence: number
  created_at: string
}
