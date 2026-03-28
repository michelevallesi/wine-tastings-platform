# Wine Tastings Platform

A multi-tenant SaaS platform for Italian wine producers to manage and sell wine tasting experiences. Customers browse available tastings, book a slot, pay online, and receive a QR-coded confirmation. Producers manage their catalog, schedule, and bookings through a dedicated interface.

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- Make

### Development Setup
```bash
git clone <repository>
cd wine-tastings-platform

# Install all service dependencies
make install

# Start full development stack (all 9 services + PostgreSQL + Redis)
make dev

# Load demo data
make db-seed
```

### Access Points
| Service | URL |
|---|---|
| Frontend | http://localhost:3001 |
| API Gateway | http://localhost:3000 |
| PostgreSQL | localhost:5433 |
| Prometheus | http://localhost:9090 (prod only) |
| Grafana | http://localhost:3010 (prod only) |

### Demo Credentials
| Tenant | Email | Password |
|---|---|---|
| Cantina Rossi (Chianti) | admin@cantinarossi.it | admin123 |
| Villa Bianchi (Barolo) | admin@villabianchi.it | admin123 |

## Project Structure

```
wine-tastings-platform/
├── backend/
│   ├── database/
│   │   ├── init.sql                   # Schema (source of truth)
│   │   └── seeds/001_initial_data.sql # Demo data
│   └── services/
│       ├── api-gateway/               # Port 3000 — routing, auth, rate limiting
│       ├── auth-service/              # Port 3001 — JWT, sessions (Redis)
│       ├── tenant-service/            # Port 3002 — wine producer management
│       ├── tasting-service/           # Port 3003 — tasting catalog
│       ├── booking-service/           # Port 3004 — reservations, QR codes
│       ├── payment-service/           # Port 3005 — Stripe / PayPal
│       ├── notification-service/      # Port 3006 — email (nodemailer), SMS (Twilio)
│       ├── analytics-service/         # Port 3007 — reporting, metrics
│       └── file-service/              # Port 3008 — uploads, AWS S3
├── frontend/
│   ├── src/main.js                    # Single entry point (vanilla JS + Vite)
│   ├── nginx.conf                     # Production nginx config
│   └── Dockerfile                     # Multi-stage production build
├── docs/
│   ├── PRD.md                         # Product Requirements Document
│   ├── api/README.md                  # API reference
│   ├── deployment/README.md           # Deployment guide
│   └── development/README.md          # Developer guide
├── docker-compose.yml                 # Production stack
├── docker-compose.dev.yml             # Development stack (hot-reload)
└── Makefile                           # Build and operational commands
```

## Make Targets

```bash
make dev              # Start development environment
make prod             # Start production environment
make install          # Install all service dependencies
make test             # Run all service tests
make lint             # ESLint across all services
make db-seed          # Load demo data
make db-migrate       # Run SQL migrations
make logs             # Tail all service logs
make logs-service SERVICE=api-gateway  # Logs for a specific service
make stop             # Stop all containers
make clean            # Remove volumes and prune images
make backup-db        # Dump PostgreSQL to file
make health           # Run health checks on all services
make monitoring       # Start Prometheus + Grafana
```

## Architecture

### Backend — 9 Microservices (Node.js / Express)

Each service is an independent Express application with its own PostgreSQL connection pool, Winston logger, and Dockerfile. All traffic is routed through the API Gateway.

```
Client → [nginx :80] → [API Gateway :3000] → [Service :300x] → [PostgreSQL / Redis]
```

**Service communication:** HTTP proxying via `http-proxy-middleware`. No message queue in v1.0.

**Multi-tenancy:** Every resource is scoped to a `tenant_id`. Enforced at the application layer — no PostgreSQL row-level security.

**Concurrency safety:** Booking capacity is enforced with a `SELECT FOR UPDATE` transaction, preventing double-booking under concurrent load.

### Frontend

Vanilla JavaScript SPA built with Vite. No framework (no React/Vue/Angular). Served by nginx in production with a reverse proxy to the API Gateway.

### Database

- **PostgreSQL 15** — primary datastore; UUID PKs, `updated_at` triggers on all mutable tables
- **Redis 7** — JWT session storage and refresh token store

## API

Base URL: `http://localhost:3000` (dev) / `https://api.wine-tastings.com` (prod)

Authentication: `Authorization: Bearer <jwt>` (24-hour tokens, refreshable)

See [docs/api/README.md](docs/api/README.md) for the full endpoint reference.

## Security

- Passwords hashed with bcrypt; never stored in plaintext
- All SQL uses parameterized queries (`$1, $2`) — no string interpolation
- HTML email content sanitized with `sanitize-html` before delivery
- `helmet` security headers on every service
- CORS restricted to `ALLOWED_ORIGINS` env var (no wildcard in production)
- HTTPS enforced via `Strict-Transport-Security` header
- Rate limited at the gateway: 1,000 requests / 15 min / IP

## Environment Variables

Copy `.env.example` to `.env` and fill in production values:

| Variable | Description |
|---|---|
| `JWT_SECRET` | JWT signing secret — **must be changed in production** |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `STRIPE_SECRET_KEY` | Stripe API key (payment-service) |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | PayPal credentials (payment-service) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Email config (notification-service) |
| `AWS_S3_BUCKET` | S3 bucket for file uploads (file-service) |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (api-gateway) |

## Documentation

- [Product Requirements Document](docs/PRD.md)
- [API Reference](docs/api/README.md)
- [Deployment Guide](docs/deployment/README.md)
- [Developer Guide](docs/development/README.md)
- [AI Assistant Guide](CLAUDE.md)

## Contributing

1. Branch from `main`: `git checkout -b feature/your-feature`
2. Make changes; follow code style conventions in [CLAUDE.md](CLAUDE.md)
3. Ensure CI passes: `make test && make lint`
4. Open a pull request against `main`

## License

MIT
