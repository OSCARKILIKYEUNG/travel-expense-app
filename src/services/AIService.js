/**
 * 單據解析改由後端 /api/parse-receipt（Vercel Serverless）呼叫 Gemini，
 * API 金鑰僅存 GEMINI_API_KEY，不經前端。
 */

import i18n from '../i18n';
import { normalizeDetectedMarket } from '../constants/receiptMarkets';
import { CURRENCY_NAMES } from '../utils/constants';
import { normalizeExpenseCategoryFromAi } from '../utils/expenseCategories';
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
 * @param {File} file
 * @param {string[]} [customExpenseCategories] 使用者自訂類別（不含預設六類；後端會合併）
 * @param {string} [accessToken]
 * @returns {Promise<object>} 解析後的單據 JSON
 */
export async function parseReceipt(file, customExpenseCategories = [], accessToken = '') {
  const base64 = await resizeImage(file);

  const res = await fetch('/api/parse-receipt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      imageBase64: base64,
      expenseCategories: Array.isArray(customExpenseCategories) ? customExpenseCategories : [],
    }),
  });

  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    if (res.status === 504) {
      const e = new Error(i18n.t('errors.parseReceiptTimeout'));
      e.code = 'gemini_timeout';
      throw e;
    }
    throw new Error(
      i18n.t('errors.parseReceipt', { status: res.status }),
    );
  }
  if (!res.ok) {
    const err = new Error(
      data.code === 'gemini_timeout' ? i18n.t('errors.parseReceiptTimeout') : (data.error || `API 請求失敗: ${res.status}`),
    );
    err.code = data.code || `http_${res.status}`;
    err.billing = data.billing || null;
    throw err;
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

/** 商品A／Item 1 這類代稱。有原文時可還原，但不可把已抄到的品名改成代稱。 */
function isPlaceholderItemName(name) {
  return /^(?:商品|物品|item|product)\s*[A-Ea-e0-9]{1,2}$/i.test(String(name || '').trim());
}

/**
 * 対象額／内消費税等是稅務摘要，不是商品行。
 * 品名較長且不像稅率列時保留，避免誤刪真實商品。
 */
export function isTaxSummaryLine(name) {
  const raw = String(name || '').trim();
  if (!raw || isPlaceholderItemName(raw)) return false;
  const n = raw.replace(/\s+/g, '');
  if (n.length > 24 && !/対象額|内消費税|消費税/.test(n)) return false;
  if (/対象額|対象金額|課税対象|税込対象|税抜対象|軽減対象/.test(n)) return true;
  if (/(?:内|外)?消費税/.test(n)) return true;
  if (/^内税(?:額)?(?:[（(][^)）]*[)）])?$/.test(n)) return true;
  if (/^[（(]?\d{1,2}(?:\.\d+)?[%％][)）]?/.test(n) && /対象|税|tax/i.test(n)) return true;
  if (/^(?:taxable\s*amount|tax\s*included|incl\.?\s*tax)$/i.test(raw)) return true;
  return false;
}

/**
 * 即時免稅加總核對用的金額：雙欄用 priceActual，佣金／固定費排除。
 * @param {Array<{ price?: number, priceActual?: number, excludeFromRefundSplit?: boolean }>} items
 */
export function sumForInstantTaxFreeCheck(items) {
  return (items || []).reduce((sum, item) => {
    if (item?.excludeFromRefundSplit) return sum;
    const actual = Number(item?.priceActual);
    if (!isNaN(actual) && actual > 0) return sum + actual;
    return sum + (Number(item?.price) || 0);
  }, 0);
}

/** 卡片：即時免稅且標價小計與實付不同時，要顯示小計（例如 20576、28130）。 */
export function shouldShowListSubtotal(expense) {
  if (expense?.receiptType !== 'instant_tax_free') return false;
  const eps = moneyEpsilon(expense.currency);
  return Math.abs((Number(expense.subtotal) || 0) - (Number(expense.originalAmount) || 0)) > eps;
}

/**
 * 同一筆免稅差額不要同時出現在折扣與退稅。
 * effectiveRefund 是卡片實際會顯示的退稅正數（含由行加總推算的差額）。
 */
