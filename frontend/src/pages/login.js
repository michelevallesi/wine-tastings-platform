import { api } from '../api.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';
import { t } from '../i18n.js';

export function renderLogin(container) {
  if (api.isAuthenticated()) { navigate('#/dashboard'); return; }

  container.innerHTML = `
    <div class="auth-wrapper">
      <div class="auth-card">
        <div class="auth-logo">🍷</div>
        <h1>${t('login.title')}</h1>
        <p class="auth-subtitle">${t('login.subtitle')}</p>
        <form id="login-form">
          <div class="form-group">
            <label for="login-email">${t('login.email')}</label>
            <input type="email" id="login-email" required placeholder="admin@cantinarossi.it" autocomplete="email">
          </div>
          <div class="form-group">
            <label for="login-password">${t('login.password')}</label>
            <input type="password" id="login-password" required placeholder="••••••••" autocomplete="current-password">
          </div>
          <div id="login-error" class="form-error" style="display:none;"></div>
          <button type="submit" id="login-submit" class="btn btn-primary btn-block">${t('login.submit')}</button>
        </form>
        <p class="auth-switch">
          ${t('login.register_prompt')} <a href="#/register" class="auth-switch-link">${t('login.register_link')}</a>
        </p>
        <div class="auth-hint">
          <strong>${t('login.demo_label')}</strong><br>
          admin@cantinarossi.it / admin123<br>
          admin@villabianchi.it / admin123
        </div>
      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn   = document.getElementById('login-submit');
    const errEl = document.getElementById('login-error');
    btn.disabled    = true;
    btn.textContent = t('login.logging_in');
    errEl.style.display = 'none';

    try {
      const res = await api.login(
        document.getElementById('login-email').value.trim(),
        document.getElementById('login-password').value,
      );
      state.user = res.data.user;
      showToast(t('login.welcome', { name: res.data.user.name }));
      navigate('#/dashboard');
    } catch (err) {
      errEl.textContent   = err.message || t('login.error');
      errEl.style.display = 'block';
      btn.disabled        = false;
      btn.textContent     = t('login.submit');
    }
  });
}
