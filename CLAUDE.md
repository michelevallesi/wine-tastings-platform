# CLAUDE.md — Wine Tastings Platform

This document provides AI assistants with the essential context needed to work effectively on this codebase.

---

## Project Overview

A **multi-tenant SaaS platform** for Italian wine producers to manage and sell wine tasting experiences. Customers can browse available tastings, make bookings, receive QR-coded confirmations, and pay online. Producers manage their profile,catalog, schedule, and bookings through a dedicated interface.

- **Version:** 1.0.0
- **License:** MIT
- **Language/Locale:** Multilanguage-facing product (Multilanguage labels, demo data, documentation)

---

## Architecture

### Microservices Backend (Node.js / Express)

Nine independent services, each on its own port, all exposed through the API Gateway:

| Service | Port | Responsibility |
|---|---|---|
| `api-gateway` | 3000 | Request routing, auth middleware, rate limiting |
| `auth-service` | 3001 | JWT authentication, sessions (Redis) |
| `tenant-service` | 3002 | Multi-tenant management (wine producers) |
| `tasting-service` | 3003 | Tasting catalog, availability |
| `booking-service` | 3004 | Reservations, QR code generation |
| `payment-service` | 3005 | Stripe & PayPal integration |
| `notification-service` | 3006 | Email (nodemailer) & SMS (Twilio) |
| `analytics-service` | 3007 | Reporting and metrics |
| `file-service` | 3008 | File uploads, AWS S3 |

**Implementation status:** All 9 services have full `src/` implementations. `payment-service` and `file-service` use mock/local-disk implementations for Stripe/PayPal and S3 respectively (see TODO comments in those files).

### Frontend

- **Framework:** Vanilla JavaScript with Vite as build tool
- **No UI framework** (no React, Vue, or Angular)
- Entry point: `frontend/src/main.js`
- Production: served via nginx with reverse proxy to API Gateway
- Chart.js and qrcode libraries available as dependencies

### Database

- **PostgreSQL 15** (primary datastore)
- **Redis 7** (JWT session storage, caching)

---

## Directory Structure

```
wine-tastings-platform/
├── .github/workflows/backend-ci.yml   # GitHub Actions CI
├── backend/
│   ├── database/
│   │   ├── init.sql                   # Schema definition (source of truth)
│   │   └── seeds/001_initial_data.sql # Demo data
│   └── services/
│       ├── api-gateway/src/server.js
│       ├── auth-service/src/server.js
│       ├── tenant-service/src/server.js
│       ├── tasting-service/src/server.js
│       ├── booking-service/src/server.js
│       ├── payment-service/src/server.js
│       ├── notification-service/src/server.js
│       ├── analytics-service/src/server.js
│       └── file-service/src/server.js
├── frontend/
│   ├── src/main.js                    # Single entry point
│   ├── index.html
│   ├── vite.config.js
│   ├── nginx.conf                     # Production nginx config
│   ├── Dockerfile                     # Multi-stage production build
│   └── Dockerfile.dev
├── docs/
│   ├── api/README.md
│   ├── deployment/README.md
│   └── development/README.md
├── docker-compose.yml                 # Production stack
├── docker-compose.dev.yml             # Development stack
├── Makefile                           # Build & operational commands
└── README.md
```

---

## Database Schema

All tables use UUID primary keys and `created_at`/`updated_at` timestamps. The schema is defined in `backend/database/init.sql`.

### Custom Enum Types
- `booking_status`: `pending | confirmed | cancelled | completed`
- `payment_status`: `pending | paid | failed | refunded`
- `user_role`: `admin | producer | customer`

### Core Tables

**`tenants`** — Wine producers/estates
- `id` (UUID PK), `name`, `slug` (unique), `description`, `location`, `email`, `phone`, `website`, `logo_url`, `settings` (JSONB), `is_active`

**`users`** — Platform users
- `id` (UUID PK), `tenant_id` (FK), `email` (unique), `password_hash`, `name`, `phone`, `role`, `is_active`, `email_verified`, `last_login_at`

**`tastings`** — Wine tasting events
- `id` (UUID PK), `tenant_id` (FK), `name`, `slug`, `description`, `wines` (JSONB), `price`, `currency`, `max_participants`, `duration_hours`, `available_days` (JSONB), `time_slots` (JSONB), `image_url`, `is_active`
- Unique constraint: `(tenant_id, slug)`

**`bookings`** — Customer reservations
- `id` (UUID PK), `tenant_id` (FK), `tasting_id` (FK), `customer_name`, `customer_email`, `customer_phone`, `booking_date`, `booking_time`, `participants`, `total_price`, `currency`, `status`, `payment_status`, `qr_code` (unique), `special_requests`, `payment_reference`

**`payments`** — Payment records
- `id` (UUID PK), `booking_id` (FK), `amount`, `currency`, `payment_method`, `payment_provider`, `transaction_id` (unique), `status`, `processed_at`

**`notifications`** — Async notification queue
- `id`, `tenant_id`, `booking_id`, `type`, `recipient_email`, `subject`, `content`, `status` (`pending | sent | failed`), `sent_at`

