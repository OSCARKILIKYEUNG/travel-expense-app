/**
 * 與前端 `src/utils/constants.js` 的 CATEGORIES 順序／字串須一致。
 * 伺服端合併：預設六類鎖定在前，僅追加客戶端自訂（防竄改預設）。
 */
export const PRESET_EXPENSE_CATEGORIES = Object.freeze([
  '飲食',
  '交通',
  '購物',
  '住宿',
  '娛樂',
  '其他',
]);

const PRESET_SET = new Set(PRESET_EXPENSE_CATEGORIES);

/**
 * @param {unknown} clientCustom
 * @returns {string[]}
 */
export function mergeExpenseCategoriesForPrompt(clientCustom) {
  const out = [...PRESET_EXPENSE_CATEGORIES];
  const seen = new Set(PRESET_SET);
  if (!Array.isArray(clientCustom)) return out;
  for (const x of clientCustom) {
    const s = String(x).trim();
    if (!s || s.length > 40) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length > 64) break;
  }
  return out;
}
