import { CURRENCY_NAMES } from '../utils/constants';

const FRANKFURTER_LATEST = 'https://api.frankfurter.app/latest';

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
  const targets = Object.keys(CURRENCY_NAMES).filter((c) => c !== home);
  const url = new URL(FRANKFURTER_LATEST);
  url.searchParams.set('from', home);
  url.searchParams.set('to', targets.join(','));
  const res = await fetch(url.toString());
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || `HTTP ${res.status}`);
  }
  const data = await res.json();
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
