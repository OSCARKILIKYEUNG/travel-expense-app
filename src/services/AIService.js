/**
 * 單據解析改由後端 /api/parse-receipt（Vercel Serverless）呼叫 Gemini，
 * API 金鑰僅存 GEMINI_API_KEY，不經前端。
 */

import i18n from '../i18n';
import { normalizeDetectedMarket } from '../constants/receiptMarkets';
import { CURRENCY_NAMES } from '../utils/constants';
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
      i18n.t('errors.parseReceipt', { status: res.status }),
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
  const v = String(raw).toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (KNOWN_RECEIPT_TYPES.includes(v)) return v;
  if (/^(standard|tax_included|tax_inc)$/.test(v)) return 'tax_inclusive';
  if (/^(tax_excluded|tax_exc)$/.test(v)) return 'tax_exclusive';
  if (/instant.*(free|exempt)|即時免稅/.test(v)) return 'instant_tax_free';
  if (/net.*(free|exempt)|淨價免稅/.test(v)) return 'net_tax_free';
  if (/vat.*refund|refund.*later|離境/.test(v)) return 'vat_refund_later';
  if (/inclusive|内税|內稅/.test(v)) return 'tax_inclusive';
  if (/exclusive|外税|外稅/.test(v)) return 'tax_exclusive';
  if (/free|exempt|免稅|免税/.test(v)) return 'instant_tax_free';
  return v;
}

