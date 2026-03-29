/**
 * 與 `api/receipt-prompt/registry.js` 的 DETECTED_MARKET_CODES 保持一致（修改時兩邊同步）。
 */

export const DETECTED_MARKET_CODES = [
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
];

const CODE_SET = new Set(DETECTED_MARKET_CODES);

/** @param {unknown} raw */
export function normalizeDetectedMarket(raw) {
  if (raw == null || raw === '') return '';
  const v = String(raw).toUpperCase().trim().replace(/[\s-]+/g, '_');
  if (CODE_SET.has(v)) return v;
  if (/^JPN|JAPAN$/.test(v)) return 'JP';
  if (/^USA|AMERICA$/.test(v)) return 'US';
  if (/^UK|UNITED_KINGDOM|ENGLAND$/.test(v)) return 'GB';
  if (/^EUROPE|EUR$/.test(v)) return 'EU';
  if (/^ASEAN|APAC$/.test(v)) return 'SEA';
  return '';
}
