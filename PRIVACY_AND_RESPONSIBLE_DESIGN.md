# Privacy & Responsible Design Architecture

## Core Philosophy

Engineering offboarding naturally handles high-sensitivity information: internal discussions, confidential architectural debt, credentials, personnel notes, and security incidents. Presenting uncurated automated summaries or exposing raw connected data directly to successors introduces severe privacy, compliance, and operational risks.

RELAY AI is designed around four strict responsible AI principles:
1. **Never Present Assumptions as Verified Truth**: Sentence-level grounding and deterministic verifiers precede any automated synthesis.
2. **Permission-Aware Filtering Enforced at the Data Layer**: Role-based access control and configurable per-source ACLs govern all queries, counts, and search endpoints.
3. **Known Credential Patterns Scrubbed at Ingest & Read**: Automated pattern-based regex scrubbers sanitize standard industry tokens (AWS, Stripe, GitHub, SendGrid, JWT, database URIs, private keys) before database persistence and display, with boundary limitations documented.
4. **Human-in-the-Loop Release Gating**: Critical transitions (claim modifications, releases, ACL loosening) require explicit human confirmation.

---

## 1. Role-Based Access Control (RBAC) & Per-Source ACLs

```mermaid
flowchart TD
    UserReq["Incoming HTTP Request"] --> AuthHdr["Extract Authorization: Bearer <token>"]
    AuthHdr --> TokenVerify{"Verify HMAC-SHA256 Token"}
    
    TokenVerify -->|"Invalid / Tampered"| RejectAuth["401 Unauthorized / Default Role"]
    TokenVerify -->|"engineering_lead"| FullAccess["Full Access: Public, Internal, Confidential"]
    TokenVerify -->|"successor"| SuccessorAccess["Access: Public + Internal Only"]
    TokenVerify -->|"contractor"| PublicAccess["Access: Public Only"]

    FullAccess --> ACLCheck{"Check Source ACL"}
    SuccessorAccess --> ACLCheck
    PublicAccess --> ACLCheck

    ACLCheck -->|"Authorized"| MaskSecrets["Mask Secrets in Output"]
    ACLCheck -->|"Restricted (Direct ID)"| Filter404["Return 404 Not Found (Existence Privacy)"]
    ACLCheck -->|"Restricted (Claim Citation)"| WithheldClaims["Placeholder: 'Withheld: requires [level] access'"]

    WithheldClaims --> MaskSecrets
    MaskSecrets --> Response["JSON Response to Client"]
```

### Configurable Per-Source ACLs (Improvement 1)
- Data sources (GitHub, Slack, Jira, Documentation, Meeting Notes) are assigned granular access levels:
  - `public`: Visible to Engineering Lead, Successor, and Contractor.
  - `internal`: Visible to Engineering Lead and Successor.
  - `confidential`: Visible only to Engineering Lead.
- **Lead-Only Modification**: Only the Engineering Lead can modify source access levels via `PATCH /cases/{case_id}/sources/{source_name}/acl`.
- **Derived View Propagation**: Changing a source's access level immediately propagates across all derived views:
  - Artifacts from that source are re-tagged with the new permission scope.
  - The Contractor's artifact list updates immediately; direct requests to newly restricted artifacts return 404.
  - Handover claims depending on newly restricted evidence switch dynamically to `"Withheld: requires [level] access"`.
  - Simulation readiness scores dynamically re-compute based strictly on the caller's permitted fact set.
- **Loosening Confirmation**: Loosening a source's access level (granting wider visibility) prompts for explicit user confirmation in the UI to prevent accidental exposure of internal data.
- **Release Invalidation**: If the handover was already released, modifying an ACL automatically creates a new numbered version snapshot in the immutable audit log, preserving historical records.

### Existence Privacy (404 on Direct Access) & Withheld Disclosures
When an unauthorized user attempts direct access by ID (`GET /artifacts/{id}`) to a restricted artifact:
- Direct ID access returns 404; aggregate withheld counts are disclosed by design so the successor knows the view is partial.
- Returning **HTTP 404 Not Found** (never HTTP 403 Forbidden) guarantees that an unauthorized user cannot infer whether a sensitive artifact (e.g. finance review or security audit) exists.
- The tension between existence privacy and partial-view awareness is resolved through the per-case setting `disclose_withheld_counts` (default `True`, configurable via `PATCH /cases/{id}/settings`). When enabled, aggregate withheld counts inform successors that items are missing without disclosing IDs, titles, authors, or timestamps; when disabled, withheld counts and notices are fully suppressed for maximum confidentiality.

---

## 2. Secrets & Credential Sanitization

