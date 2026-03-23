import { CURRENCY_NAMES } from './constants';

export function getExchangeRate(currency, rates) {
  return rates[currency] || 1;
}

/**
 * 單據 AI 若回傳 currency（如 JPY），應優先採用，勿用使用者預設幣別覆蓋，否則金額會被當錯幣別、HKD 匯率錯。
 */
export function resolveReceiptCurrency(parsed, settings) {
  const raw = (parsed?.currency || '').toString().trim().toUpperCase();
  if (raw && CURRENCY_NAMES[raw]) return raw;
  if (settings?.defaultCurrency === 'OTHER' && settings?.customCurrencyCode) {
    const c = String(settings.customCurrencyCode).trim().toUpperCase();
    if (c && CURRENCY_NAMES[c]) return c;
  }
  const def = settings?.defaultCurrency;
  if (def && def !== 'OTHER' && CURRENCY_NAMES[def]) return def;
  return 'HKD';
}

export function toHKD(amount, currency, rates) {
  return amount * getExchangeRate(currency, rates);
}

export function formatCurrency(amount, options = {}) {
  const { decimals = 0, prefix = '$' } = options;
  const rounded = decimals > 0 ? amount.toFixed(decimals) : Math.round(amount);
  return `${prefix}${Number(rounded).toLocaleString()}`;
}

export function getCurrencyLabel(code) {
  return CURRENCY_NAMES[code] || code;
}
