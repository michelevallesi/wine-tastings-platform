// Wine Tastings Platform - Frontend Entry Point

console.log('🍷 Wine Tastings Platform - Frontend Starting...');

// API Client configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Basic API client
class ApiClient {
    constructor(baseURL) {
        this.baseURL = baseURL;
        this.token = localStorage.getItem('auth_token');
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    async getTenants() {
        return this.request('/api/tenant');
    }

    async login(email, password) {
        return this.request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    }
}

// Initialize app
const apiClient = new ApiClient(API_BASE_URL);

// Simple app initialization
document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');

    app.innerHTML = `
        <header style="background: #8B0000; color: white; padding: 1rem; text-align: center;">
            <h1>🍷 Wine Tastings Platform</h1>
            <p>Piattaforma Multi-tenant per Prenotazioni Degustazioni</p>
        </header>

        <main style="max-width: 1200px; margin: 2rem auto; padding: 0 1rem;">
            <div style="background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h2>Benvenuto nella Piattaforma</h2>
                <p>Questa è la versione base del frontend. Per l'implementazione completa, consulta:</p>
                <ul>
                    <li><strong>Backend Dashboard:</strong> <a href="https://ppl-ai-code-interpreter-files.s3.amazonaws.com/web/direct-files/46c6e1e2f5536bb7a98c771aa3a471ec/8d16c33f-e89a-4522-9c7c-04e3bcde4ab2/index.html" target="_blank">Microservizi API</a></li>
                    <li><strong>Frontend Client:</strong> <a href="https://ppl-ai-code-interpreter-files.s3.amazonaws.com/web/direct-files/46c6e1e2f5536bb7a98c771aa3a471ec/a6168734-8a31-4ab1-b59d-de06a0b31d24/index.html" target="_blank">Applicazione Completa</a></li>
                </ul>

                <h3>🚀 Quick Start</h3>
                <pre style="background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto;"><code># Avvia ambiente sviluppo
make dev

# Oppure
docker-compose -f docker-compose.dev.yml up -d

# Accedi alle applicazioni
Frontend: http://localhost:3001
API: http://localhost:3000
Database: localhost:5433</code></pre>

                <h3>📊 Architettura</h3>
                <p><strong>Backend:</strong> 9 microservizi containerizzati</p>
                <p><strong>Frontend:</strong> SPA che consuma API REST</p>
                <p><strong>Database:</strong> PostgreSQL + Redis</p>

                <div style="margin-top: 2rem; padding: 1rem; background: #e8f5e8; border-radius: 4px;">
                    <h4>✅ Pronto per:</h4>
                    <ul>
                        <li>Deploy con Docker Compose</li>
                        <li>Scalabilità con Kubernetes</li>
                        <li>CI/CD con GitHub Actions</li>
                        <li>Monitoring con Prometheus/Grafana</li>
                    </ul>
                </div>
            </div>
        </main>
    `;
});

console.log('✅ Frontend initialized');
