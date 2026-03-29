import { CATEGORIES, CATEGORY_COLORS, PERSON_COLORS } from './constants';

/** 與後端 `api/expense-categories-merge.js` 一致 */
export const LOCKED_PRESET_CATEGORIES = CATEGORIES;

const PRESET_SET = new Set([...CATEGORIES, '未分類']);

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getCategoryColor(categoryName) {
  const key = String(categoryName || '').trim();
  if (!key) return CATEGORY_COLORS['未分類'];
  if (CATEGORY_COLORS[key]) return CATEGORY_COLORS[key];
  const idx = hashString(key) % PERSON_COLORS.length;
  return PERSON_COLORS[idx];
}

export function getCustomExpenseCategories(settings) {
  const raw = settings?.customExpenseCategories;
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x).trim()).filter(Boolean);
}

const MAX_CUSTOM_LEN = 32;
const MAX_CUSTOM_COUNT = 40;

export function sanitizeCustomExpenseCategoriesArray(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const x of raw) {
    const s = String(x).trim();
    if (!s || s.length > MAX_CUSTOM_LEN) continue;
    if (PRESET_SET.has(s) || LOCKED_PRESET_CATEGORIES.includes(s)) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= MAX_CUSTOM_COUNT) break;
  }
  return out;
}

/** 掃描／下拉／圖表：預設六類 + 自訂（自訂字串排序） */
export function buildAllowedExpenseCategories(settings) {
  const custom = sanitizeCustomExpenseCategoriesArray(getCustomExpenseCategories(settings));
  custom.sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  return [...LOCKED_PRESET_CATEGORIES, ...custom];
}

export function getSelectableExpenseCategories(settings) {
  return buildAllowedExpenseCategories(settings);
}

export function getCategorySelectOptions(settings, currentCategory) {
  const base = buildAllowedExpenseCategories(settings);
  const cur = String(currentCategory || '').trim();
  if (cur && !base.includes(cur)) return [...base, cur];
  return base;
}

/**
 * @returns {{ ok: true, name: string } | { ok: false, reason: string }}
 */
export function validateNewCustomExpenseCategory(raw, existingCustom) {
  const name = String(raw ?? '').trim();
  if (!name) return { ok: false, reason: 'empty' };
  if (name.length > MAX_CUSTOM_LEN) return { ok: false, reason: 'long' };
  if (LOCKED_PRESET_CATEGORIES.includes(name) || name === '未分類') {
    return { ok: false, reason: 'preset' };
  }
  const list = Array.isArray(existingCustom) ? existingCustom : [];
  if (list.some((x) => String(x).trim() === name)) return { ok: false, reason: 'duplicate' };
  if (list.length >= MAX_CUSTOM_COUNT) return { ok: false, reason: 'limit' };
  return { ok: true, name };
}

/**
 * AI 回傳的 category：须在允許清單內，否則「其他」
 */
export function normalizeExpenseCategoryFromAi(raw, allowedCategories) {
  const allowed = Array.isArray(allowedCategories) ? allowedCategories : LOCKED_PRESET_CATEGORIES;
  const set = new Set(allowed);
  const v = String(raw ?? '').trim();
  if (!v) return '其他';
  if (set.has(v)) return v;
  return '其他';
}
