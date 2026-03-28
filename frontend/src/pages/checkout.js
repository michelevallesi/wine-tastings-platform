import { api } from '../api.js';
import { navigate } from '../router.js';
import { t, formatPrice, formatDate } from '../i18n.js';

export async function renderCheckout(container, { id }) {
  container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p>${t('checkout.loading')}</p></div>`;

  let booking;
  const cached = sessionStorage.getItem(`booking_${id}`);
  if (cached) {
    booking = JSON.parse(cached);
  } else {
    try {
      const res = await api.getBooking(id);
      booking = res.data.booking;
    } catch {
      container.innerHTML = `
        <div class="page-content">
          <div class="error-state">
            <p>${t('checkout.not_found')}</p>
            <a href="#/" class="btn btn-primary">${t('common.home_btn')}</a>
          </div>
        </div>`;
      return;
    }
  }

  if (booking.payment_status === 'paid') {
    navigate(`#/booking/${booking.id}`);
    return;
  }

  const dateStr    = formatDate(booking.booking_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const totalFmt   = formatPrice(booking.total_price, booking.currency || 'EUR');

  container.innerHTML = `
    <div class="page-content">
      <a href="#/" class="back-link">${t('checkout.back')}</a>
      <h1 class="checkout-title">${t('checkout.title')}</h1>
      <div class="checkout-grid">

        <!-- Order Summary -->
        <div class="checkout-summary">
          <h2>${t('checkout.summary_title')}</h2>
          <div class="summary-card">
            <div class="summary-row summary-row-main">
              <span>${t('checkout.row_tasting')}</span>
              <strong>#${booking.id.substring(0, 8).toUpperCase()}</strong>
            </div>
            <div class="summary-row">
              <span>${t('checkout.row_customer')}</span>
              <span>${booking.customer_name}</span>
            </div>
            <div class="summary-row">
              <span>${t('checkout.row_date')}</span>
              <span>${dateStr}</span>
            </div>
            <div class="summary-row">
              <span>${t('checkout.row_time')}</span>
              <span>${booking.booking_time}</span>
            </div>
            <div class="summary-row">
              <span>${t('checkout.row_participants')}</span>
              <span>${booking.participants}</span>
            </div>
            <div class="summary-divider"></div>
            <div class="summary-row summary-row-total">
              <span>${t('checkout.row_total')}</span>
              <strong>${totalFmt}</strong>
            </div>
          </div>
          <div class="security-badges">
            <span class="security-badge">${t('checkout.security_ssl')}</span>
            <span class="security-badge">${t('checkout.security_encrypted')}</span>
          </div>
        </div>

        <!-- Payment Form -->
        <div class="checkout-payment">
          <h2>${t('checkout.payment_title')}</h2>

          <div class="payment-method-tabs">
            <button class="payment-tab active" data-method="card">
              <span>💳</span> ${t('checkout.method_card')}
            </button>
            <button class="payment-tab" data-method="paypal">
              <span>🅿</span> ${t('checkout.method_paypal')}
            </button>
          </div>

          <!-- Card Form -->
          <div id="payment-card" class="payment-form-panel">
            <form id="card-form">
              <div class="form-group">
                <label>${t('checkout.card_number')}</label>
                <div class="card-input-wrap">
                  <input type="text" id="card-number" maxlength="19"
                    placeholder="1234 5678 9012 3456" autocomplete="cc-number">
                  <span class="card-brand" id="card-brand">💳</span>
                </div>
              </div>
              <div class="form-group">
                <label>${t('checkout.card_holder')}</label>
                <input type="text" id="card-name" placeholder="MARIO ROSSI"
                  autocomplete="cc-name" style="text-transform:uppercase">
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>${t('checkout.card_expiry')}</label>
                  <input type="text" id="card-expiry" maxlength="5"
                    placeholder="MM/AA" autocomplete="cc-exp">
                </div>
                <div class="form-group">
                  <label>${t('checkout.card_cvv')}</label>
                  <input type="text" id="card-cvv" maxlength="4"
                    placeholder="123" autocomplete="cc-csc">
                </div>
              </div>
              <div id="card-error" class="form-error" style="display:none;"></div>
              <button type="submit" class="btn btn-primary btn-block btn-pay" id="pay-btn">
                ${t('checkout.pay_btn', { amount: totalFmt })}
              </button>
            </form>
          </div>

          <!-- PayPal Panel -->
          <div id="payment-paypal" class="payment-form-panel" style="display:none;">
            <div class="paypal-info">
              <p>${t('checkout.paypal_redirect')}</p>
              <div id="paypal-error" class="form-error" style="display:none;"></div>
              <button class="btn btn-paypal btn-block btn-pay" id="paypal-btn">
                <span style="font-size:1.2rem">🅿</span> ${t('checkout.paypal_btn')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  setupTabs();
  setupCardFormatting();
  setupCardForm(booking, totalFmt);
  setupPaypalButton(booking, totalFmt);
}

function setupTabs() {
  document.querySelectorAll('.payment-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.payment-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('payment-card').style.display   = tab.dataset.method === 'card'   ? 'block' : 'none';
      document.getElementById('payment-paypal').style.display = tab.dataset.method === 'paypal' ? 'block' : 'none';
    });
  });
}

function setupCardFormatting() {
  const numberInput = document.getElementById('card-number');
  const brandEl     = document.getElementById('card-brand');
  const expiryInput = document.getElementById('card-expiry');

  numberInput.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').substring(0, 16);
    e.target.value = v.replace(/(.{4})/g, '$1 ').trim();
    const prefix = v.substring(0, 2);
    if (v[0] === '4') brandEl.textContent = '💳 Visa';
    else if (['51','52','53','54','55'].includes(prefix)) brandEl.textContent = '💳 Mastercard';
    else if (['34','37'].includes(prefix)) brandEl.textContent = '💳 Amex';
    else brandEl.textContent = '💳';
  });

  expiryInput.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').substring(0, 4);
    if (v.length >= 3) v = v.substring(0, 2) + '/' + v.substring(2);
    e.target.value = v;
  });
}

function validateCard() {
  const number = document.getElementById('card-number').value.replace(/\s/g, '');
  const name   = document.getElementById('card-name').value.trim();
  const expiry = document.getElementById('card-expiry').value.trim();
  const cvv    = document.getElementById('card-cvv').value.trim();

  if (number.length < 13 || number.length > 16) return t('checkout.error_card_invalid');
  if (!name)                                      return t('checkout.error_name_required');
  if (!/^\d{2}\/\d{2}$/.test(expiry))            return t('checkout.error_expiry_invalid');
  const [mm, yy] = expiry.split('/').map(Number);
  if (mm < 1 || mm > 12)                          return t('checkout.error_month_invalid');
  const now     = new Date();
  const expDate = new Date(2000 + yy, mm - 1);
  if (expDate < new Date(now.getFullYear(), now.getMonth())) return t('checkout.error_card_expired');
  if (cvv.length < 3)                             return t('checkout.error_cvv_invalid');
  return null;
}

async function processPayment(booking, method, errElId, btnId, totalFmt) {
  const errEl = document.getElementById(errElId);
  const btn   = document.getElementById(btnId);
  errEl.style.display = 'none';
  btn.disabled        = true;
  btn.innerHTML       = `<span class="btn-spinner"></span> ${t('checkout.processing')}`;

  try {
    await api.processPayment({
      booking_id:       booking.id,
      amount:           parseFloat(booking.total_price),
      currency:         booking.currency || 'EUR',
      payment_method:   method,
      payment_provider: 'manual',
    });
    const updated = { ...booking, payment_status: 'paid', status: 'confirmed' };
    sessionStorage.setItem(`booking_${booking.id}`, JSON.stringify(updated));
    navigate(`#/booking/${booking.id}`);
  } catch (err) {
    errEl.textContent = err.message || t('checkout.error_payment');
    errEl.style.display = 'block';
    btn.disabled        = false;
    btn.innerHTML = method === 'card'
      ? t('checkout.pay_btn', { amount: totalFmt })
      : `<span style="font-size:1.2rem">🅿</span> ${t('checkout.paypal_btn')}`;
  }
}

function setupCardForm(booking, totalFmt) {
  document.getElementById('card-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl           = document.getElementById('card-error');
    const validationError = validateCard();
    if (validationError) {
      errEl.textContent   = validationError;
      errEl.style.display = 'block';
      return;
    }
    await processPayment(booking, 'card', 'card-error', 'pay-btn', totalFmt);
  });
}

function setupPaypalButton(booking, totalFmt) {
  document.getElementById('paypal-btn').addEventListener('click', () => {
    processPayment(booking, 'paypal', 'paypal-error', 'paypal-btn', totalFmt);
  });
}
