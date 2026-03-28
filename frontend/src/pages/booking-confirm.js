import { api } from '../api.js';
import QRCode from 'qrcode';
import { t, formatPrice, formatDate } from '../i18n.js';

export async function renderBookingConfirm(container, { id }) {
  container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p>${t('booking.loading')}</p></div>`;

  try {
    let b;
    const cached = sessionStorage.getItem(`booking_${id}`);
    if (cached) {
      b = JSON.parse(cached);
      sessionStorage.removeItem(`booking_${id}`);
    } else {
      const res = await api.getBooking(id);
      b = res.data.booking;
    }

    const dateStr  = formatDate(b.booking_date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const totalFmt = formatPrice(b.total_price, b.currency || 'EUR');

    container.innerHTML = `
      <div class="page-content">
        <div class="confirm-card">
          <div class="confirm-icon-wrap">
            <div class="confirm-checkmark">✓</div>
          </div>
          <h1>${t('booking.title')}</h1>
          <p class="confirm-subtitle">${t('booking.subtitle')} <strong>${b.customer_email}</strong></p>
          <div class="confirm-details">
            <div class="detail-row">
              <span>${t('booking.ref')}</span>
              <strong>#${b.id.substring(0, 8).toUpperCase()}</strong>
            </div>
            <div class="detail-row">
              <span>${t('booking.customer')}</span>
              <strong>${b.customer_name}</strong>
            </div>
            <div class="detail-row">
              <span>${t('booking.date')}</span>
              <strong>${dateStr}</strong>
            </div>
            <div class="detail-row">
              <span>${t('booking.time')}</span>
              <strong>${b.booking_time}</strong>
            </div>
            <div class="detail-row">
              <span>${t('booking.participants')}</span>
              <strong>${b.participants}</strong>
            </div>
            <div class="detail-row">
              <span>${t('booking.total')}</span>
              <strong>${totalFmt}</strong>
            </div>
            <div class="detail-row">
              <span>${t('booking.status')}</span>
              <span class="status-badge status-${b.status}">${t(`status.${b.status}`) || b.status}</span>
            </div>
          </div>
          <div class="qr-section">
            <h3>${t('booking.qr_title')}</h3>
            <canvas id="qr-canvas"></canvas>
            <p class="qr-hint">${t('booking.qr_hint')}</p>
          </div>
          <div class="confirm-actions">
            <a href="#/" class="btn btn-primary">${t('booking.home_btn')}</a>
          </div>
        </div>
      </div>
    `;

    QRCode.toCanvas(
      document.getElementById('qr-canvas'),
      b.qr_code || b.id,
      { width: 180, margin: 2, color: { dark: '#8B0000', light: '#FFFFFF' } }
    );
  } catch {
    container.innerHTML = `
      <div class="page-content">
        <div class="error-state">
          <p>${t('booking.not_found')}</p>
          <a href="#/" class="btn btn-primary">${t('common.home_btn')}</a>
        </div>
      </div>
    `;
  }
}
