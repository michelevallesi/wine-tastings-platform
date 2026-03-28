import { api } from '../api.js';

export async function renderHome(container) {
  container.innerHTML = `
    <section class="hero">
      <div class="hero-content">
        <h1>Scopri i Migliori Vini Italiani</h1>
        <p>Prenota la tua esperienza di degustazione con i produttori più rinomati d'Italia</p>
        <a href="#producers" class="btn btn-white">Esplora i Produttori</a>
      </div>
    </section>
    <div class="page-content" id="producers" style="scroll-margin-top:70px">
      <div class="section-header">
        <h2>I Nostri Produttori</h2>
        <p>Scegli il produttore e prenota la tua degustazione esclusiva</p>
      </div>
      <div id="producers-grid" class="producers-grid">
        <div class="loading-spinner"><div class="spinner"></div><p>Caricamento...</p></div>
      </div>
    </div>
  `;

  try {
    const { data } = await api.getTenants();
    const tenants = data.tenants || [];
    const grid = document.getElementById('producers-grid');

    if (!tenants.length) {
      grid.innerHTML = '<p class="empty-state">Nessun produttore disponibile al momento.</p>';
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
        <div class="producer-card-header">
          <div class="producer-avatar">${tenant.name.charAt(0)}</div>
          <div class="producer-info">
            <h3>${tenant.name}</h3>
            ${tenant.location ? `<span class="producer-location">📍 ${tenant.location}</span>` : ''}
          </div>
        </div>
        ${tenant.description ? `<p class="producer-description">${tenant.description}</p>` : ''}
        <div class="tastings-section">
          <h4>Degustazioni Disponibili</h4>
          ${tastings.length ? tastings.map(t => `
            <div class="tasting-row">
              <div class="tasting-row-info">
                <span class="tasting-row-name">${t.name}</span>
                <span class="tasting-row-meta">⏱ ${t.duration_hours}h &nbsp;·&nbsp; 👥 max ${t.max_participants}</span>
              </div>
              <div class="tasting-row-footer">
                <span class="tasting-price">€${parseFloat(t.price).toFixed(2)}<small>/pers.</small></span>
                <a href="#/tasting/${t.id}" class="btn btn-sm btn-primary">Prenota</a>
              </div>
            </div>
          `).join('') : '<p class="no-tastings">Nessuna degustazione disponibile</p>'}
        </div>
      </div>
    `).join('');
  } catch (err) {
    document.getElementById('producers-grid').innerHTML = `
      <div class="error-state">
        <p>⚠️ Impossibile caricare i produttori.</p>
        <small>${err.message}</small>
      </div>
    `;
  }
}
