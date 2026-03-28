# Product Requirements Document
## Wine Tastings Platform — v1.0.0

**Document status:** Final
**Last updated:** 2026-03-28
**Owner:** Product

---

## 1. Executive Summary

The Wine Tastings Platform is a **multi-tenant SaaS product** that enables Italian wine producers (cantinas, estates, cooperatives) to publish, manage, and sell their wine tasting experiences online. Customers browse available tastings, book a slot, pay, and receive a QR-coded confirmation. Producers control their catalog, schedule availability, and track revenue through a dedicated dashboard.

The platform is designed to serve an underserved segment of agritourism: small-to-medium wine producers who rely on email and phone bookings today and need a zero-friction upgrade path to digital commerce.

---

## 2. Problem Statement

### 2.1 For Wine Producers
- Managing reservations over phone and email is error-prone and time-consuming.
- Double-booking a tasting slot causes reputational damage and revenue loss.
- There is no centralised view of upcoming bookings, revenue, or customer data.
- Producers lack the technical resources to build and maintain their own booking system.

### 2.2 For Customers
- Discovering available wine tastings requires calling ahead or visiting in person.
- No self-service booking: customers wait for producers to respond.
- Payment is typically cash-on-arrival, reducing convenience.
- No digital confirmation or reminder — high no-show rates.

---

## 3. Goals & Success Metrics

| Goal | Metric | Target (6 months post-launch) |
|---|---|---|
| Reduce producer admin burden | Time spent on booking management per week | −60% vs. baseline |
| Eliminate double-bookings | Concurrent booking conflicts | 0 |
| Increase tasting fill rate | % of available slots booked | ≥ 70% |
| Customer satisfaction | Post-tasting NPS | ≥ 45 |
| Platform adoption | Active tenants (wine producers) | 50 |
| Revenue throughput | Monthly bookings processed | 2,000 |

### Out of scope for v1.0
- Mobile native apps (iOS / Android)
- Loyalty / membership programmes
- Wine shop / e-commerce (physical products)
- Automated review aggregation

---

## 4. Users & Personas

### 4.1 Wine Producer (Tenant Admin / Producer role)
- **Who:** Owner or staff of a cantina or wine estate in Italy
- **Tech literacy:** Moderate — comfortable with email and basic web apps
- **Goals:** Publish tastings, manage booking schedule, get paid reliably, avoid overbooking
- **Pain points:** Phone interruptions, manual calendar tracking, cash handling

### 4.2 Customer
- **Who:** Wine enthusiast, tourist, or local — books tastings directly on the platform
- **Tech literacy:** General consumer
- **Goals:** Discover tastings, book a preferred slot, receive confirmation, arrive and enjoy
- **Pain points:** No online availability, uncertainty about booking status, unexpected travel

### 4.3 Platform Administrator
- **Who:** Internal operations team managing the SaaS platform
- **Goals:** Onboard new tenants, monitor system health, handle support escalations
- **Access:** Full admin role across all tenants

---

## 5. Feature Requirements

### 5.1 Multi-Tenant Management (P0)

| ID | Requirement | Notes |
|---|---|---|
| T-01 | Each tenant (wine producer) is isolated — data is never shared across tenants | Enforced at application layer via `tenant_id` FK on every resource |
| T-02 | Tenants are identified by UUID or human-readable slug (e.g. `cantina-rossi`) | Used in URLs and API calls |
| T-03 | Tenant profile includes: name, slug, description, location, email, phone, website, logo | JSONB `settings` field for extensible config |
| T-04 | Tenants can be activated or deactivated by platform admins | `is_active` flag; inactive tenants not listed publicly |

### 5.2 Authentication & User Management (P0)

| ID | Requirement | Notes |
|---|---|---|
| A-01 | Users log in with email + password | Email normalized to lowercase; bcrypt password hashing |
| A-02 | Login returns a 24-hour JWT access token and a 7-day refresh token | Refresh token stored in Redis; rotated on use |
| A-03 | Token refresh extends the session without re-authentication | `POST /api/auth/refresh` |
| A-04 | Logout revokes the current session and all refresh tokens for the user | Redis keys purged on logout |
| A-05 | Three roles: `admin`, `producer`, `customer` | Role enforced at route level |
| A-06 | `last_login_at` timestamp updated on every successful login | Used for inactive account monitoring |
| A-07 | Rate limiting on all public routes: 1,000 requests / 15 min / IP | Configured at API Gateway |

### 5.3 Tasting Catalog (P0)

