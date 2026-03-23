import { getExchangeRate } from './currency';

/**
 * 全單行項目「原價」加總（與實付可能因退稅等不一致）
 */
export function sumAllItemPrices(items) {
  return (items || []).reduce((s, i) => s + (Number(i.price) || 0), 0);
}

/**
 * 指定人物在行項目上的原價小計
 */
export function sumAssignedItemPrices(expense, filterPerson) {
  const items = expense.items || [];
  let S = 0;
  for (const item of items) {
    if ((item.assignedTo || expense.assignedTo || '共同') === filterPerson) {
      S += Number(item.price) || 0;
    }
  }
  return S;
}

/**
 * 分人篩選且整卡 assignee ≠ 該人、僅部分行屬於該人時：
 * 實攤 HKD = 實付 HKD × (該人原價小計 ÷ 全單原價加總)
 * G=0 時退回舊行為：原價小計 × 匯率（避免除零）
 */
export function getPartialMatchPersonShareHKD(expense, filterPerson, exchangeRates) {
  const G = sumAllItemPrices(expense.items);
  const S = sumAssignedItemPrices(expense, filterPerson);
  const rate = getExchangeRate(expense.currency || 'HKD', exchangeRates);
  if (G <= 0) {
    return S * rate;
  }
  return expense.hkdAmount * (S / G);
}

/**
 * 同上，原幣實攤（與 hkdAmount / originalAmount 比例一致）
 */
export function getPartialMatchPersonShareOriginal(expense, filterPerson) {
  const G = sumAllItemPrices(expense.items);
  const S = sumAssignedItemPrices(expense, filterPerson);
  const P = expense.originalAmount ?? expense.hkdAmount ?? 0;
  if (G <= 0) {
    return S;
  }
  return P * (S / G);
}

/**
 * 全單退稅依「原價比例」分攤到該人：|taxRefund| × (S ÷ G)
 * （畫面上退稅為正數，與 ExpenseCard 全單退稅列一致）
 */
export function getPartialRefundShareOriginal(expense, filterPerson) {
  const G = sumAllItemPrices(expense.items);
  const S = sumAssignedItemPrices(expense, filterPerson);
  const tr = expense.taxRefund ?? 0;
  const absRefund = Math.abs(tr);
  if (G <= 0 || S <= 0 || absRefund <= 0) {
    return 0;
  }
  return absRefund * (S / G);
}
