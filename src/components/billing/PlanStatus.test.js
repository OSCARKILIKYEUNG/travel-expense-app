import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import { buildBillingSnapshot } from '../../../shared/billing.js';
import { derivePlanView } from '../../utils/planView';
import PlanStatus from './PlanStatus';

const harness = { app: null };

vi.mock('../../store/AppContext', () => ({
  useApp: () => harness.app,
}));

function renderStatus(variant, props = {}) {
  return renderToStaticMarkup(createElement(
    I18nextProvider,
    { i18n },
    createElement(PlanStatus, { variant, ...props }),
  ));
}

describe('PlanStatus', () => {
  it('loading compact and panel do not leak free-plan copy', async () => {
    await i18n.changeLanguage('zh-TW');
    harness.app = {
      planView: { state: 'loading' },
      billing: { phase: 'loading', snapshot: null, refreshing: true, error: '' },
      refreshBilling: () => {},
    };
    const compact = renderStatus('compact');
    const panel = renderStatus('panel');
    for (const html of [compact, panel]) {
      expect(html).toContain('載入中');
      expect(html).not.toContain('尚餘');
      expect(html).not.toContain('免費');
      expect(html).not.toContain('目前尚未啟用訂閱');
      expect(html).not.toContain('Pro');
    }
  });

  it('error panel shows the warning and not a free quota', async () => {
    await i18n.changeLanguage('zh-TW');
    harness.app = {
      planView: { state: 'error', error: 'offline' },
      billing: { phase: 'error', snapshot: null, refreshing: false, error: 'offline' },
      refreshBilling: () => {},
    };
    const html = renderStatus('panel');
    expect(html).toContain('方案資料暫時無法自動更新');
    expect(html).not.toContain('尚餘');
    expect(html).not.toContain('目前尚未啟用訂閱');
    expect(html).toContain('重新整理方案');
  });

  it('stale pro keeps the pro copy', async () => {
    await i18n.changeLanguage('zh-TW');
    const billing = {
      phase: 'ready',
      snapshot: buildBillingSnapshot({ subscriptionStatus: 'active', usedReceiptScans: 9 }),
      refreshing: false,
      error: 'offline',
    };
    harness.app = {
      planView: derivePlanView(billing),
      billing,
      refreshBilling: () => {},
    };
    const html = renderStatus('compact');
    expect(html).toContain('Pro');
    expect(html).toContain('AI 掃描不限次');
    // Pro is named once on the compact card (the pill), not again in the sentence.
    expect(html.match(/Pro/g)).toHaveLength(1);
    expect(html).toContain('方案資料暫時無法自動更新');
    expect(html).not.toContain('尚餘');
    expect(html).not.toContain('免費');
  });
});