**`files`** — Uploaded file metadata
- `id`, `tenant_id`, `user_id`, `filename`, `original_name`, `mime_type`, `file_size`, `file_path`, `uploaded_at`

---

## API Design Conventions

### Base URL
- Development: `http://localhost:3000`
- Production: `https://api.wine-tastings.com`

### Authentication
```
Authorization: Bearer <jwt_token>
```
JWT tokens expire after 24 hours. Refresh via `POST /api/auth/refresh`.

### Standard Response Envelope
```json
{
  "success": true,
  "data": {},
  "message": "Operation successful",
  "timestamp": "2025-08-19T19:52:00Z"
}
```

### Route Prefix Pattern
All service routes follow: `/api/<service-name>/...`
- `/api/auth/...`, `/api/tenants/...`, `/api/tastings/...`, `/api/bookings/...`, etc.

### Key Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/auth/login | No | Returns `token` (24h JWT) + `refreshToken` (7d) |
| POST | /api/auth/refresh | No | Exchange refresh token for new access token |
| POST | /api/auth/logout | Yes | Revoke session and all refresh tokens |
| GET | /api/auth/me | Yes | Current user info |
| GET | /api/tenants | No | List all active tenants |
| GET | /api/tenants/:id | No | Tenant by UUID or slug |
| GET | /api/tastings/tenant/:tenantId | No | Tastings for a tenant |
| GET | /api/tastings/:id | No | Single tasting by UUID |
| POST | /api/tastings | Yes | Create tasting (producer) |
| PUT | /api/tastings/:id | Yes | Update tasting (producer) |
| DELETE | /api/tastings/:id | Yes | Soft-delete tasting (producer) |
| POST | /api/bookings | No | Create booking (generates QR code) |
| GET | /api/bookings/:id | Yes | Booking detail |
| PATCH | /api/bookings/:id | Yes | Update booking status |
| GET | /api/bookings/tenant/:tenantId | Yes | All bookings for a tenant |
| GET | /api/bookings/:id/qrcode | No | QR code image (PNG) |
| POST | /api/payments/process | No | Process payment (mock — Stripe/PayPal TODO) |
| GET | /api/payments/:bookingId | Yes | Payment records for a booking |
| POST | /api/payments/refund | Yes | Issue refund |
| POST | /api/notifications/send | No | Queue and send email notification |
| GET | /api/notifications | No | List notifications (filter by tenant/booking) |
| GET | /api/analytics/summary/:tenantId | Yes | Booking + revenue summary |
| GET | /api/analytics/bookings/:tenantId | Yes | Booking trends over time |
| GET | /api/analytics/revenue/:tenantId | Yes | Revenue by tasting |
| POST | /api/files/upload | Yes | Upload file (local disk; S3 TODO) |
| GET | /api/files/:id | No | File metadata |
| DELETE | /api/files/:id | Yes | Delete file and metadata |

Date format: ISO 8601 (`YYYY-MM-DDTHH:mm:ssZ`)

---

## Development Workflow

### Prerequisites
- Docker & Docker Compose
- Node.js >= 18.0.0
- Make

### Starting the Development Environment
```bash
make install   # Install all service dependencies
make dev       # Start development stack (docker-compose.dev.yml)
```

Development-specific settings:
- PostgreSQL on port `5433` (avoids conflicts with local 5432)
- Redis without password
- Hot-reload via nodemon for all backend services; frontend uses Vite HMR
- Database: `wine_tastings_dev`

### Useful Make Targets
```bash
make dev              # Start dev environment
make prod             # Start production environment
make test             # Run all service tests
make lint             # ESLint check across services
make db-seed          # Seed demo data
make db-migrate       # Run database migrations
make logs             # Tail all service logs
make logs-service SERVICE=api-gateway  # Logs for specific service
make stop             # Stop all containers
make clean            # Remove volumes and prune images
make backup-db        # Dump PostgreSQL
make health           # Run health checks
make monitoring       # Start Prometheus + Grafana
```

### Service-Level Development
Each service in `backend/services/<name>/` follows this structure:
```
<service>/
├── src/server.js     # Main Express application
├── package.json      # Service-specific dependencies
└── Dockerfile        # Production image (node:18-alpine)
```

To work on a single service independently:
```bash
cd backend/services/<service-name>
npm install
npm run dev    # starts with nodemon
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev   # Vite dev server on port 3001
```
Vite proxies `/api` requests to `localhost:3000` (API Gateway).

---

## Testing

**Framework:** Jest 29.5.0

```bash
# Run tests for a specific service
cd backend/services/<service-name>
npm test

# Run all tests
make test
```

**CI Environment:** Tests run against PostgreSQL 15 + Redis 7 via GitHub Actions. The test database is `wine_tastings_test`.

**Note:** Actual test implementations are minimal — most test infrastructure (jest config, service test files) needs to be written.

---

## Key Implementation Details

### Service Communication
Services communicate via **HTTP** through the API Gateway. There is no message queue or service mesh — the gateway proxies requests directly to each service using `http-proxy-middleware`.

