/**
 * sampleCase.ts
 *
 * Single source of truth for text that appears in both RoleDemo and ProofGrid.
 * All values are derived from the synthetic seed fixtures in seed/.
 * Completeness scores mirror seed/expected_findings.json (initial: 0.52,
 * after_first: 0.71, after_second: 0.87).
 */

export const CASE_NAME = "ShopLedger — Priya Nair Departure";
export const CASE_PERSON = "Priya Nair";
export const CASE_SYSTEM = "ShopLedger";

// ─── Handover items used by RoleDemo ─────────────────────────────────────────

export type Provenance = "verified" | "stated" | "inferred";
export type DemoRole = "lead" | "successor" | "contractor";

export interface HandoverItem {
  id: string;
  text: string;
  provenance: Provenance;
  source: string;
  roles: readonly DemoRole[];
}

/**
 * Evidence from seed/jira.json, seed/slack.json, seed/meetings/.
 * No invented ticket keys or channel names.
 *
 * Channel is C_ENG (seed/slack.json).  "PAY-SEC-001" and "#finance-private"
 * do not appear in the seed fixtures and are excluded.
 */
export const HANDOVER_ITEMS: readonly HandoverItem[] = [
  {
    id: "h-1",
    text: "JWT token still expires after 15 min — SL-234 marked Done but Slack (C_ENG) shows issue persists in production",
    provenance: "stated",
    source: "Slack",
    roles: ["lead", "successor"],
  },
  {
    id: "h-2",
    text: "Currency-code migration (SL-287 Done) reverted same day — foreign-key constraint violation; fixed version not yet deployed",
    provenance: "stated",
    source: "Slack",
    roles: ["lead", "successor"],
  },
  {
    id: "h-3",
    text: "Webhook retry logic (SL-456 In Progress) — exponential backoff, max 5 retries; assigned to Priya Nair",
    provenance: "stated",
    source: "Jira",
    roles: ["lead", "successor", "contractor"],
  },
  {
    id: "h-4",
    text: "PostgreSQL upgrade to v15 (SL-412 To Do) not started — may be blocked by departure",
    provenance: "stated",
    source: "Jira",
    roles: ["lead"],
  },
  {
    id: "h-5",
    text: "REPORT_BUCKET_NAME and SMTP_RELAY_HOST env vars undocumented — required by nightly report job",
    provenance: "inferred",
    source: "Slack",
    roles: ["lead", "successor", "contractor"],
  },
] as const;

// ─── Proof cards used by ProofGrid ───────────────────────────────────────────

export interface ProofCard {
  id: string;
  source: string;
  label: string;
  title: string;
  body: string;
  screen: string;
}

/**
 * Completeness score mirrors seed/expected_findings.json:
 *   initial_completeness_score: 0.52  →  52 %
 *   after_second_answer:        0.87  →  87 %
 */
export const PROOF_CARDS: readonly ProofCard[] = [
  {
    id: "contradiction",
    source: "Cross-source",
    label: "Contradiction",
    title: "SL-234 Done — but C_ENG thread shows issue persists",
    body: "Jira marks JWT expiry fixed on Oct 8; Slack shows timeouts still occurring. Conflict shown, not resolved silently.",
    screen: "findings",
  },
  {
    id: "jira-sl234",
    source: "Jira",
    label: "Ticket",
    title: "SL-234 · Fix JWT token expiry · Status: Done",
    body: "Contradicted by Slack C_ENG thread from same evening. Severity 0.8, confidence 0.85.",
    screen: "findings",
  },
  {
    id: "slack-revert",
    source: "Slack",
    label: "Thread excerpt",
    title: "C_ENG · Migration reverted Oct 14",
    body: "Foreign-key constraint violation in payments table. SL-287 marked Done but Slack shows revert same day.",
    screen: "findings",
  },
  {
    id: "jira-sl456",
    source: "Jira",
    label: "Ticket",
    title: "SL-456 · Webhook retry logic · Status: In Progress",
    body: "Assigned to Priya Nair. Exponential backoff, max 5 retries over 24 h. Risk: blocked by departure.",
    screen: "knowledge",
  },
  {
    id: "retro",
    source: "Meeting notes",
    label: "Retrospective",
    title: "Sprint retro · Oct 2024",
    body: "Webhook retry added after payment failures. Action item owned by Platform team.",
    screen: "knowledge",
  },
  {
    id: "redaction",
    source: "System",
    label: "Redaction summary",
    title: "Secrets redacted before indexing",
    body: "Pattern-based scanner masked AWS keys and DB URLs. Novel formats may be missed — see limitations.",
    screen: "admin",
  },
  {
    id: "diff",
    source: "System",
    label: "Version diff",
    title: "Handover v1 → v2",
    body: "Claim rewritten after lead review; rejected claim omitted from release. Immutable history.",
    screen: "handover",
  },
  {
    id: "completeness",
    source: "System",
    label: "Completeness test",
    title: "Blind-onboarding score: 52 % → 87 %",
    body: "Synthetic illustration. Score = found fact weight ÷ total required weight (52 % → 87 %). Two targeted interview questions closed the gap.",
    screen: "completeness",
  },
] as const;

