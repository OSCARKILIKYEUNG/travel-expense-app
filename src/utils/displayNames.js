/**
 * Pick Traditional Chinese or English for receipt-derived strings.
 * @param {string} [zh]
 * @param {string} [en]
 * @param {string} [lang] i18n.language e.g. 'en', 'zh-TW'
 */
export function pickLocalized(zh, en, lang) {
  const useEn = typeof lang === 'string' && lang.toLowerCase().startsWith('en');
  const e = (en && String(en).trim()) || '';
  const z = (zh && String(zh).trim()) || '';
  if (useEn) return e || z;
  return z || e;
}

/**
 * @param {{ name?: string, nameEn?: string }} item
 * @param {string} [lang]
 */
export function getItemDisplayName(item, lang) {
  if (!item) return '';
  return pickLocalized(item.name, item.nameEn, lang);
}

const UNKNOWN_LOC_ZH = '未知地點';
const UNKNOWN_STORE_ZH = '未知店舖';

/**
 * @param {{ location?: string, locationEn?: string }} expense
 * @param {(k: string) => string} t i18n t
 */
export function getExpenseLocationDisplay(expense, lang, t) {
  const raw = pickLocalized(expense?.location, expense?.locationEn, lang);
  if (typeof lang === 'string' && lang.toLowerCase().startsWith('en') && raw === UNKNOWN_LOC_ZH) {
    return t('common.unknownLocation');
  }
  return raw;
}

/**
 * @param {{ store?: string, storeEn?: string }} expense
 * @param {(k: string) => string} t
 */
export function getExpenseStoreDisplay(expense, lang, t) {
  const raw = pickLocalized(expense?.store, expense?.storeEn, lang);
  if (typeof lang === 'string' && lang.toLowerCase().startsWith('en') && raw === UNKNOWN_STORE_ZH) {
    return t('common.unknownStore');
  }
  return raw;
}