| ID | Requirement | Notes |
|---|---|---|
| C-01 | Producers can create, update, and soft-delete tasting experiences | `is_active = false` hides from public listing |
| C-02 | Each tasting has: name, slug, description, list of wines (JSONB), price, currency, duration, max participants | |
| C-03 | Availability is expressed as available weekdays and time slots (JSONB arrays) | Flexible enough for varied schedules |
| C-04 | Slug is unique per tenant; allows SEO-friendly URLs | Composite unique constraint `(tenant_id, slug)` |
| C-05 | Public API lists all active tastings for a given tenant without authentication | `GET /api/tastings/tenant/:tenantId` |

### 5.4 Booking & Reservation (P0)

| ID | Requirement | Notes |
|---|---|---|
| B-01 | Customers can create a booking without an account | Name, email, phone, date, time, participant count |
| B-02 | Booking capacity is enforced atomically — concurrent requests cannot overbook a slot | DB transaction with `SELECT FOR UPDATE` on the tasting row |
| B-03 | Booking date must be in the future | Validated at service boundary |
| B-04 | Participant count must be ≥ 1 and ≤ tasting max_participants | Validated at service boundary |
| B-05 | Every booking receives a unique QR code upon creation | Generated with `qrcode` npm package; encoded booking reference |
| B-06 | QR code image (PNG) is accessible without authentication | `GET /api/bookings/:id/qrcode` — customers receive link by email |
| B-07 | Booking status lifecycle: `pending → confirmed → completed` or `→ cancelled` | Producers update status via `PATCH /api/bookings/:id` |
| B-08 | Producers can view all bookings for their tenant | `GET /api/bookings/tenant/:tenantId` (auth required) |

### 5.5 Payments (P0 architecture, P1 live integration)

| ID | Requirement | Notes |
|---|---|---|
| P-01 | Payment records are stored per booking with provider, method, amount, and transaction ID | `payments` table |
| P-02 | Booking `payment_status` is updated to `paid` after successful payment | |
| P-03 | Refunds mark the payment `refunded` and the booking `cancelled` | `POST /api/payments/refund` (auth required) |
| P-04 | Stripe integration (credit card) | **TODO** — mock implementation in v1.0; SDK wired via `stripe` package |
| P-05 | PayPal integration | **TODO** — mock implementation in v1.0; SDK wired via `paypal-rest-sdk` package |
| P-06 | Duplicate payment guard — bookings already `paid` cannot be charged again | Returns HTTP 409 |

### 5.6 Notifications (P0)

| ID | Requirement | Notes |
|---|---|---|
| N-01 | System sends email confirmation after booking creation | Via nodemailer SMTP |
| N-02 | HTML email content is sanitized before delivery to prevent XSS | `sanitize-html` with allowlist of safe tags |
| N-03 | Notifications are persisted in DB with status `pending → sent / failed` | Allows audit and retry |
| N-04 | Failed notifications are retried every 5 minutes for up to 24 hours | Background `setInterval` job in notification-service |
| N-05 | SMS notifications via Twilio | Dependency included; integration wired in future iteration |
| N-06 | SMTP is optional — when `SMTP_HOST` is not set, notifications are queued only | Safe for local development |

### 5.7 Analytics & Reporting (P1)

| ID | Requirement | Notes |
|---|---|---|
| AN-01 | Summary dashboard per tenant: total bookings, confirmed, revenue | `GET /api/analytics/summary/:tenantId` |
| AN-02 | Booking trends over a date range | `GET /api/analytics/bookings/:tenantId` |
| AN-03 | Revenue breakdown by tasting | `GET /api/analytics/revenue/:tenantId` |
| AN-04 | All analytics endpoints require authentication | Producer or admin role |

### 5.8 File Management (P1)

| ID | Requirement | Notes |
|---|---|---|
| F-01 | Producers can upload images (JPEG, PNG, GIF, WebP) and PDFs | Multipart upload; 10 MB file size limit |
| F-02 | File metadata (filename, MIME type, size, path) stored in DB | Linked to tenant and uploading user |
| F-03 | Local disk storage is the current backend | Configurable via `FILE_STORAGE_PATH` |
| F-04 | AWS S3 storage | **TODO** — `aws-sdk` included; swap disk storage for `multer-s3` when ready |
| F-05 | Unauthenticated users can retrieve file metadata by ID | Image URLs used in tasting catalog |
| F-06 | File deletion removes both the DB record and the physical file | |

---

## 6. Architecture Overview

