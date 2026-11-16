# RELAY AI — Final Submission Report

**Round 3 Submission ("The Finish")**  
**Track:** CodersInPune / Autonomous Systems  
**Date:** November 15, 2026  
**Git Commit SHA:** `a75bcc9`  

---

### Team Metadata
- **Team Name:** Null Pointer
- **Institution:** Vishwakarma Institute of Technology, Pune
- **Team Leader:** Harshal Prashant Dhonge (Backend, Ingestion, Security & Verifier)
- **Team Members:**
  - **Harshal Dhonge** — Backend Architecture, Ingestion, Token Security, Grounding Verifier
  - **Parth Jadhav** — AI/ML Pipelines, Structured Outputs, Claim Extraction, Embeddings
  - **Diksha Mann** — Detectors, Bus-Factor Models, Evaluation Benchmark & Test Suites
  - **Huzefa Gandhi** — Frontend Architecture, Strict Monochrome UI, Canvas 2D Engine, Docker

---

## 1. Executive Summary & Problem Statement

### 1.1 The Silent Crisis of Engineering Offboarding
Software organizations operate on tacit knowledge that resides almost exclusively in engineers' minds. When a senior or staff engineer departs, critical context—why a database migration was rolled back, which unmerged PR branch contains an in-flight fix, what undocumented environment variables power a background daemon—departs with them.

Traditional offboarding approaches fail systematically:
1. **Rushed Wiki Handovers**: Written from memory under severe time pressure; unverified, incomplete, and missing edge-case operational details.
2. **Generic HR Questionnaires**: Unanchored to the engineer's actual code contributions, git reverts, or issue tickets.
3. **Passive Code Search**: Answers questions someone already knows to ask, but cannot detect what is unwritten or contradictory.
4. **Accidental Credential Leakage**: Copy-pasting internal credentials, private discussions, or customer IDs into unsecured documents.

### 1.2 The RELAY AI Solution
**RELAY AI** is an evidence-grounded knowledge continuity platform. It connects to read-only project sources (GitHub, Slack, Jira, architecture notes), reconstructs a chronological evidence graph of the leaver's work, detects undocumented gaps and cross-source contradictions with deterministic heuristics, and conducts targeted, evidence-grounded exit interviews.

Crucially, RELAY closes the loop: an autonomous blind agent attempts predefined tasks using **only** the generated handover pack. Deficiencies are scored against repository-derived required facts, and unresolved gaps loop directly back into follow-up questions before the engineer's final day.

---

## 2. Target Users & Stakeholders

| Stakeholder Persona | Core Need in Offboarding | What RELAY AI Delivers |
| :--- | :--- | :--- |
| **Departing Engineer** *(Priya Nair)* | Low-friction handover without authoring wikis from scratch; control over published statements. | ~8 targeted questions citing exact commits/tickets; claim review interface to approve, edit, or reject inferred facts with required rationale. |
| **Incoming Successor** *(Jordan Taylor)* | Clear first-week priorities and verifiable facts they can trust without production surprises. | Task-ordered First 5 Days roadmap, sentence-level provenance badges, cited Q&A, and alert ribbons when newer handover versions are published. |
| **Engineering Lead** *(Alex Chen)* | Visibility into single points of failure, unmerged work, and approval governance. | Component-level Knowledge Loss Radar, contradiction detection, Re-Review Queue for post-release drift, and release gating controls. |
| **Restricted Contractor** *(Sam Rodriguez)* | Clear task context without exposing confidential credentials or private corporate discussions. | Existence privacy: direct queries for confidential resources return HTTP 404 (never 403), strictly isolating internal conversations. |
| **Project Manager & HR** | Predictable project continuity and verifiable audit trails. | Measured completeness score (e.g. 71% &rarr; 96%), tamper-evident HMAC receipts, and append-only audit logging. |

---

## 3. Product Workflow & Closed-Loop Architecture

RELAY AI executes an autonomous five-stage pipeline:

```
[1. CONNECT]         [2. RECONSTRUCT]        [3. DETECT & INTERVIEW]   [4. REVIEW & GATE]      [5. VERIFY & DELIVER]
+---------------+    +---------------+       +---------------------+   +------------------+    +-------------------+
| GitHub Live   |--> | Identity Map  |-----> | Contradiction Rules |-->| Lead Claim Triage|--->| First 5 Days Plan |
| Slack / Jira  |    | Bus-Factor K  |       | Targeted Questions  |   | Required Rationale   | Readiness Test     |
| Secret Scrub  |    | Work Timeline |       | Claim Verification  |   | Version Snapshot |    | Living Drift Mon. |
+---------------+    +---------------+       +---------------------+   +------------------+    +-------------------+
                                                        ^                                                |
                                                        |------------- Missing Facts Loopback -----------|
```

