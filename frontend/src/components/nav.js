import { api } from '../api.js';
import { state } from '../state.js';
import { navigate } from '../router.js';

export function renderNav() {
  let nav = document.getElementById('main-nav');
  if (!nav) {
    nav = document.createElement('nav');
    nav.id = 'main-nav';
    nav.className = 'navbar';
    document.body.insertBefore(nav, document.body.firstChild);
  }

  const hash = window.location.hash || '#/';
  const isAuth = api.isAuthenticated();

  nav.innerHTML = `
    <div class="nav-container">
      <a href="#/" class="nav-logo">
        <span class="nav-logo-icon">🍷</span>
        <span>Wine Tastings</span>
      </a>
      <div class="nav-links" id="nav-links">
        <a href="#/" class="nav-link ${hash === '#/' || hash === '' ? 'active' : ''}">Home</a>
        ${isAuth ? `
          <a href="#/dashboard" class="nav-link ${hash.startsWith('#/dashboard') ? 'active' : ''}">Dashboard</a>
          <button class="nav-btn-logout" id="nav-logout">Esci</button>
        ` : `
          <a href="#/login" class="btn btn-sm btn-primary ${hash === '#/login' ? 'active' : ''}">Accedi</a>
        `}
      </div>
      <button class="nav-hamburger" id="nav-hamburger" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  `;

  document.getElementById('nav-logout')?.addEventListener('click', async () => {
    await api.logout();
    state.user = null;
    state.tenant = null;
    navigate('#/');
  });

  const hamburger = document.getElementById('nav-hamburger');
  const links = document.getElementById('nav-links');
  hamburger?.addEventListener('click', () => links.classList.toggle('open'));

  // Close menu on link click
  links?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
}
