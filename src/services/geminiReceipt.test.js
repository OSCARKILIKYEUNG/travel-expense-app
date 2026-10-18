import { describe, it, expect, vi } from 'vitest';
import {
  generateReceiptText, buildGenerationConfig, GeminiTimeoutError,
  MAX_OUTPUT_TOKENS, THINKING_BUDGET, FIRST_ATTEMPT_TIMEOUT_MS,
} from '../../shared/geminiReceipt.js';

function mockGenAI(impls) {
  const calls = [];
  const genAI = {
    getGenerativeModel: vi.fn((params) => ({
      generateContent: vi.fn(async (parts, opts) => {
        calls.push({ params, opts });
        return impls[calls.length - 1]();
      }),
    })),
  };
  return { genAI, calls };
}
const ok = (t) => async () => ({ response: { text: () => t } });
const abort = () => { const e = new Error('Request aborted'); e.name = 'GoogleGenerativeAIAbortError'; throw e; };
const args = (genAI, startedAt, now) => ({ genAI, systemInstruction: 's', parts: [], startedAt, now });

describe('generateReceiptText', () => {
  it('passes thinking budget, maxOutputTokens and timeout', async () => {
    const { genAI, calls } = mockGenAI([ok('{"a":1}')]);
    const t = await generateReceiptText(args(genAI, 0, () => 0));
    expect(t).toBe('{"a":1}');
    const cfg = calls[0].params.generationConfig;
    expect(cfg.maxOutputTokens).toBe(MAX_OUTPUT_TOKENS);
    expect(cfg.thinkingConfig).toEqual({ thinkingBudget: THINKING_BUDGET });
    expect(cfg.responseMimeType).toBe('application/json');
    expect(calls[0].opts.timeout).toBe(FIRST_ATTEMPT_TIMEOUT_MS);
    expect(buildGenerationConfig({ json: false }).responseMimeType).toBeUndefined();
  });

  it('timeout with no budget left -> clean GeminiTimeoutError, no retry', async () => {
    let t = 0;
    const { genAI, calls } = mockGenAI([async () => { t = 40_000; return abort(); }, ok('x')]);
    await expect(generateReceiptText(args(genAI, 0, () => t))).rejects.toBeInstanceOf(GeminiTimeoutError);
    expect(calls).toHaveLength(1);
  });

  it('non-timeout error with budget left retries without JSON mode, shorter timeout', async () => {
    let t = 0;
    const { genAI, calls } = mockGenAI([async () => { t = 5_000; throw new Error('503'); }, ok('{}')]);
    expect(await generateReceiptText(args(genAI, 0, () => t))).toBe('{}');
    expect(calls).toHaveLength(2);
    expect(calls[1].params.generationConfig.responseMimeType).toBeUndefined();
    expect(calls[1].params.generationConfig.thinkingConfig.thinkingBudget).toBe(THINKING_BUDGET);
    expect(calls[1].opts.timeout).toBeLessThan(calls[0].opts.timeout);
  });

  it('retry skipped when budget is gone, original error surfaces', async () => {
    let t = 0;
    const { genAI, calls } = mockGenAI([async () => { t = 45_000; throw new Error('503 overloaded'); }, ok('x')]);
    await expect(generateReceiptText(args(genAI, 0, () => t))).rejects.toThrow('503 overloaded');
    expect(calls).toHaveLength(1);
  });

  it('first-attempt timeout is capped by remaining budget', async () => {
    const { genAI, calls } = mockGenAI([ok('{}')]);
    await generateReceiptText(args(genAI, 0, () => 30_000));
    expect(calls[0].opts.timeout).toBe(22_000);
  });
});
