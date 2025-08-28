
# Wine Tastings Platform – Full Demo

Questa repository dimostrativa include **frontend SPA**, **API Gateway** e **8 micro-servizi** con PostgreSQL e Redis, containerizzati con **Docker Compose**.

Avvio rapido
```bash
unzip wine-tastings-platform-full_*.zip
cd wine-tastings-platform-full
cp .env.example .env  # facoltativo per personalizzare
make dev              # build & start tutti i servizi
```
Visita:
- Front-end  → http://localhost:3001
- API health → http://localhost:3000/health

Ogni micro-servizio espone un endpoint `/health`.
