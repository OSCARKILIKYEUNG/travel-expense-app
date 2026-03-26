import { getExchangeRate } from './currency';

function refundEpsilon(currency) {
  const c = (currency || 'HKD').toUpperCase();
  return ['JPY', 'KRW', 'VND', 'CLP'].includes(c) ? 1 : 0.01;
}

/**
 * 取得品項用於分帳的實際金額：有 priceActual 時用之，否則 fallback 到 price。
 * priceActual 來自 ZARA 非課稅欄、套裝均攤等場景。
 */
export function getItemActualPrice(item) {
  const pa = Number(item.priceActual);
  if (!isNaN(pa) && pa > 0) return pa;
  return Number(item.price) || 0;
}

/**
 * 全單行項目「原價/標價」加總（display price）
 */
export function sumAllItemPrices(items) {
  return (items || []).reduce((s, i) => s + (Number(i.price) || 0), 0);
}

/**
 * 全單行項目「實際計入合計的金額」加總（用於分帳比例）。
 * 大部分情況 = sumAllItemPrices；ZARA 非課稅、套裝均攤時不同。
 */
export function sumAllItemActualPrices(items) {
  return (items || []).reduce((s, i) => s + getItemActualPrice(i), 0);
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
 * 指定人物在行項目上的原價（display price）小計
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
 * 指定人物在行項目上的 actual price 小計（用於分帳）
 */
export function sumAssignedItemActualPrices(expense, filterPerson) {
  const items = expense.items || [];
  let S = 0;
  for (const item of items) {
    if ((item.assignedTo || expense.assignedTo || '共同') === filterPerson) {
      S += getItemActualPrice(item);
    }
  }
  return S;
}

/** 品名關鍵字：常見不退稅／手續費（如日本免稅單據 GB Commis） */
export function inferFixedFeeFromName(name) {
  const n = String(name || '').toLowerCase();
  return /佣金|commis|commission|手續費|gb\s*comm|service\s*fee|サービス料|global\s*blue/.test(n);
}

/**
 * 此行「實付＝標價」，不參與整單退稅比例（例如代辦手續費）。
 * true／false 為使用者明確設定；未設定時依品名推測。
 */
export function isItemExcludeFromRefundSplit(item) {
  if (item.excludeFromRefundSplit === true) return true;
  if (item.excludeFromRefundSplit === false) return false;
  return inferFixedFeeFromName(item.name);
}

/** 固定費用行的 actual price 加總（佣金等不隨退稅比例縮減） */
export function sumFixedFeeActual(items) {
  return (items || []).reduce(
    (s, i) => s + (isItemExcludeFromRefundSplit(i) ? getItemActualPrice(i) : 0), 0,
  );
}

/** @deprecated 保留向後相容；新代碼請用 sumFixedFeeActual */
export function sumFixedFeeGross(items) {
  return sumFixedFeeActual(items);
}

/**
 * 可退稅（可比例分攤）之品項池。
 * G = 全單 actual price 加總；F = 固定費行 actual；gElig = G − F。
 * P = 實付；pElig = P − F。
 * r = pElig / gElig；無固定費時 r = P/G（與舊版一致）。
 *
 * 當品項有 priceActual（如 ZARA 非課稅）時，G 已等於實付級金額，
 * r ≈ 1，分帳直接以 priceActual 為準。
 */
function getEligiblePoolRatio(expense) {
  const items = expense.items || [];
  const P = Number(expense.originalAmount) || Number(expense.hkdAmount) || 0;
  const G = sumAllItemActualPrices(items);
  const eps = refundEpsilon(expense.currency);
  if (G <= eps) {
    return { r: 1, gElig: 0, f: 0, pElig: P, legacyUniform: true };
  }
  const F = sumFixedFeeActual(items);
  const gElig = G - F;
  const pElig = P - F;
  if (gElig <= eps) {
    return { r: P / G, gElig: 0, f: F, pElig: P, legacyUniform: true };
  }
  if (pElig <= eps) {
    return { r: P / G, gElig, f: F, pElig, legacyUniform: true };
  }
  let r = pElig / gElig;
  if (r <= 0 || r > 1.25) {
    return { r: P / G, gElig, f: F, pElig, legacyUniform: true };
  }
  return { r, gElig, f: F, pElig, legacyUniform: false };
}

/**
 * 分人篩選且整卡 assignee ≠ 該人、僅部分行屬於該人時：
 * 實攤原幣：固定費行照 actual price；其餘行 × r。
 */
export function getPartialMatchPersonShareOriginal(expense, filterPerson) {
  const items = expense.items || [];
  const P = Number(expense.originalAmount) || Number(expense.hkdAmount) || 0;
  const G = sumAllItemActualPrices(items);
  const S = sumAssignedItemActualPrices(expense, filterPerson);
  const eps = refundEpsilon(expense.currency);
  if (G <= 0) {
    return S;
  }
  const { r, legacyUniform } = getEligiblePoolRatio(expense);
  if (legacyUniform) {
    return P * (S / G);
  }
  let share = 0;
  for (const item of items) {
    if ((item.assignedTo || expense.assignedTo || '共同') !== filterPerson) continue;
    const p = getItemActualPrice(item);
    share += isItemExcludeFromRefundSplit(item) ? p : p * r;
  }
  return share;
}

/**
 * 分人篩選：實攤 HKD
 */
export function getPartialMatchPersonShareHKD(expense, filterPerson, exchangeRates) {
  const G = sumAllItemActualPrices(expense.items);
  const rate = getExchangeRate(expense.currency || 'HKD', exchangeRates);
  if (G <= 0) {
    return rate > 0 ? sumAssignedItemActualPrices(expense, filterPerson) / rate : 0;
  }
  const netOrig = getPartialMatchPersonShareOriginal(expense, filterPerson);
  const P = Number(expense.originalAmount) || 0;
  if (P > 0) {
    return expense.hkdAmount * (netOrig / P);
  }
  return rate > 0 ? netOrig / rate : netOrig;
}

/**
 * 該人分攤到的退稅額（正數）：可退稅池內依該人「可退稅 actual price」比例，不含固定費行。
 */
export function getPartialRefundShareOriginal(expense, filterPerson) {
  const refundTotal = getEffectiveRefundPositive(expense);
  const items = expense.items || [];
  const G = sumAllItemActualPrices(items);
  const eps = refundEpsilon(expense.currency);
  if (refundTotal <= 0 || G <= eps) {
    return 0;
  }
  const { r, gElig, legacyUniform } = getEligiblePoolRatio(expense);
  let sRef = 0;
  for (const item of items) {
    if ((item.assignedTo || expense.assignedTo || '共同') !== filterPerson) continue;
    if (isItemExcludeFromRefundSplit(item)) continue;
    sRef += getItemActualPrice(item);
  }
  if (sRef <= 0) {
    return 0;
  }
  if (legacyUniform || gElig <= eps) {
    const S = sumAssignedItemActualPrices(expense, filterPerson);
    return refundTotal * (S / G);
  }
  return sRef * (1 - r);
}

