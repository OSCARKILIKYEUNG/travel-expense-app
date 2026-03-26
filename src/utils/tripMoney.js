import { CURRENCY_NAMES } from './constants';
import { FRANKFURTER_SUPPORTED, FRANKFURTER_GRID_CODES } from '../services/ExchangeRateService';

/** 匯率表可一鍵更新的幣別列（Frankfurter ∩ 本 app 內建名單） */
export function getFrankfurterGridCodes() {
  return [...FRANKFURTER_GRID_CODES];
}

/**
 * 記帳貨幣 ISO 代碼（與舊 homeCurrencyCode 語意相同）
 * @param {object} trip
 */
export function getAccountingCode(trip) {
  if (!trip) return 'HKD';
  const c = trip.accountingCurrency;
  if (c && typeof c === 'string' && c.length === 3) return c.toUpperCase();
  return 'HKD';
}

/** 是否可用 Frankfurter 一鍵更新匯率 */
export function canFetchLiveRates(trip) {
  if (!trip?.accountingIsCustom) {
    const code = getAccountingCode(trip);
    return FRANKFURTER_SUPPORTED.has(code);
  }
  return false;
}

/** 新旅程／切換為自訂記帳幣時：僅記帳幣本身為 1，其餘手動 */
export function blankRatesForAccounting(accountingCode) {
  const code = String(accountingCode || 'HKD').toUpperCase().slice(0, 3) || 'HKD';
  return { [code]: 1 };
}

/** 下拉選項：內建 + 跨旅程已儲存 + 本旅程自訂（去重） */
export function accountingCurrencyOptions(trip, globalSaved = []) {
  const preset = Object.keys(CURRENCY_NAMES);
  const extra = [
    ...(Array.isArray(trip?.customAccountingCodes) ? trip.customAccountingCodes : []),
    ...(Array.isArray(globalSaved) ? globalSaved : []),
  ];
  const cur = getAccountingCode(trip);
  const set = new Set([...preset, ...extra]);
  if (cur && cur.length === 3) set.add(cur);
  return [...set].sort();
}

/** 旅程主要外幣下拉：內建 + 跨旅程曾用過的代碼（去重） */
export function tripCurrencyOptions(globalSaved = []) {
  const preset = Object.keys(CURRENCY_NAMES);
  const set = new Set([...preset, ...(Array.isArray(globalSaved) ? globalSaved : [])]);
  return [...set].sort();
}
