import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import en from '../locales/en.json';
import zhTW from '../locales/zh-TW.json';
import AddForm from '../proto/ref/AddForm';
import { createRefTrip } from '../proto/ref/mockRefTrip';
import { buildExpenseFromAI } from '../services/AIService';
import NotebookApp from './NotebookApp';
import SettingsView, { applyNotebookLanguageChange } from './SettingsView';
import {
  FIXTURE_ERROR_KEY,
  FIXTURE_ERROR_MESSAGE,
  buildFixtureExpense,
  buildLawsonFixtureParseResult,
  getFixtureErrorMessage,
  isProtoNotebook,
  resolveScanFixtureMode,
} from './scanFixture';
import { preparePersistedExpense } from './tripRate';
import {
  SCAN_DEFAULT_ERROR_TEXT,
  SCAN_ERROR_DEFAULT_KEY,
  SCAN_ERROR_QUOTA_KEY,
  SCAN_ERROR_TIMEOUT_KEY,
  SCAN_LOADING_KEY,
  SCAN_LOADING_TEXT,
  SCAN_READY_KEY,
  SCAN_READY_TEXT,
  blockedScanMessageKey,
  buildScanDeps,
  checkScanBlocked,
  routeScannedSave,
  scanLoadingMessage,
  scanReadyMessage,
  scanResultToFormFields,
  shortScanErrorKey,
  shortScanErrorMessage,
} from './useReceiptScan';

describe('scanResultToFormFields — mapping real AI expense to AddForm fields', () => {
  const fixedNow = new Date(2026, 9, 22, 16, 45); // 16:45 local

  it('maps amount, currency, store, place, category, date, and time from a full AI expense', () => {
    const aiExpense = buildExpenseFromAI(
      {
        detected_market: 'JP',
        receipt_type: 'tax_inclusive',
        store: 'ローソン 河口湖駅前店',
        location: '河口湖',
        category: '飲食',
        date: '2026年10月22日',
        time: '13:05',
        currency: 'JPY',
        payment_method: '信用卡',
        total_amount: 1680,
        subtotal: 1680,
        items: [
          { name: '炸雞塊', price: 248 },
          { name: '便當', price: 1432 },
        ],
      },
      0,
      'JPY',
      19.23,
      'JPY',
      '共同',
      null,
      'abc123hash',
    );

    const fields = scanResultToFormFields(aiExpense, {
      defaultDate: '2026-10-18',
      now: fixedNow,
      payerDefault: 'Oscar',
      paymentDefault: 'cash',
      defaultAssignee: '共同',
    });

    expect(fields.amount).toBe('1680');
    expect(fields.currency).toBe('JPY');
    expect(fields.store).toBe('ローソン 河口湖駅前店');
    expect(fields.place).toBe('河口湖');
    expect(fields.category).toBe('飲食');
    expect(fields.date).toBe('2026-10-22');
    expect(fields.time).toBe('13:05');
    expect(fields.payer).toBe('Oscar');
    expect(fields.payment).toBe('card');
    expect(fields.assignedTo).toBe('共同');
    expect(fields.scanned).toBe(true);
    expect('id' in fields).toBe(false);
  });

  it('keeps defaultDate when AI date is missing and keeps defaultTime(now) when AI time is missing', () => {
    const aiNoDateOrTime = buildExpenseFromAI(
      {
        store: 'セブンイレブン 浅草店',
        location: '淺草',
        category: '飲食',
        currency: 'JPY',
        total_amount: 950,
        items: [{ name: '咖啡', price: 950 }],
      },
      0,
      'JPY',
      19.23,
      'JPY',
    );

    const fields = scanResultToFormFields(aiNoDateOrTime, {
      defaultDate: '2026-10-20',
      now: fixedNow,
      payerDefault: 'Oscar',
      paymentDefault: 'card',
      defaultAssignee: '共同',
    });

    expect(fields.date).toBe('2026-10-20');
    expect(fields.time).toBe('16:45');
    expect(fields.amount).toBe('950');
    expect(fields.store).toBe('セブンイレブン 浅草店');
    expect(fields.payment).toBe('card');
    expect(fields.payer).toBe('Oscar');
    expect(fields.scanned).toBe(true);

    // Also works when given a plain expense object with blank/missing date and time
    const plainFields = scanResultToFormFields(
      {
        originalAmount: 1200,
        currency: 'JPY',
        store: '全家便利店',
        category: '飲食',
        date: '',
        time: '',
      },
      {
        defaultDate: '2026-10-21',
        now: new Date(2026, 9, 21, 9, 5),
      },
    );
    expect(plainFields.date).toBe('2026-10-21');
    expect(plainFields.time).toBe('09:05');
  });
});

