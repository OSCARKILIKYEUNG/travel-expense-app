import { CATEGORIES, CATEGORY_COLORS, PERSON_COLORS } from './constants';

/** 系統預設（不可刪、AI 僅能選此六類 + 分不到→其他） */
export const PRESET_EXPENSE_CATEGORIES = CATEGORIES;

const PRESET_SET = new Set([...CATEGORIES, '未分類']);

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** 自訂類別顏色：預設表沒有時用穩定雜湊色 */
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

/** 手動選擇用：預設六類 + 自訂（依字串排序） */
export function getSelectableExpenseCategories(settings) {
  const custom = [...new Set(getCustomExpenseCategories(settings))].filter((c) => !PRESET_SET.has(c));
  custom.sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  return [...CATEGORIES, ...custom];
}

/** 編輯時若舊資料為已刪自訂類，仍顯示在選單 */
export function getCategorySelectOptions(settings, currentCategory) {
  const base = getSelectableExpenseCategories(settings);
  const cur = String(currentCategory || '').trim();
  if (cur && !base.includes(cur)) return [...base, cur];
  return base;
}

/**
 * AI 解析結果：只允許預設六類，否則「其他」
 * （自訂類僅能手動，不進 prompt）
 */
export function normalizeAiExpenseCategory(raw) {
  const v = String(raw ?? '').trim();
  if (!v) return '其他';
  if (CATEGORIES.includes(v)) return v;
  return '其他';
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
    if (PRESET_SET.has(s)) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= MAX_CUSTOM_COUNT) break;
  }
  return out;
}

/**
 * @returns {{ ok: true, name: string } | { ok: false, reason: 'empty'|'long'|'preset'|'duplicate' }}
 */
export function validateNewCustomExpenseCategory(raw, existingCustom) {
  const name = String(raw ?? '').trim();
  if (!name) return { ok: false, reason: 'empty' };
  if (name.length > MAX_CUSTOM_LEN) return { ok: false, reason: 'long' };
  if (PRESET_SET.has(name)) return { ok: false, reason: 'preset' };
  const list = Array.isArray(existingCustom) ? existingCustom : [];
  if (list.some((x) => String(x).trim() === name)) return { ok: false, reason: 'duplicate' };
  if (list.length >= MAX_CUSTOM_COUNT) return { ok: false, reason: 'limit' };
  return { ok: true, name };
}
