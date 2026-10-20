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
 * 結果通常寫入支出欄位 `hkdAmount`（語意見 `src/types/expense.js`）。
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

const numberFormatters = new Map();

function numberFormatter(decimals) {
  const raw = Number(decimals);
  const d = Number.isFinite(raw) && raw > 0 ? Math.min(20, Math.floor(raw)) : 0;
  let fmt = numberFormatters.get(d);
  if (!fmt) {
    fmt = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
      useGrouping: true,
    });
    numberFormatters.set(d, fmt);
  }
  return fmt;
}

function asFinite(value) {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

/** Bare grouped number. Non-finite values render as 0. Sign sits before the digits. */
export function formatNumber(n, decimals = 0) {
  return numberFormatter(decimals).format(asFinite(n));
}

/**
 * Grouped money. `HKD $12,345` with a code, `$12,345` without, `12,345` when prefix is empty.
 * Negatives keep the sign in front of the code: `-HKD $1,234`.
 * @param {number} amount
 * @param {{ code?: string, decimals?: number, prefix?: string }} [options]
 */
export function formatMoney(amount, options) {
  const { code, decimals = 0, prefix = '$' } = options || {};
  const value = asFinite(amount);
  const sign = value < 0 ? '-' : '';
  const digits = formatNumber(Math.abs(value), decimals);
  const body = `${prefix}${digits}`;
  return code ? `${sign}${code} ${body}` : `${sign}${body}`;
}

/** Same shape as formatMoney without a currency code. Grouping comes from formatNumber. */
export function formatCurrency(amount, options = {}) {
  const { decimals = 0, prefix = '$' } = options || {};
  const value = asFinite(amount);
  const sign = value < 0 ? '-' : '';
  return `${sign}${prefix}${formatNumber(Math.abs(value), decimals)}`;
}

export function getCurrencyLabel(code) {
  return CURRENCY_NAMES[code] || code;
}