describe('buildScanDeps & shortScanErrorMessage', () => {
  it('builds parseQueuedReceipts dependencies matching classic UploadArea', () => {
    const applyBillingSnapshot = vi.fn();
    const refreshBilling = vi.fn();
    const deps = buildScanDeps({
      settings: { customExpenseCategories: ['手信', '藥妝'] },
      session: { access_token: 'jwt-token-123' },
      homeCurrencyCode: 'HKD',
      tripCurrency: 'JPY',
      exchangeRates: { HKD: 1, JPY: 19.23 },
      defaultAssignee: 'Oscar',
      applyBillingSnapshot,
      refreshBilling,
    });

    expect(deps.customCats).toEqual(['手信', '藥妝']);
    expect(deps.accessToken).toBe('jwt-token-123');
    expect(deps.homeCurrencyCode).toBe('HKD');
    expect(deps.tripCurrency).toBe('JPY');
    expect(deps.exchangeRates).toEqual({ HKD: 1, JPY: 19.23 });
    expect(deps.defaultAssignee).toBe('Oscar');
    expect(deps.allowedCategories).toContain('飲食');
    expect(deps.allowedCategories).toContain('手信');
    expect(deps.allowedCategories).toContain('藥妝');
    expect(deps.applyBillingSnapshot).toBe(applyBillingSnapshot);
    expect(deps.refreshBilling).toBe(refreshBilling);
  });

  it('shortens long error strings for the single-line AddForm banner', () => {
    expect(shortScanErrorKey('AI 掃描逾時，這張單據可能太長或太複雜。請稍後再試一次。')).toBe(
      SCAN_ERROR_TIMEOUT_KEY,
    );
    expect(shortScanErrorKey(new Error('伺服器回傳異常（500）。請關閉分頁重開後再試。'))).toBe(
      SCAN_ERROR_DEFAULT_KEY,
    );
    expect(shortScanErrorKey('免費 AI 掃描已用完')).toBe(SCAN_ERROR_QUOTA_KEY);

    expect(shortScanErrorMessage('AI 掃描逾時，這張單據可能太長或太複雜。請稍後再試一次。')).toBe(
      'AI 掃描逾時，請重試或手動輸入',
    );
    expect(shortScanErrorMessage(new Error('伺服器回傳異常（500）。請關閉分頁重開後再試。'))).toBe(
      '收據讀取失敗，請重試或手動輸入',
    );
    expect(shortScanErrorMessage('免費 AI 掃描已用完')).toBe('免費掃描已用完，仍可手動記帳');
  });

  it('resolves scan loading, ready, and error banner strings for zh-TW (書面語) and en via t()', () => {
    const tZh = i18n.getFixedT('zh-TW');
    const tEn = i18n.getFixedT('en');

    expect(SCAN_LOADING_KEY).toBe('notebook.scan.loading');
    expect(SCAN_READY_KEY).toBe('notebook.scan.ready');
    expect(SCAN_LOADING_TEXT).toBe('正在讀取收據…');
    expect(SCAN_LOADING_TEXT).not.toContain('讀取緊');
    expect(SCAN_READY_TEXT).toBe('已讀取收據，請核對。');
    expect(SCAN_DEFAULT_ERROR_TEXT).toBe('收據讀取失敗，請重試或手動輸入');

    expect(scanLoadingMessage(tZh)).toBe('正在讀取收據…');
    expect(scanReadyMessage(tZh)).toBe('已讀取收據，請核對。');
    expect(shortScanErrorMessage('Request timeout 504', tZh)).toBe('AI 掃描逾時，請重試或手動輸入');
    expect(shortScanErrorMessage('Quota exceeded', tZh)).toBe('免費掃描已用完，仍可手動記帳');
    expect(shortScanErrorMessage(new Error('HTTP 500 long server failure message'), tZh)).toBe(
      '收據讀取失敗，請重試或手動輸入',
    );
    expect(getFixtureErrorMessage(tZh)).toBe('收據讀取失敗，請重試或手動輸入');

    expect(scanLoadingMessage(tEn)).toBe('Reading receipt…');
    expect(scanReadyMessage(tEn)).toBe('Receipt ready — please review.');
    expect(shortScanErrorMessage('Request timeout 504', tEn)).toBe('Scan timed out — please retry');
    expect(shortScanErrorMessage('Quota exceeded', tEn)).toBe('Free scans used — enter manually');
    expect(shortScanErrorMessage(new Error('HTTP 500 long server failure message'), tEn)).toBe(
      'Scan failed — retry or enter',
    );
    expect(getFixtureErrorMessage(tEn)).toBe('Scan failed — retry or enter');
    expect(FIXTURE_ERROR_KEY).toBe(SCAN_ERROR_DEFAULT_KEY);
  });
});

