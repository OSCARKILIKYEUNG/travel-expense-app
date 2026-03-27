/**
 * 支出紀錄（localStorage／React state 共用形狀）。
 * 本檔僅供 JSDoc／IDE 提示；執行期不強制型別。
 *
 * @typedef {Object} ExpenseRecord
 * @property {number} id
 * @property {string} [originalCurrency] 原幣代碼（若有則優先於 `currency` 供換算）
 * @property {string} currency 原幣 ISO（或 AI 辨識結果）
 * @property {number} [originalAmount] 原幣實付或總額
 * @property {number} hkdAmount **記帳幣金額**（欄位名歷史遺留為 hkd，語意為「home／accounting currency amount」，非僅限港幣）
 * @property {number} [rate] 換算當下使用的匯率（1 記帳幣 = rate 單位該外幣）
 * @property {string} [assignedTo]
 * @property {Array<{price?: number, priceActual?: number, assignedTo?: string, name?: string, excludeFromRefundSplit?: boolean}>} [items]
 * @property {number} [subtotal]
 * @property {number} [tax]
 * @property {number} [taxRefund]
 * @property {string} [receiptType]
 * @property {boolean} [needsReview]
 * @property {boolean} [currencyMismatch]
 * @property {string} [aiDetectedCurrency]
 * @property {number} [receiptTaxExemptionAmount]
 * @property {boolean} [hasBundlePricing]
 * @property {boolean} [userEditedPricing] 使用者曾改動價格相關欄位並儲存後，卡片改為精簡顯示（不顯示掃描期品項原價／實價對照等）
 */

/** 讓本檔成為 ES module，避免重複宣告 */
export {};
