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

export function buildExpenseFromAI(result, index, currency, rate) {
  const items = Array.isArray(result.items)
    ? result.items.map((item) => {
        const name = (item.name || '').replace(/內觤/g, '內褲').replace(/T袖/g, 'T恤');
        const exRaw = item.exclude_from_refund_split ?? item.excludeFromRefundSplit;
        let excludeFromRefundSplit;
        if (exRaw === true) excludeFromRefundSplit = true;
        else if (exRaw === false) excludeFromRefundSplit = false;
        else if (inferFixedFeeFromName(name)) excludeFromRefundSplit = true;
        return {
          ...item,
          name,
          excludeFromRefundSplit,
        };
      })
    : [];

  const grossSum = items.reduce((s, i) => s + (parseFloat(i.price) || 0), 0);
  const totalAmount = parseFloat(result.total_amount) || 0;
  const subFromAI = parseFloat(result.subtotal) || 0;
  let tax = parseFloat(result.tax) || 0;
  let taxRefund = parseFloat(result.tax_refund) || 0;
  const discount = parseFloat(result.discount) || 0;
  const eps = moneyEpsilon(currency);

  // 標價小計：細項加總優先，否則用 AI subtotal
  let subtotal = grossSum > 0 ? grossSum : subFromAI;

  const finalAmount =
    totalAmount > 0 ? totalAmount : subtotal > 0 ? subtotal : grossSum > 0 ? grossSum : 0;

  // 實付低於標價時，免稅／退稅差額（負數）；若 AI 數字與計算差太多則以計算為準
  if (finalAmount > 0 && subtotal > finalAmount + eps) {
    const computed = finalAmount - subtotal;
    if (Math.abs(taxRefund) < eps || Math.abs(taxRefund - computed) > Math.max(eps * 2, 1)) {
      taxRefund = computed;
    }
  }

  const receiptType = result.receipt_type || '';

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
  };
}
