import { Chart, registerables } from 'chart.js';
import { api } from '../api.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';
import { t, formatPrice, formatDate } from '../i18n.js';

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
    try {
      const res = await api.getTenant(state.user.tenant_id);
      state.tenant = res.data.tenant;
    } catch (e) {
      console.warn('getTenant failed, trying tenants list fallback:', e.message);
    }
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
    { id: 'overview',  icon: '📊', label: t('dashboard.tabs.overview')  },
    { id: 'tastings',  icon: '🍷', label: t('dashboard.tabs.tastings')  },
    { id: 'bookings',  icon: '📅', label: t('dashboard.tabs.bookings')  },
    { id: 'analytics', icon: '📈', label: t('dashboard.tabs.analytics') },
    { id: 'profile',   icon: '🏛️', label: t('dashboard.tabs.profile')   },
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
          ${tabs.map(tb => `
            <a href="#/dashboard/${tb.id}" class="sidebar-link ${tab === tb.id ? 'active' : ''}">
              <span class="sidebar-icon">${tb.icon}</span> ${tb.label}
            </a>
          `).join('')}
        </nav>
        <div class="sidebar-footer">
          <a href="#/" class="sidebar-link">${t('dashboard.public_site')}</a>
        </div>
      </aside>
      <main class="dashboard-main" id="dash-content">
        <div class="loading-spinner"><div class="spinner"></div></div>
      </main>
    </div>
  `;

  const content = document.getElementById('dash-content');

  if (!state.tenant) {
    content.innerHTML = `<div class="error-state"><p>${t('dashboard.loading_error')}</p><button class="btn btn-primary" onclick="location.reload()">${t('dashboard.retry')}</button></div>`;
    return;
  }

  switch (tab) {
    case 'tastings':  await renderTastingsTab(content);  break;
    case 'bookings':  await renderBookingsTab(content);  break;
    case 'analytics': await renderAnalyticsTab(content); break;
    case 'profile':   await renderProfileTab(content);   break;
    default:          await renderOverviewTab(content);  break;
  }
}

// ─── Overview ────────────────────────────────────────────────────────────────

async function renderOverviewTab(container) {
  try {
    const [summaryRes, bookingsRes] = await Promise.all([
      api.getAnalyticsSummary(state.tenant.id),
      api.getBookingsByTenant(state.tenant.id),
    ]);
    const s        = summaryRes.data;
    const bookings = (bookingsRes.data.bookings || []).slice(0, 8);

    container.innerHTML = `
      <div class="dash-header">
        <h1>${t('dashboard.overview.title')}</h1>
        <p>${t('dashboard.overview.welcome', { name: state.user.name })}</p>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${s.bookings?.total || 0}</div>
          <div class="stat-label">${t('dashboard.overview.total')}</div>
        </div>
        <div class="stat-card stat-green">
          <div class="stat-value">${s.bookings?.confirmed || 0}</div>
          <div class="stat-label">${t('dashboard.overview.confirmed')}</div>
        </div>
        <div class="stat-card stat-wine">
          <div class="stat-value">${formatPrice(s.revenue?.total_revenue || 0)}</div>
          <div class="stat-label">${t('dashboard.overview.revenue')}</div>
        </div>
        <div class="stat-card stat-yellow">
          <div class="stat-value">${s.bookings?.pending || 0}</div>
          <div class="stat-label">${t('dashboard.overview.pending')}</div>
        </div>
      </div>
      <div class="dash-section">
        <h2>${t('dashboard.overview.recent')}</h2>
        ${bookings.length ? `
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr>
                <th>${t('dashboard.overview.table.customer')}</th>
                <th>${t('dashboard.overview.table.date')}</th>
                <th>${t('dashboard.overview.table.participants')}</th>
                <th>${t('dashboard.overview.table.total')}</th>
                <th>${t('dashboard.overview.table.status')}</th>
              </tr></thead>
              <tbody>
                ${bookings.map(b => `
                  <tr>
                    <td><strong>${b.customer_name}</strong><br><small>${b.customer_email}</small></td>
                    <td>${formatDate(b.booking_date)}</td>
                    <td>${b.participants}</td>
                    <td>${formatPrice(b.total_price, b.currency || 'EUR')}</td>
                    <td><span class="status-badge status-${b.status}">${statusLabel(b.status)}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `<p class="empty-state">${t('dashboard.overview.empty')}</p>`}
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
      <h1>${t('dashboard.tastings.title')}</h1>
      <button class="btn btn-primary" id="btn-new-tasting">${t('dashboard.tastings.new_btn')}</button>
    </div>
    <div class="table-wrap">
      ${tastings.length ? `
        <table class="data-table">
          <thead><tr>
            <th>${t('dashboard.tastings.table.name')}</th>
            <th>${t('dashboard.tastings.table.price')}</th>
            <th>${t('dashboard.tastings.table.duration')}</th>
            <th>${t('dashboard.tastings.table.max')}</th>
            <th>${t('dashboard.tastings.table.status')}</th>
            <th>${t('dashboard.tastings.table.actions')}</th>
          </tr></thead>
          <tbody>
            ${tastings.map(tasting => `
              <tr>
                <td><strong>${tasting.name}</strong></td>
                <td>${formatPrice(tasting.price, tasting.currency || 'EUR')}</td>
                <td>${tasting.duration_hours}h</td>
                <td>${tasting.max_participants}</td>
                <td><span class="status-badge ${tasting.is_active ? 'status-confirmed' : 'status-cancelled'}">${tasting.is_active ? t('dashboard.tastings.active') : t('dashboard.tastings.inactive')}</span></td>
                <td class="actions-cell">
                  <button class="btn btn-sm btn-outline btn-edit" data-id="${tasting.id}">${t('dashboard.tastings.edit')}</button>
                  <button class="btn btn-sm btn-danger btn-delete" data-id="${tasting.id}">${t('dashboard.tastings.delete')}</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : `<p class="empty-state">${t('dashboard.tastings.empty')}</p>`}
    </div>

    <div id="tasting-modal" class="modal-overlay" style="display:none;">
      <div class="modal-box">
        <div class="modal-head">
          <h3 id="modal-title">${t('dashboard.tastings.modal.new_title')}</h3>
          <button class="modal-close" id="modal-close">×</button>
        </div>
        <form id="tasting-form">
          <input type="hidden" id="t-id">
          <div class="form-group"><label>${t('dashboard.tastings.modal.name')}</label><input type="text" id="t-name" required></div>
          <div class="form-row">
            <div class="form-group"><label>${t('dashboard.tastings.modal.price')}</label><input type="number" id="t-price" required min="0" step="0.01" placeholder="50.00"></div>
            <div class="form-group"><label>${t('dashboard.tastings.modal.duration')}</label><input type="number" id="t-duration" required min="0.5" step="0.5" value="2"></div>
          </div>
          <div class="form-group"><label>${t('dashboard.tastings.modal.max')}</label><input type="number" id="t-max" required min="1" value="10"></div>
          <div class="form-group"><label>${t('dashboard.tastings.modal.description')}</label><textarea id="t-desc" rows="3"></textarea></div>
          <div class="form-group">
            <label>${t('dashboard.tastings.modal.slots')} <small>(${t('dashboard.tastings.modal.slots_hint')})</small></label>
            <input type="text" id="t-slots" placeholder="10:00, 14:00, 17:00">
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-outline" id="modal-cancel">${t('dashboard.tastings.modal.cancel')}</button>
            <button type="submit" class="btn btn-primary">${t('dashboard.tastings.modal.save')}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const modal     = document.getElementById('tasting-modal');
  const openModal = (tasting = null) => {
    document.getElementById('t-id').value       = tasting?.id || '';
    document.getElementById('modal-title').textContent = tasting
      ? t('dashboard.tastings.modal.edit_title')
      : t('dashboard.tastings.modal.new_title');
    document.getElementById('t-name').value     = tasting?.name || '';
    document.getElementById('t-price').value    = tasting?.price || '';
    document.getElementById('t-duration').value = tasting?.duration_hours || 2;
    document.getElementById('t-max').value      = tasting?.max_participants || 10;
    document.getElementById('t-desc').value     = tasting?.description || '';
    document.getElementById('t-slots').value    = (tasting?.time_slots || []).join(', ');
    modal.style.display = 'flex';
  };
  const closeModal = () => { modal.style.display = 'none'; };

  document.getElementById('btn-new-tasting').addEventListener('click', () => openModal());
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => openModal(tastings.find(tst => tst.id === btn.dataset.id)));
  });

  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(t('dashboard.tastings.delete_confirm'))) return;
      try {
        await api.deleteTasting(btn.dataset.id);
        showToast(t('dashboard.tastings.deleted'));
        renderTastingsTab(container);
      } catch (err) { showToast(err.message, 'error'); }
    });
  });

  document.getElementById('tasting-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('t-id').value;
    const name   = document.getElementById('t-name').value.trim();
    const slug   = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const payload = {
      name,
      slug,
      price:            parseFloat(document.getElementById('t-price').value),
      duration_hours:   parseFloat(document.getElementById('t-duration').value),
      max_participants: parseInt(document.getElementById('t-max').value),
      description:      document.getElementById('t-desc').value.trim(),
      time_slots:       document.getElementById('t-slots').value.split(',').map(s => s.trim()).filter(Boolean),
      tenant_id:        state.tenant.id,
      currency:         'EUR',
      is_active:        true,
    };
    try {
      if (editId) {
        await api.updateTasting(editId, payload);
        showToast(t('dashboard.tastings.updated'));
      } else {
        await api.createTasting(payload);
        showToast(t('dashboard.tastings.created'));
      }
      closeModal();
      renderTastingsTab(container);
    } catch (err) { showToast(err.message, 'error'); }
  });
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