describe('checkScanBlocked & blockedScanMessageKey — quota gating', () => {
  it('blocks only settled free plans with 0 remaining scans and selects message key by STRIPE_UI_ENABLED', () => {
    const freeExhausted = { state: 'free', remainingFreeScans: 0, stale: false };
    const freeAvailable = { state: 'free', remainingFreeScans: 3, stale: false };
    const proPlan = { state: 'pro', subscriptionStatus: 'active', stale: false };
    const loadingPlan = { state: 'loading' };
    const t = (key) => `translated:${key}`;

    expect(blockedScanMessageKey(false)).toBe('upload.scanLimitReached');
    expect(blockedScanMessageKey(true)).toBe('settings.billingUpgradePrompt');

    const blockedNoStripe = checkScanBlocked(freeExhausted, { stripeUiEnabled: false, t });
    expect(blockedNoStripe).toEqual({
      blocked: true,
      key: 'upload.scanLimitReached',
      message: 'translated:upload.scanLimitReached',
      level: 'warning',
    });

    const blockedWithStripe = checkScanBlocked(freeExhausted, { stripeUiEnabled: true, t });
    expect(blockedWithStripe).toEqual({
      blocked: true,
      key: 'settings.billingUpgradePrompt',
      message: 'translated:settings.billingUpgradePrompt',
      level: 'warning',
    });

    expect(checkScanBlocked(freeAvailable, { stripeUiEnabled: false, t }).blocked).toBe(false);
    expect(checkScanBlocked(proPlan, { stripeUiEnabled: false, t }).blocked).toBe(false);
    expect(checkScanBlocked(loadingPlan, { stripeUiEnabled: false, t }).blocked).toBe(false);
  });

  it('returns not-blocked for a Pro plan view and for a free plan with remaining scans > 0', () => {
    const t = (key) => `translated:${key}`;
    const proPlan = { state: 'pro', subscriptionStatus: 'active', remainingFreeScans: 0, stale: false };
    const freeWithRemaining = { state: 'free', remainingFreeScans: 1, stale: false };

    expect(checkScanBlocked(proPlan, { stripeUiEnabled: false, t })).toEqual({
      blocked: false,
      key: null,
      message: '',
      level: null,
    });
    expect(checkScanBlocked(proPlan, { stripeUiEnabled: true, t })).toEqual({
      blocked: false,
      key: null,
      message: '',
      level: null,
    });
    expect(checkScanBlocked(freeWithRemaining, { stripeUiEnabled: false, t })).toEqual({
      blocked: false,
      key: null,
      message: '',
      level: null,
    });
    expect(checkScanBlocked(freeWithRemaining, { stripeUiEnabled: true, t })).toEqual({
      blocked: false,
      key: null,
      message: '',
      level: null,
    });
  });
});

