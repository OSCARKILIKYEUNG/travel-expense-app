import { getExchangeRate } from './currency';

/**
 * 依目前匯率表重算每筆支出的記帳幣金額（`hkdAmount` 欄位語意見 `types/expense.js`）。
 * 與原 `AppContext` 匯率 effect 一致：`originalAmount || hkdAmount`（0 視為假，與舊行為相同）。
 */
export function recalculateExpensesForRates(expenses, exchangeRates) {
  let changed = false;
  const updated = expenses.map((e) => {
    const curr = e.originalCurrency || e.currency;
    const amt = e.originalAmount || e.hkdAmount;
    if (!curr || !amt) return e;
    const newRate = getExchangeRate(curr, exchangeRates);
    const newHome = newRate > 0 ? amt / newRate : amt;
    if (Math.abs(newHome - e.hkdAmount) > 0.01) {
      changed = true;
      return { ...e, hkdAmount: newHome, rate: newRate };
    }
    return e;
  });
  return { expenses: updated, changed };
}