async function renderBookingsTab(container) {
  container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;
  try {
    const res      = await api.getBookingsByTenant(state.tenant.id);
    const bookings = res.data.bookings || [];

    container.innerHTML = `
      <div class="dash-header">
        <h1>${t('dashboard.bookings.title')}</h1>
        <select id="status-filter" class="filter-select">
          <option value="">${t('dashboard.bookings.filter_all')}</option>
          <option value="pending">${t('dashboard.bookings.filter_pending')}</option>
          <option value="confirmed">${t('dashboard.bookings.filter_confirmed')}</option>
          <option value="completed">${t('dashboard.bookings.filter_completed')}</option>
          <option value="cancelled">${t('dashboard.bookings.filter_cancelled')}</option>
        </select>
      </div>
      ${bookings.length ? `
        <div class="table-wrap">
          <table class="data-table" id="bookings-table">
            <thead><tr>
              <th>${t('dashboard.bookings.table.customer')}</th>
              <th>${t('dashboard.bookings.table.date')}</th>
              <th>${t('dashboard.bookings.table.time')}</th>
              <th>${t('dashboard.bookings.table.participants')}</th>
              <th>${t('dashboard.bookings.table.total')}</th>
              <th>${t('dashboard.bookings.table.payment')}</th>
              <th>${t('dashboard.bookings.table.status')}</th>
              <th>${t('dashboard.bookings.table.actions')}</th>
            </tr></thead>
            <tbody>
              ${bookings.map(b => `
                <tr data-status="${b.status}">
                  <td><strong>${b.customer_name}</strong><br><small>${b.customer_email}</small></td>
                  <td>${formatDate(b.booking_date)}</td>
                  <td>${b.booking_time}</td>
                  <td>${b.participants}</td>
                  <td>${formatPrice(b.total_price, b.currency || 'EUR')}</td>
                  <td><span class="status-badge status-pay-${b.payment_status}">${b.payment_status}</span></td>
                  <td><span class="status-badge status-${b.status}">${statusLabel(b.status)}</span></td>
                  <td class="actions-cell">
                    ${b.status === 'pending' ? `
                      <button class="btn btn-sm btn-primary action-btn" data-id="${b.id}" data-action="confirmed">${t('dashboard.bookings.confirm_btn')}</button>
                      <button class="btn btn-sm btn-danger action-btn" data-id="${b.id}" data-action="cancelled">${t('dashboard.bookings.cancel_btn')}</button>
                    ` : ''}
                    ${b.status === 'confirmed' ? `
                      <button class="btn btn-sm btn-outline action-btn" data-id="${b.id}" data-action="completed">${t('dashboard.bookings.complete_btn')}</button>
                    ` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `<p class="empty-state">${t('dashboard.bookings.empty')}</p>`}
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
          showToast(statusLabel(btn.dataset.action));
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
    const s             = summaryRes.data;
    const bookingStats  = bookingStatsRes.data.stats   || [];
    const revenueStats  = revenueStatsRes.data.revenue || [];
    const total         = s.bookings?.total || 0;
    const totalRevenue  = parseFloat(s.revenue?.total_revenue || 0);
    const avgBooking    = total > 0 ? (totalRevenue / total).toFixed(2) : '0.00';

    container.innerHTML = `
      <div class="dash-header"><h1>${t('dashboard.analytics.title')}</h1></div>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">${t('dashboard.analytics.total')}</div></div>
        <div class="stat-card stat-wine"><div class="stat-value">${formatPrice(totalRevenue)}</div><div class="stat-label">${t('dashboard.analytics.revenue')}</div></div>
        <div class="stat-card stat-green"><div class="stat-value">${formatPrice(s.revenue?.collected || 0)}</div><div class="stat-label">${t('dashboard.analytics.collected')}</div></div>
        <div class="stat-card"><div class="stat-value">${formatPrice(avgBooking)}</div><div class="stat-label">${t('dashboard.analytics.avg')}</div></div>
      </div>
      <div class="charts-grid">
        <div class="chart-card">
          <h3>${t('dashboard.analytics.chart_bookings')}</h3>
          <canvas id="chart-bookings"></canvas>
          ${!bookingStats.length ? `<p class="empty-state">${t('dashboard.analytics.no_data')}</p>` : ''}
        </div>
        <div class="chart-card">
          <h3>${t('dashboard.analytics.chart_revenue')}</h3>
          <canvas id="chart-revenue"></canvas>
          ${!revenueStats.length ? `<p class="empty-state">${t('dashboard.analytics.no_data')}</p>` : ''}
        </div>
      </div>
    `;

    const bcp47 = document.documentElement.lang === 'de' ? 'de-DE'
                : document.documentElement.lang === 'fr' ? 'fr-FR'
                : document.documentElement.lang === 'en' ? 'en-GB'
                : 'it-IT';

    if (bookingStats.length) {
      new Chart(document.getElementById('chart-bookings').getContext('2d'), {
        type: 'line',
        data: {
          labels: bookingStats.map(d => new Date(d.date).toLocaleDateString(bcp47, { day: 'numeric', month: 'short' })),
          datasets: [{
            label: t('dashboard.analytics.total'),
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
          labels: revenueStats.map(d => new Date(d.month).toLocaleDateString(bcp47, { month: 'short', year: '2-digit' })),
          datasets: [
            { label: t('dashboard.analytics.revenue'),   data: revenueStats.map(d => parseFloat(d.total)),     backgroundColor: 'rgba(139,0,0,0.7)' },
            { label: t('dashboard.analytics.collected'), data: revenueStats.map(d => parseFloat(d.collected)), backgroundColor: 'rgba(139,0,0,0.3)' },
          ],
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } },
      });
    }
  } catch (err) {
    container.innerHTML = `<div class="error-state"><p>${err.message}</p></div>`;
  }
}

// ─── Profile ──────────────────────────────────────────────────────────────────

async function renderProfileTab(container) {
  const tenant = state.tenant;

  container.innerHTML = `
    <div class="dash-header">
      <div>
        <h1>${t('dashboard.profile.title')}</h1>
        <p>${t('dashboard.profile.subtitle')}</p>
      </div>
    </div>
    <div class="dash-section">
      <form id="profile-form">
        <div class="form-row">
          <div class="form-group">
            <label for="p-name">${t('dashboard.profile.name')}</label>
            <input type="text" id="p-name" required value="${tenant.name || ''}">
          </div>
          <div class="form-group">
            <label for="p-slug">${t('dashboard.profile.slug')}</label>
            <input type="text" id="p-slug" value="${tenant.slug || ''}" disabled style="opacity:.55;cursor:not-allowed;">
          </div>
        </div>
        <div class="form-group">
          <label for="p-description">${t('dashboard.profile.description')}</label>
          <textarea id="p-description" rows="4">${tenant.description || ''}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="p-location">${t('dashboard.profile.location')}</label>
            <input type="text" id="p-location" placeholder="Es. Chianti, Toscana" value="${tenant.location || ''}">
          </div>
          <div class="form-group">
            <label for="p-email">${t('dashboard.profile.email')}</label>
            <input type="email" id="p-email" placeholder="info@cantina.it" value="${tenant.email || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="p-phone">${t('dashboard.profile.phone')}</label>
            <input type="tel" id="p-phone" placeholder="+39 055 000000" value="${tenant.phone || ''}">
          </div>
          <div class="form-group">
            <label for="p-website">${t('dashboard.profile.website')}</label>
            <input type="url" id="p-website" placeholder="https://lacantina.it" value="${tenant.website || ''}">
          </div>
        </div>
        <div class="form-group">
          <label for="p-logo">${t('dashboard.profile.logo')}</label>
          <input type="url" id="p-logo" placeholder="https://..." value="${tenant.logo_url || ''}">
        </div>
        <div id="profile-error" class="form-error" style="display:none;"></div>
        <div style="display:flex;gap:.75rem;margin-top:1.5rem;">
          <button type="submit" id="profile-submit" class="btn btn-primary">${t('dashboard.profile.save')}</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn   = document.getElementById('profile-submit');
    const errEl = document.getElementById('profile-error');
    errEl.style.display = 'none';
    btn.disabled    = true;
    btn.textContent = t('dashboard.profile.saving');

    try {
      const res = await api.updateTenant(tenant.id, {
        name:        document.getElementById('p-name').value.trim(),
        description: document.getElementById('p-description').value.trim() || null,
        location:    document.getElementById('p-location').value.trim()    || null,
        email:       document.getElementById('p-email').value.trim()       || null,
        phone:       document.getElementById('p-phone').value.trim()       || null,
        website:     document.getElementById('p-website').value.trim()     || null,
        logo_url:    document.getElementById('p-logo').value.trim()        || null,
      });
      state.tenant = res.data.tenant;
      const nameEl = document.querySelector('.sidebar-tenant-name');
      if (nameEl) nameEl.textContent = state.tenant.name;
      showToast(t('dashboard.profile.success'));
    } catch (err) {
      errEl.textContent   = err.message || t('common.error_generic');
      errEl.style.display = 'block';
    } finally {
      btn.disabled    = false;
      btn.textContent = t('dashboard.profile.save');
    }
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(status) {
  return t(`status.${status}`) || status;
}
