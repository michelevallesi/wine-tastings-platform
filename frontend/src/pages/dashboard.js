import { Chart, registerables } from 'chart.js';
import { api } from '../api.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';

Chart.register(...registerables);

async function ensureUser() {
  if (!api.isAuthenticated()) { navigate('#/login'); return false; }
  if (!state.user) {
    try {
      const res = await api.getMe();
      state.user = res.data.user;
    } catch {
      api.setToken(null);
      navigate('#/login');
      return false;
    }
  }
  if (!state.tenant && state.user.tenant_id) {
    // Primary: fetch by ID
    try {
      const res = await api.getTenant(state.user.tenant_id);
      state.tenant = res.data.tenant;
    } catch (e) {
      console.warn('getTenant failed, trying tenants list fallback:', e.message);
    }
    // Fallback: search the public tenants list
    if (!state.tenant) {
      try {
        const res = await api.getTenants();
        state.tenant = (res.data.tenants || []).find(t => t.id === state.user.tenant_id) || null;
      } catch (e) {
        console.error('Tenant fallback also failed:', e.message);
      }
    }
  }
  return true;
}

export async function renderDashboard(container, { tab = 'overview' } = {}) {
  if (!(await ensureUser())) return;

  const tabs = [
    { id: 'overview',  icon: '📊', label: 'Panoramica' },
    { id: 'tastings',  icon: '🍷', label: 'Degustazioni' },
    { id: 'bookings',  icon: '📅', label: 'Prenotazioni' },
    { id: 'analytics', icon: '📈', label: 'Analytics' },
  ];

  container.innerHTML = `
    <div class="dashboard-layout">
      <aside class="dashboard-sidebar">
        <div class="sidebar-brand">
          <div class="sidebar-tenant-name">${state.tenant?.name || 'Dashboard'}</div>
          <div class="sidebar-user-name">${state.user?.name || ''}</div>
          <span class="sidebar-role-badge">${state.user?.role || ''}</span>
        </div>
        <nav class="sidebar-nav">
          ${tabs.map(t => `
            <a href="#/dashboard/${t.id}" class="sidebar-link ${tab === t.id ? 'active' : ''}">
              <span class="sidebar-icon">${t.icon}</span> ${t.label}
            </a>
          `).join('')}
        </nav>
        <div class="sidebar-footer">
          <a href="#/" class="sidebar-link">← Sito Pubblico</a>
        </div>
      </aside>
      <main class="dashboard-main" id="dash-content">
        <div class="loading-spinner"><div class="spinner"></div></div>
      </main>
    </div>
  `;

  const content = document.getElementById('dash-content');

  if (!state.tenant) {
    content.innerHTML = `<div class="error-state"><p>Impossibile caricare il profilo del produttore.</p><button class="btn btn-primary" onclick="location.reload()">Riprova</button></div>`;
    return;
  }

  switch (tab) {
    case 'tastings':  await renderTastingsTab(content); break;
    case 'bookings':  await renderBookingsTab(content); break;
    case 'analytics': await renderAnalyticsTab(content); break;
    default:          await renderOverviewTab(content); break;
  }
}

// ─── Overview ────────────────────────────────────────────────────────────────

