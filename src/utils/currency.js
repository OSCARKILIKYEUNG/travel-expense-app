import { CURRENCY_NAMES } from './constants';

/**
 * 匯率值語意：1 homeCurrency = rate 單位的該外幣。
 * homeCurrency 本身 rate = 1。
 */
export function getExchangeRate(currency, rates) {
  return (rates && rates[currency]) || 1;
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

/** 2 when the value has cents, else 0. For original receipt amounts (USD 13.75 vs JPY 2,360). */
export function autoDecimals(n) {
  const frac = Math.abs(asFinite(n) % 1);
  return frac > 1e-6 && frac < 1 - 1e-6 ? 2 : 0;
}

function resolveDecimals(n, decimals) {
  return decimals === 'auto' ? autoDecimals(n) : decimals;
}

/**
 * Bare grouped number. Non-finite values render as 0. Sign sits before the digits.
 * @param {number} n
 * @param {number|'auto'} [decimals=0]
 */
export function formatNumber(n, decimals = 0) {
  return numberFormatter(resolveDecimals(n, decimals)).format(asFinite(n));
}

/**
 * Grouped money. `HKD $12,345` with a code, `$12,345` without, `12,345` when prefix is empty.
 * Negatives keep the sign in front of the code: `-HKD $1,234`. The sign is decided after
 * rounding, so -0.2 at 0 decimals renders `HKD $0`, not `-HKD $0`.
 * @param {number} amount
 * @param {{ code?: string, decimals?: number|'auto', prefix?: string }} [options]
 */
export function formatMoney(amount, options) {
  const { code, decimals = 0, prefix = '$' } = options || {};
  const value = asFinite(amount);
  const d = resolveDecimals(value, decimals);
  const digits = formatNumber(Math.abs(value), d);
  const sign = value < 0 && /[1-9]/.test(digits) ? '-' : '';
  const body = `${prefix}${digits}`;
  return code ? `${sign}${code} ${body}` : `${sign}${body}`;
}

/** formatMoney without a currency code (kept for existing callers/tests). */
export function formatCurrency(amount, options = {}) {
  const { decimals = 0, prefix = '$' } = options || {};
  return formatMoney(amount, { decimals, prefix });
}

export function getCurrencyLabel(code) {
  return CURRENCY_NAMES[code] || code;
}
