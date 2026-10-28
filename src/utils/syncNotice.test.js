import { describe, expect, it } from 'vitest';
import { createSyncToastLimiter, syncErrorText } from './syncNotice';

describe('createSyncToastLimiter', () => {
  it('shows the first toast, then suppresses repeats inside the window', () => {
    let t = 1_000;
    const lim = createSyncToastLimiter({ minIntervalMs: 30_000, now: () => t });
    expect(lim.allow('save')).toBe(true);
    t += 500;
    expect(lim.allow('save')).toBe(false);
    t += 29_000;
    expect(lim.allow('save')).toBe(false);
    t += 600;
    expect(lim.allow('save')).toBe(true);
  });

  it('limits each kind separately', () => {
    const lim = createSyncToastLimiter({ minIntervalMs: 30_000, now: () => 5 });
    expect(lim.allow('save')).toBe(true);
    expect(lim.allow('load')).toBe(true);
    expect(lim.allow('save')).toBe(false);
  });

  it('reset lets the next failure show at once', () => {
    const lim = createSyncToastLimiter({ minIntervalMs: 30_000, now: () => 5 });
    lim.allow('save');
    lim.reset('save');
    expect(lim.allow('save')).toBe(true);
  });
});

describe('syncErrorText', () => {
  it('prefers message, trims length, never stringifies objects', () => {
    expect(syncErrorText(new Error('Failed to fetch'))).toBe('Failed to fetch');
    expect(syncErrorText({ error_description: 'JWT expired' })).toBe('JWT expired');
    expect(syncErrorText({ code: '42501' })).toBe('');
    expect(syncErrorText('x'.repeat(300))).toHaveLength(160);
    expect(syncErrorText(null)).toBe('');
  });
});
