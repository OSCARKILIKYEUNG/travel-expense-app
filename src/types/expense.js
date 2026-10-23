/**
 * 支出紀錄（localStorage／React state 共用形狀）。
 * 本檔僅供 JSDoc／IDE 提示；執行期不強制型別。
 *
 * @typedef {Object} ExpenseRecord
 * @property {number|string} id
 * @property {string} [date] 消費日期（`YYYY-MM-DD` 或 `YYYY年M月D日`；空字串為未有日期）
 * @property {string} [time] 消費時間 `HH:MM`（與 `receiptTime` 互通，手帳 UI 優先讀取）
 * @property {string} [receiptTime] 收據印字時間 `HH:MM`（舊欄／AI 欄位別名）
 * @property {string} [store] 店舖名稱
 * @property {string} [location] 地點／城市（持久層主欄，與手帳 `place` 雙向別名）
 * @property {string} [place] 地點別名（手帳 UI 欄位，儲存時與 `location` 同步）
 * @property {string} [category] 消費類別
 * @property {string} [payer] 付款人（邊個俾錢，例如 `'Oscar'`）
 * @property {'cash'|'card'|''} [payment] 付款方式（手帳正規化值：`'cash'`｜`'card'`｜`''`）
 * @property {string} [paymentMethod] 付款方式（AI 辨識字串，或與 `payment` 同步之 `'cash'`｜`'card'`｜`''`）
 * @property {boolean} [scanned] 是否來自收據掃描
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
 * @property {string} [sourceHash] Lowercase SHA-256 hex of the original file bytes. Absent on records created before the exact-file pre-check.
 */

/** 讓本檔成為 ES module，避免重複宣告 */
export {};
