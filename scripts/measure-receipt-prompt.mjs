/**
 * 粗量 receipt 解析送進 Gemini 的文字量（不含圖像 tokens）。
 * 執行：node scripts/measure-receipt-prompt.mjs
 */
import { SYSTEM_PROMPT, USER_TEXT } from '../api/receipt-prompt/index.js';
import { mergeExpenseCategoriesForPrompt } from '../api/expense-categories-merge.js';

function buildTexts(customCount = 0) {
  const custom = Array.from({ length: customCount }, (_, i) => `自訂類別${i + 1}`);
  const expenseCategoryList = mergeExpenseCategoriesForPrompt(custom);
  const categoryAppendix = `

══════════════════════════════════════════
支出類別清單（category 欄位 · 動態）
══════════════════════════════════════════
**必填**：category 僅能為以下**一字不差**的其中一個：
${expenseCategoryList.map((n) => `「${n}」`).join('、')}
無法合理歸類時必須選「其他」（上列已含「其他」時選「其他」）。`;
  const systemInstruction = `${SYSTEM_PROMPT}${categoryAppendix}`;
  const userText = `${USER_TEXT}
category 僅能從下列擇一（須完全一致）：${expenseCategoryList.join('、')}。無法判斷填「其他」。`;
  return { systemInstruction, userText, categoryCount: expenseCategoryList.length };
}

function approxTokens(chars) {
  // 中英混排粗估：中文約 1.5–2 char/token，英文約 4；此處用保守 2.5 char/token
  return Math.ceil(chars / 2.5);
}

for (const n of [0, 20, 40]) {
  const { systemInstruction, userText, categoryCount } = buildTexts(n);
  const sysLen = systemInstruction.length;
  const userLen = userText.length;
  const total = sysLen + userLen;
  console.log(
    JSON.stringify({
      customCategories: n,
      totalCategoriesInPrompt: categoryCount,
      systemChars: sysLen,
      userChars: userLen,
      textCharsTotal: total,
      approxInputTextTokensCombined: approxTokens(total),
      note: 'Gemini 另計圖像 tokens；system vs user 在 API 中分開計價欄位相同單價。',
    }),
  );
}
