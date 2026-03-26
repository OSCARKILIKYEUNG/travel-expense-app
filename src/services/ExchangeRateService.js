import { CURRENCY_NAMES } from '../utils/constants';

/** ECB 支援的幣別（Frankfurter API 只涵蓋 ECB 牌價，TWD / VND 等不在內） */
export const FRANKFURTER_SUPPORTED = new Set([
  'AUD', 'BGN', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR',
  'GBP', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW',
  'MXN', 'MYR', 'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD',
  'THB', 'TRY', 'USD', 'ZAR',
]);

/** 經 Vercel / Vite 代理，與前端同源，避免 CORS；僅傳 `from`，由 API 回傳全部可兌幣別 */
const PROXY_PATH = '/api/exchange-rates';

/**
 * 從 Frankfurter（ECB）拉取牌價：語意為 1 `homeBase` = X 外幣，與本 app `exchangeRates` 一致。
 * @param {string} homeBase ISO 4217，須為 `CURRENCY_NAMES` 鍵之一（不含 OTHER）
 * @returns {Promise<Record<string, number>>} 各幣別匯率；記帳幣本身為 1
 */
export async function fetchFrankfurterRates(homeBase) {
  const home = String(homeBase || '').toUpperCase();
  if (!CURRENCY_NAMES[home]) {
    throw new Error('INVALID_HOME');
  }
  const url = `${PROXY_PATH}?from=${encodeURIComponent(home)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  let res, text;
  try {
    res = await fetch(url, { signal: ctrl.signal });
    text = await res.text();
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let detail = text;
    try {
      const j = JSON.parse(text);
      detail = j.error || text;
    } catch { /* keep text */ }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  const data = JSON.parse(text);
  const rates = data.rates || {};
  const out = {};
  for (const code of Object.keys(CURRENCY_NAMES)) {
    if (code === home) {
      out[code] = 1;
    } else if (rates[code] != null && rates[code] > 0) {
      out[code] = rates[code];
    }
  }
  return out;
}

/**
 * 將 API 結果合併進現有表：API 有值的覆寫；缺者保留 `existing`；記帳幣列為 1。
 */
export function mergeExchangeRates(existing, fetched, home) {
  const merged = { ...existing };
  for (const code of Object.keys(CURRENCY_NAMES)) {
    if (code === home) {
      merged[code] = 1;
    } else if (fetched[code] != null && fetched[code] > 0) {
      merged[code] = fetched[code];
    }
  }
  return merged;
}

/**
 * 以數學方式將現有匯率表從舊基準換算到新基準（cross-rate rebase）。
 * 公式：newRate[C] = oldRate[C] / oldRate[newHome]
 */
export function rebaseRates(oldRates, newHome) {
  const pivot = oldRates[newHome] || 1;
  const rebased = {};
  for (const code of Object.keys(CURRENCY_NAMES)) {
    if (code === newHome) {
      rebased[code] = 1;
    } else {
      rebased[code] = (oldRates[code] || 1) / pivot;
    }
  }
  return rebased;
}