### Authentication Flow
1. Client POSTs credentials to `/api/auth/login`
2. Auth service validates against DB using `bcrypt`, issues JWT signed with `JWT_SECRET`
3. JWT stored client-side in `localStorage`
4. All protected routes verified by the API Gateway middleware before proxying

### QR Code Generation
Booking service auto-generates a unique QR code upon booking creation using the `qrcode` npm package. The code encodes booking details and is accessible via `/api/bookings/:id/qrcode`.

### Multi-Tenancy
Every resource (users, tastings, bookings, etc.) is scoped to a `tenant_id`. The tenant can be identified by UUID or slug in API calls. There is no row-level security in PostgreSQL — tenancy is enforced at the application layer.

### Rate Limiting
API Gateway applies: **1000 requests per 15 minutes per IP address**.

### Logging
All services use **Winston** with JSON output. Log aggregation is not configured in the current setup (Prometheus + Grafana are monitoring, not log aggregation).

---

## Environment Variables

### Required for All Services
| Variable | Description |
|---|---|
| `NODE_ENV` | `development`, `test`, or `production` |
| `PORT` | Service port (defined per-service in compose files) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | JWT signing secret — **must be set in production** (default fallback is `'dev-secret'`) |

### Additional Service-Specific Variables
| Variable | Service | Description |
|---|---|---|
| `ALLOWED_ORIGINS` | api-gateway | Comma-separated CORS origins |
| `STRIPE_SECRET_KEY` | payment-service | Stripe API key |
| `PAYPAL_CLIENT_ID` | payment-service | PayPal client ID |
| `PAYPAL_CLIENT_SECRET` | payment-service | PayPal secret |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | notification-service | Email config |
| `AWS_S3_BUCKET` | file-service | S3 bucket name |
| `FILE_STORAGE_PATH` | file-service | Local fallback storage path |

**Important:** There is no `.env.example` file. Default values are embedded in `docker-compose.yml`. Always create a proper `.env` file for production with strong secrets.

---

## Docker & Deployment

### Docker Compose Environments

| File | Purpose |
|---|---|
| `docker-compose.dev.yml` | Local development with hot-reload and exposed ports |
| `docker-compose.yml` | Production with Prometheus + Grafana monitoring |

### Container Strategy
- All service containers use `node:18-alpine` (minimal image, non-root user)
- Frontend uses multi-stage build: Node for `vite build`, then `nginx:alpine` to serve
- All services share `wine-network` Docker bridge network

### Infrastructure References
The docs reference Kubernetes (`infrastructure/kubernetes/`) and Terraform (`infrastructure/terraform/`) configurations, but these directories do not currently exist in the repository.

---

## Security Considerations

When modifying code, be aware of and maintain these security practices:

1. **JWT Secret:** Never commit `JWT_SECRET` with a weak value. The fallback `'dev-secret'` must never reach production.
2. **SQL Queries:** Use parameterized queries with `pg` (the `$1, $2` placeholder syntax) — never string-interpolate user input into SQL.
3. **Password Hashing:** Always use `bcrypt` for passwords. Never store plaintext passwords.
4. **CORS:** `ALLOWED_ORIGINS` must be explicitly set in production. Avoid wildcards (`*`).
5. **Rate Limiting:** The 1000 req/15 min limit is set at the gateway. Adjust for production loads.
6. **Helmet:** All services use `helmet` middleware for security headers.
7. **Input Validation:** Validate all user-supplied data at service boundaries before using in queries or business logic.

---

## CI/CD

**GitHub Actions** (`.github/workflows/backend-ci.yml`):
- Triggers on push to `main`/`develop` and PRs to `main` (backend file changes only)
- Runs: `npm ci` → `npm test` → `docker-compose build` (main branch only)
- No frontend CI pipeline exists yet
- No automated deployment or image registry push is configured

---

## Conventions & Code Style

### Backend Services
- One Express app per service, configured in `src/server.js`
- Middleware order: `helmet` → `cors` → `express.json()` → routes → error handler
- All async route handlers should use `try/catch` and pass errors to `next(err)`
- Use Winston for logging — no `console.log` in production code
- Use connection pools (`pg.Pool`) — never create single-use DB connections

### Database
- All schema changes go in `backend/database/init.sql`
- For additive migrations, create a new file in `backend/database/seeds/` or a `migrations/` folder
- Always use UUIDs (`gen_random_uuid()`) for primary keys
- Add `updated_at` triggers for any mutable table

### Frontend
- Vanilla JS only — no framework imports
- Use the existing `ApiClient` class in `main.js` for all HTTP requests
- JWT token managed via `localStorage` (`wine_token` key)
- Build artifacts go to `frontend/dist/` (gitignored)

### Git
- Branch from `main`
- Clear, descriptive commit messages
- CI must pass before merging to `main`

---

## Demo / Seed Data

The seed file (`backend/database/seeds/001_initial_data.sql`) creates:
- **Tenants:** Cantina Rossi (Chianti region), Villa Bianchi (Barolo region)
- **Users:** Admin accounts per tenant (password: `admin123`)
- **Tastings:** 3 sample tastings with wine arrays in JSONB
- **Bookings:** 2 sample bookings with `confirmed`/`paid` status

Use `make db-seed` to load this data into the development database.
