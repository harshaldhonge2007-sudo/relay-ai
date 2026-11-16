# RELAY AI — Privacy, Security & Accessibility Architecture

**Document Version:** 1.0.0-round3  
**Date:** November 15, 2026  
**Git Commit SHA:** `a75bcc9`  

This document details the responsible engineering standards, threat mitigation strategies, role-based privacy guarantees, and WCAG 2.1 AA accessibility implementations governing **RELAY AI**.

---

## 1. Privacy Safeguards & Data Governance

### 1.1 Strictly Read-Only Ingestion Scopes
- All connector integrations (GitHub, Slack, Jira, docs) request and utilize **strictly read-only permissions**:
  - GitHub: `repo:read`, `read:org`, `read:user`.
  - Slack: `channels:history`, `groups:history` (public and configured private team channels only).
  - Jira: `read:jira-work`.
- **Private DM Exclusion**: Direct messages (1:1 DMs and multi-party private chats) are excluded by default in connector ingestion logic to respect personal employee boundaries.

### 1.2 Two-Stage Credential Scrubbing (Ingest & Read)
- **Ingest-Time Scrubbing (`api/app/security/redact.py`)**: Commits, PR descriptions, review comments, issue bodies, and meeting transcripts pass through automated regex secret sanitizers before persistence.
- **Read-Time Filtering**: Even if a raw credential is intentionally present in a fixture, the API read layer applies regex redaction to strip:
  - AWS access keys (`AKIA[0-9A-Z]{16}`)
  - Stripe secret tokens (`sk_live_[0-9a-zA-Z]{24}`)
  - GitHub Personal Access Tokens (`ghp_[0-9a-zA-Z]{36}`)
  - JSON Web Tokens (`eyJ[a-zA-Z0-9_\-]+\.eyJ[a-zA-Z0-9_\-]+`)
  - Database connection strings and password patterns
- Scrubbed secrets are replaced with opaque redaction tokens (e.g. `[REDACTED_STRIPE_KEY]`).

### 1.3 Existence Privacy & HTTP 404 Guarantees
- Standard authorization models return `HTTP 403 Forbidden` when a caller requests a resource they lack permission to view. This leaks the **existence** of the sensitive document (allowing malicious actors to enumerate confidential files).
- RELAY AI enforces **strict existence privacy**: direct queries by unauthorized roles (`GET /cases/{id}/artifacts/{art_id}`) return `HTTP 404 Not Found`, completely concealing the presence of confidential records.
- In aggregated timeline views, restricted items appear as opaque notices (`🔒 3 item(s) withheld due to access restrictions`) with zero disclosure of titles, authors, or dates.

### 1.4 Contractor Existence Privacy in Q&A
- When a restricted contractor submits an inquiry regarding a confidential file or canary token (`CANARY_CONF_7f3a`, `CANARY_INT_91bc`), the system provides a neutral abstention:
  > *"Not enough evidence: The leaver's recorded activities do not provide sufficient evidence to answer this question."*
- The response is identical whether the file does not exist or exists with confidential clearance, preventing existence leakage.

---

## 2. Security Architecture & Threat Defense

### 2.1 Cryptographic Token Authentication
- Client authentication relies on **HMAC-SHA256 signed bearer tokens** issued by `/auth/demo-login` and verified by `api/app/security/auth.py`.
- Tokens embed explicit expiration timestamps (`exp`), session IDs (`sid`), and caller roles (`engineering_lead`, `successor`, `contractor`).
- **Header Forgery Resistance**: Client-supplied headers like `X-Relay-Role` are strictly ignored by authentication dependencies.

### 2.2 Hosted Sandbox Isolation (`ScopedDBProxy`)
- In hosted demo environments, concurrent judge sessions are isolated via `ScopedDBProxy` in `api/mock_server.py`.
- Session state is scoped to a unique `session_id` stored in bearer tokens and protected by thread-safe per-session locks with TTL-based automatic eviction, ensuring zero data contamination between simultaneous evaluations.

### 2.3 Prompt Injection Defense & Delimited Sandboxing
- Untrusted user input (claim text, commit messages, Slack quotes) is wrapped in strict XML delimiters (`<claim>`, `<evidence>`) before transmission to the LLM entailment verifier.
- System prompts explicitly direct the model to treat content within these tags as data rather than instructions.
- The autonomous blind successor agent operates in a **strictly read-only sandbox** with zero side-effect tools or network access.

### 2.4 Immutable Audit Logging
- Every administrative and review action is recorded in an append-only audit log:
  - Source ACL changes (`source_acl_update`)
  - Claim edits, approvals, and rejections
  - Handover release events and version snapshotting
  - Successor receipt acknowledgements

---

## 3. Accessibility & Usability (WCAG 2.1 AA)

### 3.1 Strict Monochrome Palette & Contrast Calibration
- RELAY AI adheres to a strict monochrome engineering palette (`#FAFAFA` base, `#0D0D0D` text in light; `#121212` base, `#EDEDED` text in dark).
- Semantic token contrast was calibrated using `scripts/measure_contrast.py`:
  - `--ink-tertiary` calibrated to `#6E6E6E` (Light, 4.89:1) and `#949494` (Dark, 6.18:1).
  - **100% of evaluated pairings (26/26) meet WCAG 2.1 AA standards (≥ 4.5:1)**. Report: [eval/contrast_report.json](file:///Users/harshaldhonge/Documents/CodersInPune/relay/eval/contrast_report.json).

### 3.2 Automated Axe-Core Quality Gates (32 Permutations)
- Evaluated via `vitest-axe` across 4 viewports (390px mobile, 768px tablet, 1024px laptop, 1440px desktop) and 2 themes (Light and Dark) across all primary application screens.
- **Outcome**: **Zero critical violations and zero serious violations** across all 32 combinations. Report: [docs/ACCESSIBILITY.md](file:///Users/harshaldhonge/Documents/CodersInPune/relay/docs/ACCESSIBILITY.md).

### 3.3 Keyboard Navigation & Focus Trapping
- Built custom `useModalFocusTrap` hook ensuring strict Tab and Shift+Tab focus containment within all modal dialogs.
- Supports Escape key dismissal and automatic focus restoration to the trigger button upon closing.
- Interactive controls feature prominent 2px offset focus rings (`focus:ring-2 focus:ring-offset-2`).

### 3.4 Non-Color-Only Status Cues & Provenance Badges
- Statuses and provenance levels do not rely on color alone:
  - `VERIFIED`: Solid border, checkmark icon (`✓`), double outline ring.
  - `STATED`: Solid border, pencil icon (`✎`), neutral background fill.
  - `INFERRED`: Dashed border, approximate icon (`≈`).
  - `UNKNOWN`: Dotted border, question mark icon (`?`), muted fill.
- Diff views utilize explicit `+` / `-` textual prefixes alongside color highlights.
- Full support for `@media (prefers-reduced-motion: reduce)`.
