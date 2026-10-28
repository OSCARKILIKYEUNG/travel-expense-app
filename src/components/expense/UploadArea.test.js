import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import { parseReceipt, buildExpenseFromAI } from '../../services/AIService';
import { sha256Hex, resolveParseQueue } from '../../utils/sourceHash';
import { gateFilesBySourceHash, parseQueuedReceipts } from './uploadBatch';
import HashDuplicateDialog from './HashDuplicateDialog';
import { useReceiptScan } from '../../notebook/useReceiptScan';

vi.mock('../../services/AIService', async () => {
  const actual = await vi.importActual('../../services/AIService');
  return {
    ...actual,
    parseReceipt: vi.fn(),
  };
});

const deps = {
  customCats: [],
  accessToken: 'token',
  homeCurrencyCode: 'HKD',
  tripCurrency: 'JPY',
  exchangeRates: { JPY: 1 },
  defaultAssignee: '共同',
  allowedCategories: null,
  applyBillingSnapshot: vi.fn(),
  refreshBilling: vi.fn(),
};

function fileFrom(text, name) {
  return new File([new TextEncoder().encode(text)], name, { type: 'image/jpeg' });
}

const parsed = {
  store: '羅森',
  date: '2026年10月18日',
  total_amount: 1080,
  currency: 'JPY',
  items: [{ name: '飯團', price: 1080 }],
};

describe('UploadArea hash gate', () => {
  beforeEach(() => {
    parseReceipt.mockReset();
    deps.applyBillingSnapshot.mockReset();
    deps.refreshBilling.mockReset();
  });

  it('hash hit + skip never calls parseReceipt', async () => {
    const file = fileFrom('same-receipt', 'again.jpg');
    const hash = await sha256Hex(file);
    const gated = await gateFilesBySourceHash(
      [file],
      [{ id: 1, sourceHash: hash, store: '羅森', date: '2026年10月18日' }],
    );
    expect(gated.conflicts).toHaveLength(1);
    expect(gated.toParse).toHaveLength(0);
    const queue = resolveParseQueue(gated.toParse, gated.conflicts, {});
    const outcome = await parseQueuedReceipts(queue, deps);
    expect(queue).toHaveLength(0);
    expect(outcome.results).toEqual([]);
    expect(parseReceipt).not.toHaveBeenCalled();
  });

  it('仍然掃描 calls parseReceipt once and stores sourceHash on the new expense', async () => {
    const file = fileFrom('same-receipt', 'again.jpg');
    const hash = await sha256Hex(file);
    parseReceipt.mockResolvedValue(parsed);
    const gated = await gateFilesBySourceHash(
      [file],
      [{ id: 1, sourceHash: hash, store: '羅森', date: '2026年10月18日' }],
    );
    const queue = resolveParseQueue(gated.toParse, gated.conflicts, { [gated.conflicts[0].index]: 'scan' });
    const outcome = await parseQueuedReceipts(queue, deps);

    expect(parseReceipt).toHaveBeenCalledTimes(1);
    expect(parseReceipt).toHaveBeenCalledWith(file, [], 'token');
    expect(outcome.results).toHaveLength(1);
    expect(outcome.results[0].sourceHash).toBe(hash);
    expect(outcome.results[0].store).toBe('羅森');
  });

  it('scans a new file in the same batch while skipping the in-batch duplicate', async () => {
    const dup = fileFrom('bytes-a', 'a.jpg');
    const copy = fileFrom('bytes-a', 'a-copy.jpg');
    const fresh = fileFrom('bytes-b', 'b.jpg');
    parseReceipt.mockResolvedValue(parsed);
    const gated = await gateFilesBySourceHash([dup, copy, fresh], []);
    expect(gated.conflicts.map((row) => row.file.name)).toEqual(['a-copy.jpg']);
    expect(gated.conflicts[0].sameFile).toBe(true);

    const skipped = resolveParseQueue(gated.toParse, gated.conflicts, {});
    await parseQueuedReceipts(skipped, deps);
    expect(parseReceipt).toHaveBeenCalledTimes(2);
    expect(parseReceipt.mock.calls.map((call) => call[0].name)).toEqual(['a.jpg', 'b.jpg']);

    parseReceipt.mockClear();
    const scanned = resolveParseQueue(gated.toParse, gated.conflicts, { [gated.conflicts[0].index]: 'scan' });
    const outcome = await parseQueuedReceipts(scanned, deps);
    expect(parseReceipt).toHaveBeenCalledTimes(3);
    expect(outcome.results.map((row) => row.sourceHash)).toEqual([
      await sha256Hex(dup),
      await sha256Hex(dup),
      await sha256Hex(fresh),
    ]);
  });

  it('buildExpenseFromAI omits sourceHash unless one is provided', () => {
    const withHash = buildExpenseFromAI(parsed, 0, 'JPY', 1, 'JPY', '共同', null, 'AB');
    const without = buildExpenseFromAI(parsed, 1, 'JPY', 1, 'JPY');
    expect(withHash.sourceHash).toBe('ab');
    expect(without.sourceHash).toBeUndefined();
  });

  it('threads deps.fallbackDate through parseQueuedReceipts and emits fallback toast once in useReceiptScan', async () => {
    const file = fileFrom('no-date-receipt', 'nodate.jpg');
    parseReceipt.mockResolvedValue({
      store: 'セブンイレブン',
      date: '',
      total_amount: 950,
      currency: 'JPY',
      items: [{ name: '咖啡', price: 950 }],
    });

    const gated = await gateFilesBySourceHash([file], []);
    const outcome = await parseQueuedReceipts(gated.toParse, {
      ...deps,
      fallbackDate: '2026-10-20',
    });
    expect(outcome.results).toHaveLength(1);
    expect(outcome.results[0].date).toBe('2026-10-20');
    expect(outcome.results[0].aiDateMissing).toBe(true);

    // Hook integration: selected day fallback triggers onToast once
    const onToast = vi.fn();
    const onOpenForm = vi.fn();
    let capturedScanner = null;
    function ScannerProbe() {
      capturedScanner = useReceiptScan({
        expenses: [],
        homeCurrencyCode: 'HKD',
        tripCurrency: 'JPY',
        exchangeRates: { JPY: 19.0 },
        defaultAssignee: '共同',
        t: i18n.getFixedT('zh-TW'),
        today: '2026-10-22',
        onOpenForm,
        onToast,
      });
      return null;
    }
    renderToStaticMarkup(createElement(ScannerProbe));

    capturedScanner.requestScan({ date: '2026-10-20', dateSource: 'selected' });
    await capturedScanner.handleFileChange({ target: { files: [file] } });

    expect(onOpenForm).toHaveBeenCalledWith({
      date: '2026-10-20',
      dateSource: 'selected',
      fromForm: false,
    });
    expect(onToast).toHaveBeenCalledTimes(1);
    expect(onToast).toHaveBeenCalledWith(
      '收據沒有日期，已記入你在日曆選取的 10月20日，可在編輯中修改。',
    );

    // Explicit date receipt: onToast is NOT called
    onToast.mockClear();
    parseReceipt.mockResolvedValue(parsed);
    capturedScanner.requestScan({ date: '2026-10-20', dateSource: 'selected' });
    await capturedScanner.handleFileChange({
      target: { files: [fileFrom('dated-receipt', 'dated.jpg')] },
    });
    expect(onToast).not.toHaveBeenCalled();
  });
});

