const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'wine_token';

export class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem(TOKEN_KEY);
  }

  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  isAuthenticated() { return !!this.token; }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const response = await fetch(url, { ...options, headers });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error || `HTTP ${response.status}`);
    return data;
  }

  async register(payload) {
    const data = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    this.setToken(data.data.token);
    return data;
  }

  async login(email, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.data.token);
    return data;
  }

  async logout() {
    await this.request('/api/auth/logout', { method: 'POST' }).catch(() => {});
    this.setToken(null);
  }

  async getMe() { return this.request('/api/auth/me'); }

  async getTenants() { return this.request('/api/tenants'); }
  async getTenant(id) { return this.request(`/api/tenants/${encodeURIComponent(id)}`); }
  async updateTenant(id, payload) {
    return this.request(`/api/tenants/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
  }

  async getTastingsByTenant(tenantId) {
    return this.request(`/api/tastings/tenant/${encodeURIComponent(tenantId)}`);
  }
  async getTasting(id) { return this.request(`/api/tastings/${encodeURIComponent(id)}`); }
  async createTasting(payload) {
    return this.request('/api/tastings', { method: 'POST', body: JSON.stringify(payload) });
  }
  async updateTasting(id, payload) {
    return this.request(`/api/tastings/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
  }
  async deleteTasting(id) {
    return this.request(`/api/tastings/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async createBooking(payload) {
    return this.request('/api/bookings', { method: 'POST', body: JSON.stringify(payload) });
  }
  async getBooking(id) { return this.request(`/api/bookings/${encodeURIComponent(id)}`); }
  async getBookingsByTenant(tenantId, filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request(`/api/bookings/tenant/${encodeURIComponent(tenantId)}${params ? `?${params}` : ''}`);
  }
  async updateBookingStatus(id, status) {
    return this.request(`/api/bookings/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async processPayment(payload) {
    return this.request('/api/payments/process', { method: 'POST', body: JSON.stringify(payload) });
  }

  async getAnalyticsSummary(tenantId) {
    return this.request(`/api/analytics/summary/${encodeURIComponent(tenantId)}`);
  }
  async getAnalyticsBookings(tenantId) {
    return this.request(`/api/analytics/bookings/${encodeURIComponent(tenantId)}`);
  }
  async getAnalyticsRevenue(tenantId) {
    return this.request(`/api/analytics/revenue/${encodeURIComponent(tenantId)}`);
  }
}

export const api = new ApiClient();