describe('routeScannedSave — duplicate check routing on save', () => {
  const trip = createRefTrip();
  const existingExpenses = trip.expenses;

  it('splits a clean scanned record into action="add" and a duplicate scanned record into action="conflict"', () => {
    const cleanExpense = buildFixtureExpense({
      mode: 'default',
      date: '2026-10-22',
      existingExpenses,
    });
    const { record: cleanRecord } = preparePersistedExpense(
      scanResultToFormFields(cleanExpense, { defaultDate: '2026-10-22' }),
      { scanBase: cleanExpense, tripCurrency: 'JPY', exchangeRates: { JPY: 19.01 } },
    );

    const cleanResult = routeScannedSave(cleanRecord, existingExpenses);
    expect(cleanResult.action).toBe('add');
    expect(cleanResult.clean).toHaveLength(1);
    expect(cleanResult.conflicts).toHaveLength(0);

    const dupExpense = buildFixtureExpense({
      mode: 'dup',
      date: '2026-10-22',
      existingExpenses,
    });
    const { record: dupRecord } = preparePersistedExpense(
      scanResultToFormFields(dupExpense, { defaultDate: '2026-10-22' }),
      { scanBase: dupExpense, tripCurrency: 'JPY', exchangeRates: { JPY: 19.01 } },
    );

    const dupResult = routeScannedSave(dupRecord, existingExpenses);
    expect(dupResult.action).toBe('conflict');
    expect(dupResult.clean).toHaveLength(0);
    expect(dupResult.conflicts).toHaveLength(1);
    expect(dupResult.conflicts[0].record).toBe(dupRecord);
    expect(['strong', 'likely']).toContain(dupResult.conflicts[0].level);
  });

  it('bypasses duplicate dialog for manual (non-scanned) adds and for edits', () => {
    const manualDuplicate = {
      id: 'exp-manual-1',
      date: '2026年10月22日',
      store: '天上山纜車',
      originalAmount: 8250,
      currency: 'JPY',
      scanned: false,
      items: [],
    };

    const manualRoute = routeScannedSave(manualDuplicate, existingExpenses, {
      isEdit: false,
      isScanned: false,
    });
    expect(manualRoute.action).toBe('add');
    expect(manualRoute.conflicts).toHaveLength(0);

    const editRoute = routeScannedSave(manualDuplicate, existingExpenses, {
      isEdit: true,
      isScanned: true,
    });
    expect(editRoute.action).toBe('update');
    expect(editRoute.conflicts).toHaveLength(0);
  });
});

describe('scanFixture — proto=notebook fixture helpers', () => {
  it('resolves scanfixture URL param and builds Lawson 1680 JPY 2-item receipt at 13:05', () => {
    expect(resolveScanFixtureMode('?proto=notebook')).toBe('default');
    expect(resolveScanFixtureMode('?proto=notebook&scanfixture=dup')).toBe('dup');
    expect(resolveScanFixtureMode('?proto=notebook&scanfixture=error')).toBe('error');
    expect(resolveScanFixtureMode('?proto=notebook', '#add&date=2026-10-22&scan=1&scanfixture=dup')).toBe(
      'dup',
    );
    expect(isProtoNotebook('?proto=notebook&today=2026-10-22')).toBe(true);
    expect(isProtoNotebook('?proto=ref')).toBe(false);

    const parsed = buildLawsonFixtureParseResult({ date: '2026-10-22' });
    expect(parsed.total_amount).toBe(1680);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.time).toBe('13:05');

    const built = buildFixtureExpense({ mode: 'default', date: '2026-10-22' });
    expect(built.originalAmount).toBe(1680);
    expect(built.currency).toBe('JPY');
    expect(built.items).toHaveLength(2);
    expect(built.time).toBe('13:05');
    expect(built.sourceHash).toBeTruthy();

    expect(() => buildFixtureExpense({ mode: 'error' })).toThrow(FIXTURE_ERROR_MESSAGE);
  });
});

describe('AddForm — proto=ref mock fallback vs external scanner prop', () => {
  it('uses built-in mock banner when startScan=true and no onRequestScan prop is passed', () => {
    const html = renderToStaticMarkup(
      createElement(AddForm, {
        defaultDate: '2026-10-22',
        startScan: true,
        people: ['共同', 'Oscar'],
        onCancel() {},
        onSave() {},
      }),
    );
    expect(html).toContain('已讀取收據（示範資料），請核對。');
  });

  it('shows loading / ready / error scanState messages and prefilled scanDraft when onRequestScan is passed', () => {
    const loadingHtml = renderToStaticMarkup(
      createElement(AddForm, {
        defaultDate: '2026-10-22',
        startScan: true,
        people: ['共同', 'Oscar'],
        onRequestScan() {},
        scanState: { status: 'loading', message: SCAN_LOADING_TEXT, token: 1 },
        onCancel() {},
        onSave() {},
      }),
    );
    expect(loadingHtml).toContain('正在讀取收據…');
    expect(loadingHtml).not.toContain('已讀取收據（示範資料）');

    const draft = buildFixtureExpense({ mode: 'default', date: '2026-10-22' });
    const readyHtml = renderToStaticMarkup(
      createElement(AddForm, {
        defaultDate: '2026-10-22',
        people: ['共同', 'Oscar'],
        onRequestScan() {},
        scanState: { status: 'ready', message: SCAN_READY_TEXT, draft, token: 2 },
        scanDraft: draft,
        onCancel() {},
        onSave() {},
      }),
    );
    expect(readyHtml).toContain('已讀取收據，請核對。');
    expect(readyHtml).toContain('value="1680"');
    expect(readyHtml).toContain('value="ローソン 河口湖駅前店"');
    expect(readyHtml).toContain('13:05');
  });
});

