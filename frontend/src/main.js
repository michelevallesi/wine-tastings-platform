// Wine Tastings Platform - Frontend Entry Point

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'wine_token';

class ApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.token = localStorage.getItem(TOKEN_KEY);
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const response = await fetch(url, { ...options, headers });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    return data;
  }

  // Auth
  async login(email, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.setToken(data.data.token);
    return data;
  }

  async logout() {
    await this.request('/api/auth/logout', { method: 'POST' }).catch(() => {});
    this.setToken(null);
  }

  async getMe() {
    return this.request('/api/auth/me');
  }

  // Tenants
  async getTenants() {
    return this.request('/api/tenants');
  }

  async getTenant(idOrSlug) {
    return this.request(`/api/tenants/${encodeURIComponent(idOrSlug)}`);
  }

  // Tastings
  async getTastingsByTenant(tenantId) {
    return this.request(`/api/tastings/tenant/${encodeURIComponent(tenantId)}`);
  }

  async getTasting(id) {
    return this.request(`/api/tastings/${encodeURIComponent(id)}`);
  }

  // Bookings
  async createBooking(payload) {
    return this.request('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async getBooking(id) {
    return this.request(`/api/bookings/${encodeURIComponent(id)}`);
  }

  async getBookingsByTenant(tenantId, filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request(`/api/bookings/tenant/${encodeURIComponent(tenantId)}${params ? `?${params}` : ''}`);
  }

  // Payments
  async processPayment(payload) {
    return this.request('/api/payments/process', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async getPayments(bookingId) {
    return this.request(`/api/payments/${encodeURIComponent(bookingId)}`);
  }

  // Analytics
  async getAnalyticsSummary(tenantId) {
    return this.request(`/api/analytics/summary/${encodeURIComponent(tenantId)}`);
  }
}

const apiClient = new ApiClient(API_BASE_URL);

document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');

  app.innerHTML = `
    <header style="background:#8B0000;color:white;padding:1rem;text-align:center;">
      <h1>Wine Tastings Platform</h1>
      <p>Piattaforma Multi-tenant per Prenotazioni Degustazioni</p>
    </header>
    <main style="max-width:1200px;margin:2rem auto;padding:0 1rem;">
      <div style="background:white;padding:2rem;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,.1);">
        <h2>Benvenuto nella Piattaforma</h2>
        <h3>Quick Start</h3>
        <pre style="background:#f5f5f5;padding:1rem;border-radius:4px;overflow-x:auto;"><code>make dev

Frontend: http://localhost:3001
API:      http://localhost:3000
Database: localhost:5433</code></pre>
        <h3>Architettura</h3>
        <p><strong>Backend:</strong> 9 microservizi containerizzati</p>
        <p><strong>Frontend:</strong> SPA che consuma API REST</p>
        <p><strong>Database:</strong> PostgreSQL + Redis</p>
        <div id="tenants-container" style="margin-top:2rem;"></div>
      </div>
    </main>
  `;

  apiClient.getTenants()
    .then(({ data }) => {
      const container = document.getElementById('tenants-container');
      if (!data.tenants.length) return;
      container.innerHTML = `
        <h3>Produttori Disponibili</h3>
        <ul>
          ${data.tenants.map(t => `<li><strong>${t.name}</strong> — ${t.location || ''}</li>`).join('')}
        </ul>
      `;
    })
    .catch(() => { /* API not yet available in static preview */ });
});
