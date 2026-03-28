# Wine Tastings Platform Makefile

.PHONY: help build dev prod test clean logs

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies for all services
	@echo "Installing backend service dependencies..."
	@for service in backend/services/*; do \
		if [ -d "$$service" ] && [ -f "$$service/package.json" ]; then \
			echo "Installing $$service..."; \
			(cd $$service && npm install); \
		fi; \
	done
	@echo "Installing frontend dependencies..."
	@cd frontend && npm install

build: ## Build all Docker images
	@echo "Building Docker images..."
	docker-compose build

dev: ## Start development environment
	@echo "Starting development environment..."
	docker compose -f docker-compose.dev.yml up -d
	@echo "Development environment started!"
	@echo "Frontend: http://localhost:5173"
	@echo "API: http://localhost:3000"
	@echo "Database: localhost:5433"

prod: ## Start production environment
	@echo "Starting production environment..."
	docker-compose up -d
	@echo "Production environment started!"

test: ## Run tests for all services
	@echo "Running tests..."
	@for service in backend/services/*; do \
		if [ -d "$$service" ] && [ -f "$$service/package.json" ]; then \
			echo "Testing $$service..."; \
			(cd $$service && npm test --if-present) || true; \
		fi; \
	done

lint: ## Run linting for all services
	@echo "Running linter..."
	@for service in backend/services/*; do \
		if [ -d "$$service" ] && [ -f "$$service/package.json" ]; then \
			(cd $$service && npm run lint --if-present) || true; \
		fi; \
	done
	@cd frontend && npm run lint --if-present || true

db-migrate: ## Run database migrations — place SQL files in backend/database/migrations/
	@echo "Running database migrations..."
	@for f in backend/database/migrations/*.sql; do \
		[ -f "$$f" ] || continue; \
		echo "Applying $$f..."; \
		docker-compose exec -T postgres psql -U wine_user -d wine_tastings -f /dev/stdin < $$f; \
	done
	@echo "Migrations complete."

db-seed: ## Seed database with test data
	@echo "Seeding database..."
	docker-compose -f docker-compose.dev.yml exec -T postgres psql -U dev_user -d wine_tastings_dev -f /docker-entrypoint-initdb.d/seeds/001_initial_data.sql

logs: ## Show logs for all services
	docker-compose logs -f

logs-service: ## Show logs for specific service (usage: make logs-service SERVICE=auth-service)
	docker-compose logs -f $(SERVICE)

stop: ## Stop all services
	docker-compose down

clean: ## Clean up containers, images and volumes
	docker-compose down -v
	docker system prune -f

backup-db: ## Backup production database
	@echo "Creating database backup..."
	docker-compose exec postgres pg_dump -U wine_user wine_tastings > backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "Backup completed!"

health: ## Check health of all services
	@echo "Checking service health..."
	@./infrastructure/scripts/health_check.sh

deploy: ## Deploy to production
	@echo "Deploying to production..."
	@./infrastructure/scripts/deploy.sh production

monitoring: ## Start monitoring stack
	docker-compose up -d prometheus grafana
	@echo "Monitoring available at:"
	@echo "Prometheus: http://localhost:9090"
	@echo "Grafana: http://localhost:3010 (admin/admin123)"

setup: ## Setup development environment
	@./infrastructure/scripts/setup.sh