```
Browser / Mobile
       │
       ▼
  [Frontend — nginx]          Vite-built vanilla JS SPA
  port 80 (prod) / 3001 (dev)
       │  /api/*
       ▼
  [API Gateway]               Express + http-proxy-middleware
  port 3000                   Helmet, CORS, rate limiting (1000 req/15 min/IP)
       │                      JWT verification on protected routes
       ├─────────────────────────────────────────────────────┐
       │                                                     │
  [auth-service:3001]    [tenant-service:3002]    [tasting-service:3003]
  [booking-service:3004] [payment-service:3005]   [notification-service:3006]
  [analytics-service:3007]                        [file-service:3008]
       │
  ┌────┴────────────────┐
  │                     │
[PostgreSQL 15]      [Redis 7]
 Primary datastore    JWT sessions + refresh tokens
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| One Express app per service | Simple deployment, independent scaling, isolated dependencies |
| HTTP proxying (no message queue) | Low operational overhead for v1.0; upgrade path to RabbitMQ/Kafka for async if needed |
| Application-layer multi-tenancy | No PostgreSQL RLS required; simpler schema; `tenant_id` enforced in every query |
| `SELECT FOR UPDATE` for booking slots | Prevents race-condition overbooking without distributed locks |
| Vanilla JS frontend | Minimises build complexity and bundle size for a content-heavy SPA |
| JWT + Redis sessions | Stateless access tokens; stateful refresh + logout invalidation |

---

## 7. Data Model Summary

```
tenants (1) ──< users (N)
tenants (1) ──< tastings (N)
tenants (1) ──< bookings (N)
tastings (1) ──< bookings (N)
bookings (1) ──< payments (N)
bookings (1) ──< notifications (N)
tenants  (1) ──< notifications (N)
tenants  (1) ──< files (N)
users    (1) ──< files (N)
```

All primary keys are UUIDs (`gen_random_uuid()`). All mutable tables have `updated_at` triggers.

### Custom Enum Types
- `booking_status`: `pending | confirmed | cancelled | completed`
- `payment_status`: `pending | paid | failed | refunded`
- `user_role`: `admin | producer | customer`

---

## 8. API Contract

All endpoints served under `https://api.wine-tastings.com` (prod) / `http://localhost:3000` (dev).

**Response envelope:**
```json
{ "success": true, "data": {}, "message": "...", "timestamp": "ISO8601" }
```

**Authentication:** `Authorization: Bearer <jwt>` — 24-hour access token.

| Method | Path | Auth | Service |
|---|---|---|---|
| POST | /api/auth/login | — | auth |
| POST | /api/auth/refresh | — | auth |
| POST | /api/auth/logout | ✓ | auth |
| GET | /api/auth/me | ✓ | auth |
| GET | /api/tenants | — | tenant |
| GET | /api/tenants/:id | — | tenant |
| GET | /api/tastings/tenant/:tenantId | — | tasting |
| GET | /api/tastings/:id | — | tasting |
| POST | /api/tastings | ✓ | tasting |
| PUT | /api/tastings/:id | ✓ | tasting |
| DELETE | /api/tastings/:id | ✓ | tasting |
| POST | /api/bookings | — | booking |
| GET | /api/bookings/:id | ✓ | booking |
| PATCH | /api/bookings/:id | ✓ | booking |
| GET | /api/bookings/tenant/:tenantId | ✓ | booking |
| GET | /api/bookings/:id/qrcode | — | booking |
| POST | /api/payments/process | — | payment |
| GET | /api/payments/:bookingId | ✓ | payment |
| POST | /api/payments/refund | ✓ | payment |
| POST | /api/notifications/send | — | notification |
| GET | /api/notifications | — | notification |
| GET | /api/analytics/summary/:tenantId | ✓ | analytics |
| GET | /api/analytics/bookings/:tenantId | ✓ | analytics |
| GET | /api/analytics/revenue/:tenantId | ✓ | analytics |
| POST | /api/files/upload | ✓ | file |
| GET | /api/files/:id | — | file |
| DELETE | /api/files/:id | ✓ | file |

---

## 9. Security Requirements

