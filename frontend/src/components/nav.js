import { api } from '../api.js';
import { state } from '../state.js';
import { navigate, rerender } from '../router.js';
import {
  t, setLocale, setCurrency,
  getCurrentLocale, getCurrentCurrency,
  SUPPORTED_LOCALES, SUPPORTED_CURRENCIES,
} from '../i18n.js';

let _scrollHandler = null;

export function renderNav() {
  let nav = document.getElementById('main-nav');
  if (!nav) {
    nav = document.createElement('nav');
    nav.id = 'main-nav';
    nav.className = 'navbar';
    document.body.insertBefore(nav, document.body.firstChild);
  }

  const hash     = window.location.hash || '#/';
  const isAuth   = api.isAuthenticated();
  const isHome   = hash === '#/' || hash === '';
  const locale   = getCurrentLocale();
  const currency = getCurrentCurrency();

  nav.innerHTML = `
    <div class="nav-container">
      <a href="#/" class="nav-logo">
        <span class="nav-logo-icon">🍷</span>
        <span>Wine Tastings</span>
      </a>
      <div class="nav-links" id="nav-links">
        <a href="#/" class="nav-link ${isHome ? 'active' : ''}">${t('nav.home')}</a>
        ${isAuth ? `
          <a href="#/dashboard" class="nav-link ${hash.startsWith('#/dashboard') ? 'active' : ''}">${t('nav.dashboard')}</a>
          <button class="nav-btn-logout" id="nav-logout">${t('nav.logout')}</button>
        ` : `
          <a href="#/register" class="nav-link ${hash === '#/register' ? 'active' : ''}">${t('nav.register')}</a>
          <a href="#/login" class="btn btn-sm btn-primary ${hash === '#/login' ? 'active' : ''}">${t('nav.login')}</a>
        `}
        <div class="locale-controls">
          <select id="lang-select" class="locale-select" aria-label="Language">
            ${SUPPORTED_LOCALES.map(l => `
              <option value="${l.code}" ${locale === l.code ? 'selected' : ''}>${l.flag} ${l.code.toUpperCase()}</option>
            `).join('')}
          </select>
          <select id="currency-select" class="locale-select" aria-label="Currency">
            ${SUPPORTED_CURRENCIES.map(c => `
              <option value="${c}" ${currency === c ? 'selected' : ''}>${c}</option>
            `).join('')}
          </select>
        </div>
      </div>
      <button class="nav-hamburger" id="nav-hamburger" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  `;

  // Scroll transparency: only on home page
  if (_scrollHandler) {
    window.removeEventListener('scroll', _scrollHandler, { passive: true });
    _scrollHandler = null;
  }

  if (isHome) {
    const updateTransparency = () => {
      if (window.scrollY < 72) {
        nav.classList.add('nav-transparent');
        nav.classList.remove('nav-scrolled');
      } else {
        nav.classList.remove('nav-transparent');
        nav.classList.add('nav-scrolled');
      }
    };
    updateTransparency();
    _scrollHandler = updateTransparency;
    window.addEventListener('scroll', _scrollHandler, { passive: true });
  } else {
    nav.classList.remove('nav-transparent', 'nav-scrolled');
  }

  document.getElementById('nav-logout')?.addEventListener('click', async () => {
    await api.logout();
    state.user   = null;
    state.tenant = null;
    navigate('#/');
  });

  document.getElementById('lang-select')?.addEventListener('change', async (e) => {
    await setLocale(e.target.value);
    rerender();
  });

  document.getElementById('currency-select')?.addEventListener('change', (e) => {
    setCurrency(e.target.value);
    rerender();
  });

  const hamburger = document.getElementById('nav-hamburger');
  const links     = document.getElementById('nav-links');
  hamburger?.addEventListener('click', () => links.classList.toggle('open'));
  links?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
}
