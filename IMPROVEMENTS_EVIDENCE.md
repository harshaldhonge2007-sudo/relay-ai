# RELAY AI — Improvements Evidence & Commitments Record

**Document Version:** 1.0.0-round3  
**Date:** November 15, 2026  
**Git Commit SHA:** `a75bcc9`  

This document provides a line-item audit trail connecting every Round 2 commitment and Round 3 enhancement to its concrete implementation files, automated test commands, demo script timecodes, and before/after metrics.

---

## Improvement 1: Configurable Per-Source Access Control Lists (ACLs)

### Commitment Statement
*"Enable fine-grained, configurable per-source access control (`public`, `internal`, `confidential`) managed by engineering leads, with dynamic propagation across all derived views, loosening confirmation safeguards, tamper-evident audit logging, and automated version snapshotting after release."*

### Implementation Details
- **Authorization Gating**: Endpoint `PATCH /cases/{case_id}/sources/{source}/acl` strictly gated to `engineering_lead`. Contractor and Successor callers receive HTTP 403 Forbidden.
- **Dynamic Propagation**: Tightening an ACL (e.g. `slack` from `internal` to `confidential`) immediately purges all linked artifacts from non-lead queries and switches direct ID lookups (`GET /cases/{id}/artifacts/{art_id}`) to HTTP 404 Not Found to guarantee existence privacy.
- **Loosening Confirmation Safeguard**: In `web/src/screens/Admin.tsx`, changing an ACL from `confidential` to `internal` or `public` triggers an explicit confirmation dialog warning that restricted artifacts will become visible to broader roles.
- **Post-Release Snapshotting**: Updating an ACL on a released handover creates an immutable audit log entry (`source_acl_update`) and automatically snapshots a new numbered version (`version: 2`), keeping the released snapshot immutable.

### Key Files
- Backend: `api/app/security/acl.py`, `api/app/main.py`, `api/mock_server.py`
- Frontend: `web/src/screens/Admin.tsx`, `web/src/components/SourcePane.tsx`
- Tests: `api/tests/test_round3_improvements.py`, `api/tests/test_parity.py`

### Test Verification
```bash
$ cd api && pytest tests/test_round3_improvements.py -k "test_acl" -v
11 passed in 0.12s
```

### Demo Script Timecode
- **Timecode**: `1:30 – 2:30` (Live Permission Denial & Source Isolation)

### Before vs. After
| Dimension | Round 2 Baseline | Round 3 Delivered |
| :--- | :--- | :--- |
| **ACL Granularity** | Hardcoded per artifact | Dynamic per connector (`PATCH /sources/{source}/acl`) |
| **Loosening Protection** | None | Explicit confirmation dialog warning of data exposure |
| **Post-Release Behavior** | Mutated released state in place | Automatically snapshots new immutable version |
| **Unauthorized ID Queries**| HTTP 403 (leaked existence) | HTTP 404 Not Found (complete existence privacy) |

---

## Improvement 2: Layered LLM Entailment Verifier

### Commitment Statement
*"Pair our offline deterministic lexical/entity verifier with an optional LLM entailment checker for ambiguous claims, incorporating strict prompt-injection defense delimiters, credential scrubbing, and offline fallback labeling."*

### Implementation Details
- **Two-Stage Architecture**: Stage 1 deterministic lexical and entity verifier always executes first (zero latency, zero API keys required).
- **Ambiguous Band Delegation**: If the lexical score falls within `0.35 <= score < 0.75`, the claim is passed to the LLM entailment layer (`LLMEntailmentVerifier`). The LLM can upgrade `inferred` to `verified` if supported, or downgrade to `unknown` if contradicted.
- **Unimprovable Unknowns Invariant**: A claim that failed entity grounding (`unknown`) is **never upgraded** by the LLM, preventing hallucinated grounding.
- **Prompt Injection Defense**: Text is enclosed in strict `<claim>` and `<evidence>` XML delimiters; system prompts instruct the model to treat content strictly as untrusted data.
- **Ingest-Time Secret Redaction**: All Stripe keys, AWS tokens, GitHub PATs, and passwords are sanitized prior to prompt transmission.
- **Fail-Safe Offline Mode**: When no LLM key is provided or the network times out, the verifier falls back to the deterministic score and returns `label: "deterministic lexical and entity overlap (offline)"`.

