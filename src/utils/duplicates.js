/**
 * Shared duplicate-receipt matcher.
 * Used by UploadArea (after parsing, before adding) and by the expense list banner.
 * Pure functions only; no I/O.
 */

const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP']);
const PLACEHOLDER_STORES = new Set(['未知店舖', '未知店铺', '未命名', 'unknown', 'unknownstore', 'unnamed']);

// Common chains whose name differs across zh / ja / en. Keys are normalized (see normalizeStoreName).
const STORE_ALIASES = [
  ['lawson', 'ローソン', '羅森', '罗森'],
  ['7eleven', 'seveneleven', 'セブンイレブン', '711', '七仔', '柒之十一'],
  ['familymart', 'ファミリーマート', '全家'],
  ['donki', 'donquijote', 'ドンキホーテ', 'ドンキ', '唐吉訶德', '驚安の殿堂', '驚安殿堂'],
  ['uniqlo', 'ユニクロ', '優衣庫'],
  ['daiso', 'ダイソー', '大創'],
  ['matsumotokiyoshi', 'マツモトキヨシ', 'マツキヨ', '松本清'],
];

/** Level ranking, higher = stronger. */
export const MATCH_RANK = { weak: 1, likely: 2, strong: 3 };

/**
 * Normalize AI / locale date strings to YYYY-MM-DD. Unparseable -> null.
 * Slash dates with year last are read as D/M/Y (HK/JP convention); year-first as Y/M/D.
 * @param {unknown} input
 * @returns {string|null}
 */