Prior to storing artifacts in the database or displaying them in the user interface, RELAY AI applies automated regular expression pattern scrubbers targeting:
- Stripe Live / Test Secret Keys (`sk_live_...`, `sk_test_...`)
- AWS Access Keys & Secret Keys (`AKIA...`, `AWS_SECRET_ACCESS_KEY=...`)
- SendGrid API Keys (`SG....`)
- JWT Signatures and Bearer Tokens (`eyJ...`)
- GitHub Personal Access Tokens (`ghp_...`, `gho_...`, `github_pat_...`)
- Slack Bot & User Tokens (`xoxb-...`, `xoxp-...`)
- Database Connection Strings (`postgresql://...`, `mysql://...`)
- Private Keys (`-----BEGIN RSA PRIVATE KEY-----`)

### Ingest-Time Scrubbing (Improvement 3)
In the live GitHub connector (`app/ingest/github_live.py`), `redact_secrets()` is invoked on commit messages, PR descriptions, review comments, and issue bodies **before** records are written to the database.

---

## 3. Layered Anti-Hallucination & Grounding Engine (Improvement 2)

```mermaid
flowchart TD
    Claim["Handover Claim + Cited Evidence"] --> Stage1["Stage 1: Deterministic Lexical & Entity Verifier"]
    Stage1 --> DetScore{"Deterministic Grounding Score"}
    
    DetScore -->|"Score >= 0.75"| Verified["VERIFIED (Direct Evidence Support)"]
    DetScore -->|"Score < 0.35"| Unknown["UNKNOWN (Unsupported / Gaps Flagged)"]
    DetScore -->|"0.35 <= Score < 0.75 (Ambiguous)"| Stage2["Stage 2: Layered LLM Entailment Check"]
    
    Stage2 --> PromptSanitize["Sanitize Secrets & Wrap in XML Delimiters"]
    PromptSanitize --> LLMCall{"Query Model (Gemini / Mock)"}
    
    LLMCall -->|"ENTAILED"| Upgrade["Upgrade to VERIFIED (Entailment Confirmed)"]
    LLMCall -->|"CONTRADICTED"| Downgrade["Downgrade to UNKNOWN (Contradiction Found)"]
    LLMCall -->|"Timeout / Garbage / Error"| SafeFallback["Preserve Deterministic Score (Safe Fallback)"]
```

### Deterministic Sentence-Level Verifier (Offline)
- Extracts numbers, percentages, ticket keys (`SL-234`), environment variables, code paths, and proper nouns.
- Evaluates non-stopword lexical token containment and exact domain entity recall against cited evidence.
- Unsupported sentences are downgraded to `INFERRED` or `UNKNOWN` and flagged with specific diagnostic reasons.

### Optional LLM Entailment Layer
- Acts only on ambiguous claims (`0.35 <= score < 0.75`).
- **Prompt Injection Defense**: Claim and evidence texts are strictly wrapped in `<claim>` and `<evidence>` XML delimiters. The system prompt instructs the model to treat content as opaque data.
- **Fail-Safe Operation**: Timeouts, connection errors, or malformed model outputs safely default to the deterministic score. An LLM error can never upgrade an ungrounded claim.

---

## 4. Human-in-the-Loop Release Gating

- **Append-Only Version History**: Every approval, rejection, claim edit, or ACL modification increments the package version and stores a snapshot (author, timestamp, change summary, items).
- **Release Gating**: Engineering leads cannot release a handover document until 100% of claims have been reviewed (approved, edited, or rejected). Unreviewed draft claims block release with HTTP 400.
- **Exclusion of Rejected Claims**: Claims rejected by the lead with a mandatory rejection reason are permanently excluded from the released snapshot.
- **Versioned Receipt Acknowledgement**: Successors acknowledge receipt of the exact released version number.

---

## 5. Accessibility & Responsible UX

- **Monochrome Contrast**: Strict high-contrast monochrome design system (WCAG AA compliant).
- **Reduced Motion**: Full support for `prefers-reduced-motion: reduce`, suppressing animated vignettes, rotating words, and marquee elements.
- **Screen Reader Support**: All provenance badges provide descriptive text (`aria-label="Provenance: VERIFIED. Directly corroborated by git commits..."`) and accessible focus management on drawers and dialogs.
- **Explicit Labeling**: All simulated data, cached fixtures, and offline modes are explicitly labeled in the UI (no false live claims).

---

## 6. Known Limitations

1. **Demo Authentication (not production auth)**: Uses HMAC-SHA256 bearer tokens. The signing secret is loaded from `RELAY_TOKEN_SECRET` env-var; if unset, a random per-process secret is generated (tokens do not survive restarts). Not intended for multi-tenant enterprise SSO.
2. **Regex Redaction Bounds**: Regex pattern matching covers standard token formats; custom or non-standard token formats lacking recognizable prefixes cannot be guaranteed to be caught.
3. **Simulation Scope**: The onboarding simulation evaluates required-fact coverage (tested for the demo scope); it does not clone code to disk or execute terminal shell commands.
4. **Deterministic Lexical Verifier Bounds**: Offline grounding verification evaluates lexical overlap and entity recall. It does not evaluate semantic meaning — it cannot detect a factually incorrect paraphrase that re-uses the same domain entities.
