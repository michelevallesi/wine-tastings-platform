# API Documentation

## Base URL
- Development: `http://localhost:3000`
- Production: `https://api.wine-tastings.com`

## Authentication
All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <token>
```

## Endpoints

### Auth Service (:3001)
```
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
POST /api/auth/refresh
```

### Tenant Service (:3002)
```
GET    /api/tenants
GET    /api/tenants/:id
POST   /api/tenants (protected)
PUT    /api/tenants/:id (protected)
DELETE /api/tenants/:id (protected)
```

### Tasting Service (:3003)
```
GET    /api/tastings/tenant/:tenantId
GET    /api/tastings/:id
POST   /api/tastings (protected)
PUT    /api/tastings/:id (protected)
DELETE /api/tastings/:id (protected)
GET    /api/tastings/:id/availability
```

### Booking Service (:3004)
```
GET    /api/bookings/tenant/:tenantId (protected)
GET    /api/bookings/:id
POST   /api/bookings
PUT    /api/bookings/:id (protected)
DELETE /api/bookings/:id (protected)
GET    /api/bookings/:id/qrcode
```

### Payment Service (:3005)
```
POST /api/payments/process
GET  /api/payments/:bookingId
POST /api/payments/refund (protected)
```

## Response Format
```json
{
  "success": true,
  "data": {...},
  "message": "Operation successful",
  "timestamp": "2025-08-19T19:52:00Z"
}
```

## Error Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data"
  },
  "timestamp": "2025-08-19T19:52:00Z"
}
```