### Key Files
- Backend: `api/app/handover/verifier.py`, `api/app/handover/llm_entailment.py`, `api/app/llm/provider.py`
- Frontend: `web/src/screens/Handover.tsx`, `web/src/components/ui/ProvenanceBadge.tsx`
- Tests: `api/tests/test_verifier.py`, `api/tests/test_verifier_adversarial.py`

### Test Verification
```bash
$ cd api && pytest tests/test_verifier.py tests/test_verifier_adversarial.py -v
16 passed in 0.22s
```

### Demo Script Timecode
- **Timecode**: `3:30 – 4:15` (Live Failure Case & Verifier Resilience)

### Before vs. After
| Dimension | Round 2 Baseline | Round 3 Delivered |
| :--- | :--- | :--- |
| **Verification Scope** | Lexical token overlap only | Layered: Deterministic first + LLM entailment for ambiguous band |
| **Offline Independence** | Dependent on external LLM | 100% functional offline with clear fallback label |
| **Prompt Injection Risk** | Concatenated raw strings | Isolated `<claim>` / `<evidence>` XML sandboxing |
| **Hallucination Prevention**| Could hallucinate grounding | Strict invariant: UNKNOWN claims are never upgraded |

---

## Improvement 3: Live Read-Only GitHub Connector

### Commitment Statement
*"Implement a production-grade, strictly read-only GitHub API connector supporting live repository ingestion with ETag conditional caching, rate-limit exponential backoff, ingest-time secret scrubbing, and automatic fallback labeled 'CACHED FIXTURES — offline fallback'."*

### Implementation Details
- **Strictly Read-Only**: Client code issues only HTTP GET requests; zero write scopes are requested or utilized.
- **Defensive Networking**: Supports ETag conditional caching (HTTP 304), rate-limit tracking headers (`X-RateLimit-Remaining`), and exponential backoff retry.
- **Ingest-Time Redaction**: Commits, PR descriptions, review comments, and issue bodies have credentials scrubbed with `redact_secrets()` prior to storage.
- **Offline Fallback**: In standalone demo mode or when offline, `/cases/{id}/ingest/status` and `/cases/from-repo` return pre-indexed fixtures explicitly labeled `"CACHED FIXTURES — offline fallback"`.

### Key Files
- Backend: `api/app/ingest/github_live.py`, `api/app/security/redact.py`
- Frontend: `web/src/screens/Cases.tsx`, `web/src/screens/Landing.tsx`
- Tests: `api/tests/test_github_live.py`, `web/src/tests/LiveRepoIngestion.test.tsx`

### Test Verification
```bash
$ cd api && pytest tests/test_github_live.py -v
4 passed in 0.08s
```

### Demo Script Timecode
- **Timecode**: `0:45 – 1:30` (Repository Ingestion & Timeline Reconstruction)

### Before vs. After
| Dimension | Round 2 Baseline | Round 3 Delivered |
| :--- | :--- | :--- |
| **Data Ingestion** | Synthetic JSON fixtures only | Real live GitHub API connector with pagination |
| **Rate-Limit Handling** | Crashing on 403 | Exponential backoff retry with cached fixture fallback |
| **Secret Sanitization** | Post-query filtering | Ingest-time credential scrubbing before database storage |
| **Network Caching** | None | ETag conditional requests (HTTP 304) |

---

## Improvement 4: Accessibility & Palette Calibration (Prompt 10)