1. **Connect & Scrub**: Read-only ingestion with ETag conditional caching. Ingest-time regex redaction scrubs AWS, Stripe, GitHub PAT, database, and JWT tokens before storage or model exposure.
2. **Reconstruct**: Fuzzy and deterministic cross-platform identity resolution ties git authors, Jira assignees, and Slack handles to canonical contributors. Reconstructs a cited work ledger.
3. **Detect & Interview**: Deterministic scanners identify hidden dependencies (env vars, cron jobs, external endpoints), in-flight branches, and cross-source contradictions (e.g., Jira marked "Done" while Slack logs active production rollback). Generates ~8 evidence-backed interview questions.
4. **Review & Gate**: Engineering leads triage claims (`VERIFIED`, `STATED`, `INFERRED`, `UNKNOWN`). Mandatory rationales are enforced for rejections. Release gating strictly blocks release if unreviewed claims exist.
5. **Verify & Deliver**: Blind successor agent evaluates required facts. Missing facts trigger follow-up questions, lifting completeness from 71% to 96%. Post-release, webhook monitors detect evidence drift, maintaining approved text immutability while queuing lead re-reviews.

---

## 4. Technology Stack & Architectural Decisions

| Layer | Selected Technologies | Technical Rationale |
| :--- | :--- | :--- |
| **Backend API** | Python 3.13, FastAPI, Uvicorn | Async I/O for connector polling, strict Pydantic schemas, Python data-science ecosystem. |
| **Data Layer** | PostgreSQL, pgvector | Single relational store for artifacts, links, scores, and findings; recursive CTEs for graph traversal; hybrid full-text and vector search with SQL-level ACL filtering. |
| **Frontend UI** | React 18, Vite, TypeScript, Tailwind CSS | Zero runtime CSS overhead, accessible component semantics, strict monochrome palette with zero emojis. |
| **Canvas Engine** | HTML5 Canvas 2D (`Float32Array`) | Zero-dependency interactive evidence lattice running at solid 60 FPS behind foreground UI cards. |
| **Grounding Verifier**| Deterministic Lexical/Entity + Optional LLM Entailment | Stage 1 offline deterministic verifier runs with zero external API calls. Ambiguous band `[0.35, 0.75)` delegates to LLM with prompt-injection delimiters. |
| **Security & Auth** | HMAC-SHA256 Bearer Tokens, Secret Sanitizer | Server-signed tokens with expiration; 404 existence privacy on restricted IDs; zero trust in forged headers. |

---

## 5. Measured Impact & Generated Evidence

Every claim in RELAY AI is backed by reproducible automated tests and generated evaluation artifacts:

