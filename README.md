# 🍷 Wine Tastings Platform

Una piattaforma multi-tenant completa per la gestione di prenotazioni di degustazioni di vini, con architettura a microservizi e frontend separato.

## 🚀 Quick Start

### Prerequisiti
- Docker & Docker Compose
- Node.js 18+
- Git

### Setup Rapido
```bash
# Estrai il progetto
unzip wine-tastings-platform.zip
cd wine-tastings-platform

# Setup automatico
chmod +x infrastructure/scripts/setup.sh
./infrastructure/scripts/setup.sh

# Avvia ambiente sviluppo
make dev
```

### Accesso Applicazioni
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **Database**: localhost:5433
- **Monitoring**: http://localhost:3010

## 📁 Struttura Progetto

```
wine-tastings-platform/
├── backend/           # Microservizi API
├── frontend/          # SPA Client
├── infrastructure/    # DevOps e Deploy
├── docs/             # Documentazione
└── docker-compose.yml
```

## 🔧 Comandi Principali

```bash
make dev              # Ambiente sviluppo
make prod             # Ambiente produzione
make test             # Run tests
make logs             # View logs
make health           # Health check
make db-seed          # Seed database
```

## 📊 Architettura

### Backend (9 Microservizi)
- **API Gateway** (3000) - Routing e autenticazione
- **Auth Service** (3001) - JWT e gestione utenti
- **Tenant Service** (3002) - Gestione cantine
- **Tasting Service** (3003) - Gestione degustazioni
- **Booking Service** (3004) - Prenotazioni e QR codes
- **Payment Service** (3005) - Elaborazione pagamenti
- **Notification Service** (3006) - Email e SMS
- **Analytics Service** (3007) - Analytics e reports
- **File Service** (3008) - Upload e gestione file

### Frontend
- Single Page Application API-consumer
- Multi-tenant support
- Responsive design
- Real-time updates

### Database
- **PostgreSQL** - Database principale
- **Redis** - Cache e sessioni

## 🔒 Sicurezza

- JWT Authentication
- Rate limiting
- Input validation
- XSS/CSRF protection
- HTTPS enforcement

## 📱 Funzionalità

### Per Clienti
- ✅ Browsing degustazioni
- ✅ Prenotazione con calendario
- ✅ Pagamento sicuro
- ✅ Conferma con QR code

### Per Produttori
- ✅ Dashboard analytics
- ✅ Gestione degustazioni
- ✅ Gestione prenotazioni
- ✅ Reports e metriche

## 🚀 Deployment

### Docker Compose (Locale)
```bash
docker-compose up -d
```

### Kubernetes (Produzione)
```bash
kubectl apply -f infrastructure/kubernetes/
```

### Cloud (AWS/GCP/Azure)
```bash
terraform apply infrastructure/terraform/
```

## 📚 Documentazione

- **API Documentation**: [docs/api/](docs/api/)
- **Deployment Guide**: [docs/deployment/](docs/deployment/)
- **Development Guide**: [docs/development/](docs/development/)

## 🤝 Contribuire

1. Fork del repository
2. Crea feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push al branch (`git push origin feature/amazing-feature`)
5. Apri Pull Request

## 📄 License

MIT License

---

**Costruito con ❤️ per l'industria vinicola italiana**
