# API Reference

## Base URLs

| Environment | URL |
|---|---|
| Development | `http://localhost:3000` |
| Production | `https://api.wine-tastings.com` |

All requests are routed through the **API Gateway** (port 3000), which handles authentication verification, CORS, and rate limiting before proxying to the appropriate backend service.

## Authentication

Protected endpoints require a JWT access token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

Tokens are obtained via `POST /api/auth/login` and expire after **24 hours**. Use `POST /api/auth/refresh` to extend the session without re-authenticating.

## Standard Response Envelope

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful",
  "timestamp": "2026-03-28T10:00:00.000Z"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Human-readable error message",
  "timestamp": "2026-03-28T10:00:00.000Z"
}
```

All timestamps use ISO 8601 format (`YYYY-MM-DDTHH:mm:ss.sssZ`). All IDs are UUIDs. Default currency is `EUR`.

## Rate Limiting

**1,000 requests per 15 minutes per IP address**, enforced at the API Gateway. Exceeding this limit returns HTTP 429.

---

## Auth Service

### POST /api/auth/login

Authenticate a user and receive tokens.

**Request:**
```json
{
  "email": "admin@cantinarossi.it",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "<24h JWT access token>",
    "refreshToken": "<7d refresh token UUID>",
    "user": {
      "id": "uuid",
      "email": "admin@cantinarossi.it",
      "name": "Admin Rossi",
      "role": "producer",
      "tenant_id": "uuid"
    }
  }
}
```

### POST /api/auth/refresh

Exchange a valid refresh token for a new access token.

**Request:**
```json
{ "refreshToken": "<refresh token UUID>" }
```

**Response:** Same shape as login, with new `token` and `refreshToken`.

### POST /api/auth/logout

Revoke the current session and all refresh tokens for the user. Requires auth.

**Response:** `{ "success": true, "message": "Logged out successfully" }`

### GET /api/auth/me

Return the currently authenticated user's profile. Requires auth.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "...", "name": "...", "role": "producer", "tenant_id": "uuid" }
  }
}
```

---

## Tenant Service

### GET /api/tenants

List all active wine producers.

**Response:**
```json
{
  "success": true,
  "data": {
    "tenants": [
      { "id": "uuid", "name": "Cantina Rossi", "slug": "cantina-rossi", "location": "Chianti", ... }
    ]
  }
}
```

### GET /api/tenants/:id

Retrieve a single tenant by **UUID** or **slug**.

```
GET /api/tenants/cantina-rossi
GET /api/tenants/550e8400-e29b-41d4-a716-446655440000
```

Returns HTTP 404 if not found or inactive.

---

## Tasting Service

### GET /api/tastings/tenant/:tenantId

List all active tastings for a tenant. Public endpoint.

**Query params:** none

**Response data:** `{ "tastings": [ ... ] }`

Each tasting includes `wines` (JSONB array), `available_days` (JSONB array of weekday names), and `time_slots` (JSONB array of `"HH:MM"` strings).

### GET /api/tastings/:id

Get a single tasting by UUID.

### POST /api/tastings

Create a new tasting. Requires auth (producer role).

**Request:**
```json
{
  "tenant_id": "uuid",
  "name": "Chianti Classico Experience",
  "slug": "chianti-classico",
  "description": "...",
  "wines": ["Chianti Classico 2020", "Riserva 2019"],
  "price": 35.00,
  "currency": "EUR",
  "max_participants": 8,
  "duration_hours": 2.0,
  "available_days": ["Friday", "Saturday", "Sunday"],
  "time_slots": ["10:00", "14:00", "16:00"]
}
```

### PUT /api/tastings/:id

Update a tasting. Requires auth.

### DELETE /api/tastings/:id

Soft-delete a tasting (sets `is_active = false`). Requires auth. Returns HTTP 404 if not found.

---

## Booking Service

### POST /api/bookings

Create a booking. Public endpoint — no account required.

**Request:**
```json
{
  "tasting_id": "uuid",
  "tenant_id": "uuid",
  "customer_name": "Mario Rossi",
  "customer_email": "mario@example.com",
  "customer_phone": "+39 333 1234567",
  "booking_date": "2026-04-15",
  "booking_time": "14:00",
  "participants": 2,
  "special_requests": "Vegetarian snacks please"
}
```

**Validation rules:**
- `booking_date` must be in the future
- `participants` must be ≥ 1 and ≤ tasting `max_participants`
- Capacity is enforced atomically (`SELECT FOR UPDATE`) — concurrent overbooking is impossible

**Response:** Returns the created booking including `qr_code` (UUID string) and `total_price`.

### GET /api/bookings/:id

