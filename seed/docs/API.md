# API Development

## Architecture

The API is built with:
- FastAPI for REST endpoints
- SQLAlchemy 2 async for database access
- PostgreSQL with pgvector for embeddings
- Alembic for migrations

## Environment Setup

Create a `.env` file:

```bash
DATABASE_URL=postgresql://relay:relay@localhost:5432/relay
GITHUB_TOKEN=your_github_token
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
REPLAY_MODE=false
```

## Testing Locally

```bash
cd relay/api
pip install -r requirements.txt
python -m app.main
```

## API Endpoints

- `POST /cases` - Create a new case
- `GET /cases/{id}` - Get case details
- `POST /cases/{id}/ingest` - Start ingestion
- `GET /people/{id}` - Get person details