### 5.1 Bus-Factor Backtest ($n=8\text{ Repositories}, 52\text{ Critical Components}$)
We extended our historical departure evaluation from 4 to 8 public open-source repositories across 52 components, enforcing strict temporal pre-departure isolation and blind held-out evaluation:
- **Dev Tuning Set ($n=4, 25\text{ components}$)**: `pallets/flask`, `psf/requests`, `expressjs/express`, `encode/starlette` (weights calibrated to 40% churn, 30% lines, 15% recency, 15% reviews; 180-day half-life).
- **Held-Out Test Set ($n=4, 27\text{ components}$)**: `vuejs/vue`, `reduxjs/redux`, `tiangolo/fastapi`, `tornadoweb/tornado` (evaluated blind with frozen calibration weights).
- **Bootstrap Resampling (1,000 iterations, 95% Confidence Intervals)**:
  - **Overall ($n=8$)**: Precision@1 = **100.0%** [95% CI: 100.0% – 100.0%] vs Naive Commits 12.5% [0.0% – 37.5%]; Precision@3 = **91.7%** [79.2% – 100.0%] vs Baseline 41.7% [25.0% – 58.3%] (**+120% lift**); MRR = **1.000** vs 0.448.
  - **Held-Out Test Set ($n=4$)**: Precision@3 = **100.0%** [100.0% – 100.0%] vs Baseline 33.3% (**+200% lift**); MRR = **1.000** vs 0.389.
  - Artifact: [backtest/results.json](file:///Users/harshaldhonge/Documents/CodersInPune/relay/backtest/results.json) (stamped with Git SHA `a75bcc9`).

### 5.2 Q&A Grounding Benchmark & Contractor Existence Privacy (38 Gold Inquiries)
- **38 Gold Questions**: Evaluated across answerable inquiries, adversarial ungrounded traps, outdated drift items, and contractor confidentiality queries.
- **Contractor Existence Privacy**: Queries by contractors asking about confidential canaries (`CANARY_CONF_7f3a`) or internal secrets (`CANARY_INT_91bc`) receive neutral abstention without revealing whether the file exists.
- **Score**: **100.0% Answerable Accuracy** (18/18) and **100.0% Abstention Accuracy on Traps** (20/20).
- Artifact: [eval/eval_results.json](file:///Users/harshaldhonge/Documents/CodersInPune/relay/eval/eval_results.json).

### 5.3 Permission Canary Leak Audit (Zero Data Leaks Across 41 Routes)
- Automated audit runner probed **41 API routes across 3 roles (135 HTTP calls)**.
- Injected canaries: `CANARY_CONF_7f3a` (confidential) and `CANARY_INT_91bc` (internal).
- **Result**: **0 leaks detected** across all roles and derived views.
- Artifact: [eval/leak_test_report.json](file:///Users/harshaldhonge/Documents/CodersInPune/relay/eval/leak_test_report.json).

### 5.4 WCAG 2.1 AA Palette Contrast Audit (26/26 Pairings Passing)
- Deterministic luminance analysis across Light (`#FAFAFA`) and Dark (`#121212`) themes.
- Recalibrated `--ink-tertiary` to `#6E6E6E` (Light, 4.89:1) and `#949494` (Dark, 6.18:1).
- **Result**: **26 out of 26 evaluated semantic token pairings (100%) meet WCAG AA standards**.
- Artifact: [eval/contrast_report.json](file:///Users/harshaldhonge/Documents/CodersInPune/relay/eval/contrast_report.json).

### 5.5 Accessibility & Quality Gates (32 Viewport/Theme Permutations)
- Automated `@axe-core/react` / `vitest-axe` test matrix across 4 viewports (390px, 768px, 1024px, 1440px) and 2 themes.
- **Result**: **0 critical violations and 0 serious violations** across all 32 combinations.
- Artifact: [docs/ACCESSIBILITY.md](file:///Users/harshaldhonge/Documents/CodersInPune/relay/docs/ACCESSIBILITY.md).

### 5.6 Living Handover & Evidence Drift Detection
- Ingested GitHub PR merge webhook (PR #47 / SL-456 merging into `main`).
- System flagged dependent approved claim `ho-001` with `is_stale: true`, showed the unified evidence diff, preserved approved text untouched, and populated the Lead Re-Review Queue.
- Lead amendment bumped version from `v1` to `v2`, rendering an "Update Available" ribbon for successors.

---

## 6. Honest Limitations & Non-Goals

1. **Case Study Scope**: The backtest ($n=8\text{ repositories}, 52\text{ components}$) represents defensible historical case studies, not a statistically significant sample of all software engineering populations worldwide.
2. **Degraded Lift Edge Cases**: When a single author writes >85% of lines across an entire repository (e.g. TJ Holowaychuk in early `expressjs`), raw commit count ties with our multi-signal model. The multi-signal model delivers its primary advantage in collaborative repositories with turnover.
3. **Regex Redaction Bounds**: Ingest-time secret scrubbing targets known industry shapes (AWS keys, Stripe keys, GitHub PATs). Non-standard internal tokens lacking distinct prefixes require custom organizational patterns.
4. **Heuristic Risk Model**: Knowledge-loss risk is a heuristic prioritization formula based on literature findings (degree-of-authorship), not an actuarial probability.
5. **Static Required Facts vs Dynamic Sandboxing**: The completeness test verifies the presence of necessary technical facts; it does not compile or build code in an isolated container.
6. **Explicit Non-Goals**: RELAY AI is an offboarding and handover continuity tool. It is **not** an employee monitoring system, surveillance tool, or automated code-sync bot.

---

## 7. Verification Certificate

```
======================================================================
RELAY AI — FINAL RELEASE VERIFICATION CERTIFICATE
Git Commit SHA: a75bcc9 | Timestamp: 2026-11-15T12:16:44Z
======================================================================
1. Backend Tests (pytest):      396 PASSED, 2 skipped, 0 failed (1.26s)
2. Frontend Tests (vitest):     110 PASSED across 16 test suites (3.28s)
3. TypeScript (tsc --noEmit):   0 ERRORS
4. Production Build (vite):     BUILT CLEANLY (884ms)
5. Route & Auth Parity:         140/140 ASSERTIONS PASSED (0.39s)
6. Canary Leak Audit:           0 LEAKS across 41 routes (135 calls)
7. Contrast Compliance:         26/26 PAIRINGS PASS WCAG AA (100%)
8. Axe-Core Accessibility:      0 CRITICAL / 0 SERIOUS (32 permutations)
9. Offline Independence:        FULLY AUTONOMOUS (0 external API keys required)
======================================================================
```
