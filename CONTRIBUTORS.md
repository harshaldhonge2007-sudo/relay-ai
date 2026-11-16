# Project Contributors & Team Responsibilities

**Project Name:** RELAY AI  
**Team Name:** Null Pointer  
**Institution:** Vishwakarma Institute of Technology, Pune  
**Competition / Track:** CodersInPune / Autonomous Systems  
**Evaluation Round:** Round 3 ("The Finish")  
**Date:** November 15, 2026  

---

## 1. Team Members & Primary Ownership

| Name | Role / Title | Primary Responsibility Areas | Contact / Profile |
| :--- | :--- | :--- | :--- |
| **Harshal Prashant Dhonge** | **Team Leader** & Backend Systems Architect | Backend architecture (`FastAPI`), live GitHub connector, HMAC-SHA256 bearer token authentication, role-based ACL engine (`_can_see`, 404 existence privacy), two-stage grounding verifier (`GroundingVerifier`), secret scrubbing, and parity test harness. | [Leader Profile / GitHub](https://github.com/harshaldhonge2007-sudo) |
| **Parth Jadhav** | AI/ML & Pipeline Engineer | Structured LLM extraction schemas (quoted source spans), layered entailment checker (`LLMEntailmentVerifier`), prompt injection defenses, Q&A retrieval engine, and blind successor agent completeness testing. | [Contributor Profile](https://github.com/harshaldhonge2007-sudo/relay-ai) |
| **Diksha Mann** | Analysis, Detection & Testing Lead | Bus-Factor multi-signal risk models, deterministic gap & contradiction detectors, 8-repository backtest benchmark with 1,000 bootstrap resamples, 38-question Q&A gold evaluation suite, and full pytest automation. | [Contributor Profile](https://github.com/harshaldhonge2007-sudo/relay-ai) |
| **Huzefa Gandhi** | Frontend Lead & UX Engineer | Strict monochrome design system, React 18 / Vite / TypeScript single-page application, HTML5 Canvas 2D interactive evidence grid (`InteractiveGridBackground`), modal focus trapping, accessibility calibration (WCAG AA), and Dockerization. | [Contributor Profile](https://github.com/harshaldhonge2007-sudo/relay-ai) |

---

## 2. Detailed Contribution Matrix

| Functional Area | Primary Owner (P) | Support Owner (S) | Key Implemented Files & Deliverables |
| :--- | :---: | :---: | :--- |
| **Backend API & Orchestration** | Harshal Dhonge | Diksha Mann | `api/mock_server.py`, `api/app/main.py`, `api/app/security/acl.py`, `api/app/security/auth.py` |
| **Ingestion & Live Connectors** | Harshal Dhonge | Parth Jadhav | `api/app/ingest/github_live.py`, `api/app/ingest/importers.py`, `api/app/webhooks/github.py` |
| **AI / ML & Verification** | Parth Jadhav | Harshal Dhonge | `api/app/handover/verifier.py`, `api/app/handover/llm_entailment.py`, `api/app/llm/provider.py` |
| **Risk Modeling & Detectors** | Diksha Mann | Parth Jadhav | `api/app/risk/backtest.py`, `api/app/detect/recurring.py`, `api/app/detect/__init__.py` |
| **Evaluation & Benchmarks** | Diksha Mann | Harshal Dhonge | `scripts/run_eval.py`, `scripts/run_leak_test.py`, `scripts/measure_contrast.py`, `Makefile` |
| **Frontend Architecture & UX** | Huzefa Gandhi | Parth Jadhav | `web/src/screens/*`, `web/src/components/*`, `web/src/hooks/useModalFocusTrap.ts` |
| **Visual Design & Canvas Engine**| Huzefa Gandhi | — | `web/src/components/InteractiveGridBackground.tsx`, `web/src/index.css`, `tailwind.config.js` |
| **Deployment & Containers** | Huzefa Gandhi | Harshal Dhonge | `docker-compose.yml`, `start_demo.sh`, `run_demo.py`, `api/Dockerfile`, `web/Dockerfile` |

---

## 3. Statement of Originality & Ethical Conduct
All team members certify that the architecture, verification code, algorithms, and interface components of RELAY AI were developed in compliance with hackathon guidelines. Pre-existing open-source libraries and frameworks are transparently documented in [DISCLOSURES.md](file:///Users/harshaldhonge/Documents/CodersInPune/relay/DISCLOSURES.md).
