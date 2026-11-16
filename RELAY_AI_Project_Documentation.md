# RELAY AI — Comprehensive Project Documentation

**Tagline:** Your project’s knowledge shouldn’t leave when your people do.  
**Subtitle:** An evidence-backed knowledge continuity platform for employee transitions  
**Document Version:** 3.0.0 (Round 3 — "The Finish")  
**Date:** November 16, 2026  
**Git Commit SHA:** `a75bcc9`  

---

### Project & Team Metadata

| Field | Details |
| :--- | :--- |
| **TEAM NAME** | **Null Pointer** |
| **INSTITUTION** | **Vishwakarma Institute of Technology (VIT), Pune** |
| **TEAM LEADER** | **Harshal Prashant Dhonge** (Lead — Backend, Ingestion, Security & Verifier) |
| **SUBMITTED BY** | **Harshal Dhonge, Parth Jadhav, Diksha Mann, Huzefa Gandhi** |
| **REPOSITORY** | `https://github.com/harshaldhonge2007-sudo/relay-ai` |
| **EVALUATION MODE** | Standalone Offline Demo: `./start_demo.sh --reset` (`http://localhost:5173`) |
| **TEST STATUS** | **396 passed backend tests (pytest -q)** in 1.25s; **140 parity assertions**; **110 passed Vitest tests** across 16 suites; **0 canary leaks across 41 routes** |

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Understanding the Problem Statement](#2-understanding-the-problem-statement)
3. [Specific Problem Statement](#3-specific-problem-statement)
4. [Target Users and Stakeholders](#4-target-users-and-stakeholders)
5. [Proposed Solution](#5-proposed-solution)
6. [Complete Product Workflow](#6-complete-product-workflow)
7. [Features and Innovation](#7-features-and-innovation)
8. [Competitive Differentiation](#8-competitive-differentiation)
9. [Technical Architecture](#9-technical-architecture)
10. [Technology Stack and Justification](#10-technology-stack-and-justification)
11. [Technical Challenges and Mitigation](#11-technical-challenges-and-mitigation)
12. [Team Member Responsibilities](#12-team-member-responsibilities)
13. [Three-Round Development Roadmap](#13-three-round-development-roadmap)
14. [Expected Impact & Empirical Results](#14-expected-impact--empirical-results)
15. [Future Scope & Production Roadmap](#15-future-scope--production-roadmap)
16. [References](#16-references)

---

## 1. Executive Summary

When a software developer departs an organization, the critical context needed to maintain and continue their work almost never leaves in documentation. It is scattered across commits, pull requests, issue tickets, and team chat threads—and a substantial portion was never written down at all: why a database migration was reverted, which unlogged cron daemon keeps a service operational, what was left half-finished on an unmerged branch.

**RELAY AI** is an evidence-backed knowledge continuity platform. It reconstructs what a departing engineer contributed from linked cross-platform project evidence (GitHub, Slack, Jira, architecture notes), detects undocumented single points of failure, hidden dependencies, and cross-source contradictions, and interviews the departing employee on those exact gaps.

From their responses, it compiles a structured handover in which every statement carries a sentence-level provenance label (`VERIFIED`, `STATED`, `INFERRED`, `UNKNOWN`) and direct evidence citations. 

To prove that the handover is sufficient for a newcomer, an autonomous blind agent attempts defined onboarding tasks using **only** the handover pack, scoring completeness against repository-derived required facts. Whatever the agent fails to recover loops directly back into follow-up questions before the engineer's final day.

### The Closed Feedback Loop:
$$\text{Detect Gaps} \longrightarrow \text{Interview Leaver} \longrightarrow \text{Generate Handover} \longrightarrow \text{Test Completeness} \longrightarrow \text{Identify Blockers} \longrightarrow \text{Targeted Follow-Ups} \longrightarrow \text{Re-Test}$$

1. **Evidence-Grounded Interviews**: Questions derive from deterministic gap detectors (reverts, unresolved issues, undocumented decisions) rather than generic questionnaires.
2. **Measurable Completeness Tests**: Blind agent scored against ground-truth required facts extracted objectively from the repository (e.g. 71% &rarr; 96% readiness lift).
3. **Provenance-Labelled Living Handover**: Every claim is cited, role-gated by permissions, exportable to a publication-grade signed PDF, and kept alive post-release via real-time GitHub webhook drift monitors.

---

## 2. Understanding the Problem Statement

Software engineering organizations rely heavily on tacit knowledge stored in individual developers' minds. Transitions (resignations, reassignments, sudden departures) expose this vulnerability when it is too late to remediate. The issue is not a lack of data—the digital footprints exist in repositories, issue trackers, and team chats. The problem is that no system connects the fragments, identifies what is missing, or verifies that a successor could actually execute based on what was captured.

| Operational Dimension | Real-World Failure Mode | Engineering Consequence |
| :--- | :--- | :--- |
| **Knowledge Silos** | A single engineer becomes the sole maintainer of an authentication service, payment webhook, or deployment pipeline. | Review, backup, and on-call escalation paths quietly collapse onto that individual. |
| **High Truck-Factor Risk** | Authorship and architectural decisions concentrate in a few people. Studies show 46% of popular GitHub projects have a truck factor of 1, and 28% have a truck factor of 2 [R9]. | A single departure can stall an entire product line or module. |
| **Undocumented Rationale** | Design rationale is dispersed across PR comments, issue logs, and Slack threads [R14], resisting automated extraction [R13]. | Successors repeat previously abandoned dead-ends or unknowingly revert deliberate architecture choices. |
| **Scattered & Disagreeing Tools** | Code is in GitHub, status is in Jira, discussion is in Slack, and guides are in wikis—and they frequently contradict each other. | Engineers cannot determine what is truly complete, what is in-flight, and what is currently broken in production. |
| **Hidden Tribal Memory** | Critical environment variables, secrets, external SaaS dependencies, and migration orderings exist only in the leaver’s head. | Successors discover dependencies through production outages. |
| **Incomplete & Unverified Handovers** | Handover documents are written in haste from memory under two-week notice pressure. | Silent omissions surface weeks after the engineer has permanently departed. |

> **Key Insight:** Knowledge loss has two layers: (1) knowledge that exists across fragmented tools, and (2) knowledge that exists only in a human mind. Search tools address only the first. Conventional interview tools address only the second. Neither identifies what is proven to be missing, and neither verifies whether the resulting handover is sufficient for someone else to take over.

---

## 3. Specific Problem Statement

> **Problem Addressed:** When a developer leaves, existing engineering ecosystems lack a systematic mechanism to:  
> **(a)** Identify from project evidence which aspects of their work are undocumented, high-risk, or contradictory,  
> **(b)** Elicit that specific tacit knowledge before their departure date, and  
> **(c)** Objectively verify that the resulting handover is sufficient for a successor to continue the work without production failures.

### Why Traditional Approaches Fall Short:
- **Manual Handover Wikis**: Written from memory under severe time pressure. The departing engineer cannot anticipate what context a successor will lack, and no mechanism verifies the output.
- **Generic Exit Questionnaires**: Not anchored to the developer's specific code, reverts, or tickets; misses undocumented migrations, reverted PRs, and open operational issues.
- **Wikis & Notion Pages**: Static documentation goes stale rapidly, omits in-flight work, and rarely covers runtime configuration stored in code.
- **AI Search / Enterprise Chat Assistants**: Rely on a user knowing what questions to ask; incapable of detecting unwritten gaps or verifying handover completeness.
- **Static Code Authorship Metrics**: Measures commit volume rather than review depth, discussion context, or whether knowledge was ever transferred.

---

## 4. Target Users and Stakeholders

```
+---------------------------------------------------------------------------------------+
|                               RELAY AI STAKEHOLDER MATRIX                             |
+---------------------------------------------------------------------------------------+
|  [Departing Engineer]   --> Targeted questions, review, claim approval / rejection    |
|  [Incoming Successor]   --> Task-ordered First 5 Days roadmap, cited Q&A, drift alerts |
|  [Engineering Lead]     --> Knowledge Loss Radar, contradiction review, release gates |
|  [Project Manager]      --> In-flight work ledger, completeness score, audit trails   |
|  [Restricted Contractor]--> Existence privacy (404 on confidential resources)         |
|  [Organization / HR]    --> Institutional continuity, reduced key-person dependency   |
+---------------------------------------------------------------------------------------+
```

| Stakeholder Persona | Specific Operational Needs | What RELAY AI Delivers |
| :--- | :--- | :--- |
| **Departing Engineer** *(Priya Nair)* | Low-friction handover without writing documentation from scratch; full governance over what is published. | ~8 targeted interview questions citing exact commits/tickets; claim review interface to edit wording, approve facts, or reject inaccurate claims with required rationales. |
| **Incoming Successor** *(Jordan Taylor)* | Clear Day-1 priorities, verifiable claims, and zero confidential data leakage. | Task-ordered First 5 Days onboarding roadmap, sentence-level provenance badges (`VERIFIED`, `STATED`, `INFERRED`, `UNKNOWN`), cited Q&A, and "Update Available" drift ribbons. |
| **Engineering Lead** *(Alex Chen)* | Visibility into single points of failure, unmerged branches, and approval governance. | Component-level Knowledge Loss Radar, contradiction cards, post-release Re-Review Queue, and release gating controls. |
| **Restricted Contractor** *(Sam Rodriguez)* | Clear task scope without exposure to confidential credentials, internal chat, or severance discussions. | Strict **Existence Privacy**: direct requests for confidential resources return `HTTP 404 Not Found` (never 403), strictly concealing the existence of restricted documents. |
| **Project Manager & HR** | Predictable project continuity and verifiable audit trails. | Measured completeness score (e.g. 71% &rarr; 96%), tamper-evident HMAC receipts, and append-only audit logging. |

---

## 5. Proposed Solution

RELAY AI converts scattered project evidence into structured, verified, and living handover knowledge in three integrated steps:

1. **Evidence into Structure**: Connect read-only project sources, resolve contributor identities across platforms, and link commits, PRs, issue tickets, and Slack discussions into a unified evidence graph and personal work ledger.
2. **Structure into Questions**: Deterministic scanners detect single points of failure, hidden dependencies, in-flight work, and cross-source contradictions. Detected gaps automatically synthesize ~8 targeted interview questions citing the trigger evidence.
3. **Answers into Verified Knowledge**: Leaver answers are stored as `human-stated` claims, grounded against repository evidence, compiled into an evidence-linked handover pack, and tested by an autonomous blind agent. Deficiencies loop back into follow-up questions before the engineer departs.

---

## 6. Complete Product Workflow

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

| Step | Stage Name | Technical Method | Description |
| :---: | :--- | :--- | :--- |
| **1** | **Connect Sources** | Read-only OAuth | Connects GitHub, Slack, and Jira using read-only scopes. Direct messages are excluded by default. |
| **2** | **Extract & Scrub** | Ingest Sanitizer | Normalizes commits, PRs, issues, messages, and docs into typed artifacts. Regex sanitizers scrub AWS, Stripe, GitHub, and JWT keys before storage. |
| **3** | **Resolve Identities** | Fuzzy Matching & Overrides | Normalizes git emails, Slack handles, and Jira usernames to canonical individuals. |
| **4** | **Link Evidence** | Deterministic + Embeddings | Links artifacts via Jira keys, commit hashes, `#refs`, URLs, and semantic thread embeddings. |
| **5** | **Reconstruct Timeline**| Deterministic Ledger | Chronological ledger of leaver's completed work, in-flight PRs, reverts, and architectural decisions. |
| **6** | **Calculate Risk** | 180-Day Survival Model | Heuristic score: $\text{Risk} = \text{Crit} \times L \times (1 - B) \times (1 - 0.6D)$ identifying unbacked modules. |
| **7** | **Detect Findings** | Deterministic Rules | Detects contradictions (Jira Done vs Slack rollback), hidden env vars, cron daemons, and unmerged branches. |
| **8** | **Generate Questions** | Evidence-Anchored LLM | Synthesizes ~8 targeted questions citing specific commits and tickets where knowledge is undocumented. |
| **9** | **Capture & Ground** | Two-Stage Verifier | Captures leaver answers; verifies claims against repository facts using deterministic overlap and ambiguous-band LLM entailment. |
| **10** | **Compile Handover** | Provenance Renderer | Compiles structured pack with sentence-level provenance badges (`VERIFIED`, `STATED`, `INFERRED`, `UNKNOWN`). |
| **11** | **Completeness Test**| Autonomous Blind Agent | Blind agent attempts onboarding tasks using only the pack, scored against repository-derived ground-truth facts. |
| **12** | **Feedback Loopback**| Closed Loop | Missing facts and blockers automatically generate follow-up questions; pack is re-compiled and re-tested (e.g. 71% &rarr; 96%). |

---

## 7. Features and Innovation

### Feature 1 | Evidence-Linked Project Memory Reconstruction
* **What it does**: Reconstructs an engineer's complete work history from linked evidence across GitHub, Jira, Slack, and architecture notes.
* **How it works**: Deterministic key matching first (Jira keys, PR `#refs`, commit SHAs), followed by semantic embeddings for unreferenced discussion threads.
* **Practical value**: Gives managers and incoming successors a cited, tamper-evident ledger of everything the leaver completed, reverted, and left open.

### Feature 2 | Knowledge Loss Radar (Bus-Factor Modeling)
* **What it does**: Identifies components that lean precariously on the departing engineer, incorporating contribution volume, review graphs, discussion activity, and documentation coverage.
* **Formula**: $\text{Risk} = \text{Crit} \times L \times (1 - B) \times (1 - 0.6 \times D)$
  * $\text{Crit}$: Dependency-graph centrality of the component.
  * $L$: Leaver's share of knowledge: $K(x, c) / \sum_d K(d, c)$ (using a 180-day line-survival half-life).
  * $B$: Backup knowledge strength: $\min(1, \text{best remaining } K(d, c) / K(x, c))$.
  * $D$: Documentation coverage (0.0 to 1.0).

### Feature 3 | Evidence-Grounded AI Departure Interviewer
* **What it does**: Formulates personalized interview questions anchored to detected gaps (reverts, abandoned branches, unresolved tickets).
* **How it works**: Gap detectors output candidate anomalies; ranking and de-duplication isolate ~8 high-priority questions citing exact commits/tickets.
* **Practical value**: Replaces generic HR questionnaires with actionable technical questions: *"On Oct 14, you reverted PR #42 modifying the payment webhook retry queue. What broke in staging?"*

### Feature 4 | Hidden Dependency & Contradiction Detection
* **What it does**: Scans code, CI workflows, and Docker configurations against documentation to detect unrecorded environment variables, cron daemons, and cross-source contradictions.
* **Rules**:
  1. *Jira marked "Done" while linked PR is unmerged or closed without merge.*
  2. *Jira marked "Done" while CI test suite is failing on main branch.*
  3. *Production incident language in Slack following a ticket "Done" timestamp.*
* **Invariant**: Contradictions are presented as paired evidence cards for human adjudication; the system **never auto-resolves** factual conflicts.

### Feature 5 | Provenance-Labelled Handover Generation
* **What it does**: Compiles a verified handover pack where every sentence carries a provenance badge:
  * `VERIFIED`: Check mark (`✓`), solid border, verified by deterministic evidence overlap or independent reviewer.
  * `STATED`: Pencil (`✎`), solid border, stated by the departing engineer during the exit interview.
  * `INFERRED`: Approximate (`≈`), dashed border, inferred by the system from cross-source patterns.
  * `UNKNOWN`: Question mark (`?`), dotted border, unevidenced or contradicted claim.

### Feature 6 | Handover Completeness Test (Onboarding Simulation)
* **What it does**: An autonomous blind AI agent attempts predefined onboarding tasks using **only** the generated handover pack (no repository access, no external tools).
* **Scoring Methodology**: Scores the proportion of repository-derived required facts successfully recovered by the agent. Active blockers are mapped directly to missing facts.
* **Measured Lift**: In the ShopLedger reference departure scenario, the completeness test scores **71%** initially, and rises to **96%** after resolving the targeted follow-up questions.

### Feature 7 | Exportable Handover Documentation (Professional PDF Generation)
* **What it does**: Native ReportLab engine (`api/app/export/pdf.py`) compiling the complete handover package into a signed, publication-grade PDF dossier (`GET /cases/{id}/handover/export/pdf`).
* **Why it matters**: Enables final continuation plans to be securely downloaded, officially signed off, archived, or transmitted to executive leadership without requiring a live web application login.
* **Contents**: Branded cover page, executive metadata, table of contents, sentence-level provenance badges, clickable evidence links, First 5 Days roadmap, and HMAC-SHA256 cryptographic receipt verification block.

### Feature 8 | Workspace & Cloud Storage Integration (Automated File Curation)
* **What it does**: Dedicated asset workbench (`/case/:id/assets`) indexing project specs, architecture guides (`ENV_KEYS.md`), runbooks, and spreadsheets.
* **Why it matters**: Departing engineers can selectively curate critical documentation via checkboxes (`POST /cases/{id}/assets/{asset_id}/select`), automatically package them into an organized Google Drive folder (`POST /cases/{id}/assets/create-handover-folder`), and embed the secure folder URL directly into the handover pack.
* **Operational Reality**: Includes an autonomous offline demo mode that simulates folder curation without requiring live Google OAuth tokens during judges' testing.

### Feature 9 | Living Project Memory & Evidence Drift Detection
* **What it does**: A continuous background pipeline using GitHub webhooks (`api/app/webhooks/github.py`) to keep the project's knowledge graph and risk models updated in real time.
* **Proactive Bus-Factor Alerts**: Real-time dashboard (`/case/:id/busfactor`) warning managers of single points of failure *before* an employee resigns.
* **Evidence Drift Monitor (`/case/:id/intelligence`)**:
  * Ingests post-approval events (e.g. Priya Nair's in-flight PR #47 / SL-456 merging into `main`).
  * Flags dependent claims with an amber `Evidence changed since approval` badge and unified diff.
  * **Strict Invariant**: Original approved claim text is **never auto-edited**.
  * Queues items in the **Engineering Lead Re-Review Queue** (`/handover/re-review-queue`), where leads can explicitly amend text and bump version (`v1 -> v2`).
  * Renders an **"Update Available"** ribbon for successors with one-click side-by-side comparison (`Compare v1 vs v2`).

### Feature 10 | Interactive Provenance Grid (Evidence Lattice)
* **What it does**: HTML5 Canvas 2D engine drawing an interactive monochrome evidence lattice behind application cards.
* **How it works**: Zero-dependency `Float32Array` particle system moving nodes with traveling waves, coupling to scroll inertia, and morphing into provenance crosshairs under the cursor within a 155px radius.

---

## 8. Competitive Differentiation

| Capability Area | Existing AI Offboarding (Sensay, Flamekeeper) | Enterprise Knowledge Search (Unblocked, Glean) | Code Bus-Factor Tools (CodeScene) | RELAY AI (Delivered Prototype) |
| :--- | :---: | :---: | :---: | :---: |
| **Questions from Own Code & Tickets** | No (Role-level generic) | No (Search only) | No (No interview) | **YES (~8 gap-derived questions)** |
| **Cross-Source Contradiction Catching**| No | No | No | **YES (Jira vs Slack vs PRs)** |
| **Sentence-Level Provenance Badges** | No | No (Doc-level links) | No | **YES (4 distinct levels)** |
| **Autonomous Blind Completeness Test**| No | No | No | **YES (Closed-loop 71% &rarr; 96%)** |
| **Existence Privacy (404 on Unauthorized)**| No | No (Standard 403) | No | **YES (Conceals resource existence)** |
| **Exportable Cryptographic PDF Dossier**| No | No | No | **YES (ReportLab + HMAC receipt)** |
| **Living Memory & Evidence Drift Webhooks**| No | Partial (Re-indexing) | No | **YES (PR merge drift + lead queue)**|
| **100% Offline Resilient Demo Execution**| No | No | No | **YES (Zero API keys required)** |

---

## 9. Technical Architecture

```
USERS (ROLE-BASED VIEWS)
  ├── Departing Employee (Alex Chen / Priya Nair): Review, edit, approve, reject with reason
  ├── Incoming Successor (Jordan Taylor): Permitted view, First 5 Days, simulation, HMAC receipt
  └── Restricted Contractor (Sam Rodriguez): Public-only view, HTTP 404 on confidential resources

PRESENTATION LAYER | React 18 + Vite + TypeScript + Tailwind CSS
  ├── 17 Application Screens (Handover, Radar, Timeline, Findings, Completeness, Limits, etc.)
  ├── Strict Monochrome Palette (0 emojis, 100% WCAG AA contrast across 26/26 token pairings)
  ├── Accessible Components (useModalFocusTrap, non-color geometric provenance badges)
  └── Interactive Canvas 2D Evidence Lattice (Float32Array, 60 FPS)

API & ORCHESTRATION LAYER | FastAPI (Python 3.13)
  ├── Auth & ACL Engine: Server-signed HMAC-SHA256 bearer tokens, _can_see query filters, 404 existence privacy
  ├── Ingest-Time Secret Sanitizer: Regex scrubbers for AWS, Stripe, GitHub, and JWT credentials
  ├── Two-Stage Grounding Verifier: Deterministic lexical/entity verifier + ambiguous-band LLM entailment
  ├── Handover PDF Generator: Native ReportLab engine with cryptographic sign-off blocks
  └── Webhook Pipeline: Asynchronous GitHub PR merge & push listeners with evidence drift triggers

DATA LAYER | PostgreSQL + pgvector (with ScopedDBProxy in-memory demo fallback)
  ├── Relational Tables: people, artifacts, links, components, knowledge_scores, claims, findings, handover_items
  ├── Graph Traversal: Recursive SQL Common Table Expressions (CTEs) across typed links
  └── Search: Hybrid PostgreSQL full-text search combined with pgvector cosine similarity
```

---

## 10. Technology Stack and Justification

| Layer | Technology | Operational Justification |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18, Vite, TypeScript | Rapid hot-module reloading, strict type safety across data contracts, sub-second production builds (884ms). |
| **Styling & UI** | Tailwind CSS | Zero runtime overhead; predictable utility classes; custom strict monochrome semantic palette. |
| **Backend Framework** | Python 3.13, FastAPI, Uvicorn | High-performance async ASGI server; native Pydantic schema validation; extensive data processing ecosystem. |
| **Database** | PostgreSQL + pgvector | Unified relational datastore handling structured entities, graph links (recursive CTEs), and semantic vector embeddings without requiring three separate databases. |
| **PDF Generation** | ReportLab (Python) | Server-side PDF compilation creating standalone vector documents with zero headless browser / Chromium overhead. |
| **AI Verification** | Deterministic Regex + Gemini API | Two-stage pipeline: deterministic offline overlap executes first with zero cost/latency; Gemini 2.0 Flash handles ambiguous entailment checking. |
| **Testing** | Pytest, Vitest, Vitest-Axe | **396 backend tests** and **110 frontend tests** certifying route parity, role isolation, hostile input handling, and zero accessibility violations. |

---

## 11. Technical Challenges and Mitigation

| Technical Challenge | Engineering Risk | RELAY AI Mitigation |
| :--- | :--- | :--- |
| **Accidental Confidential Data Leaks** | Successors or contractors seeing private Slack channels, compensation, or API keys. | Server-side `_can_see` query filtering; HTTP 404 existence privacy; ingest-time credential scrubbing; automated canary leak test suite (0 leaks across 41 routes). |
| **LLM Hallucinations in Handovers** | Models inventing ungrounded architecture details or operational runbooks. | GroundingVerifier deterministically downgrades unsupported claims to `UNKNOWN`; LLM entailment layer is forbidden from upgrading ungrounded entities. |
| **Prompt Injection Attacks** | Malicious content inside git commits or Slack messages hijacking the verification agent. | Text enclosed in strict `<claim>` and `<evidence>` XML delimiters; system prompts mandate treating content strictly as untrusted data; read-only agent sandbox. |
| **API Rate Limiting & Outages** | External LLM or GitHub API outages causing 500 errors during demo or evaluation. | Native `aiohttp` client with ETag HTTP 304 caching and exponential backoff; automatic fallback to labeled cached fixtures (`CACHED FIXTURES — offline fallback`). |
| **Stale Post-Approval Information** | Code continues to evolve after a handover document is signed off. | Real-time webhook drift monitor flagging dependent claims `is_stale`, generating diffs, queuing lead re-reviews, and notifying successors with update ribbons. |

---

## 12. Team Member Responsibilities

- **Team Name:** Null Pointer  
- **Institution:** Vishwakarma Institute of Technology, Pune  
- **Team Leader:** Harshal Prashant Dhonge  

| Team Member | Selected Role | Primary Responsibility Areas |
| :--- | :--- | :--- |
| **Harshal Prashant Dhonge** | Team Leader & Backend Architect | Backend architecture (`FastAPI`), live GitHub connector, HMAC-SHA256 bearer token authentication, role-based ACL engine (`_can_see`, 404 existence privacy), two-stage grounding verifier (`GroundingVerifier`), secret scrubbing, and parity test harness. |
| **Parth Jadhav** | AI/ML & Pipeline Engineer | Structured LLM extraction schemas (quoted source spans), layered entailment checker (`LLMEntailmentVerifier`), prompt injection defenses, Q&A retrieval engine, and blind successor agent completeness testing. |
| **Diksha Mann** | Analysis, Detection & Testing Lead | Bus-Factor multi-signal risk models, deterministic gap & contradiction detectors, 8-repository backtest benchmark with 1,000 bootstrap resamples, 38-question Q&A gold evaluation suite, and full pytest automation. |
| **Huzefa Gandhi** | Frontend Lead & UX Engineer | Strict monochrome design system, React 18 / Vite / TypeScript single-page application, HTML5 Canvas 2D interactive evidence grid (`InteractiveGridBackground`), modal focus trapping, accessibility calibration (WCAG AA), and Dockerization. |

---

## 13. Three-Round Development Roadmap

```
ROUND 1: Foundation & Evidence (30%)
├── Live GitHub ingestion with ETag caching
├── Identity resolution & deterministic linker
├── Cited personal work ledger & timeline API
└── Seeded ShopLedger fintech reference scenario

ROUND 2: Detection, Interview & Handover (40%)
├── Knowledge Loss Radar (180-day survival model)
├── Contradiction & hidden dependency scanners
├── Evidence-grounded interview question generator
├── Sentence-level provenance badges (VERIFIED, STATED, INFERRED, UNKNOWN)
└── First closed-loop onboarding completeness test (71% -> 96%)

ROUND 3: The Finish — Living Memory, Benchmarking & Hardening (30%)
├── Living Project Memory (real-time webhooks, bus-factor alerts, evidence drift)
├── Exportable Handover Documentation (native ReportLab PDF generator)
├── Workspace & Cloud Storage Integration (curated asset folder packaging)
├── Defensible 8-repository departure backtest (n=8, 52 components, 1,000 bootstrap resamples)
├── 38-question Q&A evaluation benchmark with Contractor Existence Privacy
├── Zero-Canary-Leak Security Audit (41 routes, 135 calls, 0 leaks)
├── WCAG 2.1 AA Palette Contrast Calibration (26/26 token pairings passing)
├── Axe-core Automated Accessibility Audits (32 permutations, 0 critical / 0 serious)
└── Dual-Server Parity Test Suite (140 route and auth assertions passing)
```

---

## 14. Expected Impact & Empirical Results

### 14.1 Empirically Measured Prototype Results

| Evaluation Metric | Measurement Methodology | Demonstrated Empirical Result |
| :--- | :--- | :--- |
| **Historical Departure Backtest** | Evaluated on 8 public OSS repositories across 52 critical components with 1,000 bootstrap resamples. | Precision@1 = **100.0%** [95% CI: 100.0% – 100.0%] vs Baseline 12.5%; Precision@3 = **91.7%** [79.2% – 100.0%] vs Baseline 41.7% (**+120% lift**); MRR = **1.000**. |
| **Held-Out Test Set Lift** | Blind evaluation on 4 held-out repositories (`vuejs`, `redux`, `fastapi`, `tornado`) with frozen weights. | Precision@3 = **100.0%** [100.0% – 100.0%] vs Baseline 33.3% (**+200% lift**); MRR = **1.000** vs 0.389. |
| **Q&A Grounding Accuracy** | 38 gold benchmark questions evaluated across answerability, ungrounded traps, and outdated drift. | **100.0% Answerable Accuracy** (18/18) and **100.0% Trap Abstention** (20/20); zero confidential existence leakage. |
| **Onboarding Completeness Lift** | Blind agent score before and after leaver answers targeted follow-up questions. | **71% &rarr; 96% (+25% gain)** on reference scenario; active blockers drop to zero. |
| **Permission Canary Leak Audit**| Probed 41 API routes across 3 roles (135 HTTP calls) with injected confidential canaries. | **0 leaks detected** across all roles and derived views (`eval/leak_test_report.json`). |
| **Palette Contrast Compliance** | Deterministic WCAG 2.1 relative luminance measurement on Light and Dark theme tokens. | **26 out of 26 evaluated semantic token pairings (100%) meet WCAG AA standards**. |
| **Automated Accessibility** | Axe-core test matrix auditing 4 viewports (390px to 1440px) across Light and Dark themes. | **0 critical violations and 0 serious violations** across all 32 permutations. |
| **Runtime Performance** | Ingestion, graph reconstruction, and simulation latency. | **< 1.2s** on standalone seed demo; **< 4.8s** on live GitHub repo with 500+ commits. |

---

## 15. Future Scope & Production Roadmap

The following phased capabilities outline the planned trajectory for enterprise production scaling:

* **Phase 1: Enterprise Identity & Live OAuth (Months 1–3)**:
  * Enterprise SSO (OIDC / SAML 2.0 with Okta, Google Workspace, Azure AD).
  * SCIM 2.0 automated user provisioning and offboarding triggers with Workday and BambooHR.
  * Marketplace-approved read-only Slack and Jira Cloud 3LO OAuth applications.
* **Phase 2: Encryption, Retention & Compliance (Months 4–6)**:
  * Envelope encryption at rest (AES-256-GCM) with Customer-Managed Keys (CMEK) via AWS KMS / GCP Cloud KMS.
  * Configurable retention periods (30, 90, 180 days) and GDPR/CCPA "Right to Be Forgotten" purge workflows.
  * Cryptographic Merkle tree audit log export to enterprise SIEM platforms (Splunk, Datadog).
* **Phase 3: Multi-Tenancy & High-Availability Scaling (Months 7–9)**:
  * PostgreSQL Row-Level Security (RLS) policies for complete database-level tenant isolation.
  * Distributed ingestion worker pools orchestrated via Temporal or Celery backed by Redis.
* **Phase 4: Dynamic Build Verification Sandboxes (Months 10–12)**:
  * Ephemeral container execution sandboxes (Firecracker microVMs) where an autonomous agent boots an isolated environment, follows the handover runbook, and compiles code dynamically to verify Day-1 readiness.

---

## 16. References

* **[R1]** Sensay, *"How Sensay AI offboarding works"* — `https://blog.sensay.io/how-sensay-ai-offboarding-works`
* **[R2]** Sensay Launch Announcement (AccessNewswire) — `https://www.accessnewswire.com/newsroom/en/education/sensay-launches-world%E2%80%99s-first-ai-offboarding-platform-for-knowledge-transfer-1090553`
* **[R3]** Flamekeeper Product Description (AlternativeTo) — `https://alternativeto.net/software/flamekeeper/about/`
* **[R4]** OakHive Product Listing (GetApp) — `https://www.getapp.com/all-software/a/oakhive/`
* **[R5]** ServiceNow, *"Offboarding Knowledge Agentic Workflow Documentation"* — `https://www.servicenow.com/docs/r/employee-service-management/now-assist-for-hrsd/offboarding-knowledge-x-agentic-wf.html`
* **[R6]** Unblocked, *"Unblocked vs Greptile: Code Review Comparison"* — `https://getunblocked.com/blog/unblocked-vs-greptile-code-review-comparison/`
* **[R7]** Unblocked, *"What your coding agent can’t see"* — `https://getunblocked.com/blog/what-your-coding-agent-cant-see/`
* **[R8]** Atlassian Teamwork Graph, Principal ML Engineer Job Description (Built In Boston) — `https://www.builtinboston.com/job/principal-machine-learning-engineer/11475729`
* **[R9]** Truck Factor / Degree-of-Authorship Study of 133 GitHub Applications (ProQuest) — `https://www.proquest.com/docview/1953746224`
* **[R10]** Bus Factor Explorer Review (The Moonlight) — `https://www.themoonlight.io/review/bus-factor-explorer`
* **[R11]** BFSig: File Significance for Bus-Factor Estimation (Bilkent University) — `https://repository.bilkent.edu.tr/items/dd0c9aa0-f054-4b4b-a74e-11dc7c0951a4`
* **[R12]** CodeScene, *"Knowledge Distribution & Social Code Analysis Documentation"* — `https://docs.enterprise.codescene.io/versions/5.4.2/guides/social/knowledge-distribution.html`
* **[R13]** DRMiner: Design Rationale Extraction from Jira Issue Logs (arXiv:2405.19623) — `https://arxiv.org/abs/2405.19623`
* **[R14]** Argus: Code Change Rationale Extraction from Software Repositories (2026) — `https://arxiv.org/html/2604.10345v1`
* **[R15]** RTFM Testing: Autonomous Documentation Validation Agent Skill — `https://skills.cat/skills/zscole/rtfm-testing`
* **[R16]** Zero-Context Validation: Testing Software From Documentation Alone — `https://site-45q.pages.dev/blog/zero-context-validation.html`
* **[R17]** DocWorks: Repository Documentation Testing Harness — `https://gh.r-mj.com/caiopizzol/docworks`
* **[R18]** Tray.ai, Jira Integrations and Automated Workflow Connectors — `https://tray.ai/connectors/jira-integrations.md`
* **[R19]** TeamOnTrack, Developer Activity and Continuity Management — `https://alternativeto.net/software/teamontrack/about`