export function buildExpenseFromAI(result, index, currency, rate, tripCurrency, defaultAssignee = '共同') {
  const receiptType = normalizeReceiptType(result.receipt_type);
  const rawMarket = result.detected_market ?? result.detectedMarket ?? '';
  const aiDetectedMarket = normalizeDetectedMarket(rawMarket);
  const evRaw = result.market_evidence ?? result.marketEvidence;
  const aiMarketEvidence = Array.isArray(evRaw)
    ? evRaw.slice(0, 12).map((x) => String(x).trim()).filter(Boolean)
    : [];
  const hasBundlePricing = !!(result.has_bundle ?? result.hasBundle);

  const items = Array.isArray(result.items)
    ? result.items.map((item) => {
        const name = (item.name || '').replace(/內觤/g, '內褲').replace(/T袖/g, 'T恤');
        const nameEn = String(item.name_en || item.nameEn || '').trim();
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
          ...(nameEn ? { nameEn } : {}),
          price,
          ...(priceActual !== undefined ? { priceActual } : {}),
          excludeFromRefundSplit,
        };
      })
    : [];

  let grossSum = items.reduce((s, i) => s + (i.price || 0), 0);
  const totalAmount = parseFloat(result.total_amount) || 0;
  const subFromAI = parseFloat(result.subtotal) || 0;
  let tax = parseFloat(result.tax) || 0;
  let taxRefund = parseFloat(result.tax_refund) || 0;
  const discount = parseFloat(result.discount) || 0;
  const eps = moneyEpsilon(currency);

  // --- 品項加總 vs 收據小計 交叉驗證 ---
  // 若 AI 多列了重複品項（如套裝內的個別行又多列了），嘗試刪除多餘行
  if (subFromAI > 0 && grossSum > subFromAI + eps) {
    const excess = Math.round(grossSum - subFromAI);
    if (excess > 0) {
      const candidates = items
        .map((it, idx) => ({ idx, price: it.price || 0 }))
        .filter((c) => Math.abs(c.price - excess) <= Math.max(eps, 1))
        .sort((a, b) => b.idx - a.idx);
      if (candidates.length > 0) {
        items.splice(candidates[0].idx, 1);
        grossSum = items.reduce((s, i) => s + (i.price || 0), 0);
      } else {
        const combo2 = [];
        for (let i = items.length - 1; i >= 1; i--) {
          for (let j = i - 1; j >= 0; j--) {
            const sum2 = (items[i].price || 0) + (items[j].price || 0);
            if (Math.abs(sum2 - excess) <= Math.max(eps, 1)) {
              combo2.push([j, i]);
            }
          }
        }
        if (combo2.length > 0) {
          const [a, b] = combo2[0];
          items.splice(b, 1);
          items.splice(a, 1);
          grossSum = items.reduce((s, i) => s + (i.price || 0), 0);
        }
      }
    }
  }

  const actualSum = items.reduce((s, i) => s + (i.priceActual ?? (i.price || 0)), 0);

  // --- 小計：收據印字 (subFromAI) 優先於 items 加總 ---
  let subtotal;
  const subDrift = subFromAI > 0 && grossSum > 0 ? Math.abs(subFromAI - grossSum) : 0;
  if (subFromAI > 0 && (hasBundlePricing || subDrift > Math.max(eps * 5, 3))) {
    subtotal = subFromAI;
  } else {
    subtotal = grossSum > 0 ? grossSum : subFromAI;
  }

  const finalAmount =
    totalAmount > 0 ? totalAmount : subtotal > 0 ? subtotal : grossSum > 0 ? grossSum : 0;

  // --- 依類型計算 taxRefund / tax ---
  if (receiptType === 'net_tax_free') {
    if (Math.abs(taxRefund) < eps) taxRefund = 0;
  } else if (receiptType === 'tax_exclusive') {
    // 外稅：若 AI 沒回 tax，從 total − subtotal 推算
    if (tax <= 0 && finalAmount > subtotal + eps) {
      tax = Math.round(finalAmount - subtotal);
    }
    if (tax > 0 && Math.abs(taxRefund) < eps) taxRefund = 0;
  } else if (finalAmount > 0 && subtotal > finalAmount + eps) {
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

  const rawAiCurrency = (result?.currency || '').toString().trim().toUpperCase();
  const tripCur = (tripCurrency || '').toString().trim().toUpperCase();
  const currencyMismatch =
    !!rawAiCurrency &&
    !!tripCur &&
    CURRENCY_NAMES[rawAiCurrency] &&
    CURRENCY_NAMES[tripCur] &&
    rawAiCurrency !== tripCur;

  // --- 驗證：數字是否依類型自洽 ---
  let needsReview = false;
  const driftThreshold = Math.max(eps * 5, 5);
  if (receiptType === 'tax_inclusive' && grossSum > 0 && Math.abs(grossSum - finalAmount) > driftThreshold) {
    needsReview = true;
  }
  if (receiptType === 'tax_exclusive' && subFromAI > 0 && tax > 0 && Math.abs(subFromAI + tax - finalAmount) > driftThreshold) {
    needsReview = true;
  }
  if (receiptType === 'instant_tax_free' && subFromAI > 0 && grossSum > 0) {
    // 品項加總應接近 subtotal（含稅小計）；差太大表示 AI 漏列或多列
    const itemVsSub = Math.abs(grossSum - subFromAI);
    if (itemVsSub > subFromAI * 0.05 && itemVsSub > driftThreshold) {
      needsReview = true;
    }
  }
  // 套裝/bundle：容忍 1% 或 300 以內的漂移（AI 品名/金額小誤差常見）
  if (hasBundlePricing && subFromAI > 0 && grossSum > 0) {
    const bundleTolerance = Math.max(subFromAI * 0.01, 300);
    if (subDrift > bundleTolerance && !items.some((i) => i.priceActual !== undefined)) {
      needsReview = true;
    }
  }

  const locationEn = String(result.location_en || result.locationEn || '').trim();
  const storeEn = String(result.store_en || result.storeEn || '').trim();

  return {
    id: Date.now() + index,
    assignedTo: defaultAssignee,
    date: result.date || new Date().toLocaleDateString('zh-TW'),
    location: result.location || '未知地點',
    ...(locationEn ? { locationEn } : {}),
    store: result.store || '未知店舖',
    ...(storeEn ? { storeEn } : {}),
    category: result.category || '未分類',
    items,
    subtotal: subtotal || 0,
    tax,
    taxRefund,
    discount,
    originalAmount: finalAmount,
    currency,
    hkdAmount: rate > 0 ? finalAmount / rate : finalAmount,
    paymentMethod: result.payment_method || '',
    receiptType,
    ...(hasBundlePricing ? { hasBundlePricing: true } : {}),
    ...(receiptTaxExemptionAmount > eps ? { receiptTaxExemptionAmount } : {}),
    ...(needsReview ? { needsReview: true } : {}),
    ...(currencyMismatch ? { currencyMismatch: true, aiDetectedCurrency: rawAiCurrency } : {}),
    ...(aiDetectedMarket ? { aiDetectedMarket } : {}),
    ...(aiMarketEvidence.length > 0 ? { aiMarketEvidence } : {}),
  };
}
