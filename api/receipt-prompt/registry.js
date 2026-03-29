/**
 * 單據市場偵測 — 單一真相（prompt 與後端註解以此為準）。
 * 前端正規化請同步：`src/constants/receiptMarkets.js`（或 AIService 內註解）。
 *
 * 中期（第二段 API）：可依 detected_market 只載入對應 `markets/<code>.js`。
 */

/** @type {readonly string[]} */
export const DETECTED_MARKET_CODES = Object.freeze([
  'JP',
  'US',
  'EU',
  'GB',
  'SG',
  'TW',
  'HK',
  'KR',
  'AU',
  'MY',
  'TH',
  'VN',
  'CN',
  'SEA',
  'OTHER',
  'UNKNOWN',
]);

export function getDetectedMarketEnumLineForPrompt() {
  return DETECTED_MARKET_CODES.join(', ');
}
