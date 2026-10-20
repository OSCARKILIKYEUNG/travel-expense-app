import { describe, it, expect } from 'vitest';
import { FREE_RECEIPT_SCAN_LIMIT, buildBillingSnapshot } from '../../shared/billing.js';
import { billingReducer, initialBillingState } from './billingState';
import { derivePlanView, isUploadBlocked } from './planView';

const proSnapshot = buildBillingSnapshot({
  subscriptionStatus: 'active',
  usedReceiptScans: 9,
});

describe('derivePlanView', () => {
  it('loading has no free-plan numbers to leak', () => {
    const view = derivePlanView({
      phase: 'loading',
      snapshot: null,
      refreshing: true,
      error: '',
      remainingFreeScans: FREE_RECEIPT_SCAN_LIMIT,
      usedReceiptScans: 0,
      freeScanLimit: FREE_RECEIPT_SCAN_LIMIT,
      plan: 'free',
      hasUnlimitedScans: false,
    });
    expect(view).toEqual({ state: 'loading' });
    expect(view).not.toHaveProperty('remainingFreeScans');
    expect(JSON.stringify(view)).not.toContain(String(FREE_RECEIPT_SCAN_LIMIT));
  });

  it('error with no snapshot does not fall back to free', () => {
    const view = derivePlanView({
      phase: 'error',
      snapshot: null,
      refreshing: false,
      error: 'network down',
    });
    expect(view).toEqual({ state: 'error', error: 'network down' });
    expect(view).not.toHaveProperty('remainingFreeScans');
  });

  it('keeps a previous pro snapshot while a refresh is in flight', () => {
    const view = derivePlanView({
      phase: 'ready',
      snapshot: proSnapshot,
      refreshing: true,
      error: '',
    });
    expect(view).toEqual({
      state: 'pro',
      subscriptionStatus: 'active',
      stale: true,
    });
  });

  it('keeps a previous pro snapshot when the refresh fails', () => {
    const view = derivePlanView({
      phase: 'ready',
      snapshot: proSnapshot,
      refreshing: false,
      error: 'billing failed',
    });
    expect(view).toEqual({
      state: 'pro',
      subscriptionStatus: 'active',
      stale: true,
    });
    expect(view).not.toHaveProperty('remainingFreeScans');
  });

  it('describes a settled free plan with remaining scans', () => {
    const view = derivePlanView({
      phase: 'ready',
      snapshot: buildBillingSnapshot({ usedReceiptScans: 2 }),
      refreshing: false,
      error: '',
    });
    expect(view).toEqual({
      state: 'free',
      remainingFreeScans: FREE_RECEIPT_SCAN_LIMIT - 2,
      usedReceiptScans: 2,
      freeScanLimit: FREE_RECEIPT_SCAN_LIMIT,
      subscriptionStatus: null,
      stale: false,
    });
  });
});

describe('isUploadBlocked', () => {
  it('blocks only a settled free plan with nothing left', () => {
    expect(isUploadBlocked({ state: 'free', remainingFreeScans: 0, stale: false })).toBe(true);
    expect(isUploadBlocked({ state: 'free', remainingFreeScans: 0, stale: true })).toBe(true);
    expect(isUploadBlocked({ state: 'free', remainingFreeScans: 1, stale: false })).toBe(false);
    expect(isUploadBlocked({ state: 'pro', subscriptionStatus: 'active', stale: true })).toBe(false);
    expect(isUploadBlocked({ state: 'loading' })).toBe(false);
    expect(isUploadBlocked({ state: 'error', error: 'nope' })).toBe(false);
    expect(isUploadBlocked(null)).toBe(false);
  });
});

describe('billingReducer request order', () => {
  it('ignores an older success after a newer upload snapshot', () => {
    let state = billingReducer(initialBillingState, { type: 'start', requestId: 1 });
    state = billingReducer(state, { type: 'apply', requestId: 2, snapshot: proSnapshot });
    state = billingReducer(state, {
      type: 'success',
      requestId: 1,
      snapshot: buildBillingSnapshot({ usedReceiptScans: 1 }),
    });
    expect(state.requestId).toBe(2);
    expect(state.phase).toBe('ready');
    expect(state.snapshot).toBe(proSnapshot);
    expect(derivePlanView(state)).toEqual({
      state: 'pro',
      subscriptionStatus: 'active',
      stale: false,
    });
  });

  it('ignores an older failure while a newer refresh is still in flight', () => {
    let state = billingReducer(initialBillingState, {
      type: 'success',
      requestId: 1,
      snapshot: proSnapshot,
    });
    state = billingReducer(state, { type: 'start', requestId: 2 });
    expect(derivePlanView(state)).toMatchObject({ state: 'pro', stale: true });
    const ignored = billingReducer(state, { type: 'failure', requestId: 1, error: 'late' });
    expect(ignored).toBe(state);
    expect(ignored.refreshing).toBe(true);
    expect(ignored.error).toBe('');
  });

  it('failure with a snapshot stays ready and stale; failure without one is error', () => {
    let ready = billingReducer(initialBillingState, {
      type: 'success',
      requestId: 1,
      snapshot: proSnapshot,
    });
    ready = billingReducer(ready, { type: 'start', requestId: 2 });
    ready = billingReducer(ready, { type: 'failure', requestId: 2, error: 'offline' });
    expect(ready.phase).toBe('ready');
    expect(ready.snapshot).toBe(proSnapshot);
    expect(ready.refreshing).toBe(false);
    expect(derivePlanView(ready)).toEqual({
      state: 'pro',
      subscriptionStatus: 'active',
      stale: true,
    });

    let empty = billingReducer(initialBillingState, { type: 'start', requestId: 1 });
    empty = billingReducer(empty, { type: 'failure', requestId: 1, error: 'offline' });
    expect(empty.phase).toBe('error');
    expect(empty.snapshot).toBeNull();
    expect(derivePlanView(empty)).toEqual({ state: 'error', error: 'offline' });
    expect(derivePlanView(empty)).not.toHaveProperty('remainingFreeScans');
  });
});
