# Deploying RELAY AI (Free Host + Static Host)

This guide documents deploying **RELAY AI** to public cloud infrastructure for hackathon evaluation and production use, with zero cost using free cloud tiers.

---

## 1. Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │             Judge Browser              │
                      └──────────────────┬─────────────────────┘
                                         │ (HTTPS)
                                         ▼
                      ┌────────────────────────────────────────┐
                      │    Static Frontend: Vercel / Netlify   │
                      │  - React 18 + Vite + Tailwind CSS SPA  │
                      │  - Fast edge routing via vercel.json   │
                      └──────────────────┬─────────────────────┘
                                         │ (HTTPS API calls with CORS)
                                         ▼
                      ┌────────────────────────────────────────┐
                      │     Backend: Render / Railway / Fly    │
                      │  - FastAPI / Uvicorn (Python 3.11)     │
                      │  - RELAY_DEMO_MODE=1 (sandbox active)  │
                      │  - Isolated per-session memory state   │
                      └──────────────────┬─────────────────────┘
                                         │
                                         ▼
                      ┌────────────────────────────────────────┐
                      │   PostgreSQL 16 + pgvector (Optional)  │
                      │  - For live database persistence mode  │
                      └────────────────────────────────────────┘
```

---

## 2. Hosted-Demo Sandbox Safety

In hosted evaluations, multiple judges may inspect the application concurrently. To ensure **complete evaluation integrity without shared state pollution**:

1. **Session-Scoped DB Proxy (`ScopedDBProxy`)**:
   - When `RELAY_DEMO_MODE=1` is enabled on the backend, every judge's requests are isolated by a session identifier (`sid`).
   - The session ID is encoded into the HMAC-signed bearer token, sent in the `X-Relay-Session` header, or passed via `?sid=`.
   - Mutating actions (approving handover claims, toggling source ACLs, releasing to successor, acknowledging receipts) only mutate that judge's isolated session copy.
2. **TTL Eviction**: Inactive sessions are automatically evicted after 2 hours to prevent memory exhaustion on free-tier containers.
3. **One-Click Sandbox Reset**: The `Reset Sandbox` button in the UI (or `POST /demo/reset-sandbox`) instantly resets the caller's session to clean seed fixtures.

---

## 3. Fast Launch: Free Host (Render) + Static Host (Vercel)

### Step A: Deploy Backend API on Render (Free Web Service)

1. Fork or push the repository to GitHub.
2. Go to [dashboard.render.com](https://dashboard.render.com) and click **"New +"** $\to$ **"Blueprint"**.
3. Select your repository. Render will automatically detect [`render.yaml`](../render.yaml).
4. Configure the environment variables in the Render dashboard:
   ```env
   RELAY_DEMO_MODE=1
   RELAY_TOKEN_SECRET=a_random_hmac_secret_string_32_chars
   PORT=8000
   ```
   *(Optional for live GitHub ingestion)*:
   ```env
   GITHUB_TOKEN=ghp_your_github_personal_access_token
   GEMINI_API_KEY=your_gemini_api_key
   ```
5. Click **"Apply"**. Render will build the container using `api/Dockerfile`.
6. Once deployed, verify health:
   ```bash
   curl -s https://<your-render-app>.onrender.com/health
   # Expected: {"status":"ok","version":"0.2.0","mode":"standalone_demo","dataset":"synthetic"}
   ```

---

### Step B: Deploy Frontend on Vercel (Free Static CDN)

1. Log into [vercel.com](https://vercel.com) and click **"Add New..."** $\to$ **"Project"**.
2. Import your GitHub repository.
3. Configure Project Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `web`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Set Environment Variable:
   - `VITE_API_URL` = `https://<your-render-app>.onrender.com`
5. Click **"Deploy"**. Vercel will build the SPA and deploy it globally. The included [`web/vercel.json`](../web/vercel.json) automatically handles SPA route rewrites so deep links (`/case/case-001/handover`, `/limits`, etc.) work seamlessly.

---

## 4. Alternative: Deploy to Railway (1-Click Full Stack)

1. Install Railway CLI (`npm i -g @railway/cli`) or use [railway.app](https://railway.app).
2. Run in the root directory:
   ```bash
   railway up
   ```
3. Set environment variable `RELAY_DEMO_MODE=1` in the Railway service settings.
4. Set the frontend `VITE_API_URL` to the generated backend domain.

---

## 5. Production Mode vs. Demo Mode

| Feature | `RELAY_DEMO_MODE=1` (Demo / Hosted) | `RELAY_DEMO_MODE=0` (Production) |
|---|---|---|
| **Storage Backend** | In-memory session-scoped seed data | PostgreSQL 16 + pgvector database |
| **Demo Login** | Enabled (`POST /auth/demo-login`) | Disabled (returns HTTP 404) |
| **Authentication** | HMAC-SHA256 signed bearer token | Production OAuth2 / OIDC / SAML SSO |
| **Fixtures** | Seeded ShopLedger case (Priya Nair departure) | Live organization data ingest |
| **Sandbox Reset** | Enabled (`POST /demo/reset-sandbox`) | Disabled |
