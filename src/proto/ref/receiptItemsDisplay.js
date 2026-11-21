/**
 * Read-only presentation of receipt lines that are already on the record.
 * Does not multiply, sum, convert, reprice, or invent a missing amount as 0.
 */

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function readFiniteAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^[+-]{2,}/.test(trimmed)) return null;
  const unsigned = trimmed.startsWith('+') ? trimmed.slice(1) : trimmed;
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(unsigned)) return null;
  const amount = Number(unsigned.replace(/,/g, ''));
  return Number.isFinite(amount) ? amount : null;
}

export function formatRecordedAmount(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || Object.is(value, -0) || value === 0) {
    return value === 0 || Object.is(value, -0) ? '0' : '';
  }
  const negative = value < 0;
  const raw = String(Math.abs(value));
  // Scientific form already round-trips. Trimming it deletes exponent zeros and changes magnitude.
  if (/[eE]/.test(raw)) return `${negative ? '-' : ''}${raw}`;
  const [whole, frac = ''] = raw.split('.');
  const trimmedFrac = frac.replace(/0+$/, '');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${trimmedFrac ? `.${trimmedFrac}` : ''}`;
}

export function readCurrencyValue(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^[A-Za-z]{3}$/.test(text)) return text.toUpperCase();
  return text;
}

export function readSourceCurrency(record) {
  if (!record || typeof record !== 'object') return '';
  return readCurrencyValue(record.originalCurrency ?? record.currency);
}

export function isKnownScan(record) {
  if (!record || typeof record !== 'object') return false;
  if (record.scanned === true) return true;
  if (record.scanned === false) return false;
  return Boolean(record.sourceHash || record.receiptType);
}

function positiveAmount(value) {
  const amount = readFiniteAmount(value);
  if (amount === null || amount <= 0) return null;
  return amount;
}

function readSuppliedAmount(item, keys) {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(item, key)) continue;
    const amount = readFiniteAmount(item[key]);
    if (amount !== null) return amount;
  }
  return null;
}

/** Explicit positive `quantity`, otherwise explicit positive `qty`. Never parsed from the name. */
export function readExplicitQuantity(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  if (Object.prototype.hasOwnProperty.call(item, 'quantity')) {
    const fromQuantity = positiveAmount(item.quantity);
    if (fromQuantity !== null) return fromQuantity;
  }
  if (Object.prototype.hasOwnProperty.call(item, 'qty')) return positiveAmount(item.qty);
  return null;
}

function suppliedName(item, lang) {
  const name = cleanText(item.name);
  const original = cleanText(item.originalName) || cleanText(item.original_name);
  const en = cleanText(item.nameEn) || cleanText(item.name_en);
  const useEn = typeof lang === 'string' && lang.toLowerCase().startsWith('en');
  if (useEn) return en || name || original;
  return name || original || en;
}

function presentItem(item, lang, index) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const name = suppliedName(item, lang);
  const price = readSuppliedAmount(item, ['price']);
  const priceActual = readSuppliedAmount(item, ['priceActual', 'price_actual']);
  const quantity = readExplicitQuantity(item);
  if (!name && price === null && priceActual === null && quantity === null) return null;
  return {
    key: `line-${index}`,
    name,
    price,
    priceActual,
    quantity,
    currency: readCurrencyValue(item.originalCurrency ?? item.currency),
  };
}

export function normalizeReceiptItemsForDisplay(items, { lang = 'zh-TW', scanned = false } = {}) {
  const list = Array.isArray(items) ? items : [];
  const rows = [];
  list.forEach((item, index) => {
    const row = presentItem(item, lang, index);
    if (row) rows.push(row);
  });
  const empty = Boolean(scanned) && rows.length === 0;
  return {
    show: rows.length > 0 || empty,
    empty,
    rows,
  };
}

export function resolveReceiptItemSource({
  initial = null,
  scanDraft = null,
  scanToken,
  demoScanned = false,
} = {}) {
  if (initial && typeof initial === 'object') {
    return {
      items: Array.isArray(initial.items) ? initial.items : [],
      currency: readSourceCurrency(initial),
      scanned: isKnownScan(initial),
      identity: `edit:${initial.id ?? 'record'}`,
    };
  }
  if (scanDraft && typeof scanDraft === 'object') {
    const tokenMissing = scanToken === undefined || scanToken === null || scanToken === '';
    const token = tokenMissing ? (scanDraft.id ?? 'draft') : scanToken;
    return {
      items: Array.isArray(scanDraft.items) ? scanDraft.items : [],
      currency: readSourceCurrency(scanDraft),
      scanned: true,
      identity: `scan:${token}`,
    };
  }
  if (demoScanned) {
    return { items: [], currency: '', scanned: true, identity: 'demo-scan' };
  }
  return { items: [], currency: '', scanned: false, identity: 'manual' };
}
