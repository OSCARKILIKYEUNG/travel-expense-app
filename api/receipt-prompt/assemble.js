import { buildMarketBasePrompt } from './markets/base.js';
import { MARKET_GENERIC } from './markets/generic.js';
import { MARKET_JP } from './markets/jp.js';

/**
 * 單次呼叫：基底 + 附件 A（通用非日）+ 附件 B（日本專章）。
 * 中期改兩段式時：可改為 buildSystemPromptForMarket('JP') 只拼接 base + jp。
 */
export function buildSystemPrompt() {
  const base = buildMarketBasePrompt();
  return `${base}

══════════════════════════════════════════
附件 A — 通用非日本情境（detected_market 非 JP 或為 UNKNOWN 時：依此與上文；勿套用附件 B 的日文前提）
══════════════════════════════════════════
${MARKET_GENERIC}

══════════════════════════════════════════
附件 B — 日本市場專用（僅當 detected_market 為 JP 時啟用下列細則與範例 A～D）
══════════════════════════════════════════
${MARKET_JP}`;
}