| Requirement | Implementation |
|---|---|
| Password storage | bcrypt hashing; no plaintext passwords ever stored |
| SQL injection prevention | Parameterized queries (`$1, $2` syntax) throughout |
| XSS in emails | `sanitize-html` applied to all notification HTML content |
| Security headers | `helmet` middleware on every service |
| CORS | Explicit `ALLOWED_ORIGINS` env var; no wildcard `*` in production |
| HTTPS | `Strict-Transport-Security` header; HTTP→HTTPS redirect block in nginx |
| JWT secret | `JWT_SECRET` env var required; `'dev-secret'` default must not reach production |
| Rate limiting | 1,000 requests / 15 min / IP at API Gateway |
| File uploads | MIME type allowlist (JPEG, PNG, GIF, WebP, PDF); 10 MB size cap |

---

## 10. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Availability | 99.5% uptime target (SLA for tenants) |
| Response time | P95 API response < 300 ms under normal load |
| Scalability | Horizontal scaling of individual services via Docker/Kubernetes replicas |
| Data isolation | Zero cross-tenant data leakage — enforced and tested per endpoint |
| Audit logging | Winston JSON logs on all services; log aggregation to be configured |
| Monitoring | Prometheus + Grafana included in production Docker Compose stack |
| Backup | Daily PostgreSQL dump via `make backup-db` |
| i18n | Italian-language content; date format ISO 8601; currency EUR default |

---

## 11. Development & Deployment

### Environments

| Environment | Command | DB Port | Notes |
|---|---|---|---|
| Development | `make dev` | 5433 | All 9 services with nodemon hot-reload + Vite HMR |
| Production | `make prod` | 5432 | Prometheus + Grafana monitoring included |

### CI/CD Pipeline (GitHub Actions)
- Triggers on push to `main`/`develop` and PRs to `main`
- Per-service: `npm install` → `npm test --passWithNoTests`
- Docker image build on `main` branch only
- No automated deployment or registry push yet (manual `make prod`)

### Infrastructure TODOs
- Kubernetes manifests (`infrastructure/kubernetes/`) — not yet created
- Terraform IaC (`infrastructure/terraform/`) — not yet created
- Container registry push in CI
- Frontend CI pipeline (currently backend-only)

---

## 12. Roadmap & Open TODOs

### v1.0 Known Gaps (must resolve before GA)

| ID | Area | Description | Priority |
|---|---|---|---|
| R-01 | Payments | Wire Stripe SDK (`stripe.charges.create`) in payment-service | P0 |
| R-02 | Payments | Wire PayPal SDK payment + execute flow in payment-service | P0 |
| R-03 | File storage | Replace disk storage with `multer-s3` + `AWS_S3_BUCKET` in file-service | P1 |
| R-04 | Testing | Write Jest test suites for all 9 services | P1 |
| R-05 | SMS | Wire Twilio in notification-service for SMS confirmations | P1 |
| R-06 | Frontend | Build booking flow, tasting catalog, and producer dashboard UI | P0 |
| R-07 | Auth | Email verification flow (`email_verified` flag exists but no verification email) | P1 |
| R-08 | Infra | Create Kubernetes manifests and Terraform IaC | P2 |
| R-09 | CI/CD | Add Docker registry push + automated deployment to CI pipeline | P2 |
| R-10 | Frontend | Add frontend CI pipeline (Vite build + lint) | P2 |

### v1.1 Candidate Features
- Customer self-service portal (view / cancel bookings without logging in, via booking token)
- Producer-side calendar view of upcoming reservations
- Automated reminder emails 24h before a booking
- Waitlist for fully-booked tasting slots
- Multi-currency pricing
- Webhook events for third-party integrations (e.g. POS systems)

---

## 13. Demo Data

The seed file (`backend/database/seeds/001_initial_data.sql`) populates a development database with:

| Entity | Details |
|---|---|
| Tenant: Cantina Rossi | Chianti region; admin login `admin@cantinarossi.it` / `admin123` |
| Tenant: Villa Bianchi | Barolo region; admin login `admin@villabianchi.it` / `admin123` |
| Tastings | 3 sample experiences with wine lists in JSONB |
| Bookings | 2 sample bookings in `confirmed`/`paid` state |

Load with: `make db-seed`

---

## 14. Glossary

| Term | Definition |
|---|---|
| **Tenant** | A wine producer / estate that has onboarded to the platform |
| **Tasting** | A wine tasting experience offered by a tenant, with a price, schedule, and capacity |
| **Booking** | A customer reservation for a specific tasting slot |
| **Slot** | The combination of a booking date + time for a specific tasting |
| **QR Code** | A unique machine-readable code attached to each booking, used for check-in |
| **Producer** | A user with `role = producer`, belonging to a tenant, who manages that tenant's catalog |
| **API Gateway** | The single entry point for all client-to-backend traffic; handles auth, CORS, rate limiting |
