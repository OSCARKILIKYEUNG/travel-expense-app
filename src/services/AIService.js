/**
 * 單據解析改由後端 /api/parse-receipt（Vercel Serverless）呼叫 Gemini，
 * API 金鑰僅存 GEMINI_API_KEY，不經前端。
 */

import { inferFixedFeeFromName } from '../utils/personShare';

function resizeImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        const MAX = 1024;
        if (w > h) {
          if (w > MAX) { h *= MAX / w; w = MAX; }
        } else {
          if (h > MAX) { w *= MAX / h; h = MAX; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    };
  });
}

/**
 * @returns {Promise<object>} 解析後的單據 JSON
 */
export async function parseReceipt(file) {
  const base64 = await resizeImage(file);

  const res = await fetch('/api/parse-receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64 }),
  });

  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(
      `伺服器回傳異常（${res.status}）。若使用「加到主畫面」的 PWA，請關閉分頁重開或清除網站資料後再試。`,
    );
  }
  if (!res.ok) {
    throw new Error(data.error || `API 請求失敗: ${res.status}`);
  }
  return data;
}

/** 零錢幣別：整數；其餘預設兩位小數 */
function roundMoney(amount, currency) {
  const c = (currency || 'HKD').toUpperCase();
  if (['JPY', 'KRW', 'VND', 'CLP'].includes(c)) {
    return Math.round(amount);
  }
  return Math.round(amount * 100) / 100;
}

function moneyEpsilon(currency) {
  const c = (currency || 'HKD').toUpperCase();
  return ['JPY', 'KRW', 'VND', 'CLP'].includes(c) ? 1 : 0.01;
}

/**
 * 當細項加總 ≠ 實付時，依比例調整各品項，使加總 = targetTotal（最後一筆吸收捨入差）。
 * @returns {{ items: Array, adjusted: boolean }}
 */
export function alignItemPricesToTotal(items, targetTotal, currency) {
  if (!items?.length || targetTotal <= 0) {
    return { items: items || [], adjusted: false };
  }
  const eps = moneyEpsilon(currency);
  const sum = items.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);
  if (Math.abs(sum - targetTotal) <= eps) {
    return { items, adjusted: false };
  }
  if (sum <= 0) {
    return { items, adjusted: false };
  }
  const factor = targetTotal / sum;
  const scaled = items.map((item) => ({
    ...item,
    price: roundMoney((parseFloat(item.price) || 0) * factor, currency),
  }));
  let newSum = scaled.reduce((s, i) => s + i.price, 0);
  let diff = roundMoney(targetTotal - newSum, currency);
  if (Math.abs(diff) > eps && scaled.length > 0) {
    const last = scaled.length - 1;
    scaled[last] = {
      ...scaled[last],
      price: roundMoney(scaled[last].price + diff, currency),
    };
  }
  return { items: scaled, adjusted: true };
}

const KNOWN_RECEIPT_TYPES = [
  'tax_inclusive', 'tax_exclusive', 'instant_tax_free',
  'net_tax_free', 'vat_refund_later', 'unknown',
];

function normalizeReceiptType(raw) {
  if (!raw) return '';
  const v = String(raw).toLowerCase().trim();
  if (KNOWN_RECEIPT_TYPES.includes(v)) return v;
  if (v === 'standard' || v === 'tax_included') return 'tax_inclusive';
  if (v === 'tax_excluded') return 'tax_exclusive';
  if (/instant.*(free|exempt)/i.test(v)) return 'instant_tax_free';
  if (/net.*(free|exempt)/i.test(v)) return 'net_tax_free';
  if (/vat.*refund|refund.*later/i.test(v)) return 'vat_refund_later';
  return v;
}