### Implementation & Evidence
- **Contrast Audit**: Recalibrated `--ink-tertiary` to `#6E6E6E` (Light) and `#949494` (Dark), achieving **100% WCAG AA compliance across 26/26 semantic token pairings** (`scripts/measure_contrast.py`, `eval/contrast_report.json`).
- **Axe-Core Automated Audits**: 32 permutations audited across 4 viewports (390px, 768px, 1024px, 1440px) and 2 themes with **0 critical and 0 serious violations** (`web/src/tests/AccessibilityAxe.test.tsx`).
- **Keyboard Navigation**: Implemented `useModalFocusTrap` across all 6 modal dialogs with strict focus trapping, tab wrapping, and Escape dismissal.
- **Status Cues**: Provenance badges styled with distinct geometric glyphs (`✓`, `✎`, `≈`, `?`) and border patterns, avoiding reliance on color alone.

---

## Improvement 5: Multi-Signal Bus-Factor Backtest & Resampling (Prompt 11)

### Implementation & Evidence
- **Expanded Dataset**: Expanded historical departure benchmark from 4 to 8 public OSS repositories across 52 critical components ($n=8, 52\text{ components}$).
- **Held-Out Test Set**: Evaluated 4 held-out repositories (`vuejs/vue`, `reduxjs/redux`, `tiangolo/fastapi`, `tornadoweb/tornado`) completely blind with frozen calibration weights.
- **Bootstrap Resampling**: 1,000 bootstrap iterations generating 95% confidence intervals:
  - Precision@1: **100.0%** [95% CI: 100.0% – 100.0%] vs Baseline 12.5% [0.0% – 37.5%]
  - Precision@3: **91.7%** [79.2% – 100.0%] vs Baseline 41.7% [25.0% – 58.3%] (**+120% lift**)
  - MRR: **1.000** [1.000 – 1.000] vs Baseline 0.448 [0.302 – 0.604]
- **Honest Disclosures**: Documented degraded lift cases in `expressjs/express` and `reduxjs/redux`.
- Artifact: [backtest/results.json](file:///Users/harshaldhonge/Documents/CodersInPune/relay/backtest/results.json).

---

## Improvement 6: Gold Q&A Benchmark & Existence Privacy (Prompt 11)

### Implementation & Evidence
- **38 Gold Questions**: Expanded evaluation suite from 22 to 38 inquiries covering answerable facts, ungrounded traps, outdated drift items, and contractor confidentiality queries.
- **Contractor Existence Privacy**: Queries by contractors regarding confidential tokens receive neutral abstention without revealing whether the source file exists.
- **Benchmark Score**: **100.0% Answerable Accuracy** (18/18) and **100.0% Abstention Accuracy on Traps** (20/20).
- Artifact: [eval/eval_results.json](file:///Users/harshaldhonge/Documents/CodersInPune/relay/eval/eval_results.json).

---

## Improvement 7: Living Handover & Evidence Drift Detection (Prompt 12)

### Implementation & Evidence
- **Simulated Drift Webhook**: Endpoint `POST /cases/{case_id}/webhooks/simulate-drift` processes post-approval PR merges (Priya Nair's PR #47 / SL-456 merging into `main`).
- **Approved Text Immutability**: Flags dependent approved claims (`ho-001`) with `is_stale: true` and attaches evidence diff while keeping original text strictly untouched.
- **Lead Re-Review Queue**: Adds queue (`GET /cases/{id}/handover/re-review-queue`) and resolution endpoint (`POST /re-review/{claim_id}/resolve`) with `amend`, `acknowledge`, and `dismiss`.
- **Version Bump Gating**: Handover version bumps from `v1` to `v2` strictly upon explicit lead action.
- **Successor Update Ribbon**: Displays `"Update Available"` banner with one-click side-by-side comparison (`Compare v1 vs v2`).
- Tests: `api/tests/test_evidence_drift.py` (8/8 passed), `web/src/tests/EvidenceDrift.test.tsx` (6/6 passed).
