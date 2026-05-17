# Chaos-Security-Monkey

Autonomous red-team / blue-team demo: Cursor-powered agents attack a vulnerable sandbox API, then patch it when an exploit succeeds.

## Deploy on Render (full agent, repo root)

Deploy the **entire repo** (orchestrator + `target-app`), not `target-app` alone.

### 1. Push to GitHub

Render deploys from Git. Ensure `main` is pushed to your remote.

### 2. Create the service

**Option A — Blueprint (recommended)**

1. [Render Dashboard](https://dashboard.render.com) → **New +** → **Blueprint**
2. Connect the repo; Render reads `render.yaml` at the repo root
3. When prompted, set **`CURSOR_API_KEY`** (from Cursor account settings)
4. Apply the blueprint

**Option B — Manual Web Service**

| Setting | Value |
|--------|--------|
| **Root Directory** | *(leave empty — repo root)* |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Health Check Path** | `/health` |

### 3. Environment variables

| Variable | Required | Notes |
|----------|----------|--------|
| `CURSOR_API_KEY` | Yes | Powers attacker + remediation agents |
| `JWT_SECRET` | No | Passed to `target-app` (auto-generated in blueprint) |
| `NODE_VERSION` | No | Use `20` if `better-sqlite3` fails to build |
| `STARTUP_TIMEOUT_MS` | No | Default `90000` on Render blueprint (slow cold starts) |

Render sets `PORT` and `RENDER=true` automatically.

### 4. What happens on deploy

1. Build installs root + `target-app` dependencies
2. `npm start` runs `monkey.ts`
3. Orchestrator boots `target-app` on `PORT` and waits for `/health`
4. Attacker agent runs, then remediation if exploit succeeded
5. On Render, **target-app stays up** so the service stays healthy (no restart loop)

### 5. Verify

```bash
curl -s https://YOUR-SERVICE.onrender.com/health
```

Check **Logs** in Render for agent output (`Phase 1`, `Phase 2`, etc.).

### Local run

```bash
cp .env.example .env   # add CURSOR_API_KEY
npm install && npm run build
npm start
```

Without `RENDER` set, the process exits after the pipeline (local default).

## Project layout

| Path | Role |
|------|------|
| `monkey.ts` | Orchestrator |
| `src/attackerAgent.ts` | Cursor SDK exploit generation + verification |
| `src/remediationAgent.ts` | Cursor SDK patching + re-test |
| `target-app/` | Intentionally vulnerable Express sandbox |
