# RELAY AI

A system that converts scattered project activity into a usable handover when a team member leaves.

## Features

- **Live GitHub ingestion**: Commits, PRs, issues, branches from any public repository
- **Evidence linking**: Deterministic and embedding-based connection of artifacts
- **Knowledge-loss risk model**: Identify high-risk components when a developer leaves
- **Evidence-grounded interviewer**: Ask targeted questions based on detected gaps
- **Handover pack**: Cited, provenance-tracked documentation
- **Completeness test**: Blind agent verification of handover sufficiency

## Stack

- **Backend**: Python 3.11, FastAPI, SQLAlchemy 2, PostgreSQL 16 with pgvector
- **Frontend**: React, Vite, TypeScript, Tailwind
- **LLM**: Provider-agnostic (Gemini/OpenAI) with replay mode
- **Embeddings**: fastembed with bge-small

## Quick Start

### Prerequisites

- Docker and Docker Compose
- GitHub token (for live ingestion)
- LLM API key (Gemini or OpenAI)

### Setup

1. Clone the repository:
```bash
git clone <repo-url>
cd relay
```

2. Create `.env` file:
```bash
GITHUB_TOKEN=your_github_token
GEMINI_API_KEY=your_gemini_key
# or
OPENAI_API_KEY=your_openai_key
REPLAY_MODE=false
```

3. Start services:
```bash
docker-compose up
```

4. Access the application:
- API: http://localhost:8000
- Web: http://localhost:5173

## Development

### Backend

```bash
cd api
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd web
npm install
npm run dev
```

## Data Sources

- **Live**: GitHub (via REST API with read-only token)
- **Fixtures**: Slack, Jira, and docs loaded from `/seed` directory
- **Demo**: ShopLedger case with Priya Nair as the departing developer

## Honesty Rules

Every artifact has a `source_mode` (live, fixture, or replay). The UI displays a persistent banner showing the data sources for each case.

## Architecture

```
relay/
  api/           Backend FastAPI application
  web/           Frontend React application
  seed/          Demo fixtures and ShopLedger case
  docker-compose.yml
```

## Testing

Run detector precision/recall tests:
```bash
cd api
pytest tests/
```

## Deployment

Deploy to Google Cloud Run:
```bash
./scripts/deploy.sh
```

## Security

- Read-only API tokens stored in environment variables
- Secrets scanning before embedding or LLM calls
- ACL filtering applied at SQL level
- Audit logging for all handover access

## What's Live vs Seeded

- ✅ **Live**: GitHub ingestion for any public repository
- 📦 **Seeded**: Slack messages, Jira tickets, documentation
- 🎬 **Optional**: Replay mode for demo resilience

## License

MIT
