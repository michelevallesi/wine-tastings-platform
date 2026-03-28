import { api } from '../api.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';
import { t } from '../i18n.js';

export function renderRegister(container) {
  if (api.isAuthenticated()) { navigate('#/dashboard'); return; }

  container.innerHTML = `
    <div class="auth-wrapper">
      <div class="auth-card auth-card-wide">
        <div class="auth-logo">🍷</div>
        <h1>${t('register.title')}</h1>
        <p class="auth-subtitle">${t('register.subtitle')}</p>

        <form id="register-form">
          <div class="register-section-label">${t('register.account_section')}</div>
          <div class="form-row">
            <div class="form-group">
              <label for="r-name">${t('register.name')}</label>
              <input type="text" id="r-name" required placeholder="Mario Rossi">
            </div>
            <div class="form-group">
              <label for="r-email">${t('register.email')}</label>
              <input type="email" id="r-email" required placeholder="mario@cantina.it" autocomplete="email">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="r-password">${t('register.password')}</label>
              <input type="password" id="r-password" required placeholder="${t('register.password_placeholder')}" autocomplete="new-password">
            </div>
            <div class="form-group">
              <label for="r-password2">${t('register.confirm_password')}</label>
              <input type="password" id="r-password2" required placeholder="${t('register.confirm_placeholder')}" autocomplete="new-password">
            </div>
          </div>

          <div class="register-section-label">${t('register.winery_section')}</div>
          <div class="form-group">
            <label for="r-winery">${t('register.winery')}</label>
            <input type="text" id="r-winery" required placeholder="Es. Cantina Rossi">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="r-location">${t('register.location')}</label>
              <input type="text" id="r-location" placeholder="Es. Chianti, Toscana">
            </div>
            <div class="form-group">
              <label for="r-phone">${t('register.phone')}</label>
              <input type="tel" id="r-phone" placeholder="+39 055 000000">
            </div>
          </div>
          <div class="form-group">
            <label for="r-website">${t('register.website')}</label>
            <input type="url" id="r-website" placeholder="https://lacantina.it">
          </div>

          <div id="register-error" class="form-error" style="display:none;"></div>

          <button type="submit" id="register-submit" class="btn btn-primary btn-block" style="margin-top:.5rem">
            ${t('register.submit')}
          </button>
        </form>

        <p class="auth-switch">
          ${t('register.login_prompt')} <a href="#/login" class="auth-switch-link">${t('register.login_link')}</a>
        </p>
      </div>
    </div>
  `;

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('register-error');
    const btn   = document.getElementById('register-submit');
    errEl.style.display = 'none';

    const password  = document.getElementById('r-password').value;
    const password2 = document.getElementById('r-password2').value;
    if (password !== password2) {
      errEl.textContent   = t('register.error_passwords');
      errEl.style.display = 'block';
      return;
    }

    btn.disabled    = true;
    btn.textContent = t('register.creating');

    try {
      const res = await api.register({
        name:        document.getElementById('r-name').value.trim(),
        email:       document.getElementById('r-email').value.trim(),
        password,
        winery_name: document.getElementById('r-winery').value.trim(),
        location:    document.getElementById('r-location').value.trim() || undefined,
        phone:       document.getElementById('r-phone').value.trim()    || undefined,
        website:     document.getElementById('r-website').value.trim()  || undefined,
      });
      state.user = res.data.user;
      showToast(t('register.welcome_toast'));
      navigate('#/dashboard');
    } catch (err) {
      errEl.textContent   = err.message || t('register.error');
      errEl.style.display = 'block';
      btn.disabled        = false;
      btn.textContent     = t('register.submit');
    }
  });
}