describe('HashDuplicateDialog', () => {
  it('shows the Phase 2 zh-TW copy and pre-selects skip', async () => {
    await i18n.changeLanguage('zh-TW');
    const html = renderToStaticMarkup(createElement(I18nextProvider, { i18n },
      createElement(HashDuplicateDialog, {
        open: true,
        conflicts: [
          {
            index: 0,
            hash: 'aa',
            file: { name: 'again.jpg' },
            match: { store: '羅森', date: '2026年10月18日' },
            sameFile: false,
          },
          {
            index: 1,
            hash: 'aa',
            file: { name: 'copy.jpg' },
            match: null,
            sameFile: true,
          },
        ],
        onConfirm() {},
        onClose() {},
      })));
    expect(html).toContain('這張單據似乎已上傳過（羅森・2026年10月18日）。');
    expect(html).toContain('這張單據似乎已上傳過（同一檔案）。');
    expect(html).toContain('略過（不用額度）');
    expect(html).toContain('仍然掃描');
    expect(html).toMatch(/aria-pressed="true"[^>]*data-choice="skip"/);
    expect(html).toMatch(/aria-pressed="false"[^>]*data-choice="scan"/);
    expect(html).toContain('data-hash-review="choose"');
  });

  it('renders nothing when closed', () => {
    const html = renderToStaticMarkup(createElement(HashDuplicateDialog, {
      open: false,
      conflicts: [],
      onConfirm() {},
      onClose() {},
    }));
    expect(html).toBe('');
  });
});
