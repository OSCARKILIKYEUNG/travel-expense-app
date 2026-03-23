import { getExchangeRate } from './currency';

function refundEpsilon(currency) {
  const c = (currency || 'HKD').toUpperCase();
  return ['JPY', 'KRW', 'VND', 'CLP'].includes(c) ? 1 : 0.01;
}

/**
 * 全單行項目「原價」加總（與實付可能因退稅等不一致）
 */
export function sumAllItemPrices(items) {
  return (items || []).reduce((s, i) => s + (Number(i.price) || 0), 0);
}

/**
 * 全單「退稅／折讓」金額（正數）：優先 |taxRefund|，否則用 原價加總(或標價小計) − 實付。
 * 舊資料或未存 taxRefund 時仍可顯示分人比例退稅。
 */
export function getEffectiveRefundPositive(expense) {
  const eps = refundEpsilon(expense.currency);
  const tr = Number(expense.taxRefund) || 0;
  if (Math.abs(tr) > eps) {
    return Math.abs(tr);
  }
  const fromItems = sumAllItemPrices(expense.items);
  const sub = Number(expense.subtotal) || 0;
  const gross = fromItems > 0 ? fromItems : sub;
  const paid = Number(expense.originalAmount) || Number(expense.hkdAmount) || 0;
  if (gross > paid + eps) {
    return gross - paid;
  }
  return 0;
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
 * 全單退稅依「原價比例」分攤到該人：有效退稅 × (S ÷ G)
 * （畫面上退稅為正數，與 ExpenseCard 全單退稅列一致）
 */
export function getPartialRefundShareOriginal(expense, filterPerson) {
  const G = sumAllItemPrices(expense.items);
  const S = sumAssignedItemPrices(expense, filterPerson);
  const refundTotal = getEffectiveRefundPositive(expense);
  if (G <= 0 || S <= 0 || refundTotal <= 0) {
    return 0;
  }
  return refundTotal * (S / G);
}
