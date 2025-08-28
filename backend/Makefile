# VinBooking Backend Makefile

.PHONY: help build up down logs clean test

help:
	@echo "VinBooking Backend - Comandi Disponibili:"
	@echo ""
	@echo "  make build     - Build di tutti i container"
	@echo "  make up        - Avvio dell'intero stack"
	@echo "  make down      - Spegnimento dell'intero stack"
	@echo "  make logs      - Visualizza log di tutti i servizi"
	@echo "  make clean     - Pulizia completa (containers, volumes, images)"
	@echo "  make test      - Esecuzione test"
	@echo "  make db-reset  - Reset completo del database"
	@echo "  make dev       - Avvio in modalità sviluppo"

build:
	docker-compose build

up:
	docker-compose up -d
	@echo "VinBooking Backend avviato!"
	@echo "API Gateway: http://localhost:3000"
	@echo "Database: localhost:5432"

down:
	docker-compose down

logs:
	docker-compose logs -f

clean:
	docker-compose down -v --rmi all --remove-orphans
	docker system prune -f

test:
	@echo "Eseguendo test di tutti i servizi..."
	curl -f http://localhost:3000/health || echo "Gateway down"
	curl -f http://localhost:3001/health || echo "Auth service down"

db-reset:
	docker-compose down -v
	docker-compose up -d postgres
	sleep 10
	docker-compose up -d

dev:
	docker-compose -f docker-compose.yml up --build

# Podman variants
podman-up:
	podman-compose -f podman-compose.yml up -d

podman-down:
	podman-compose -f podman-compose.yml down

# Utility commands
setup-env:
	@echo "Creando file .env da template..."
	@for service in auth-service producer-service package-service booking-service payment-service email-service api-gateway; do \
		cp services/$$service/.env.example services/$$service/.env; \
	done
	@echo "File .env creati! Modifica le configurazioni se necessario."
