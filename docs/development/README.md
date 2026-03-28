# Developer Guide

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 18+ |
| Docker & Docker Compose | v2 |
| Make | Any |
| Git | Any |

---

## Getting Started

```bash
git clone <repository>
cd wine-tastings-platform

# Install dependencies for all services
make install

# Start the full dev stack (all 9 services + PostgreSQL + Redis)
make dev

# Load demo data
make db-seed
```

The dev stack starts with hot-reload for all services. Frontend is on http://localhost:3001, API Gateway on http://localhost:3000.

**Demo accounts:**
| Email | Password | Role | Tenant |
|---|---|---|---|
| admin@cantinarossi.it | admin123 | producer | Cantina Rossi |
| admin@villabianchi.it | admin123 | producer | Villa Bianchi |

---

## Project Structure

```
wine-tastings-platform/
├── backend/
│   ├── database/
│   │   ├── init.sql                   # Schema — source of truth for all tables
│   │   ├── migrations/                # Additive schema changes (create as needed)
│   │   └── seeds/001_initial_data.sql # Demo data
│   └── services/
│       └── <service-name>/
│           ├── src/server.js          # Express application (single file per service)
│           ├── package.json           # Service-specific dependencies only
│           ├── package-lock.json
│           └── Dockerfile             # node:18-alpine production image
├── frontend/
│   ├── src/
│   │   └── main.js                    # Single entry point — all JS lives here
│   ├── public/
│   │   └── favicon.svg
│   ├── index.html
│   ├── vite.config.js
│   ├── nginx.conf                     # Production nginx config
│   ├── Dockerfile                     # Multi-stage: Vite build → nginx:alpine
│   └── Dockerfile.dev
├── docs/
├── .github/workflows/backend-ci.yml
├── docker-compose.yml                 # Production stack
├── docker-compose.dev.yml             # Development stack
├── Makefile
├── .env.example
├── .gitignore
└── CLAUDE.md                          # AI assistant context guide
```

---

## Backend Development

### Service Architecture

Each service in `backend/services/<name>/` is a self-contained Express application:

- One file: `src/server.js`
- Middleware order: `helmet()` → `cors()` → `express.json()` → routes → error handler
- All async route handlers use `try/catch` and return structured JSON errors
- Winston logger (JSON format) for all output — no `console.log`
- `pg.Pool` for all database access — never create one-off connections
- Graceful SIGTERM handling: close HTTP server, drain connection pool, exit

### Running a Single Service

```bash
cd backend/services/auth-service
npm install
npm run dev     # starts with nodemon; requires DATABASE_URL and REDIS_URL env vars
```

Or use the dev Docker stack which provides all dependencies automatically:

```bash
make dev
make logs-service SERVICE=auth-service
```

### Adding a New Service

1. Create `backend/services/<name>/src/server.js` following the existing pattern
2. Create `backend/services/<name>/package.json` — declare only the packages the service actually uses
3. Create `backend/services/<name>/Dockerfile` (copy from an existing service)
4. Add the service to `docker-compose.yml` and `docker-compose.dev.yml`
5. Register the service URL in `api-gateway/src/server.js` service registry
6. Add a health check in `docker-compose.yml`

### Database Changes

**Schema changes (DDL):** Add to `backend/database/init.sql` for new installations; create a numbered migration file in `backend/database/migrations/` for existing deployments:

```bash
# Create a migration
touch backend/database/migrations/002_add_waitlist.sql

# Apply migrations
make db-migrate
```

**Conventions:**
- All PKs: `UUID DEFAULT gen_random_uuid()`
- All mutable tables: `updated_at TIMESTAMP DEFAULT NOW()` + trigger (reuse `update_updated_at_column()`)
- Use parameterized queries only — never interpolate user input into SQL strings
- Add an index for any column used in `WHERE` or `JOIN` predicates

### Authentication

Protected routes use a `requireAuth` middleware (defined locally in each service). It verifies the JWT from the `Authorization: Bearer <token>` header using `JWT_SECRET`.

