# VinBooking Backend - Sistema Multi-Tenant

Sistema completo di microservizi per la gestione di prenotazioni di degustazioni vino.

## 🚀 Quick Start

```bash
# Clona il repository
git clone <repository-url>
cd wine-booking-backend

# Setup file di configurazione
make setup-env

# Avvio con Docker Compose
make up

# Verifica stato servizi
docker-compose ps
curl http://localhost:3000/health
```

## 📋 Architettura

- **API Gateway**: Punto di ingresso unico (porta 3000)
- **Auth Service**: Autenticazione JWT (porta 3001) 
- **Producer Service**: Gestione produttori (porta 3002)
- **Package Service**: Gestione pacchetti degustazione (porta 3003)
- **Booking Service**: Gestione prenotazioni (porta 3004)
- **Payment Service**: Elaborazione pagamenti Stripe (porta 3005)
- **Email Service**: Invio email e QR code (porta 3006)
- **PostgreSQL**: Database persistente (porta 5432)
- **Nginx**: Reverse proxy e load balancer (porta 80)

## 🗄️ Database

Il sistema utilizza PostgreSQL con schema multi-tenant con dati di test:

- **Email**: `info@cantinarossi.it`
- **Password**: `demo123`

## 🔧 Configurazione

### Variabili d'Ambiente

Copiare i file `.env.example` in ogni servizio e configurare:
- Database credentials
- JWT secret
- Stripe API keys  
- SMTP settings

## 🔌 API Endpoints

### Autenticazione
- `POST /api/auth/login` - Login produttore
- `POST /api/auth/register` - Registrazione
- `GET /api/auth/verify` - Verifica token

### Produttori
- `GET /api/producers/list` - Lista produttori pubblici
- `GET /api/producers/profile` - Profilo autenticato
- `GET /api/producers/dashboard-stats` - Statistiche

### Pacchetti, Prenotazioni, Pagamenti
Tutti gli endpoint sono documentati nel codice dei microservizi.

## 🐳 Containerizzazione

### Docker Compose
```bash
# Avvio completo
make up

# Log aggregati  
make logs

# Spegnimento
make down
```

### Podman Alternative
```bash
make podman-up
```

## 📈 Monitoraggio

- Gateway: `http://localhost:3000/health`
- Database: `localhost:5432`

## 🔒 Sicurezza

- JWT Authentication
- Rate Limiting (100 req/15min)
- Input Validation con Joi
- SQL Injection Protection
- CORS configurato
- Password Hashing bcrypt

## 🤝 Contribuzione

1. Fork del repository
2. Crea feature branch
3. Commit modifiche
4. Push e crea Pull Request

## 📄 Licenza

MIT License

---

**VinBooking** - La piattaforma per le degustazioni di vini 🍷
