# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Known TODOs (before GA)
- Wire Stripe and PayPal SDKs in payment-service (currently mock)
- Replace local disk storage with AWS S3 in file-service
- Write Jest test suites for all 9 services
- Wire Twilio SMS in notification-service
- Build booking flow and producer dashboard UI in frontend
- Add email verification flow (`email_verified` flag exists, no email sent yet)
- Create Kubernetes manifests and Terraform IaC
- Add Docker registry push and automated deployment to CI pipeline

---

## [1.0.0] - 2026-03-28

### Added

**Architecture**
- 9-service microservices backend (Node.js / Express), all behind a single API Gateway
- Multi-tenant data model — every resource scoped by `tenant_id`; isolation enforced at application layer
- PostgreSQL 15 primary datastore with UUID PKs and `updated_at` triggers on all mutable tables
- Redis 7 for JWT session storage and refresh token management
- Vanilla JS frontend (Vite) served by nginx with API reverse proxy

**Authentication (auth-service)**
- JWT login returning 24-hour access token + 7-day refresh token
- Refresh token rotation via `POST /api/auth/refresh`
- Full session revocation on logout (Redis keys purged)
- `last_login_at` timestamp updated on every successful login
- Email normalization (lowercase + trim) before authentication

**Tenant Management (tenant-service)**
- Tenant lookup by UUID or human-readable slug via single parameterized query

**Tasting Catalog (tasting-service)**
- CRUD for tasting experiences (create, update, soft-delete)
- JSONB storage for wine lists, available days, and time slots
- Composite unique constraint on `(tenant_id, slug)`

**Booking System (booking-service)**
- Customer booking creation without requiring an account
- Atomic capacity enforcement using `SELECT FOR UPDATE` transaction — prevents overbooking under concurrent load
- Unique QR code generated with `crypto.randomUUID()` on every booking
- Input validation: future date, participants > 0, email format, capacity check
- Partial composite index on `(tasting_id, booking_date, booking_time) WHERE status <> 'cancelled'`

**Payments (payment-service)**
- Payment record persistence with provider, method, amount, and transaction ID
- Duplicate payment guard (HTTP 409 if booking already paid)
- Refund endpoint updates both `payments` and `bookings` tables atomically
- Stripe and PayPal SDK dependencies wired; integration marked as TODO

**Notifications (notification-service)**
- Email delivery via nodemailer with optional SMTP config (queues only when `SMTP_HOST` unset)
- HTML content sanitized with `sanitize-html` before storage and delivery
- Failed notification retry: background job polls every 5 minutes, retries for up to 24 hours
- Graceful shutdown clears retry timer

**Analytics (analytics-service)**
- Booking + revenue summary per tenant
- Booking trend over a date range
- Revenue breakdown by tasting
- All endpoints protected by JWT

**File Management (file-service)**
- Multipart file upload with MIME type allowlist (JPEG, PNG, GIF, WebP, PDF) and 10 MB limit
- File metadata stored in PostgreSQL; linked to tenant and uploading user
- Local disk storage with AWS S3 upgrade path documented via TODO
- File deletion removes both DB record and physical file

**Infrastructure**
- Docker Compose: separate `docker-compose.dev.yml` (hot-reload) and `docker-compose.yml` (production + Prometheus/Grafana)
- All 9 services in dev stack using `node:18-alpine` + bind-mounted `src/` + named `node_modules` volumes + nodemon
- `Strict-Transport-Security` (HSTS) header and HTTP→HTTPS redirect block in nginx
- Dockerfile: `npm install` (was `npm ci`); `package-lock.json` generated for all services

**CI/CD**
- GitHub Actions workflow: per-service `npm install` + `npm test --passWithNoTests` loop
- Docker image build on `main` branch merges

**Tooling**
- `.env.example` with all 15 environment variables documented
- `.gitignore` covering `node_modules/`, `.env`, `dist/`, logs, uploads, OS and IDE files
- `Makefile` with 15 targets for dev, prod, test, lint, DB, logs, monitoring, backup

**Documentation**
- `CLAUDE.md` — comprehensive AI assistant onboarding guide
- `docs/PRD.md` — full Product Requirements Document
- `docs/api/README.md` — complete API reference (27 endpoints)
- `docs/deployment/README.md` — deployment guide (dev, prod, monitoring)
- `docs/development/README.md` — developer guide (setup, conventions, debugging)

### Fixed
- API Gateway: `on: {}` (silently ignored http-proxy-middleware v3 syntax) → `onProxyReq` / `onError` (correct v2 top-level options)
- Auth service: Redis client `.connect()` was never called — sessions never persisted
- Tenant lookup: replaced two-query fallback with single regex + single parameterized query
- All services: removed copy-pasted unused dependencies (each service now declares only what it requires)
- Docker builds: removed `npm ci` calls that failed due to missing `package-lock.json` files
- CI workflow: removed reference to non-existent `backend/package-lock.json`; replaced monorepo `npm test` with per-service loop

### Security
- Parameterized SQL queries throughout — no string interpolation of user input
- bcrypt password hashing; seed uses PostgreSQL `crypt()` (compatible)
- `helmet` middleware on all 9 services
- `sanitize-html` on all outbound email HTML content
- CORS restricted to explicit `ALLOWED_ORIGINS`; no wildcard in production
- HSTS header added to nginx
- Rate limiting at API Gateway: 1,000 requests / 15 min / IP

---

## [0.1.0] - 2025-08-19

### Added
- Initial project scaffolding: 9-service directory structure, database schema, seed data, Docker Compose files, Makefile, GitHub Actions CI, frontend skeleton