describe('Notebook i18n scaffold — SettingsView language toggle, nav, and locale key parity', () => {
  it('keeps zh-TW and en notebook.* locale trees in lockstep with no missing keys', () => {
    function collectKeys(obj, prefix = '') {
      const out = [];
      for (const [k, v] of Object.entries(obj || {})) {
        const next = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          out.push(...collectKeys(v, next));
        } else {
          out.push(next);
        }
      }
      return out.sort();
    }

    const zhKeys = collectKeys(zhTW.notebook, 'notebook');
    const enKeys = collectKeys(en.notebook, 'notebook');
    expect(zhKeys.length).toBeGreaterThan(0);
    expect(zhKeys).toEqual(enKeys);
  });

  it('persists normalized uiLanguage via onChangeUiLanguage / updateSettings and falls back to local changeLanguage', () => {
    const onChangeUiLanguage = vi.fn();
    expect(applyNotebookLanguageChange('en', { onChangeUiLanguage })).toBe('en');
    expect(onChangeUiLanguage).toHaveBeenCalledWith('en');

    expect(applyNotebookLanguageChange('invalid-lang', { onChangeUiLanguage })).toBe('zh-TW');
    expect(onChangeUiLanguage).toHaveBeenLastCalledWith('zh-TW');

    const updateSettings = vi.fn();
    expect(applyNotebookLanguageChange('en', { updateSettings })).toBe('en');
    expect(updateSettings).toHaveBeenCalledWith({ uiLanguage: 'en' });

    const changeLanguage = vi.fn();
    expect(applyNotebookLanguageChange('en', { i18nInstance: { changeLanguage } })).toBe('en');
    expect(changeLanguage).toHaveBeenCalledWith('en');
  });

  it('renders notebook SettingsView and BottomNav in zh-TW and switches to en via i18n', async () => {
    const trip = createRefTrip();

    await i18n.changeLanguage('zh-TW');
    const zhHtml = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(NotebookApp, {
          trip,
          trips: [trip],
          today: '2026-10-22',
          initialHash: '#settings',
          uiLanguage: 'zh-TW',
        }),
      ),
    );
    expect(zhHtml).toContain('data-testid="language-select"');
    expect(zhHtml).toContain('介面語言');
    expect(zhHtml).toContain('繁體中文');
    expect(zhHtml).toContain('English');
    expect(zhHtml).toContain('旅程管理');
    expect(zhHtml).toContain('旅程預算');
    expect(zhHtml).toContain('人物管理');
    expect(zhHtml).toContain('貨幣與匯率');
    expect(zhHtml).toContain('資料管理');
    expect(zhHtml).toContain('日曆');
    expect(zhHtml).toContain('帳本');
    expect(zhHtml).toContain('圖表');

    await i18n.changeLanguage('en');
    const enHtml = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(NotebookApp, {
          trip,
          trips: [trip],
          today: '2026-10-22',
          initialHash: '#settings',
          uiLanguage: 'en',
        }),
      ),
    );
    expect(enHtml).toContain('data-testid="language-select"');
    expect(enHtml).toContain('Language');
    expect(enHtml).toContain('Traditional Chinese');
    expect(enHtml).toContain('Trips');
    expect(enHtml).toContain('Trip budget');
    expect(enHtml).toContain('People');
    expect(enHtml).toContain('Currency &amp; exchange rate');
    expect(enHtml).toContain('Data');
    expect(enHtml).toContain('Calendar');
    expect(enHtml).toContain('Ledger');
    expect(enHtml).toContain('Charts');
    expect(enHtml).toContain('Settings');

    // Language section appears before Trip management
    expect(enHtml.indexOf('data-testid="language-select"')).toBeLessThan(
      enHtml.indexOf('>Trips</h2>'),
    );

    const directSettingsHtml = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(SettingsView, {
          trip,
          trips: [trip],
          onUpdateTrip() {},
          onSelectTrip() {},
          uiLanguage: 'en',
        }),
      ),
    );
    expect(directSettingsHtml).toContain('About Travel Notebook');
    // Settings title gloss should not duplicate "Settings" in EN
    expect(directSettingsHtml.match(/>Settings<\/h1>/g)).toHaveLength(1);
    expect(directSettingsHtml).not.toContain('>Settings</span>');

    await i18n.changeLanguage('zh-TW');
  });

  it('renders Home calendar chrome and top bar in zh-TW and en without duplicate brand gloss or leftover chrome CJK', async () => {
    const trip = createRefTrip();

    await i18n.changeLanguage('zh-TW');
    const zhHomeHtml = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(NotebookApp, {
          trip,
          trips: [trip],
          today: '2026-10-22',
          initialHash: '',
          uiLanguage: 'zh-TW',
        }),
      ),
    );
    expect(zhHomeHtml).toContain('Travel notebook');
    expect(zhHomeHtml).toContain('旅遊手帳');
    expect(zhHomeHtml).toContain('第 5 日／共 10 日');
    expect(zhHomeHtml).toContain('今日 HKD $1,086');
    expect(zhHomeHtml).toContain('17 筆');
    expect(zhHomeHtml).toContain('今日手札');
    expect(zhHomeHtml).toContain('掃描收據');
    expect(zhHomeHtml).toContain('記一筆');
    expect(zhHomeHtml).toContain('2026年10月');
    expect(zhHomeHtml).toContain('aria-label="上個月"');
    expect(zhHomeHtml).toContain('aria-label="下個月"');

    await i18n.changeLanguage('en');
    const enHomeHtml = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(NotebookApp, {
          trip,
          trips: [trip],
          today: '2026-10-22',
          initialHash: '',
          uiLanguage: 'en',
        }),
      ),
    );
    // Top bar shows "Travel notebook" only once (no duplicate script + display line)
    expect(enHomeHtml.match(/>Travel notebook<\/span>/g)).toHaveLength(1);

    // Home body chrome in EN
    expect(enHomeHtml).toContain('Day 5 / 10 days');
    expect(enHomeHtml).toContain('Today HKD $1,086');
    expect(enHomeHtml).toContain('17 items');
    expect(enHomeHtml).toContain('Today&#x27;s note');
    expect(enHomeHtml).toContain('Scan receipt');
    expect(enHomeHtml).toContain('Add entry');
    expect(enHomeHtml).toContain('Oct 2026');
    expect(enHomeHtml).not.toContain(' · Oct</span>');
    expect(enHomeHtml).toContain('aria-label="Previous month"');
    expect(enHomeHtml).toContain('aria-label="Next month"');
    expect(enHomeHtml).toContain('>Sun</div>');
    expect(enHomeHtml).toContain('>Sat</div>');
    expect(enHomeHtml).toContain('aria-label="Oct 22 富士山一日遊"');

    // No zh chrome leftovers on EN Home
    for (const forbidden of [
      '旅遊手帳',
      '第 5 日／共 10 日',
      '今日 HKD',
      '17 筆',
      'JPY 原幣合計',
      '今日手札',
      '掃描收據',
      '記一筆',
      '2026年10月',
      '上個月',
      '下個月',
      '回到旅程月',
      '出發前',
      '已完成',
      '10月22日',
    ]) {
      expect(enHomeHtml).not.toContain(forbidden);
    }

    // Also verify before-trip and after-trip stamp & back-to-trip-month button in EN
    const enBeforeHtml = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(NotebookApp, {
          trip,
          trips: [trip],
          today: '2026-09-15',
          initialHash: '',
          uiLanguage: 'en',
        }),
      ),
    );
    expect(enBeforeHtml).toContain('33 days to go');
    expect(enBeforeHtml).toContain('>BEFORE</span>');

    const enAfterHtml = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(NotebookApp, {
          trip,
          trips: [trip],
          today: '2026-11-05',
          initialHash: '',
          uiLanguage: 'en',
        }),
      ),
    );
    expect(enAfterHtml).toContain('Trip complete · 10 days');
    expect(enAfterHtml).toContain('>DONE</span>');

    await i18n.changeLanguage('zh-TW');
  });
});
