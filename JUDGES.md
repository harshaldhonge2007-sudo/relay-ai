# RELAY AI — Judge Evaluation Guide (Round 3: "The Finish")

Welcome judges! This one-page guide ensures you can launch, test, and evaluate RELAY AI in under 5 minutes on macOS, Linux, or Windows.

---

## 1. Fast Launch (Under 60 Seconds)

Choose any of the three launch paths:

```bash
# Option A: Python (Recommended, cross-platform, checks port conflicts)
python run_demo.py

# Option B: Bash (macOS / Linux)
./start_demo.sh

# Option C: Windows PowerShell
.\start_demo.ps1

# Option D: Full Docker Stack (Postgres + pgvector + FastAPI + Vite)
docker compose up
```

Your browser will automatically open **http://localhost:5173**. Both the backend API and frontend Vite server will be running with hot reload.

---

## 2. The 3-Minute Walkthrough

1. **Start the Guided Tour**: Click **"Tour"** in the top navigation bar to activate the interactive 6-step guided evaluation tour.
2. **Step 1 — Connect (`/case/case-001/assets`)**: Inspect connected repositories, tickets, and docs. Review source ACL visibility tiers (Lead Only, Internal, Public). Notice that all credentials and keys are scrubbed upon ingestion.
3. **Step 2 — Reconstruct (`/case/case-001/busfactor`)**: Inspect time-decayed authorship and critical single-point dependencies. Identify modules where Priya Nair's departure creates zero-backup knowledge gaps.
4. **Step 3 — Verify (`/case/case-001/findings`)**: Review unmerged PRs, hidden environment variables, and ticket-code contradictions flagged by zero-LLM deterministic detectors. Visit `/validation` to review historical backtest precision and the zero-canary leak audit.
5. **Step 4 — Review (`/case/case-001/handover`)**: Inspect claim-by-claim sentence-level provenance (`VERIFIED`, `STATED`, `INFERRED`, `UNKNOWN`) with clickable evidence citations. Switch roles (top right) to see confidential claims masked with withheld indicators. Export the branded handover PDF.
6. **Step 5 — Handover (`/case/case-001/completeness`)**: Run the blind agent completeness test. A blind evaluator attempts to reconstruct configuration using handover claims alone, displaying 3-run spread bounds.
7. **Step 6 — Continue (`/case/case-001/interview`)**: Query Priya's departure persona with role-isolated citations. Acknowledge the handover as Jordan Taylor to generate a cryptographically signed HMAC-SHA256 receipt.
8. **Check Honest Limits (`/limits`)**: Click **"Limits"** in the footer or visit `/limits` to review the verified capabilities matrix and explicit architectural boundaries.

---

## 3. Demo Roles & Role Switcher

Use the **"Viewing as"** dropdown in the top-right corner to test role isolation instantly:

| Role | Persona | Permissions & Visible Views |
|---|---|---|
| **Lead** | Alex Chen | Full access: confidential credentials (`ENV_KEYS.md`, payroll), claim review/rejection, source ACL toggles, and handover release. |
| **Successor** | Jordan Taylor | Internal access: system architecture, knowledge maps, runbooks, simulation; signs HMAC receipt; confidential items masked. |
| **Contractor** | Sam Rodriguez | Public only: open repository items; internal Slack/meetings withheld; direct ID requests return HTTP 404. |

---

## 4. Round 3 Rubric Mapping (100 Points)

| Rubric Criterion | Feature Delivered | Where to See It | Test / Verification Command |
|---|---|---|---|
| **Completeness (25 pts)** | End-to-end 6-stage handover pipeline with deterministic completeness test | `/case/case-001/completeness` & `/case/case-001/handover` | `pytest tests/test_workflow.py` `tests/test_journeys.py` |
| **Improvements Delivered (20 pts)** | Layered entailment verifier, per-session sandboxes, canary leak test suite, HMAC receipts | `/validation`, `/limits`, TopBar "Reset Sandbox" | `pytest tests/test_verifier.py` `pytest tests/test_failure_modes.py` |
| **Reliability Under Normal Use (20 pts)** | Zero canary leaks, existence privacy (404 parity), secret scrubbing, mock fallback banner | `/validation` (Canary card), `PRIVACY_AND_RESPONSIBLE_DESIGN.md` | `make leak-test` `pytest tests/test_canary_leak.py` |
| **Usability & Real-World Fit (20 pts)** | WCAG-AA monochrome UI, Guided Tour, Cmd+K palette, cross-platform launchers | TopBar "Tour", Cmd+K, `run_demo.py`, `start_demo.ps1` | `npm test -- src/tests/GuidedTour.test.tsx` `scripts/verify_clean_install` |
| **Documentation & Roadmap (15 pts)** | Runnable claims audit, honest limits page, deployment guide, realistic engineering roadmap | `/limits`, `docs/CLAIMS_AUDIT.md`, `docs/LIMITATIONS.md`, `docs/DEPLOY.md` | Every claim in `CLAIMS_AUDIT.md` mapped to runnable commands |

---

## 5. Honest Known Limits & Boundaries

In accordance with the hackathon principle (*"honest limitations beat unsupported claims of automation"*), RELAY AI explicitly discloses:
- **Synthetic Demo Data**: Slack and Jira fixtures in demo mode run against deterministic local seed data (`seed/`) for offline reproducibility. Live GitHub repository ingestion connects to real GitHub APIs.
- **Demo Authentication**: Bearer tokens are signed with HMAC-SHA256 for evaluation and isolated sandboxes. Production SSO (SAML/OIDC) is on the post-hackathon roadmap.
- **Completeness Scope**: Completeness tests verify required-fact presence in the handover document; they do not compile binary code in virtual machines.
- **Full Details**: Visit `/limits` in the web application or read [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md).

---

## 6. Repository Map

```
relay/
├── api/
│   ├── app/                # FastAPI production backend (auth, detect, risk, handover, export, sim)
│   ├── mock_server.py      # Standalone demo server with thread-safe session sandboxing
│   └── tests/              # 396+ unit and integration tests (parity, canaries, failure modes)
├── web/
│   ├── src/screens/        # 17 UI screens (Handover, Radar, Timeline, Completeness, Limits, etc.)
│   ├── src/components/     # Accessible WCAG-AA monochrome components (GuidedTour, CoveragePanel)
│   └── src/tests/          # Vitest component test suites (110 tests across 16 suites)
├── seed/                   # ShopLedger demo fixtures (Slack, Jira, Git history, notes)
├── docs/                   # CLAIMS_AUDIT.md, LIMITATIONS.md, DEPLOY.md, ROUND3_REPORT.md
├── run_demo.py             # Cross-platform demo launcher with port conflict checks
├── start_demo.sh           # macOS / Linux launcher
├── start_demo.ps1          # Windows PowerShell launcher
└── docker-compose.yml      # Multi-container production stack
```
