import { api } from '../api.js';
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';

export async function renderTasting(container, { id }) {
  container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p>Caricamento...</p></div>`;

  let tasting;
  try {
    const res = await api.getTasting(id);
    tasting = res.data.tasting;
  } catch {
    container.innerHTML = `
      <div class="page-content">
        <div class="error-state">
          <p>Degustazione non trovata.</p>
          <a href="#/" class="btn btn-primary">Torna alla Home</a>
        </div>
      </div>`;
    return;
  }

  const wines = Array.isArray(tasting.wines) ? tasting.wines : [];
  const timeSlots = Array.isArray(tasting.time_slots) ? tasting.time_slots : [];
  const today = new Date().toISOString().split('T')[0];

  container.innerHTML = `
    <div class="page-content">
      <a href="#/" class="back-link">← Torna ai produttori</a>
      <div class="tasting-detail-grid">
        <div class="tasting-info-col">
          ${tasting.image_url
            ? `<img src="${tasting.image_url}" alt="${tasting.name}" class="tasting-image">`
            : `<div class="tasting-image-placeholder">🍷</div>`}
          <h1 class="tasting-title">${tasting.name}</h1>
          <div class="tasting-badges">
            <span class="badge">⏱ ${tasting.duration_hours} ore</span>
            <span class="badge">👥 Max ${tasting.max_participants} persone</span>
            <span class="badge badge-price">€${parseFloat(tasting.price).toFixed(2)} / persona</span>
          </div>
          ${tasting.description ? `<p class="tasting-description">${tasting.description}</p>` : ''}
          ${wines.length ? `
            <div class="wines-section">
              <h3>Vini in Degustazione</h3>
              <ul class="wines-list">
                ${wines.map(w => `<li>🍾 ${typeof w === 'string' ? w : (w.name || JSON.stringify(w))}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>

        <div class="booking-col">
          <div class="booking-card">
            <h2>Prenota questa Degustazione</h2>
            <form id="booking-form">
              <div class="form-group">
                <label for="b-name">Nome e Cognome *</label>
                <input type="text" id="b-name" required placeholder="Mario Rossi">
              </div>
              <div class="form-group">
                <label for="b-email">Email *</label>
                <input type="email" id="b-email" required placeholder="mario@email.com">
              </div>
              <div class="form-group">
                <label for="b-phone">Telefono</label>
                <input type="tel" id="b-phone" placeholder="+39 333 000 0000">
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="b-date">Data *</label>
                  <input type="date" id="b-date" required min="${today}">
                </div>
                <div class="form-group">
                  <label for="b-time">Orario *</label>
                  ${timeSlots.length
                    ? `<select id="b-time" required>
                        <option value="">Seleziona...</option>
                        ${timeSlots.map(s => `<option value="${s}">${s}</option>`).join('')}
                      </select>`
                    : `<input type="time" id="b-time" required>`}
                </div>
              </div>
              <div class="form-group">
                <label for="b-participants">Partecipanti *</label>
                <input type="number" id="b-participants" required min="1" max="${tasting.max_participants}" value="2">
              </div>
              <div class="form-group">
                <label for="b-requests">Richieste Speciali</label>
                <textarea id="b-requests" rows="3" placeholder="Allergie, preferenze, richieste particolari..."></textarea>
              </div>
              <div class="price-summary">
                <span>Totale stimato</span>
                <span class="price-total" id="price-total">€${(parseFloat(tasting.price) * 2).toFixed(2)}</span>
              </div>
              <div id="booking-error" class="form-error" style="display:none;"></div>
              <button type="submit" class="btn btn-primary btn-block" id="booking-submit">
                Conferma Prenotazione
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('b-participants').addEventListener('input', (e) => {
    const n = Math.max(1, parseInt(e.target.value) || 0);
    document.getElementById('price-total').textContent = `€${(parseFloat(tasting.price) * n).toFixed(2)}`;
  });

  document.getElementById('booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('booking-submit');
    const errEl = document.getElementById('booking-error');
    btn.disabled = true;
    btn.textContent = 'Elaborazione...';
    errEl.style.display = 'none';

    const participants = parseInt(document.getElementById('b-participants').value);
    try {
      const res = await api.createBooking({
        tasting_id: tasting.id,
        tenant_id: tasting.tenant_id,
        customer_name: document.getElementById('b-name').value.trim(),
        customer_email: document.getElementById('b-email').value.trim(),
        customer_phone: document.getElementById('b-phone').value.trim(),
        booking_date: document.getElementById('b-date').value,
        booking_time: document.getElementById('b-time').value,
        participants,
        total_price: parseFloat(tasting.price) * participants,
        currency: tasting.currency || 'EUR',
        special_requests: document.getElementById('b-requests').value.trim(),
      });
      const booking = res.data.booking;

      // Process mock payment
      await api.processPayment({
        booking_id: booking.id,
        amount: booking.total_price,
        currency: booking.currency,
        payment_method: 'card',
        payment_provider: 'stripe',
      }).catch(() => {});

      navigate(`#/booking/${booking.id}`);
    } catch (err) {
      errEl.textContent = err.message || 'Errore durante la prenotazione. Riprova.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Conferma Prenotazione';
    }
  });
}
