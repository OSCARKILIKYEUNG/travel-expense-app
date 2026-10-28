/**
 * Hash-gate then parse. Phase 1 content matching stays in UploadArea after this returns.
 * Hash is of the original File; parseReceipt may resize a JPEG later and that image is not hashed.
 */

import { parseReceipt, buildExpenseFromAI } from '../../services/AIService';
import { getExchangeRate, resolveReceiptCurrency } from '../../utils/currency';
import { collectHashHits, sha256Hex } from '../../utils/sourceHash';

/**
 * @param {File[]} files
 * @param {object[]} expenses current trip
 */
export async function gateFilesBySourceHash(files, expenses) {
  const hashed = [];
  for (let index = 0; index < (files || []).length; index++) {
    const file = files[index];
    let hash = '';
    try {
      hash = await sha256Hex(file);
    } catch (err) {
      console.error('sourceHash failed:', err);
      hash = '';
    }
    hashed.push({ file, hash, index });
  }
  return collectHashHits(hashed, expenses);
}

/**
 * @param {Array<{ file: File, hash: string, index: number }>} queue
 * @param {{
 *   customCats?: string[],
 *   accessToken?: string,
 *   homeCurrencyCode?: string,
 *   tripCurrency?: string,
 *   exchangeRates?: object,
 *   defaultAssignee?: string,
 *   allowedCategories?: string[]|null,
 *   applyBillingSnapshot?: (snapshot: object) => void,
 *   refreshBilling?: () => Promise<void>,
 * }} deps
 * @param {(current: number, total: number) => void} [onProgress]
 * @returns {Promise<{ results: object[], lastError: string }>}
 */
export async function parseQueuedReceipts(queue, deps, onProgress) {
  const results = [];
  let lastError = '';
  const list = queue || [];
  const applyBillingSnapshot = deps?.applyBillingSnapshot;
  const refreshBilling = deps?.refreshBilling;

  for (let n = 0; n < list.length; n++) {
    const item = list[n];
    onProgress?.(n + 1, list.length);
    try {
      const parsed = await parseReceipt(item.file, deps?.customCats || [], deps?.accessToken || '');
      if (parsed?._billing) applyBillingSnapshot?.(parsed._billing);
      const currency = resolveReceiptCurrency(parsed, deps?.homeCurrencyCode, deps?.tripCurrency);
      const rate = getExchangeRate(currency, deps?.exchangeRates || {});
      results.push(
        buildExpenseFromAI(
          parsed,
          item.index,
          currency,
          rate,
          deps?.tripCurrency,
          deps?.defaultAssignee,
          deps?.allowedCategories ?? null,
          item.hash,
          deps?.fallbackDate || '',
        ),
      );
    } catch (err) {
      console.error(`第 ${item.index + 1} 張處理失敗:`, err);
      if (err?.billing) applyBillingSnapshot?.(err.billing);
      if (err?.code === 'quota_exceeded') {
        await refreshBilling?.().catch(() => {});
      }
      lastError = err?.message || String(err);
    }
  }

  return { results, lastError };
}
