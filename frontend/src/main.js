import './styles.css';
import { initI18n, t } from './i18n.js';
import { renderNav } from './components/nav.js';
import { startRouter, route, notFound } from './router.js';
import { renderHome }          from './pages/home.js';
import { renderTasting }       from './pages/tasting.js';
import { renderBookingConfirm} from './pages/booking-confirm.js';
import { renderLogin }         from './pages/login.js';
import { renderDashboard }     from './pages/dashboard.js';
import { renderCheckout }      from './pages/checkout.js';
import { renderRegister }      from './pages/register.js';

const app  = document.getElementById('app');
app.innerHTML = '<main id="main-content"></main>';
const main = document.getElementById('main-content');

route('/',               (c)    => renderHome(c));
route('/tasting/:id',    (c, p) => renderTasting(c, p));
route('/checkout/:id',   (c, p) => renderCheckout(c, p));
route('/booking/:id',    (c, p) => renderBookingConfirm(c, p));
route('/login',          (c)    => renderLogin(c));
route('/register',       (c)    => renderRegister(c));
route('/dashboard',      (c)    => renderDashboard(c, { tab: 'overview' }));
route('/dashboard/:tab', (c, p) => renderDashboard(c, p));

notFound((c) => {
  c.innerHTML = `
    <div class="page-content" style="text-align:center;padding:5rem 1rem;">
      <h1 style="font-size:4rem;color:var(--wine)">${t('common.not_found_title')}</h1>
      <p style="color:var(--text-muted);margin:1rem 0 2rem">${t('common.not_found_msg')}</p>
      <a href="#/" class="btn btn-primary">${t('common.home_btn')}</a>
    </div>`;
});

// Initialise i18n before first render (top-level await — Vite supports this)
await initI18n();
startRouter(main, renderNav);
