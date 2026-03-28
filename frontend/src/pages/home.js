import { api } from '../api.js';
import { t, formatPrice } from '../i18n.js';

export async function renderHome(container) {
  container.innerHTML = `
    <section class="hero">
      <div class="hero-content">
        <span class="hero-eyebrow">${t('home.hero.eyebrow')}</span>
        <h1>${t('home.hero.title')}</h1>
        <p>${t('home.hero.subtitle')}</p>
        <div class="hero-cta-group">
          <button class="btn btn-white" id="scroll-to-producers">${t('home.hero.cta_explore')}</button>
          <a href="#/login" class="btn btn-outline-white">${t('home.hero.cta_portal')}</a>
        </div>
        <div class="hero-trust">
          <div class="hero-trust-item">
            <span class="hero-trust-icon">✓</span>
            <span>${t('home.hero.trust_booking')}</span>
          </div>
          <div class="hero-trust-item">
            <span class="hero-trust-icon">✓</span>
            <span>${t('home.hero.trust_confirm')}</span>
          </div>
          <div class="hero-trust-item">
            <span class="hero-trust-icon">✓</span>
            <span>${t('home.hero.trust_qr')}</span>
          </div>
        </div>
      </div>
      <div class="hero-wave">
        <svg viewBox="0 0 1440 56" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <path d="M0 56 L0 32 Q360 0 720 28 Q1080 56 1440 24 L1440 56 Z" fill="#F7F3EF"/>
        </svg>
      </div>
    </section>

    <div class="page-content" id="producers" style="scroll-margin-top:80px">
      <div class="section-header">
        <span class="section-eyebrow">${t('home.producers.eyebrow')}</span>
        <h2>${t('home.producers.title')}</h2>
        <p>${t('home.producers.subtitle')}</p>
      </div>
      <div id="producers-grid" class="producers-grid">
        <div class="loading-spinner"><div class="spinner"></div><p>${t('home.producers.loading')}</p></div>
      </div>
    </div>
  `;

  document.getElementById('scroll-to-producers')?.addEventListener('click', () => {
    document.getElementById('producers').scrollIntoView({ behavior: 'smooth' });
  });

  try {
    const { data } = await api.getTenants();
    const tenants = data.tenants || [];
    const grid = document.getElementById('producers-grid');

    if (!tenants.length) {
      grid.innerHTML = `<p class="empty-state">${t('home.producers.empty')}</p>`;
      return;
    }

    const results = await Promise.all(
      tenants.map(async (tenant) => {
        let tastings = [];
        try {
          const res = await api.getTastingsByTenant(tenant.id);
          tastings = (res.data.tastings || []).filter(t => t.is_active);
        } catch {}
        return { tenant, tastings };
      })
    );

    grid.innerHTML = results.map(({ tenant, tastings }) => `
      <div class="producer-card">
        <div class="producer-card-stripe"></div>
        <div class="producer-card-body">
          <div class="producer-card-header">
            <div class="producer-avatar">${tenant.name.charAt(0)}</div>
            <div class="producer-info">
              <h3>${tenant.name}</h3>
              ${tenant.location ? `<span class="producer-location">📍 ${tenant.location}</span>` : ''}
            </div>
          </div>
          ${tenant.description ? `<p class="producer-description">${tenant.description}</p>` : ''}
          <div class="tastings-section">
            <h4>${t('home.producers.available')}</h4>
            ${tastings.length ? tastings.map(tasting => `
              <div class="tasting-row">
                <div class="tasting-row-info">
                  <span class="tasting-row-name">${tasting.name}</span>
                  <span class="tasting-row-meta">⏱ ${tasting.duration_hours}${t('tasting.hours')} &nbsp;·&nbsp; 👥 ${t('home.producers.max_people', { max: tasting.max_participants })}</span>
                </div>
                <div class="tasting-row-footer">
                  <span class="tasting-price">${formatPrice(tasting.price, tasting.currency || 'EUR')}<small>${t('tasting.per_person')}</small></span>
                  <a href="#/tasting/${tasting.id}" class="btn btn-sm btn-primary">${t('home.producers.book')}</a>
                </div>
              </div>
            `).join('') : `<p class="no-tastings">${t('home.producers.no_tastings')}</p>`}
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    document.getElementById('producers-grid').innerHTML = `
      <div class="error-state">
        <p>⚠️ ${t('home.producers.error')}</p>
        <small>${err.message}</small>
      </div>
    `;
  }
}
