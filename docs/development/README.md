# Development Guide

## Project Structure
```
wine-tastings-platform/
├── backend/           # Microservices
├── frontend/          # SPA Client
├── infrastructure/    # DevOps
└── docs/             # Documentation
```

## Getting Started

1. Clone and setup:
```bash
git clone <repository>
cd wine-tastings-platform
make setup
```

2. Start development:
```bash
make dev
```

## Backend Development

### Adding New Service
1. Create service directory: `backend/services/new-service/`
2. Add package.json and Dockerfile
3. Implement service logic in `src/server.js`
4. Add service to docker-compose.yml
5. Update API Gateway routes

### Database Changes
1. Create migration file: `backend/database/migrations/`
2. Run migration: `make db-migrate`
3. Update models and schemas

## Frontend Development

### Component Structure
```
frontend/src/
├── components/       # Reusable components
├── services/        # API clients
├── store/          # State management
└── utils/          # Utilities
```

### Adding New Feature
1. Create component in `components/`
2. Add API client in `services/`
3. Update routing and state management
4. Add tests

## Testing

```bash
# Run all tests
make test

# Service-specific tests
cd backend/services/auth-service
npm test

# Frontend tests
cd frontend
npm test
```

## Code Style

- ESLint configuration in `.eslintrc.json`
- Prettier formatting in `.prettierrc.json`
- Run linting: `make lint`

## Git Workflow

1. Create feature branch: `git checkout -b feature/new-feature`
2. Make changes and commit
3. Push and create pull request
4. Code review and merge

## Debugging

### Backend Services
```bash
# View logs
make logs

# Service-specific logs
make logs-service SERVICE=auth-service

# Debug single service
cd backend/services/auth-service
npm run dev
```

### Frontend
```bash
# Development server with hot reload
cd frontend
npm run dev
```

## Performance Optimization

- Use Redis caching for frequently accessed data
- Implement database indexing
- Optimize API queries
- Use CDN for static assets
- Implement lazy loading

## Security Checklist

- [ ] JWT tokens with expiration
- [ ] Input validation and sanitization
- [ ] Rate limiting on APIs
- [ ] HTTPS in production
- [ ] Environment variable security
- [ ] Database access controls