The API Gateway also verifies JWT on all protected routes before proxying, so most services receive pre-validated requests. The local `requireAuth` acts as a defence-in-depth layer.

---

## Frontend Development

The frontend is a **vanilla JavaScript SPA** built with Vite. There is no React, Vue, or Angular.

```bash
cd frontend
npm install
npm run dev     # Vite dev server on :3001; proxies /api to localhost:3000
npm run build   # Production build → frontend/dist/
```

### Code Conventions

- All JavaScript lives in `src/main.js`
- Use the `ApiClient` class for all HTTP requests — it handles auth headers automatically
- JWT token stored in `localStorage` under the key `wine_token`
- No framework imports — plain DOM APIs and `fetch`

### Vite Proxy

`vite.config.js` proxies all `/api` requests to `http://localhost:3000` during development, so the frontend can call `fetch('/api/tenants')` without CORS issues. In production, nginx handles the same proxy.

---

## Testing

**Framework:** Jest 29

```bash
# All services
make test

# Single service
cd backend/services/booking-service
npm test

# Frontend (once tests are added)
cd frontend
npm test
```

Test files should be placed at `backend/services/<name>/src/<name>.test.js`. The CI workflow runs `npm test -- --passWithNoTests` so missing test files do not fail the build — but tests should be written.

**CI environment:** GitHub Actions provides PostgreSQL 15 + Redis 7 for integration tests. The test database is `wine_tastings_test`.

---

## Code Style

```bash
# Run ESLint across all services
make lint

# Fix auto-fixable issues
cd backend/services/<name>
npm run lint
```

**Key rules:**
- No `console.log` — use Winston logger
- No string interpolation in SQL — use `$1, $2` placeholders
- Async route handlers must have `try/catch`
- Each service's `package.json` should list only what it actually `require()`s

---

## Git Workflow

```bash
# Start a feature
git checkout main && git pull
git checkout -b feature/your-feature-name

# Work, commit
git add <files>
git commit -m "feat: describe what and why"

# Before pushing
make test && make lint

# Push and open a PR against main
git push -u origin feature/your-feature-name
```

CI must pass before merging to `main`. The workflow runs per-service tests and a Docker build check.

---

## Debugging

### Backend Services

```bash
# Tail logs for all services
make logs

# Logs for a specific service
make logs-service SERVICE=booking-service

# Drop into a running container
docker compose -f docker-compose.dev.yml exec booking-service sh

# Connect to PostgreSQL
docker compose -f docker-compose.dev.yml exec postgres \
  psql -U wine_user wine_tastings_dev

# Connect to Redis
docker compose -f docker-compose.dev.yml exec redis redis-cli
```

### Frontend

```bash
cd frontend
npm run dev     # Vite dev server with detailed error overlay in the browser
```

Browser DevTools → Network tab shows all API requests. Check the API Gateway logs (`make logs-service SERVICE=api-gateway`) to see what the gateway is receiving and proxying.

### Common Issues

| Symptom | Cause | Fix |
|---|---|---|
| 503 from API Gateway | Downstream service is not running | Check `make logs-service SERVICE=<name>` |
| 401 on protected routes | Token expired or missing | Re-login; check `wine_token` in `localStorage` |
| Booking returns 409 | Slot is fully booked | Check participants vs `max_participants` |
| Email not delivered | `SMTP_HOST` not set | Expected; notification is queued with `status='pending'` |
| `npm install` fails | Node version < 18 | Run `node --version`; upgrade if needed |

---

## Security Checklist

When contributing code, verify:

- [ ] All SQL uses parameterized queries (`$1, $2`) — never string concatenation
- [ ] User-supplied data is validated at the route handler before use
- [ ] Passwords are hashed with bcrypt; never logged or returned in responses
- [ ] New services include `helmet()` and `cors()` middleware
- [ ] JWT verification uses `requireAuth` on all protected routes
- [ ] File uploads validate MIME type and file size
- [ ] HTML content destined for email is passed through `sanitize-html`
- [ ] No secrets committed to the repository (check `.gitignore`)
