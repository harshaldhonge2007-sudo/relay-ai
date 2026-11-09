# RELAY AI Deployment Guide

This guide covers deploying **RELAY AI** to production using:
1. **Render (Backend + PostgreSQL with pgvector) + Vercel (Frontend)** *(Recommended)*
2. **Railway (Full Stack)**
3. **Docker Compose (Self-hosted VM / Local)**

---

## Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │             User Browser               │
                      └──────────────────┬─────────────────────┘
                                         │ (HTTPS)
                                         ▼
                      ┌────────────────────────────────────────┐
                      │      Frontend: Vercel (or Railway)     │
                      │  - React 18 + Vite + Tailwind SPA      │
                      │  - Static CDN Edge routing             │
                      └──────────────────┬─────────────────────┘
                                         │ (HTTPS API calls with CORS)
                                         ▼
                      ┌────────────────────────────────────────┐
                      │      Backend: Render (or Railway)      │
                      │  - FastAPI / Uvicorn (Docker)          │
                      │  - Endpoints at / and /api/*           │
                      └──────────────────┬─────────────────────┘
                                         │
                                         ▼
                      ┌────────────────────────────────────────┐
                      │   PostgreSQL 16 (with pgvector)        │
                      │  - Render Postgres or Railway Postgres │
                      └────────────────────────────────────────┘
```

---

## Option 1: Render (Backend & DB) + Vercel (Frontend)

### Part A: Deploy Backend & Database on Render

We have provided a [`render.yaml`](file:///e:/Relay%20AI/render.yaml) Blueprint in the root of the repository, which sets up both the PostgreSQL database and FastAPI Web Service in one click.

1. **Push your code to GitHub**:
   ```bash
   git add .
   git commit -m "Configure Render and Vercel deployment"
   git push origin main
   ```
2. **Deploy via Render Blueprint**:
   - Go to [dashboard.render.com](https://dashboard.render.com).
   - Click **"New +"** $\to$ **"Blueprint"**.
   - Connect your repository: `harshaldhonge2007-sudo/relay-ai`.
   - Render will detect [`render.yaml`](file:///e:/Relay%20AI/render.yaml) and automatically configure:
     - **Database**: `relay-postgres` (PostgreSQL 16)
     - **Web Service**: `relay-api` (using `api/Dockerfile`)
   - When prompted for environment variables:
     - `GEMINI_API_KEY`: Enter your Google Gemini API key.
     - `GITHUB_TOKEN`: *(Optional)* Enter your GitHub Personal Access Token for live repository ingestion.
   - Click **"Apply"**.
3. **Copy your Render API URL**:
   - Once deployment completes, copy the URL of your Web Service (e.g. `https://relay-api-xxxx.onrender.com`).
   - You can test it by visiting: `https://relay-api-xxxx.onrender.com/health` (should return `{"status":"ok"}`).

---

### Part B: Deploy Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) and log in with GitHub.
2. Click **"Add New..."** $\to$ **"Project"**.
3. Import your repository: `harshaldhonge2007-sudo/relay-ai`.
4. Configure Project Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click `Edit` and select `web` (Click Continue).
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. **Environment Variables**:
   - Add:
     - Name: `VITE_API_URL`
     - Value: `https://relay-api-xxxx.onrender.com` *(your Render Web Service URL from Part A)*
6. Click **"Deploy"**.
7. Vercel will build and deploy the React application. [`web/vercel.json`](file:///e:/Relay%20AI/web/vercel.json) handles SPA routing so deep links and page refreshes work smoothly.

---

### Part C: Seed the Demo Data
Once both are live:
1. Open your Vercel URL in your browser.
2. On the Cases screen, click **"Seed Demo Case"**.
3. The demo dataset (ShopLedger / Priya Nair departure) will be populated in your Render database!

---

## Option 2: Deploy to Railway

If you prefer deploying everything under one dashboard:

1. **Deploy PostgreSQL**:
   - Add PostgreSQL (or Docker image `pgvector/pgvector:pg16`).
2. **Deploy Backend (`api`)**:
   - Root Directory: `/api`
   - Variables:
     - `DATABASE_URL`: `${{Postgres.DATABASE_URL}}`
     - `GEMINI_API_KEY`: `<your_gemini_api_key>`
     - `LLM_PROVIDER`: `gemini`
     - `REPLAY_MODE`: `false`
   - Generate Domain (e.g. `api-production-xxxx.up.railway.app`).
3. **Deploy Frontend (`web`)**:
   - Root Directory: `/web`
   - Variables:
     - `BACKEND_URL`: URL of your backend service.
   - Generate Domain.

---

## Option 3: Local / Self-Hosted Docker Compose

```bash
cp .env.example .env
# Edit .env and set GEMINI_API_KEY and GITHUB_TOKEN
docker compose up -d
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- API Health: `http://localhost:8000/health`

---

## Option 4: Zero-Config Judge Demo Link (Static Frontend + Standalone Mock Server)

For hackathon judges and evaluators who need an instant, self-contained preview without setting up PostgreSQL or third-party API keys:

### 1. Deploy Standalone Server on Render / Railway (Free Tier)
- **Repository**: Connect this repository.
- **Root Directory**: `api`
- **Build Command**: `pip install fastapi uvicorn pydantic pydantic-settings python-dotenv`
- **Start Command**: `python mock_server.py`
- **Port**: `8000`
- **Environment Variables**: None required! All data is seeded in-memory and signed tokens are derived with demo secrets.
- **Health Check**: `GET /health` returns `{"status": "ok"}`.

### 2. Deploy Static Frontend on Vercel
- **Root Directory**: `web`
- **Framework**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variable**: `VITE_API_URL=<your-render-mock-server-url>`

### What is Simulated in the Judge Evaluation?
- **Source Ingestion**: Slack, Jira, GitHub, and meeting notes are realistic synthetic fixtures centered on senior engineer Priya Nair's departure from `ShopLedger`.
- **Demo Authentication**: Uses signed HMAC-SHA256 bearer tokens for three seeded personas (`lead`, `successor`, `contractor`) to prove server-side role enforcement without requiring an external OAuth provider.
- **LLM Synthesis**: Operates in deterministic offline replay mode with exact entity grounding verification so evaluation results are instantaneous, zero-cost, and immune to rate limits.
- **Blind Onboarding Agent**: A deterministic coverage simulation that tests required facts against role permissions.

