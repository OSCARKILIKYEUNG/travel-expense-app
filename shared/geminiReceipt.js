/**
 * Gemini 呼叫（含 thinking 上限、單次逾時、剩餘時間預算內才重試）。
 * 與 vercel.json 的 maxDuration 對齊：函式上限 60s，保留 8s 安全邊際。
 */
export const MODEL_ID = 'gemini-2.5-flash';
export const FUNCTION_LIMIT_MS = 60_000;
export const SAFETY_MARGIN_MS = 8_000;
export const FIRST_ATTEMPT_TIMEOUT_MS = 40_000;
export const RETRY_TIMEOUT_MS = 20_000;
/** 剩餘預算低於此值就不重試（再短也來不及生成完整 JSON） */
export const MIN_RETRY_BUDGET_MS = 15_000;
export const MAX_OUTPUT_TOKENS = 4096;
// ~20 品項 x ~80 tokens + 外層 ≈ 2k；thinking 512 + 輸出 < 4096（maxOutputTokens 含 thinking）
export const THINKING_BUDGET = 512;

export class GeminiTimeoutError extends Error {
  constructor(message = 'Gemini 回應逾時') {
    super(message);
    this.name = 'GeminiTimeoutError';
    this.code = 'gemini_timeout';
  }
}

export function isAbortLike(err) {
  const s = `${err?.name || ''} ${err?.message || ''}`;
  return /abort/i.test(s);
}

export function buildGenerationConfig({ json }) {
  // thinkingConfig 在 @google/generative-ai 0.24.1 型別未宣告，但 SDK 會原樣送出 generationConfig。
  const cfg = {
    temperature: 0.1,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    thinkingConfig: { thinkingBudget: THINKING_BUDGET },
  };
  if (json) cfg.responseMimeType = 'application/json';
  return cfg;
}

/**
 * @returns {Promise<string|undefined>} 回應文字
 * @throws {GeminiTimeoutError} 逾時
 */
export async function generateReceiptText({ genAI, systemInstruction, parts, startedAt, now = Date.now }) {
  const deadline = startedAt + FUNCTION_LIMIT_MS - SAFETY_MARGIN_MS;

  const attempt = async (json, timeoutMs) => {
    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      systemInstruction,
      generationConfig: buildGenerationConfig({ json }),
    });
    try {
      const result = await model.generateContent(parts, { timeout: timeoutMs });
      return result.response?.text();
    } catch (err) {
      if (isAbortLike(err)) throw new GeminiTimeoutError();
      throw err;
    }
  };

  const firstTimeout = Math.max(1_000, Math.min(FIRST_ATTEMPT_TIMEOUT_MS, deadline - now()));
  try {
    return await attempt(true, firstTimeout);
  } catch (firstErr) {
    const remaining = deadline - now();
    if (remaining < MIN_RETRY_BUDGET_MS) throw firstErr;
    return attempt(false, Math.min(RETRY_TIMEOUT_MS, remaining));
  }
}