Get booking details. Requires auth.

### PATCH /api/bookings/:id

Update booking status. Requires auth.

**Request:** `{ "status": "confirmed" | "cancelled" | "completed" }`

### GET /api/bookings/tenant/:tenantId

List all bookings for a tenant. Requires auth.

**Query params:**
- `status` — filter by booking status
- `date` — filter by booking date (`YYYY-MM-DD`)

### GET /api/bookings/:id/qrcode

Returns the QR code as a PNG image. Public endpoint (no auth required — used in confirmation emails).

```
Content-Type: image/png
```

---

## Payment Service

### POST /api/payments/process

Process a payment for a booking. Public endpoint.

**Request:**
```json
{
  "booking_id": "uuid",
  "amount": 70.00,
  "currency": "EUR",
  "payment_method": "card",
  "payment_provider": "stripe"
}
```

**Validation:**
- `amount` must be a positive number
- Booking must exist and must not already be `paid` (HTTP 409 if already paid)

> **Note:** Stripe and PayPal SDK calls are currently mocked. The payment is recorded as `paid` immediately. See `TODO(payment)` comments in `payment-service/src/server.js`.

**Response:** Returns the created payment record including `transaction_id`.

### GET /api/payments/:bookingId

List payment records for a booking. Requires auth.

### POST /api/payments/refund

Issue a refund for a paid booking. Requires auth.

**Request:** `{ "booking_id": "uuid" }`

Sets payment status to `refunded` and booking status to `cancelled`.

> **Note:** Provider-side refund SDK calls are mocked. See `TODO(payment)` in `payment-service/src/server.js`.

---

## Notification Service

### POST /api/notifications/send

Queue and send an email notification.

**Request:**
```json
{
  "tenant_id": "uuid",
  "booking_id": "uuid",
  "type": "booking_confirmation",
  "recipient_email": "mario@example.com",
  "subject": "Your booking is confirmed",
  "content": "<p>Thank you for booking...</p>"
}
```

HTML `content` is sanitized with `sanitize-html` before storage and delivery. Failed deliveries are retried every 5 minutes for up to 24 hours.

When `SMTP_HOST` is not configured, the notification is stored with `status = 'pending'` but no email is sent.

### GET /api/notifications

List notifications, optionally filtered.

**Query params:**
- `tenant_id` — filter by tenant UUID
- `booking_id` — filter by booking UUID

Returns up to 100 notifications, ordered by `created_at DESC`.

---

## Analytics Service

All analytics endpoints require auth.

### GET /api/analytics/summary/:tenantId

Overall booking and revenue summary for a tenant.

**Response data:**
```json
{
  "summary": {
    "total_bookings": 42,
    "confirmed_bookings": 38,
    "total_revenue": 1540.00,
    "currency": "EUR"
  }
}
```

### GET /api/analytics/bookings/:tenantId

Booking volume over time.

**Query params:**
- `start_date` — ISO 8601 date (`YYYY-MM-DD`)
- `end_date` — ISO 8601 date

**Response data:** `{ "bookings": [ { "date": "2026-04-01", "count": 5 }, ... ] }`

### GET /api/analytics/revenue/:tenantId

Revenue broken down by tasting.

**Response data:** `{ "revenue": [ { "tasting_name": "...", "total": 420.00 }, ... ] }`

---

## File Service

### POST /api/files/upload

Upload a file. Requires auth. Accepts `multipart/form-data`.

**Form fields:**
- `file` (required) — the file binary
- `tenant_id` (optional) — associate with a tenant
- `user_id` (optional) — associate with a user

**Allowed MIME types:** `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf`

**Max file size:** 10 MB

**Response:** Returns file metadata record including `id`, `filename`, `file_path`.

> **Note:** Files are stored on local disk by default. AWS S3 integration is planned — see `TODO(s3)` in `file-service/src/server.js`.

### GET /api/files/:id

Retrieve file metadata by UUID. Public endpoint.

### DELETE /api/files/:id

Delete a file and its metadata. Requires auth. Removes both the DB record and the physical file from disk.

---

## HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 | Success |
| 201 | Created |
| 400 | Bad request — missing or invalid fields |
| 401 | Unauthorized — missing or invalid token |
| 404 | Not found |
| 409 | Conflict — e.g. booking already paid |
| 429 | Too many requests (rate limit exceeded) |
| 500 | Internal server error |
| 503 | Service unavailable (proxy error) |

## Health Checks

Each service exposes `GET /health`:

```json
{ "status": "healthy", "timestamp": "...", "service": "booking-service" }
```

The API Gateway health check also includes `uptime`:

```
GET http://localhost:3000/health
```