async function renderOverviewTab(container) {
  try {
    const [summaryRes, bookingsRes] = await Promise.all([
      api.getAnalyticsSummary(state.tenant.id),
      api.getBookingsByTenant(state.tenant.id),
    ]);
    const s = summaryRes.data;
    const bookings = (bookingsRes.data.bookings || []).slice(0, 8);

    container.innerHTML = `
      <div class="dash-header">
        <h1>Panoramica</h1>
        <p>Benvenuto, <strong>${state.user.name}</strong></p>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${s.bookings?.total || 0}</div>
          <div class="stat-label">Prenotazioni Totali</div>
        </div>
        <div class="stat-card stat-green">
          <div class="stat-value">${s.bookings?.confirmed || 0}</div>
          <div class="stat-label">Confermate</div>
        </div>
        <div class="stat-card stat-wine">
          <div class="stat-value">€${parseFloat(s.revenue?.total_revenue || 0).toFixed(0)}</div>
          <div class="stat-label">Fatturato Totale</div>
        </div>
        <div class="stat-card stat-yellow">
          <div class="stat-value">${s.bookings?.pending || 0}</div>
          <div class="stat-label">In Attesa</div>
        </div>
      </div>
      <div class="dash-section">
        <h2>Ultime Prenotazioni</h2>
        ${bookings.length ? `
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Cliente</th><th>Data</th><th>Pers.</th><th>Totale</th><th>Stato</th></tr></thead>
              <tbody>
                ${bookings.map(b => `
                  <tr>
                    <td><strong>${b.customer_name}</strong><br><small>${b.customer_email}</small></td>
                    <td>${new Date(b.booking_date).toLocaleDateString('it-IT')}</td>
                    <td>${b.participants}</td>
                    <td>€${parseFloat(b.total_price).toFixed(2)}</td>
                    <td><span class="status-badge status-${b.status}">${statusLabel(b.status)}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<p class="empty-state">Nessuna prenotazione ancora.</p>'}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="error-state"><p>${err.message}</p></div>`;
  }
}

// ─── Tastings ─────────────────────────────────────────────────────────────────

async function renderTastingsTab(container) {
  container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;
  let tastings = [];
  try {
    const res = await api.getTastingsByTenant(state.tenant.id);
    tastings = res.data.tastings || [];
  } catch {}

  container.innerHTML = `
    <div class="dash-header">
      <h1>Degustazioni</h1>
      <button class="btn btn-primary" id="btn-new-tasting">+ Nuova Degustazione</button>
    </div>
    <div class="table-wrap">
      ${tastings.length ? `
        <table class="data-table">
          <thead><tr><th>Nome</th><th>Prezzo</th><th>Durata</th><th>Max Pers.</th><th>Stato</th><th>Azioni</th></tr></thead>
          <tbody>
            ${tastings.map(t => `
              <tr>
                <td><strong>${t.name}</strong></td>
                <td>€${parseFloat(t.price).toFixed(2)}</td>
                <td>${t.duration_hours}h</td>
                <td>${t.max_participants}</td>
                <td><span class="status-badge ${t.is_active ? 'status-confirmed' : 'status-cancelled'}">${t.is_active ? 'Attiva' : 'Inattiva'}</span></td>
                <td class="actions-cell">
                  <button class="btn btn-sm btn-outline btn-edit" data-id="${t.id}">Modifica</button>
                  <button class="btn btn-sm btn-danger btn-delete" data-id="${t.id}">Elimina</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p class="empty-state">Nessuna degustazione. Creane una!</p>'}
    </div>

    <div id="tasting-modal" class="modal-overlay" style="display:none;">
      <div class="modal-box">
        <div class="modal-head">
          <h3 id="modal-title">Nuova Degustazione</h3>
          <button class="modal-close" id="modal-close">×</button>
        </div>
        <form id="tasting-form">
          <input type="hidden" id="t-id">
          <div class="form-group"><label>Nome *</label><input type="text" id="t-name" required></div>
          <div class="form-row">
            <div class="form-group"><label>Prezzo (€) *</label><input type="number" id="t-price" required min="0" step="0.01" placeholder="50.00"></div>
            <div class="form-group"><label>Durata (ore) *</label><input type="number" id="t-duration" required min="0.5" step="0.5" value="2"></div>
          </div>
          <div class="form-group"><label>Max Partecipanti *</label><input type="number" id="t-max" required min="1" value="10"></div>
          <div class="form-group"><label>Descrizione</label><textarea id="t-desc" rows="3"></textarea></div>
          <div class="form-group">
            <label>Orari Disponibili <small>(separati da virgola)</small></label>
            <input type="text" id="t-slots" placeholder="10:00, 14:00, 17:00">
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-outline" id="modal-cancel">Annulla</button>
            <button type="submit" class="btn btn-primary">Salva</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const modal = document.getElementById('tasting-modal');
  const openModal = (t = null) => {
    document.getElementById('t-id').value = t?.id || '';
    document.getElementById('modal-title').textContent = t ? 'Modifica Degustazione' : 'Nuova Degustazione';
    document.getElementById('t-name').value = t?.name || '';
    document.getElementById('t-price').value = t?.price || '';
    document.getElementById('t-duration').value = t?.duration_hours || 2;
    document.getElementById('t-max').value = t?.max_participants || 10;
    document.getElementById('t-desc').value = t?.description || '';
    document.getElementById('t-slots').value = (t?.time_slots || []).join(', ');
    modal.style.display = 'flex';
  };
  const closeModal = () => { modal.style.display = 'none'; };

  document.getElementById('btn-new-tasting').addEventListener('click', () => openModal());
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openModal(tastings.find(t => t.id === btn.dataset.id)));
  });

  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Eliminare questa degustazione?')) return;
      try {
        await api.deleteTasting(btn.dataset.id);
        showToast('Degustazione eliminata');
        renderTastingsTab(container);
      } catch (err) { showToast(err.message, 'error'); }
    });
  });

  document.getElementById('tasting-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('t-id').value;
    const payload = {
      name: document.getElementById('t-name').value.trim(),
      price: parseFloat(document.getElementById('t-price').value),
      duration_hours: parseFloat(document.getElementById('t-duration').value),
      max_participants: parseInt(document.getElementById('t-max').value),
      description: document.getElementById('t-desc').value.trim(),
      time_slots: document.getElementById('t-slots').value.split(',').map(s => s.trim()).filter(Boolean),
      tenant_id: state.tenant.id,
      currency: 'EUR',
      is_active: true,
    };
    try {
      if (editId) { await api.updateTasting(editId, payload); showToast('Degustazione aggiornata'); }
      else { await api.createTasting(payload); showToast('Degustazione creata'); }
      closeModal();
      renderTastingsTab(container);
    } catch (err) { showToast(err.message, 'error'); }
  });
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

async function renderBookingsTab(container) {
  container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;
  try {
    const res = await api.getBookingsByTenant(state.tenant.id);
    const bookings = res.data.bookings || [];

    container.innerHTML = `
      <div class="dash-header">
        <h1>Prenotazioni</h1>
        <select id="status-filter" class="filter-select">
          <option value="">Tutti gli stati</option>
          <option value="pending">In attesa</option>
          <option value="confirmed">Confermata</option>
          <option value="completed">Completata</option>
          <option value="cancelled">Cancellata</option>
        </select>
      </div>
      ${bookings.length ? `
        <div class="table-wrap">
          <table class="data-table" id="bookings-table">
            <thead><tr><th>Cliente</th><th>Data</th><th>Orario</th><th>Pers.</th><th>Totale</th><th>Pagamento</th><th>Stato</th><th>Azioni</th></tr></thead>
            <tbody>
              ${bookings.map(b => `
                <tr data-status="${b.status}">
                  <td><strong>${b.customer_name}</strong><br><small>${b.customer_email}</small></td>
                  <td>${new Date(b.booking_date).toLocaleDateString('it-IT')}</td>
                  <td>${b.booking_time}</td>
                  <td>${b.participants}</td>
                  <td>€${parseFloat(b.total_price).toFixed(2)}</td>
                  <td><span class="status-badge status-pay-${b.payment_status}">${b.payment_status}</span></td>
                  <td><span class="status-badge status-${b.status}">${statusLabel(b.status)}</span></td>
                  <td class="actions-cell">
                    ${b.status === 'pending' ? `
                      <button class="btn btn-sm btn-primary action-btn" data-id="${b.id}" data-action="confirmed">Conferma</button>
                      <button class="btn btn-sm btn-danger action-btn" data-id="${b.id}" data-action="cancelled">Cancella</button>
                    ` : ''}
                    ${b.status === 'confirmed' ? `
                      <button class="btn btn-sm btn-outline action-btn" data-id="${b.id}" data-action="completed">Completa</button>
                    ` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<p class="empty-state">Nessuna prenotazione.</p>'}
    `;

    document.getElementById('status-filter')?.addEventListener('change', (e) => {
      const val = e.target.value;
      document.querySelectorAll('#bookings-table tbody tr').forEach(row => {
        row.style.display = !val || row.dataset.status === val ? '' : 'none';
      });
    });

    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await api.updateBookingStatus(btn.dataset.id, btn.dataset.action);
          showToast(`Prenotazione ${statusLabel(btn.dataset.action).toLowerCase()}`);
          renderBookingsTab(container);
        } catch (err) { showToast(err.message, 'error'); }
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="error-state"><p>${err.message}</p></div>`;
  }
}

// ─── Analytics ────────────────────────────────────────────────────────────────

async function renderAnalyticsTab(container) {
  container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;
  try {
    const [summaryRes, bookingStatsRes, revenueStatsRes] = await Promise.all([
      api.getAnalyticsSummary(state.tenant.id),
      api.getAnalyticsBookings(state.tenant.id),
      api.getAnalyticsRevenue(state.tenant.id),
    ]);
    const s = summaryRes.data;
    const bookingStats = bookingStatsRes.data.stats || [];
    const revenueStats = revenueStatsRes.data.revenue || [];
    const avgBooking = s.bookings?.total > 0
      ? (parseFloat(s.revenue?.total_revenue || 0) / s.bookings.total).toFixed(2)
      : '0.00';

    container.innerHTML = `
      <div class="dash-header"><h1>Analytics</h1></div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${s.bookings?.total || 0}</div><div class="stat-label">Prenotazioni Totali</div></div>
        <div class="stat-card stat-wine"><div class="stat-value">€${parseFloat(s.revenue?.total_revenue || 0).toFixed(0)}</div><div class="stat-label">Fatturato Totale</div></div>
        <div class="stat-card stat-green"><div class="stat-value">€${parseFloat(s.revenue?.collected || 0).toFixed(0)}</div><div class="stat-label">Incassato</div></div>
        <div class="stat-card"><div class="stat-value">€${avgBooking}</div><div class="stat-label">Valore Medio</div></div>
      </div>
      <div class="charts-grid">
        <div class="chart-card">
          <h3>Prenotazioni Ultimi 30 Giorni</h3>
          <canvas id="chart-bookings"></canvas>
          ${!bookingStats.length ? '<p class="empty-state">Dati insufficienti</p>' : ''}
        </div>
        <div class="chart-card">
          <h3>Fatturato Mensile (12 mesi)</h3>
          <canvas id="chart-revenue"></canvas>
          ${!revenueStats.length ? '<p class="empty-state">Dati insufficienti</p>' : ''}
        </div>
      </div>
    `;

    if (bookingStats.length) {
      new Chart(document.getElementById('chart-bookings').getContext('2d'), {
        type: 'line',
        data: {
          labels: bookingStats.map(d => new Date(d.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })),
          datasets: [{
            label: 'Prenotazioni',
            data: bookingStats.map(d => parseInt(d.count)),
            borderColor: '#8B0000',
            backgroundColor: 'rgba(139,0,0,0.08)',
            tension: 0.4,
            fill: true,
            pointBackgroundColor: '#8B0000',
          }],
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
      });
    }

    if (revenueStats.length) {
      new Chart(document.getElementById('chart-revenue').getContext('2d'), {
        type: 'bar',
        data: {
          labels: revenueStats.map(d => {
            const dt = new Date(d.month);
            return dt.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
          }),
          datasets: [
            { label: 'Fatturato', data: revenueStats.map(d => parseFloat(d.total)), backgroundColor: 'rgba(139,0,0,0.7)' },
            { label: 'Incassato', data: revenueStats.map(d => parseFloat(d.collected)), backgroundColor: 'rgba(139,0,0,0.3)' },
          ],
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } },
      });
    }
  } catch (err) {
    container.innerHTML = `<div class="error-state"><p>${err.message}</p></div>`;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(status) {
  const labels = { pending: 'In Attesa', confirmed: 'Confermata', cancelled: 'Cancellata', completed: 'Completata' };
  return labels[status] || status;
}