export function buildExpenseFromAI(result, index, currency, rate) {
  const receiptType = normalizeReceiptType(result.receipt_type);
  const hasBundlePricing = !!(result.has_bundle ?? result.hasBundle);

  const items = Array.isArray(result.items)
    ? result.items.map((item) => {
        const name = (item.name || '').replace(/內觤/g, '內褲').replace(/T袖/g, 'T恤');
        const exRaw = item.exclude_from_refund_split ?? item.excludeFromRefundSplit;
        let excludeFromRefundSplit;
        if (exRaw === true) excludeFromRefundSplit = true;
        else if (exRaw === false) excludeFromRefundSplit = false;
        else if (inferFixedFeeFromName(name)) excludeFromRefundSplit = true;

        const price = parseFloat(item.price) || 0;
        const rawActual = parseFloat(item.price_actual ?? item.priceActual);
        const priceActual =
          !isNaN(rawActual) && rawActual > 0 && Math.abs(rawActual - price) > moneyEpsilon(currency)
            ? rawActual
            : undefined;

        return {
          ...item,
          name,
          price,
          ...(priceActual !== undefined ? { priceActual } : {}),
          excludeFromRefundSplit,
        };
      })
    : [];

  const grossSum = items.reduce((s, i) => s + (i.price || 0), 0);
  const actualSum = items.reduce((s, i) => s + (i.priceActual ?? (i.price || 0)), 0);
  const totalAmount = parseFloat(result.total_amount) || 0;
  const subFromAI = parseFloat(result.subtotal) || 0;
  let tax = parseFloat(result.tax) || 0;
  let taxRefund = parseFloat(result.tax_refund) || 0;
  const discount = parseFloat(result.discount) || 0;
  const eps = moneyEpsilon(currency);

  // --- 小計：收據印字 (subFromAI) 優先於 items 加總 ---
  // 套裝/組合價、或 AI 小計與品項加總明顯不同時，信任 AI subtotal（= 收據印字）
  let subtotal;
  const subDrift = subFromAI > 0 && grossSum > 0 ? Math.abs(subFromAI - grossSum) : 0;
  if (subFromAI > 0 && (hasBundlePricing || subDrift > Math.max(eps * 5, 3))) {
    subtotal = subFromAI;
  } else {
    subtotal = grossSum > 0 ? grossSum : subFromAI;
  }

  const finalAmount =
    totalAmount > 0 ? totalAmount : subtotal > 0 ? subtotal : grossSum > 0 ? grossSum : 0;

  // --- 依類型計算 taxRefund ---
  if (receiptType === 'net_tax_free') {
    // 品項已是淨價，行加總 ≈ 實付；不需要 taxRefund
    if (Math.abs(taxRefund) < eps) taxRefund = 0;
  } else if (receiptType === 'tax_exclusive') {
    // 外稅：實付 = 小計 + 稅；taxRefund 通常為 0
    if (tax > 0 && Math.abs(taxRefund) < eps) taxRefund = 0;
  } else if (finalAmount > 0 && subtotal > finalAmount + eps) {
    // instant_tax_free 或其他差額場景
    const computed = finalAmount - subtotal;
    if (Math.abs(taxRefund) < eps || Math.abs(taxRefund - computed) > Math.max(eps * 2, 1)) {
      taxRefund = computed;
    }
  }

  // --- 收據免稅額 ---
  const rawExemption =
    result.receipt_tax_exemption_amount ??
    result.receiptTaxExemptionAmount ??
    result.tax_exemption_amount ??
    result.duty_free_amount ??
    result.exemption_amount ??
    result.tax_exemption_display;
  const receiptTaxExemptionAmount = Math.max(0, parseFloat(rawExemption) || 0);

  // --- 驗證：數字是否依類型自洽 ---
  let needsReview = false;
  if (receiptType === 'tax_inclusive' && grossSum > 0 && Math.abs(grossSum - finalAmount) > Math.max(eps * 5, 5)) {
    needsReview = true;
  }
  if (receiptType === 'tax_exclusive' && subFromAI > 0 && tax > 0 && Math.abs(subFromAI + tax - finalAmount) > Math.max(eps * 5, 5)) {
    needsReview = true;
  }
  if (hasBundlePricing && subFromAI > 0 && grossSum > 0 && subDrift > Math.max(eps * 5, 3) && !items.some((i) => i.priceActual !== undefined)) {
    needsReview = true;
  }

  return {
    id: Date.now() + index,
    date: result.date || new Date().toLocaleDateString('zh-TW'),
    location: result.location || '未知地點',
    store: result.store || '未知店舖',
    category: result.category || '未分類',
    items,
    subtotal: subtotal || 0,
    tax,
    taxRefund,
    discount,
    originalAmount: finalAmount,
    currency,
    hkdAmount: finalAmount * rate,
    paymentMethod: result.payment_method || '',
    receiptType,
    ...(hasBundlePricing ? { hasBundlePricing: true } : {}),
    ...(receiptTaxExemptionAmount > eps ? { receiptTaxExemptionAmount } : {}),
    ...(needsReview ? { needsReview: true } : {}),
  };
}
