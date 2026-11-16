# Project Disclosures, Attribution & Build-Window Statement

**Document Version:** 1.0.0-round3  
**Date:** November 15, 2026  
**Git Commit SHA:** `a75bcc9`  
**Track:** CodersInPune / Autonomous Systems  

---

## 1. Participants & Team Roles

- **Team Name:** Null Pointer
- **Institution:** Vishwakarma Institute of Technology, Pune
- **Team Leader:** Harshal Prashant Dhonge

| Participant Name | Hackathon Role | Primary Responsibilities & Contributions |
| :--- | :--- | :--- |
| **Harshal Prashant Dhonge** | **Team Leader** & Backend Systems Architect | Backend architecture (`FastAPI`), live GitHub connector, HMAC-SHA256 bearer token authentication, role-based ACL engine (`_can_see`, 404 existence privacy), two-stage grounding verifier (`GroundingVerifier`), secret scrubbing, and parity test harness. |
| **Parth Jadhav** | AI/ML & Pipeline Engineer | Structured LLM extraction schemas (quoted source spans), layered entailment checker (`LLMEntailmentVerifier`), prompt injection defenses, Q&A retrieval engine, and blind successor agent completeness testing. |
| **Diksha Mann** | Analysis, Detection & Testing Lead | Bus-Factor multi-signal risk models, deterministic gap & contradiction detectors, 8-repository backtest benchmark with 1,000 bootstrap resamples, 38-question Q&A gold evaluation suite, and full pytest automation. |
| **Huzefa Gandhi** | Frontend Lead & UX Engineer | Strict monochrome design system, React 18 / Vite / TypeScript single-page application, HTML5 Canvas 2D interactive evidence grid (`InteractiveGridBackground`), modal focus trapping, accessibility calibration (WCAG AA), and Dockerization. |

---

## 2. Pre-Existing Work Statement

The following standard open-source boilerplate scaffolding existed prior to the hackathon window:
- Standard React 18 with Vite build tooling and TypeScript configuration (`tsconfig.json`).
- Tailwind CSS configuration (`tailwind.config.js`) and PostCSS boilerplate.
- Python standard virtual environment scaffolding, baseline FastAPI project structure, and Alembic database migration templates.

**Build-Window Statement**:  
All core intellectual property, application logic, and algorithms were developed entirely during the hackathon build window, including:
1. Cross-platform identity resolution and evidence linking graph.
2. Bus-Factor multi-signal risk scoring and 180-day line-survival decay formula.
3. Deterministic gap detectors and cross-source contradiction rules (ticket status vs production chat).
4. Two-stage grounding verifier with ambiguous-band LLM entailment delegation.
5. Live read-only GitHub API connector with conditional ETag caching and rate-limit backoff.
6. Role-based existence privacy (HTTP 404 on restricted IDs) and contractor existence privacy in Q&A.
7. Closed-loop onboarding completeness simulation with missing facts interview loopback.
8. Post-release living handover monitor with PR merge webhook drift detection and lead re-review queue.
9. HTML5 Canvas 2D interactive evidence lattice (`InteractiveGridBackground`).

---

## 3. AI Tools Used & Modes of Utilization

| AI Tool / Model | Mode of Utilization | Specific Scope & Purpose |
| :--- | :--- | :--- |
| **Google Gemini (Gemini 2.0 Flash / 1.5 Flash)** | Hosted API & Assistant | Layered claim entailment verification for ambiguous claims `[0.35, 0.75)`, query expansion for AskTheLeaver, and test scenario generation. |
| **Anthropic Claude (Claude Sonnet 3.5 / 4.6)** | Pair Programming | Code refactoring, test suite expansion, and documentation drafting. |
| **Google Antigravity Agent** | Autonomous Orchestrator | Workspace automation, regression test execution, linting, and continuous verification. |

All AI-generated code and suggestions underwent strict human-in-the-loop review, automated unit and integration testing, and security verification.

---

## 4. Third-Party Libraries & Open-Source Licenses

### Backend (Python)
- `fastapi` (MIT License) — Async web framework and typed routing
- `uvicorn` (BSD 3-Clause) — High-performance ASGI web server
- `pydantic` (MIT License) — Data validation and schema enforcement
- `sqlalchemy` (MIT License) — Database ORM and SQL toolkit
- `aiohttp` (Apache 2.0) — Async HTTP client for live GitHub API connector
- `reportlab` (BSD License) — Professional PDF generation engine
- `pytest` & `pytest-asyncio` (MIT License) — Automated test runner and async testing utilities
- `python-jose` / `cryptography` (MIT / Apache 2.0) — HMAC-SHA256 token signing and verification

### Frontend (TypeScript / React)
- `react` & `react-dom` (MIT License) — UI component foundation
- `react-router-dom` (MIT License) — Client-side SPA routing
- `tailwindcss` (MIT License) — Utility-first CSS styling
- `vite` (MIT License) — Build tool and development server
- `vitest` (MIT License) — Unit and component test runner
- `@testing-library/react` (MIT License) — DOM testing utilities
- `vitest-axe` / `@axe-core/react` (MPL 2.0) — Automated accessibility auditing engine
- `clsx` (MIT License) — Class name composition utility

---

## 5. Datasets & Source Code Licenses

1. **ShopLedger Synthetic Dataset**: Completely synthetic dataset developed specifically for the RELAY AI reference scenario ("Priya Nair Departure"). Contains no proprietary, customer, or real personally identifiable information (PII).
2. **Public GitHub Repositories (Used for Backtesting & Live Connectors)**:
   - `pallets/flask` (BSD-3-Clause)
   - `psf/requests` (Apache 2.0)
   - `expressjs/express` (MIT License)
   - `encode/starlette` (BSD-3-Clause)
   - `vuejs/vue` (MIT License)
   - `reduxjs/redux` (MIT License)
   - `tiangolo/fastapi` (MIT License)
   - `tornadoweb/tornado` (Apache 2.0)
