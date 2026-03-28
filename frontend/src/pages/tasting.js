import { api } from '../api.js';
import { navigate } from '../router.js';
import { t, formatPrice } from '../i18n.js';

export async function renderTasting(container, { id }) {
  container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p>${t('common.loading')}</p></div>`;

  let tasting;
  try {
    const res = await api.getTasting(id);
    tasting = res.data.tasting;
  } catch {
    container.innerHTML = `
      <div class="page-content">
        <div class="error-state">
          <p>${t('tasting.not_found')}</p>
          <a href="#/" class="btn btn-primary">${t('common.home_btn')}</a>
        </div>
      </div>`;
    return;
  }

  const wines      = Array.isArray(tasting.wines)      ? tasting.wines      : [];
  const timeSlots  = Array.isArray(tasting.time_slots) ? tasting.time_slots : [];
  const today      = new Date().toISOString().split('T')[0];
  const unitPrice  = formatPrice(tasting.price, tasting.currency || 'EUR');
  const totalPrice = formatPrice(parseFloat(tasting.price) * 2, tasting.currency || 'EUR');

  container.innerHTML = `
    <div class="page-content">
      <a href="#/" class="back-link">${t('tasting.back')}</a>
      <div class="tasting-detail-grid">
        <div class="tasting-info-col">
          ${tasting.image_url
            ? `<img src="${tasting.image_url}" alt="${tasting.name}" class="tasting-image">`
            : `<div class="tasting-image-placeholder">🍷</div>`}
          <h1 class="tasting-title">${tasting.name}</h1>
          <div class="tasting-badges">
            <span class="badge">⏱ ${tasting.duration_hours} ${t('tasting.hours')}</span>
            <span class="badge">👥 ${t('tasting.max_people', { max: tasting.max_participants })}</span>
            <span class="badge badge-price">${unitPrice} ${t('tasting.per_person')}</span>
          </div>
          ${tasting.description ? `<p class="tasting-description">${tasting.description}</p>` : ''}
          ${wines.length ? `
            <div class="wines-section">
              <h3>${t('tasting.wines_title')}</h3>
              <ul class="wines-list">
                ${wines.map(w => `<li>🍾 ${typeof w === 'string' ? w : (w.name || JSON.stringify(w))}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>

        <div class="booking-col">
          <div class="booking-card">
            <h2>${t('tasting.book_title')}</h2>
            <form id="booking-form">
              <div class="form-group">
                <label for="b-name">${t('tasting.form.name')}</label>
                <input type="text" id="b-name" required placeholder="Mario Rossi">
              </div>
              <div class="form-group">
                <label for="b-email">${t('tasting.form.email')}</label>
                <input type="email" id="b-email" required placeholder="mario@email.com">
              </div>
              <div class="form-group">
                <label for="b-phone">${t('tasting.form.phone')}</label>
                <input type="tel" id="b-phone" placeholder="+39 333 000 0000">
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="b-date">${t('tasting.form.date')}</label>
                  <input type="date" id="b-date" required min="${today}">
                </div>
                <div class="form-group">
                  <label for="b-time">${t('tasting.form.time')}</label>
                  ${timeSlots.length
                    ? `<select id="b-time" required>
                        <option value="">${t('tasting.form.time_select')}</option>
                        ${timeSlots.map(s => `<option value="${s}">${s}</option>`).join('')}
                      </select>`
                    : `<input type="time" id="b-time" required>`}
                </div>
              </div>
              <div class="form-group">
                <label for="b-participants">${t('tasting.form.participants')}</label>
                <input type="number" id="b-participants" required min="1" max="${tasting.max_participants}" value="2">
              </div>
              <div class="form-group">
                <label for="b-requests">${t('tasting.form.requests')}</label>
                <textarea id="b-requests" rows="3" placeholder="${t('tasting.form.requests_placeholder')}"></textarea>
              </div>
              <div class="price-summary">
                <span>${t('tasting.form.total_estimated')}</span>
                <span class="price-total" id="price-total">${totalPrice}</span>
              </div>
              <div id="booking-error" class="form-error" style="display:none;"></div>
              <button type="submit" class="btn btn-primary btn-block" id="booking-submit">
                ${t('tasting.form.confirm')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('b-participants').addEventListener('input', (e) => {
    const n = Math.max(1, parseInt(e.target.value) || 0);
    document.getElementById('price-total').textContent = formatPrice(
      parseFloat(tasting.price) * n,
      tasting.currency || 'EUR'
    );
  });

  document.getElementById('booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn    = document.getElementById('booking-submit');
    const errEl  = document.getElementById('booking-error');
    btn.disabled = true;
    btn.textContent = t('tasting.form.processing');
    errEl.style.display = 'none';

    const participants = parseInt(document.getElementById('b-participants').value);
    try {
      const res = await api.createBooking({
        tasting_id:      tasting.id,
        tenant_id:       tasting.tenant_id,
        customer_name:   document.getElementById('b-name').value.trim(),
        customer_email:  document.getElementById('b-email').value.trim(),
        customer_phone:  document.getElementById('b-phone').value.trim(),
        booking_date:    document.getElementById('b-date').value,
        booking_time:    document.getElementById('b-time').value,
        participants,
        total_price:     parseFloat(tasting.price) * participants,
        currency:        tasting.currency || 'EUR',
        special_requests: document.getElementById('b-requests').value.trim(),
      });
      const booking = res.data.booking;
      sessionStorage.setItem(`booking_${booking.id}`, JSON.stringify(booking));
      navigate(`#/checkout/${booking.id}`);
    } catch (err) {
      errEl.textContent    = err.message || t('tasting.form.error');
      errEl.style.display  = 'block';
      btn.disabled         = false;
      btn.textContent      = t('tasting.form.confirm');
    }
  });
}