export function normalizeDate(input) {
  if (input == null) return null;
  const s = String(input).normalize('NFKC').trim();
  if (!s) return null;
  let y; let m; let d;
  let mt = s.match(/(\d{4})\s*[年/.\-]\s*(\d{1,2})\s*[月/.\-]\s*(\d{1,2})/);
  if (mt) {
    [y, m, d] = [mt[1], mt[2], mt[3]];
  } else {
    mt = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/);
    if (!mt) return null;
    [d, m, y] = [mt[1], mt[2], mt[3]];
  }
  const yy = Number(y); const mm = Number(m); const dd = Number(d);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yy < 1900) return null;
  return `${String(yy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

/** Lowercase, NFKC, keep only letters/digits (any script). */
export function normalizeStoreName(name) {
  if (name == null) return '';
  return String(name).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function aliasGroup(norm) {
  for (let i = 0; i < STORE_ALIASES.length; i++) {
    for (const a of STORE_ALIASES[i]) {
      const na = normalizeStoreName(a);
      if (na.length >= 2 && (norm === na || (na.length >= 3 && norm.includes(na)))) return i;
    }
  }
  return -1;
}

/**
 * All usable normalized store names of an expense (store, storeOriginal, storeEn),
 * placeholders removed.
 * @returns {string[]}
 */
export function storeNames(expense) {
  const out = [];
  for (const raw of [expense?.store, expense?.storeOriginal, expense?.storeEn]) {
    const n = normalizeStoreName(raw);
    if (!n || PLACEHOLDER_STORES.has(n)) continue;
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

/** True when stores plausibly are the same shop. Placeholder / empty never matches. */
export function storesMatch(a, b) {
  const na = storeNames(a);
  const nb = storeNames(b);
  if (!na.length || !nb.length) return false;
  for (const x of na) {
    for (const y of nb) {
      if (x === y) return true;
      const shorter = x.length <= y.length ? x : y;
      const longer = x.length <= y.length ? y : x;
      if (shorter.length >= 3 && longer.includes(shorter)) return true;
      const gx = aliasGroup(x);
      if (gx !== -1 && gx === aliasGroup(y)) return true;
    }
  }
  return false;
}

function tolerance(currency) {
  return ZERO_DECIMAL.has(String(currency || '').toUpperCase()) ? 0.5 : 0.011;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Comparable totals: final amount, subtotal, and final + tax refund (pre-refund total). */
export function amountCandidates(expense) {
  const out = [];
  const total = num(expense?.originalAmount);
  if (total > 0) out.push(total);
  const sub = num(expense?.subtotal);
  if (sub > 0) out.push(sub);
  const refund = Math.abs(num(expense?.taxRefund));
  if (total > 0 && refund > 0) out.push(total + refund);
  return out;
}

function amountsMatch(a, b) {
  const tol = tolerance(a?.currency || b?.currency);
  const ca = amountCandidates(a);
  const cb = amountCandidates(b);
  return ca.some((x) => cb.some((y) => Math.abs(x - y) <= tol));
}

function sameCurrency(a, b) {
  const ca = String(a?.currency || '').toUpperCase();
  const cb = String(b?.currency || '').toUpperCase();
  return !ca || !cb || ca === cb;
}

/**
 * Compare two records.
 * strong: date + currency + amount + store + item count
 * likely: same but item count differs
 * weak:   same raw/normalized date + item count + rounded amount (legacy banner rule)
 * @returns {'strong'|'likely'|'weak'|null}
 */
export function compareExpenses(a, b) {
  if (!a || !b || !sameCurrency(a, b)) return null;
  const da = normalizeDate(a.date);
  const db = normalizeDate(b.date);
  const sameDate = da && db ? da === db : String(a.date ?? '') === String(b.date ?? '');
  if (!sameDate) return null;

  const countA = a.items?.length || 0;
  const countB = b.items?.length || 0;
  const dateKnown = Boolean(da && db);

  if (dateKnown && storesMatch(a, b) && amountsMatch(a, b)) {
    return countA === countB ? 'strong' : 'likely';
  }
  if (countA === countB && Math.round(num(a.originalAmount)) === Math.round(num(b.originalAmount))) {
    return 'weak';
  }
  return null;
}

/**
 * Best match of `candidate` among `existing` (strongest level wins, first wins on ties).
 * @returns {{ match: object|null, level: 'strong'|'likely'|'weak'|null }}
 */
export function findDuplicateOf(candidate, existing) {
  let best = { match: null, level: null };
  for (const e of existing || []) {
    if (!e || e.id === candidate?.id) continue;
    const level = compareExpenses(candidate, e);
    if (level && (!best.level || MATCH_RANK[level] > MATCH_RANK[best.level])) {
      best = { match: e, level };
      if (level === 'strong') break;
    }
  }
  return best;
}

/**
 * Split freshly parsed records into clean ones (add immediately) and conflicts (need review).
 * Only strong/likely prompt. Weak matches stay clean and rely on the banner.
 * Each record is compared with existing (current trip) + earlier clean records of the same batch.
 * @returns {{ clean: object[], conflicts: Array<{ record: object, matchId: number, level: string }> }}
 */
export function splitBatchByDuplicates(parsed, existing) {
  const clean = [];
  const conflicts = [];
  for (const record of parsed) {
    const { match, level } = findDuplicateOf(record, [...(existing || []), ...clean]);
    if (match && (level === 'strong' || level === 'likely')) {
      conflicts.push({ record, matchId: match.id, level });
    } else {
      clean.push(record);
    }
  }
  return { clean, conflicts };
}

/** True if the user has edited this record after scanning. */
export function isUserEdited(expense) {
  return Boolean(expense?.editedAt || expense?.userEditedPricing);
}

/**
 * Banner detection. Returns Map<id, { ofId, level }> (Map#has works like the old Set).
 * Pairs where either record has duplicateDismissed are ignored, so one tap on 「不是重複」 clears the pair.
 */
export function detectDuplicates(expenses) {
  const flagged = new Map();
  const list = expenses || [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a.duplicateDismissed || b.duplicateDismissed) continue;
      const level = compareExpenses(a, b);
      if (!level) continue;
      if (!flagged.has(a.id)) flagged.set(a.id, { ofId: b.id, level });
      if (!flagged.has(b.id)) flagged.set(b.id, { ofId: a.id, level });
    }
  }
  return flagged;
}
