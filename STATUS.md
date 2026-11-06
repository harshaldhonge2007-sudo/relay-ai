# RELAY AI Implementation Status

## Completed Milestones

### ✅ Design Plan
- Color tokens (paper, ink, focus, provenance colors)
- Typography (Schibsted Grotesk, Literata, JetBrains Mono)
- Three-pane workbench layout
- 8 screen wireframes

### ✅ Milestone 1: Backend Skeleton
- PostgreSQL schema with pgvector support
- FastAPI application structure
- SQLAlchemy 2 async models
- GitHub live ingestion (commits, PRs, issues, branches, tags)
- Fixture ingestion (Slack, Jira, docs)
- Identity resolution with fuzzy matching
- Docker Compose setup

### ✅ Milestone 3: Detectors & Risk
- **Detectors** (all deterministic, no LLM):
  - `inflight.py`: Open PRs, unmerged branches, TODO/FIXME, incomplete tickets
  - `hidden_deps.py`: Env vars, secrets, cron jobs, external hosts
  - `contradictions.py`: Jira/PR status mismatches, CI failures
  - `gaps.py`: Undocumented decisions from large diffs/reverts
- **Risk Model**:
  - `knowledge.py`: Time-decayed authorship (12-month half-life)
  - `score.py`: Risk = Crit × L × (1-B) × (1-0.6×D) with breakdown
  - `backtest.py`: Validation script

### ✅ Milestone 2: Linking (Partial)
- `rules.py`: Explicit linking (Jira keys, #refs, URLs)
- `embed.py`: Embedding-based linking with fastembed
- `confirm.py`: LLM confirmation for low-confidence links

### ✅ Milestone 4: Interviewer
- `planner.py`: Generate questions from findings (max 8)
- `dedupe.py`: Embedding-based deduplication

### ✅ Milestone 5: Handover
- `build.py`: Generate handover with provenance tracking
- Evidence IDs required for every sentence

### ✅ Milestone 6: Completeness Test
- `required_facts.py`: Extract env vars, services deterministically
- `agent.py`: Blind agent with handover-only access
- `score.py`: 3-run mean and spread calculation

### ✅ Milestone 7: Frontend (Structure)
- React + Vite + TypeScript + Tailwind setup
- 8 screens (Cases, Knowledge Radar, Timeline, Findings, Interview, Handover, Completeness, Admin)
- Source pane component
- Source banner for demo data
- Workbench layout structure

### ✅ Security
- `secrets_scan.py`: Secret detection (stores names, not values)
- `acl.py`: Access control and audit logging

### ✅ Seed Data
- ShopLedger demo case with Priya Nair
- Slack threads (JWT issue, migration revert, nightly reports)
- Jira tickets (SL-234, SL-287, SL-456, etc.)
- Documentation (README, API docs)
- Expected findings JSON

## In Progress / Remaining

### Milestone 2: Complete Timeline API
- Timeline endpoint with evidence citations
- Link recall/precision tests

### Milestone 7: Frontend Implementation
- API integration
- Treemap visualization for Knowledge Radar
- Evidence linking UI
- Responsive layouts (390/768/1024/1440px)
- Source pane interactions

### Milestone 8: Deployment
- Alembic migrations
- Cloud Run configuration
- 4-minute demo script

### Tests
- Precision/recall tests against expected_findings.json
- Injection test
- Integration tests

## Project Structure

```
relay/
├── api/
│   ├── app/
│   │   ├── config.py ✅
│   │   ├── db.py ✅
│   │   ├── models.py ✅
│   │   ├── schemas.py ✅
│   │   ├── llm.py ✅
│   │   ├── main.py ✅
│   │   ├── ingest/
│   │   │   ├── github.py ✅
│   │   │   ├── fixtures.py ✅
│   │   │   └── identity.py ✅
│   │   ├── link/
│   │   │   ├── rules.py ✅
│   │   │   ├── embed.py ✅
│   │   │   └── confirm.py ✅
│   │   ├── detect/
│   │   │   ├── inflight.py ✅
│   │   │   ├── hidden_deps.py ✅
│   │   │   ├── contradictions.py ✅
│   │   │   └── gaps.py ✅
│   │   ├── risk/
│   │   │   ├── knowledge.py ✅
│   │   │   ├── score.py ✅
│   │   │   └── backtest.py ✅
│   │   ├── interview/
│   │   │   ├── planner.py ✅
│   │   │   └── dedupe.py ✅
│   │   ├── handover/
│   │   │   └── build.py ✅
│   │   ├── sim/
│   │   │   ├── required_facts.py ✅
│   │   │   ├── agent.py ✅
│   │   │   └── score.py ✅
│   │   └── security/
│   │       ├── acl.py ✅
│   │       └── secrets_scan.py ✅
│   ├── tests/
│   │   └── test_detectors.py ✅
│   ├── requirements.txt ✅
│   ├── Dockerfile ✅
│   └── alembic.ini ✅
├── web/
│   ├── src/
│   │   ├── screens/ (8 screens) ✅
│   │   ├── components/ ✅
│   │   ├── contexts/ ✅
│   │   ├── types/ ✅
│   │   ├── App.tsx ✅
│   │   ├── main.tsx ✅
│   │   └── index.css ✅
│   ├── package.json ✅
│   ├── vite.config.ts ✅
│   ├── tailwind.config.js ✅
│   ├── Dockerfile ✅
│   └── index.html ✅
├── seed/
│   ├── slack.json ✅
│   ├── jira.json ✅
│   ├── expected_findings.json ✅
│   └── docs/ ✅
├── docker-compose.yml ✅
├── README.md ✅
└── DESIGN_PLAN.md ✅
```

## Next Steps

1. Run `docker-compose up` to test backend
2. Complete Alembic migrations for pgvector
3. Add API endpoints for timeline, findings, questions
4. Build frontend API client
5. Implement treemap visualization
6. Write integration tests
7. Create demo script
8. Deploy to Cloud Run

## Key Features Implemented

- ✅ Live GitHub ingestion with rate limiting
- ✅ Deterministic detectors (no guessing)
- ✅ Evidence-grounded approach (every claim cites source)
- ✅ Time-decayed knowledge model
- ✅ Provenance tracking (inferred/stated/verified)
- ✅ Blind agent completeness test
- ✅ Secret scanning (names only, never values)
- ✅ Source mode transparency (live/fixture/replay)
- ✅ LLM provider abstraction (Gemini/OpenAI)
- ✅ Replay mode for demo resilience

## Honesty Rules Compliance

- ✅ Every artifact has source_mode
- ✅ UI shows persistent source banner for demo data
- ✅ Handover items require evidence_ids
- ✅ No fake results (seeded/cached/replayed data labeled)
- ✅ Completeness score is not a prediction of human performance
