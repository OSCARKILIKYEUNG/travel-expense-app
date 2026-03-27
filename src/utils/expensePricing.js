/**
 * 判斷編輯儲存時是否變更了「價格／稅／折扣／品項金額」相關欄位。
 * 僅改店名、地點、日期、類別、分配、收據免稅額顯示等 → 不視為價格編輯。
 */
function numClose(a, b, eps) {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) <= eps;
}

function itemPricingKey(item) {
  return {
    price: Number(item?.price) || 0,
    priceActual: item?.priceActual != null ? Number(item.priceActual) : null,
    excludeFromRefundSplit: Boolean(item?.excludeFromRefundSplit),
  };
}

export function hasPricingRelatedChanges(prev, next, currency = 'HKD') {
  if (!prev || !next) return false;
  const c = (currency || next.currency || prev.currency || 'HKD').toUpperCase();
  const eps = ['JPY', 'KRW', 'VND', 'CLP'].includes(c) ? 1 : 0.01;

  if (!numClose(prev.originalAmount, next.originalAmount, eps)) return true;
  if (!numClose(prev.subtotal, next.subtotal, eps)) return true;
  if (!numClose(prev.tax, next.tax, eps)) return true;
  if (!numClose(prev.taxRefund, next.taxRefund, eps)) return true;
  if (!numClose(prev.discount, next.discount, eps)) return true;
  const rtPrev = prev.receiptType || '';
  const rtNext = next.receiptType || '';
  if (rtPrev !== rtNext) return true;

  const pi = prev.items || [];
  const ni = next.items || [];
  if (pi.length !== ni.length) return true;
  for (let i = 0; i < pi.length; i++) {
    const a = itemPricingKey(pi[i]);
    const b = itemPricingKey(ni[i]);
    if (!numClose(a.price, b.price, eps)) return true;
    const pa = a.priceActual;
    const pb = b.priceActual;
    if (pa == null && pb == null) {
      /* ok */
    } else if (pa == null || pb == null) {
      return true;
    } else if (!numClose(pa, pb, eps)) {
      return true;
    }
    if (a.excludeFromRefundSplit !== b.excludeFromRefundSplit) return true;
  }
  return false;
}
