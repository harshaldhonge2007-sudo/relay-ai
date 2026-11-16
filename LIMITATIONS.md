# RELAY AI — System Boundaries, Limitations & Operational Realities

**Document Version:** 1.0.0-round3  
**Date:** November 15, 2026  
**Git Commit SHA:** `a75bcc9`  
**In-App Reference:** Available directly in the application at `/limits` and in [docs/LIMITATIONS.md](file:///Users/harshaldhonge/Documents/CodersInPune/relay/docs/LIMITATIONS.md).  

---

## 1. Real vs. Simulated Matrix

To maintain total transparency with evaluators, judges, and prospective engineering leads, the table below documents the exact operational state of every platform subsystem:

| Capability / Subsystem | Operational State | Real Engine Implementation | Simulated / Synthetic Scope | Production Path Required |
| :--- | :---: | :--- | :--- | :--- |
| **Role-Based Access Control (RBAC)** | **REAL** | Enforced at database query layer in `app/security/acl.py` deriving permissions solely from signed HMAC-SHA256 bearer tokens. Unauthorized direct ID lookups return `404 Not Found`. | None. Permissions are real server-side checks. | Swap demo token signer with enterprise OIDC/SAML provider. |
| **Per-Source ACL Tuning** | **REAL** | `PATCH /cases/{id}/sources/{name}/acl` updates permissions, forces immediate derived view cascade, writes audit logs, and creates numbered version snapshots post-release. | None. Dynamic cascade is fully implemented. | Ready as-is. |
| **Deterministic Grounding Verifier** | **REAL** | Offline lexical token overlap and exact entity recall (numbers, ticket IDs, env vars, paths, proper nouns). Deterministically downgrades unevidenced sentences to `UNKNOWN` or `INFERRED`. | None. Runs offline with zero external network or LLM calls. | Ready as-is. |
| **Layered LLM Entailment Verifier** | **REAL** | Ambiguous grounding scores `[0.35, 0.75)` delegate to LLM with XML delimiters. LLM errors/timeouts safely default to deterministic scores; LLM can never upgrade `UNKNOWN`. | Runs in `mock` mode by default for zero-cost offline reproduction; live Gemini API enabled via `LLM_PROVIDER=gemini`. | Register production Gemini API key or private hosted Ollama/vLLM endpoint. |
| **Live GitHub Ingestion** | **REAL** | Native `aiohttp` client supporting rate-limit backoff, ETag HTTP 304 caching, CODEOWNERS discovery, and PR review graph extraction. Read-only (GET only). | When offline or in demo mode, connector falls back to pre-indexed fixture files explicitly labeled `"CACHED FIXTURES — offline fallback"`. | Provide GitHub App credentials with read-only repository permissions. |
| **Slack & Jira Ingestion** | **SYNTHETIC** | Parsing pipelines, schema normalizers, and cross-source contradiction engines are real code. | Data feeds are pre-indexed fixtures in `seed/` representing the "ShopLedger — Priya Nair" departure scenario. | Register live Slack App with `channels:history` and Jira Cloud API token. |
| **Authentication & Sessions** | **DEMO AUTH** | Real cryptographic HMAC-SHA256 bearer tokens with validity timestamps and signature verification. | Hardcoded demo accounts (`Alex Chen (Lead)`, `Jordan Taylor (Successor)`, `Sam Rodriguez (Contractor)`). | Connect Okta, Google Workspace, or Microsoft Entra ID via OAuth2/OIDC. |
| **Cryptographic Handover Receipt** | **REAL** | Successor acknowledgement produces a verifiable HMAC-SHA256 signature binding case ID, released version, ISO timestamp, and recipient identity. Verified via `GET /cases/{id}/handover/receipt/verify`. | Signed with local demo secret (`RELAY_TOKEN_SECRET`). | Store receipt signatures in immutable append-only ledger or KMS. |
| **Onboarding Completeness Simulation** | **REAL (FACTS)** | Autonomous blind agent parses handover text, compares against deterministically extracted required facts, and scores coverage. Fix loop lifts score from 71% to 96%. | The agent verifies required fact presence in documentation; it does not clone source code into an isolated Docker container to execute `npm run build`. | Spin up ephemeral sandbox microVMs (e.g. Firecracker/Fly Machines) for execution checks. |
| **Secrets Sanitizer** | **REAL (REGEX)** | Automated pattern-based regex scrubbers mask Stripe keys, AWS tokens, JWTs, and database URIs at ingest and read time. | Non-standard token formats lacking known prefixes or high entropy in arbitrary strings may not be caught by static regexes alone. | Augment with ML-based entity scrubbers (e.g. Microsoft Presidio) and Shannon entropy detectors. |

---

## 2. Reconciled Architectural Design Decisions

### 2.1 Dual Half-Life Models: 365 Days vs. 180 Days
RELAY AI intentionally utilizes two distinct half-life decay constants for different analytical horizons:
1. **General Knowledge Authorship (`risk/knowledge.py` — 365-Day Half-Life):**
   - Purpose: Evaluates long-term, multi-year organizational familiarity and conceptual ownership.
   - Half-Life: 12 months (365 days).
   - Rationale: An engineer who designed and authored a service 18 months ago still retains significant conceptual architecture memory, even if they have not committed code recently.
2. **Defensible Bus-Factor Line Survival (`risk/busfactor.py` — 180-Day Half-Life):**
   - Purpose: Evaluates active, immediate operational readiness and line survival in the current git HEAD.
   - Half-Life: 6 months (180 days).
   - Rationale: Code changes rapidly. Subsystems where the primary author has not committed or reviewed PRs in the last 6 months present acute operational fragility because active code has evolved under others or drifted from the author's mental model.

---

## 3. Honest Limitations & Non-Goals

1. **Backtest Case Study Scope**: The historical departure backtest ($n=8\text{ repositories}, 52\text{ components}$) represents defensible historical case studies, not a statistically significant sample of all software engineering populations worldwide.
2. **Degraded Lift Edge Cases**: When a single author writes >85% of lines across an entire repository (e.g. TJ Holowaychuk in early `expressjs`), raw commit count ties with our multi-signal model. The multi-signal model delivers its primary advantage in collaborative repositories with turnover.
3. **Static Fact Verification vs Dynamic Sandboxing**: The completeness test verifies the presence of necessary technical facts in documentation; it does not compile or build code in an isolated container.
4. **Heuristic Risk Model**: Knowledge-loss risk is a heuristic prioritization formula based on literature findings (degree-of-authorship), not an actuarial probability.
5. **Regex Redaction Bounds**: Ingest-time secret scrubbing targets known industry shapes (AWS keys, Stripe keys, GitHub PATs). Non-standard internal tokens lacking distinct prefixes require custom organizational patterns.
6. **Explicit Non-Goals**: RELAY AI is an offboarding and handover continuity tool. It is **not** an employee monitoring system, surveillance tool, or automated code-sync bot.