export function shouldShowSeparateDiscount(expense, effectiveRefund) {
  const eps = moneyEpsilon(expense?.currency);
  const discount = Math.abs(Number(expense?.discount) || 0);
  if (discount <= eps) return false;
  const refund = Math.abs(
    effectiveRefund != null ? Number(effectiveRefund) || 0 : Number(expense?.taxRefund) || 0,
  );
  if (refund > eps && Math.abs(discount - refund) <= Math.max(eps * 2, 1)) return false;
  return true;
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

/**
 * 套裝/multipack 重複防護（保守）：AI 同時列出「套裝×N」合併行與 N 條個別成分行時，
 * 刪除成分行。僅在以下條件全部成立時才動 items（永不改金額／合計）：
 *  1. 印字小計 > 0 且 items 加總超出小計 excess > 0
 *  2. 存在名稱含「套裝／セット／set ×N」(N>=2) 的行 S，且 S.price <= N * p
 *  3. 其餘品項中，恰好有 N 條價格相同 (p) 的行，且 N * p === excess（容差 eps）
 * 回傳 { items, removed }；不符合則原樣返回。
 */
export function dropDuplicateSetComponents(items, printedSubtotal, eps = 1) {
  const none = { items, removed: [] };
  if (!Array.isArray(items) || !(printedSubtotal > 0)) return none;
  const gross = items.reduce((s, i) => s + (i.price || 0), 0);
  const excess = gross - printedSubtotal;
  if (!(excess > eps)) return none;
  const setRe = /(?:套裝|套装|組合|组合|セット|\bset\b)\s*[×xX＊*]\s*(\d+)|[×xX＊*]\s*(\d+)\s*(?:套裝|套装|セット|\bset\b)/i;
  for (let si = 0; si < items.length; si++) {
    const setItem = items[si];
    const label = `${setItem.name || ''} ${setItem.originalName || ''} ${setItem.nameEn || ''}`;
    const m = label.match(setRe);
    const n = m ? parseInt(m[1] || m[2], 10) : 0;
    if (!(n >= 2) || !(setItem.price > 0)) continue;
    const byPrice = new Map();
    items.forEach((it, idx) => {
      if (idx === si || !(it.price > 0)) return;
      if (!byPrice.has(it.price)) byPrice.set(it.price, []);
      byPrice.get(it.price).push(idx);
    });
    for (const [price, idxs] of byPrice) {
      if (idxs.length !== n) continue;
      if (Math.abs(n * price - excess) > eps) continue;
      if (setItem.price > n * price + eps) continue;
      const drop = new Set(idxs);
      return { items: items.filter((_, i) => !drop.has(i)), removed: idxs.map((i) => items[i]) };
    }
  }
  return none;
}

export function buildExpenseFromAI(
  result,
  index,
  currency,
  rate,
  tripCurrency,
  defaultAssignee = '共同',
  allowedExpenseCategories = null,
) {
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
        let name = (item.name || '').replace(/內觤/g, '內褲').replace(/T袖/g, 'T恤');
        const originalName = String(item.original_name || item.originalName || '').trim();
        if (isPlaceholderItemName(name) && originalName && !isPlaceholderItemName(originalName)) {
          name = originalName;
        }
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
          ...(originalName ? { originalName } : {}),
          price,
          ...(priceActual !== undefined ? { priceActual } : {}),
          excludeFromRefundSplit,
        };
      })
    : [];

  let removedSummaryRows = false;
  for (let i = items.length - 1; i >= 0; i--) {
    if (isTaxSummaryLine(items[i].name)) {
      items.splice(i, 1);
      removedSummaryRows = true;
    }
  }

  let grossSum = items.reduce((s, i) => s + (i.price || 0), 0);
  const totalAmount = parseFloat(result.total_amount) || 0;
  const subFromAI = parseFloat(result.subtotal) || 0;
  let tax = parseFloat(result.tax) || 0;
  let taxRefund = parseFloat(result.tax_refund) || 0;
  let discount = parseFloat(result.discount) || 0;
  const eps = moneyEpsilon(currency);
  const driftThreshold = Math.max(eps * 5, 5);

  // --- 套裝成分行重複（套裝×N + N 條個別行）：先於一般交叉驗證處理 ---
  if (subFromAI > 0 && grossSum > subFromAI + eps) {
    const dedup = dropDuplicateSetComponents(items, subFromAI, Math.max(eps, 1));
    if (dedup.removed.length > 0) {
      items.splice(0, items.length, ...dedup.items);
      grossSum = items.reduce((s, i) => s + (i.price || 0), 0);
    }
  }

  // --- 品項加總 vs 收據小計 交叉驗證 ---
  // 若 AI 多列了重複品項（如套裝內的個別行又多列了），嘗試刪除多餘行。
  // 即時免稅若把小計收成實付，行加總高出的差額是退稅，不是重複品項。
  const subtotalLooksCollapsed =
    receiptType === 'instant_tax_free' &&
    totalAmount > 0 &&
    subFromAI > 0 &&
    Math.abs(subFromAI - totalAmount) <= driftThreshold &&
    grossSum > totalAmount + driftThreshold;
  if (!subtotalLooksCollapsed && subFromAI > 0 && grossSum > subFromAI + eps) {
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

  // --- 收據免稅額（淨價免稅校正會用到，須先於稅額搬移） ---
  const rawExemption =
    result.receipt_tax_exemption_amount ??
    result.receiptTaxExemptionAmount ??
    result.tax_exemption_amount ??
    result.duty_free_amount ??
    result.exemption_amount ??
    result.tax_exemption_display;
  let receiptTaxExemptionAmount = Math.max(0, parseFloat(rawExemption) || 0);

  // --- 小計：收據印字 (subFromAI) 優先於 items 加總 ---
  // 內稅：合計是含稅錨點。行加總已對上合計就用行加總；否則不要沿用未稅行加總（如 1076 vs 合計 2359）。
  // 即時免稅：小計是含稅標價（28130／20576），不要收成實付。
  let subtotal;
  const subDrift = subFromAI > 0 && grossSum > 0 ? Math.abs(subFromAI - grossSum) : 0;
  const linesMatchTotal =
    grossSum > 0 &&
    totalAmount > 0 &&
    Math.abs(grossSum - totalAmount) <= driftThreshold;
  if (receiptType === 'tax_inclusive' && totalAmount > 0 && linesMatchTotal) {
    subtotal = grossSum;
  } else if (receiptType === 'tax_inclusive' && totalAmount > 0) {
    subtotal = totalAmount;
  } else if (receiptType === 'instant_tax_free') {
    const refundMag = Math.abs(taxRefund) > eps
      ? Math.abs(taxRefund)
      : (Math.abs(discount) > eps ? Math.abs(discount) : 0);
    const printedAbovePaid = subFromAI > totalAmount + eps ? subFromAI : 0;
    const restored = refundMag > eps && totalAmount > 0
      ? roundMoney(totalAmount + refundMag, currency)
      : 0;
    const itemsAbovePaid = grossSum > totalAmount + eps ? grossSum : 0;
    const collapsed = subFromAI <= 0 || (totalAmount > 0 && Math.abs(subFromAI - totalAmount) <= driftThreshold);
    if (printedAbovePaid > 0) {
      subtotal = printedAbovePaid;
    } else if (collapsed && restored > totalAmount + eps) {
      subtotal = restored;
    } else if (collapsed && itemsAbovePaid > 0) {
      subtotal = itemsAbovePaid;
    } else if (subFromAI > 0) {
      subtotal = subFromAI;
    } else {
      subtotal = grossSum > 0 ? grossSum : 0;
    }
  } else if (subFromAI > 0 && (hasBundlePricing || subDrift > Math.max(eps * 5, 3))) {
    subtotal = subFromAI;
  } else {
    subtotal = grossSum > 0 ? grossSum : subFromAI;
  }

  const finalAmount =
    totalAmount > 0 ? totalAmount : subtotal > 0 ? subtotal : grossSum > 0 ? grossSum : 0;

  // --- 依類型計算 taxRefund / tax ---
  if (receiptType === 'net_tax_free') {
    if (Math.abs(taxRefund) < eps) taxRefund = 0;
    // 免税額被誤填進 tax、免稅額欄空白時搬回資訊欄。淨價免稅的消費稅恆為 0，不加到實付。
    if (tax > eps && receiptTaxExemptionAmount <= eps) {
      receiptTaxExemptionAmount = tax;
    }
    if (tax > eps) tax = 0;
  } else if (receiptType === 'tax_exclusive') {
    // 外稅：若 AI 沒回 tax，從 total − subtotal 推算
    if (tax <= 0 && finalAmount > subtotal + eps) {
      tax = Math.round(finalAmount - subtotal);
    }
    if (tax > 0 && Math.abs(taxRefund) < eps) taxRefund = 0;
  } else if (receiptType === 'tax_inclusive' && totalAmount > 0 && !linesMatchTotal && tax > eps) {
    // 8%／10% 稅額列加總解釋不了合計（1076+92），不要顯示成另加的消費稅。
    tax = 0;
  } else if (finalAmount > 0 && subtotal > finalAmount + eps) {
    const computed = finalAmount - subtotal;
    if (Math.abs(taxRefund) < eps || Math.abs(taxRefund - computed) > Math.max(eps * 2, 1)) {
      taxRefund = computed;
    }
  }

  if (receiptType === 'instant_tax_free') {
    // 免税差額只留一列退稅。模型若把同一筆同時寫進 discount 或 tax，拿掉重複。
    if (Math.abs(discount) > eps && Math.abs(taxRefund) > eps
      && Math.abs(Math.abs(discount) - Math.abs(taxRefund)) <= Math.max(eps * 2, 1)) {
      discount = 0;
    }
    if (tax > eps && Math.abs(taxRefund) > eps
      && Math.abs(tax - Math.abs(taxRefund)) <= Math.max(eps * 2, 1)) {
      tax = 0;
    }
  }

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
  if (receiptType === 'tax_inclusive' && grossSum > finalAmount + driftThreshold) {
    // 行加總短於合計（未稅行、或已剔除的対象額／内税摘要）不是漏帳。
    // 摘要列已從 items 移除；只有商品行加總超過實付才標需核對。
    needsReview = true;
  }
  if (removedSummaryRows && receiptType === 'tax_inclusive' && grossSum > 0 && grossSum <= finalAmount + driftThreshold) {
    needsReview = false;
  }
  if (receiptType === 'tax_exclusive' && subFromAI > 0 && tax > 0 && Math.abs(subFromAI + tax - finalAmount) > driftThreshold) {
    needsReview = true;
  }
  if (receiptType === 'instant_tax_free' && subtotal > 0 && finalAmount > 0) {
    const headerOk = Math.abs(subtotal + taxRefund - finalAmount) <= driftThreshold;
    if (!headerOk) {
      const payable = sumForInstantTaxFreeCheck(items);
      const tolerance = Math.max(subtotal * 0.05, driftThreshold);
      if (payable > 0 && Math.abs(payable - subtotal) > tolerance) {
        needsReview = true;
      }
    }
  }
  // 套裝/bundle：容忍 1% 或 300 以內的漂移（AI 品名/金額小誤差常見）
  const resolvedDrift = subtotal > 0 && grossSum > 0 ? Math.abs(subtotal - grossSum) : 0;
  if (hasBundlePricing && subtotal > 0 && grossSum > 0) {
    const bundleTolerance = Math.max(subtotal * 0.01, 300);
    if (resolvedDrift > bundleTolerance && !items.some((i) => i.priceActual !== undefined)) {
      needsReview = true;
    }
  }

  const locationEn = String(result.location_en || result.locationEn || '').trim();
  const storeEn = String(result.store_en || result.storeEn || '').trim();
  const storeOriginal = String(
    result.store_original || result.storeOriginal || '',
  ).trim();

  const category =
    Array.isArray(allowedExpenseCategories) && allowedExpenseCategories.length > 0
      ? normalizeExpenseCategoryFromAi(result.category, allowedExpenseCategories)
      : String(result.category || '').trim() || '未分類';

  return {
    id: Date.now() + index,
    assignedTo: defaultAssignee,
    date: result.date || new Date().toLocaleDateString('zh-TW'),
    location: result.location || '未知地點',
    ...(locationEn ? { locationEn } : {}),
    store: result.store || '未知店舖',
    ...(storeOriginal ? { storeOriginal } : {}),
    ...(storeEn ? { storeEn } : {}),
    category,
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
