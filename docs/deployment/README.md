# Deployment Guide

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Docker | 24+ | Required for all environments |
| Docker Compose | v2 | `docker compose` (not `docker-compose`) |
| Node.js | 18+ | Only needed for local development outside Docker |
| Make | Any | Convenience wrapper around Docker Compose commands |

---

## Environment Configuration

Copy the example file and fill in production values:

```bash
cp .env.example .env
```

Key variables to set before starting any environment:

```env
# Required — use a strong random value in production
JWT_SECRET=your-64-char-random-secret-here

# PostgreSQL
DATABASE_URL=postgresql://wine_user:wine_pass@postgres:5432/wine_tastings

# Redis
REDIS_URL=redis://:wine_redis_pass@redis:6379

# CORS — comma-separated list of allowed frontend origins
ALLOWED_ORIGINS=https://wine-tastings.com,https://www.wine-tastings.com

# Payment providers (needed for live payments)
STRIPE_SECRET_KEY=sk_live_...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...

# Email (SMTP) — leave unset to queue-only mode
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=...

# File storage
FILE_STORAGE_PATH=/uploads
AWS_S3_BUCKET=wine-tastings-files   # when S3 integration is ready

# Monitoring
GRAFANA_ADMIN_PASSWORD=change-me-in-production
```

---

## Development Environment

The development stack starts all 9 services with hot-reload, PostgreSQL on port 5433 (avoids conflicts with a local 5432), and Redis without a password.

```bash
# Install all service dependencies
make install

# Start the full dev stack
make dev

# Load demo data (Cantina Rossi + Villa Bianchi)
make db-seed
```

**Access points:**
| Service | URL |
|---|---|
| Frontend (Vite HMR) | http://localhost:3001 |
| API Gateway | http://localhost:3000 |
| PostgreSQL | localhost:5433 |
| Redis | localhost:6380 |

**Hot-reload:** All 9 backend services use nodemon with bind-mounted `src/` directories. Edit any `src/server.js` and the service restarts automatically. The frontend uses Vite's HMR — changes to `frontend/src/` are reflected instantly.

### Useful development commands

```bash
# Tail logs for all services
make logs

# Logs for a specific service
make logs-service SERVICE=booking-service

# Stop all containers
make stop

# Remove all volumes and prune images (full reset)
make clean

# Run tests across all services
make test

# Run ESLint
make lint
```

---

## Production Environment

The production stack uses the versioned `docker-compose.yml` file and includes Prometheus + Grafana monitoring.

```bash
# Build images and start production stack
make prod

# Verify all services are healthy
make health
```

**Access points:**
| Service | URL |
|---|---|
| Frontend | http://localhost:80 |
| API Gateway | http://localhost:3000 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3010 (admin / `$GRAFANA_ADMIN_PASSWORD`) |

### First-time production setup

1. Set all required environment variables in `.env`
2. Ensure `JWT_SECRET` is a cryptographically random value (minimum 64 characters):
   ```bash
   openssl rand -hex 32
   ```
3. Start the stack:
   ```bash
   make prod
   ```
4. Run database schema initialisation (automatic on first start via `init.sql`)
5. Optionally seed demo data:
   ```bash
   make db-seed
   ```

### Database backup and restore

```bash
# Dump PostgreSQL to a timestamped file
make backup-db
# Creates: backup_YYYYMMDD_HHMMSS.sql

# Restore from a backup
docker compose exec postgres psql -U wine_user wine_tastings < backup_20260328_120000.sql
```

---

## HTTPS Setup

The nginx configuration (`frontend/nginx.conf`) includes:

- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` header on all responses
- Commented-out HTTP → HTTPS redirect block (uncomment and configure when terminating TLS at nginx)

### Option A: TLS at nginx (direct)

1. Obtain certificates (e.g. Let's Encrypt via Certbot):
   ```bash
   certbot certonly --webroot -w /usr/share/nginx/html -d wine-tastings.com
   ```
2. Uncomment the redirect block and TLS server block in `frontend/nginx.conf`
3. Add `ssl_certificate` and `ssl_certificate_key` directives pointing to your cert files
4. Rebuild the frontend container: `docker compose up -d --build frontend`

### Option B: TLS at an upstream load balancer (recommended for production)

When running behind a load balancer (AWS ALB, GCP HTTPS LB, Cloudflare, etc.) that terminates TLS:
- The nginx container keeps `listen 80`; TLS is handled upstream
- The HSTS header is still sent and browsers will enforce HTTPS after the first visit
- Set `X-Forwarded-Proto: https` on the load balancer so that the app can detect HTTPS correctly

---

## Monitoring

```bash
# Start Prometheus + Grafana (included in the production compose file)
make monitoring

# Or start the full production stack (includes monitoring)
make prod
```

- **Prometheus** scrapes metrics from all service `/health` endpoints.
- **Grafana** provides dashboards at http://localhost:3010. Default login: `admin` / value of `GRAFANA_ADMIN_PASSWORD`.

---

## Scaling

Each microservice is independently scalable. To run multiple replicas:

```bash
docker compose up -d --scale booking-service=3
```

Add a load balancer (nginx upstream block or HAProxy) in front of multiple replicas if needed. The API Gateway already handles per-service discovery via environment variables (`AUTH_SERVICE_URL`, `BOOKING_SERVICE_URL`, etc.).

For database read scaling:
- Add a PostgreSQL read replica
- Point analytics-service and read-only queries to the replica's `DATABASE_URL`

---

## Kubernetes (planned)

Kubernetes manifests are not yet implemented (`infrastructure/kubernetes/` does not exist). When created, deployment will follow the standard pattern:

```bash
kubectl apply -f infrastructure/kubernetes/
kubectl get pods -n wine-tastings
```

Each service will have its own `Deployment`, `Service`, and `ConfigMap`. Secrets (`JWT_SECRET`, SMTP credentials) will use Kubernetes `Secret` objects.

---

## Terraform / Cloud IaC (planned)

Terraform configurations for AWS/GCP/Azure are not yet implemented (`infrastructure/terraform/` does not exist). When ready:

```bash
cd infrastructure/terraform
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

---

## CI/CD

GitHub Actions (`.github/workflows/backend-ci.yml`) runs on every push to `main`/`develop` and PRs to `main`:

1. Per-service `npm install` and `npm test --passWithNoTests`
2. Docker image build on `main` branch merges only

**Not yet configured:**
- Docker registry push (ECR / Docker Hub / GCR)
- Automated deployment after build
- Frontend CI (lint + `vite build`)
