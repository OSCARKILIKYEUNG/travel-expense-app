import { CURRENCY_NAMES } from './constants';

/**
 * 匯率值語意：1 homeCurrency = rate 單位的該外幣。
 * homeCurrency 本身 rate = 1。
 */
export function getExchangeRate(currency, rates) {
  return rates[currency] || 1;
}

/**
 * 將原幣金額轉成記帳幣（home currency）。
 * 公式：homeAmount = originalAmount / rate（rate = 1 home = X foreign）。
 */
export function toHome(amount, currency, rates) {
  const rate = getExchangeRate(currency, rates);
  return rate > 0 ? amount / rate : amount;
}

/**
 * AI 回傳 currency 優先；其次 tripCurrency（旅程幣）；最後記帳幣代碼。
 * @param {string} accountingCode 目前旅程記帳貨幣 ISO（可為自訂三字碼）
 */
export function resolveReceiptCurrency(parsed, accountingCode, tripCurrency) {
  const raw = (parsed?.currency || '').toString().trim().toUpperCase();
  if (raw && CURRENCY_NAMES[raw]) return raw;
  if (raw && /^[A-Z]{3}$/.test(raw)) return raw;
  const tripIso = String(tripCurrency || '')
    .toUpperCase()
    .slice(0, 3);
  if (tripIso && /^[A-Z]{3}$/.test(tripIso)) return tripIso;
  const home = String(accountingCode || '').toUpperCase();
  if (home && /^[A-Z]{3}$/.test(home)) return home.slice(0, 3);
  return 'HKD';
}

export function formatCurrency(amount, options = {}) {
  const { decimals = 0, prefix = '$' } = options;
  const rounded = decimals > 0 ? amount.toFixed(decimals) : Math.round(amount);
  return `${prefix}${Number(rounded).toLocaleString()}`;
}

export function getCurrencyLabel(code) {
  return CURRENCY_NAMES[code] || code;
}
