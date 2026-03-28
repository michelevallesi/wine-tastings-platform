import { api } from '../api.js';
import QRCode from 'qrcode';

export async function renderBookingConfirm(container, { id }) {
  container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p>Caricamento prenotazione...</p></div>`;

  try {
    const res = await api.getBooking(id);
    const b = res.data.booking;
    const dateStr = new Date(b.booking_date).toLocaleDateString('it-IT', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    container.innerHTML = `
      <div class="page-content">
        <div class="confirm-card">
          <div class="confirm-icon-wrap">
            <div class="confirm-checkmark">✓</div>
          </div>
          <h1>Prenotazione Confermata!</h1>
          <p class="confirm-subtitle">Riceverai una email di conferma a <strong>${b.customer_email}</strong></p>
          <div class="confirm-details">
            <div class="detail-row">
              <span>Riferimento</span>
              <strong>#${b.id.substring(0, 8).toUpperCase()}</strong>
            </div>
            <div class="detail-row">
              <span>Intestatario</span>
              <strong>${b.customer_name}</strong>
            </div>
            <div class="detail-row">
              <span>Data</span>
              <strong>${dateStr}</strong>
            </div>
            <div class="detail-row">
              <span>Orario</span>
              <strong>${b.booking_time}</strong>
            </div>
            <div class="detail-row">
              <span>Partecipanti</span>
              <strong>${b.participants}</strong>
            </div>
            <div class="detail-row">
              <span>Totale</span>
              <strong>€${parseFloat(b.total_price).toFixed(2)}</strong>
            </div>
            <div class="detail-row">
              <span>Stato</span>
              <span class="status-badge status-${b.status}">${b.status}</span>
            </div>
          </div>
          <div class="qr-section">
            <h3>QR Code di Accesso</h3>
            <canvas id="qr-canvas"></canvas>
            <p class="qr-hint">Mostra questo codice all'ingresso della degustazione</p>
          </div>
          <div class="confirm-actions">
            <a href="#/" class="btn btn-primary">Torna alla Home</a>
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
          <p>Prenotazione non trovata.</p>
          <a href="#/" class="btn btn-primary">Torna alla Home</a>
        </div>
      </div>
    `;
  }
}
