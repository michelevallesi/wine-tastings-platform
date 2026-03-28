const LOCALE_KEY    = 'wine_locale';
const CURRENCY_KEY  = 'wine_currency';

export const SUPPORTED_LOCALES = [
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'en', label: 'English',  flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch',  flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'];

// Approximate display-only exchange rates relative to EUR
const RATES = { EUR: 1, USD: 1.09, GBP: 0.85, CHF: 0.96 };

// Map locale code → BCP-47 tag for Intl APIs
const LOCALE_BCP47 = { it: 'it-IT', en: 'en-GB', de: 'de-DE', fr: 'fr-FR' };

let _locale = localStorage.getItem(LOCALE_KEY)
  || (navigator.language || '').substring(0, 2)
  || 'it';
if (!SUPPORTED_LOCALES.find(l => l.code === _locale)) _locale = 'it';

let _currency = localStorage.getItem(CURRENCY_KEY) || 'EUR';
if (!SUPPORTED_CURRENCIES.includes(_currency)) _currency = 'EUR';

let _translations = {};

async function loadLocale(code) {
  const mod = await import(`./locales/${code}.js`);
  _translations = mod.default;
}

export async function initI18n() {
  await loadLocale(_locale);
  document.documentElement.lang = _locale;
}

export async function setLocale(code) {
  _locale = code;
  localStorage.setItem(LOCALE_KEY, code);
  await loadLocale(code);
  document.documentElement.lang = code;
}

export function getCurrentLocale()   { return _locale; }

export function setCurrency(code) {
  _currency = code;
  localStorage.setItem(CURRENCY_KEY, code);
}

export function getCurrentCurrency() { return _currency; }

/**
 * Translate a dot-notation key, substituting {{param}} placeholders.
 * Falls back to the key itself when a translation is missing.
 */
export function t(key, params = {}) {
  const parts = key.split('.');
  let val = _translations;
  for (const k of parts) {
    val = val?.[k];
    if (val === undefined) return key;
  }
  if (typeof val !== 'string') return key;
  return val.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in params ? params[k] : `{{${k}}}`));
}

/**
 * Format a price amount, converting from sourceCurrency to the user's
 * selected display currency. Conversion is approximate and for display only;
 * actual charges are always processed in the source currency.
 */
export function formatPrice(amount, sourceCurrency = 'EUR') {
  const src    = RATES[sourceCurrency] || 1;
  const tgt    = RATES[_currency] || 1;
  const converted = (parseFloat(amount) / src) * tgt;
  const bcp47  = LOCALE_BCP47[_locale] || 'it-IT';
  return new Intl.NumberFormat(bcp47, {
    style: 'currency',
    currency: _currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(converted);
}

/**
 * Format a date using the current locale.
 */
export function formatDate(dateStr, options = {}) {
  const bcp47 = LOCALE_BCP47[_locale] || 'it-IT';
  return new Date(dateStr).toLocaleDateString(bcp47, options);
}
