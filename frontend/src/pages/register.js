import { api } from '../api.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';

export function renderRegister(container) {
  if (api.isAuthenticated()) { navigate('#/dashboard'); return; }

  container.innerHTML = `
    <div class="auth-wrapper">
      <div class="auth-card auth-card-wide">
        <div class="auth-logo">🍷</div>
        <h1>Registra la tua Cantina</h1>
        <p class="auth-subtitle">Crea il tuo profilo produttore e inizia a gestire le degustazioni</p>

        <form id="register-form">
          <div class="register-section-label">Il tuo account</div>
          <div class="form-row">
            <div class="form-group">
              <label for="r-name">Nome e Cognome *</label>
              <input type="text" id="r-name" required placeholder="Mario Rossi">
            </div>
            <div class="form-group">
              <label for="r-email">Email *</label>
              <input type="email" id="r-email" required placeholder="mario@cantina.it" autocomplete="email">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="r-password">Password *</label>
              <input type="password" id="r-password" required placeholder="Min. 8 caratteri" autocomplete="new-password">
            </div>
            <div class="form-group">
              <label for="r-password2">Conferma Password *</label>
              <input type="password" id="r-password2" required placeholder="Ripeti la password" autocomplete="new-password">
            </div>
          </div>

          <div class="register-section-label">La tua cantina</div>
          <div class="form-group">
            <label for="r-winery">Nome Cantina *</label>
            <input type="text" id="r-winery" required placeholder="Es. Cantina Rossi">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="r-location">Zona / Regione</label>
              <input type="text" id="r-location" placeholder="Es. Chianti, Toscana">
            </div>
            <div class="form-group">
              <label for="r-phone">Telefono</label>
              <input type="tel" id="r-phone" placeholder="+39 055 000000">
            </div>
          </div>
          <div class="form-group">
            <label for="r-website">Sito Web</label>
            <input type="url" id="r-website" placeholder="https://lacantina.it">
          </div>

          <div id="register-error" class="form-error" style="display:none;"></div>

          <button type="submit" id="register-submit" class="btn btn-primary btn-block" style="margin-top:.5rem">
            Crea Account
          </button>
        </form>

        <p class="auth-switch">
          Hai già un account? <a href="#/login" class="auth-switch-link">Accedi</a>
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
      errEl.textContent = 'Le password non coincidono.';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Creazione in corso...';

    try {
      const res = await api.register({
        name:        document.getElementById('r-name').value.trim(),
        email:       document.getElementById('r-email').value.trim(),
        password,
        winery_name: document.getElementById('r-winery').value.trim(),
        location:    document.getElementById('r-location').value.trim() || undefined,
        phone:       document.getElementById('r-phone').value.trim() || undefined,
        website:     document.getElementById('r-website').value.trim() || undefined,
      });
      state.user = res.data.user;
      showToast('Registrazione completata! Benvenuto.');
      navigate('#/dashboard');
    } catch (err) {
      errEl.textContent = err.message || 'Errore durante la registrazione. Riprova.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Crea Account';
    }
  });
}
