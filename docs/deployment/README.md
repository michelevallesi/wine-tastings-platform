# Deployment Guide

## Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for development)
- PostgreSQL 15+ (if not using Docker)
- Redis 7+ (if not using Docker)

## Environment Setup

1. Copy environment template:
```bash
cp .env.example .env
```

2. Configure variables in `.env`:
```env
DATABASE_URL=postgresql://wine_user:wine_pass@postgres:5432/wine_tastings
JWT_SECRET=your-super-secret-key
STRIPE_SECRET_KEY=sk_test_...
SMTP_HOST=smtp.gmail.com
```

## Development Deployment

```bash
# Quick setup
make setup

# Start development environment
make dev

# Access applications
# Frontend: http://localhost:3001
# API: http://localhost:3000
# Database: localhost:5433
```

## Production Deployment

### Docker Compose
```bash
# Build and start
make prod

# Or manually
docker-compose up -d

# Check health
make health
```

### Kubernetes
```bash
# Apply configurations
kubectl apply -f infrastructure/kubernetes/

# Check status
kubectl get pods
```

### Cloud (AWS)
```bash
# Using Terraform
cd infrastructure/terraform
terraform init
terraform plan
terraform apply
```

## Monitoring

```bash
# Start monitoring stack
make monitoring

# Access dashboards
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3010 (admin/admin123)
```

## Backup & Restore

```bash
# Backup database
make backup-db

# Restore from backup
docker-compose exec postgres psql -U wine_user wine_tastings < backup_file.sql
```

## SSL/HTTPS Setup

1. Obtain SSL certificates
2. Update nginx configuration
3. Configure environment variables
4. Restart services

## Scaling

### Horizontal Scaling
- Each microservice can be scaled independently
- Use load balancer (nginx/HAProxy)
- Database read replicas for analytics

### Monitoring & Alerts
- Prometheus metrics collection
- Grafana dashboards
- Automated alerting
