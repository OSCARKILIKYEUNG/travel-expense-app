import { getAccountingCode, getTripCurrencyCode } from './tripMoney';

function mergeArr(base, additions) {
  const s = new Set([...(base || [])]);
  additions.forEach((x) => {
    const c = String(x).toUpperCase().slice(0, 3);
    if (/^[A-Z]{3}$/.test(c)) s.add(c);
  });
  return [...s].sort();
}

/**
 * 將某旅程的記帳幣／旅程幣代碼合併進 settings 的「已儲存重用清單」。
 * 供 `AppContext` 在 `createTrip` / `updateTrip` 後更新 `savedAccountingCodes`、`savedTripCurrencies`。
 *
 * @param {object} prevSettings 現有 settings（需含 `savedAccountingCodes`、`savedTripCurrencies` 陣列）
 * @param {object} trip 旅程物件
 * @returns {object|null} 合併後的 settings patch（`{ ...prev, savedAccountingCodes, savedTripCurrencies }`），若無 trip 則 `null`
 */
export function buildMergedSavedCurrencySettings(prevSettings, trip) {
  if (!trip) return null;
  const acc = new Set();
  const ac = getAccountingCode(trip);
  if (/^[A-Z]{3}$/.test(ac)) acc.add(ac);
  (trip.customAccountingCodes || []).forEach((c) => {
    const x = String(c).toUpperCase().slice(0, 3);
    if (/^[A-Z]{3}$/.test(x)) acc.add(x);
  });
  const tripCodes = new Set();
  const tc = getTripCurrencyCode(trip);
  if (/^[A-Z]{3}$/.test(tc)) tripCodes.add(tc);
  (trip.customTripCurrencyCodes || []).forEach((c) => {
    const x = String(c).toUpperCase().slice(0, 3);
    if (/^[A-Z]{3}$/.test(x)) tripCodes.add(x);
  });

  return {
    ...prevSettings,
    savedAccountingCodes: mergeArr(prevSettings.savedAccountingCodes, [...acc]),
    savedTripCurrencies: mergeArr(prevSettings.savedTripCurrencies, [...tripCodes]),
  };
}
