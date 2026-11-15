import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LOGIN_COVER_ID,
  DEVICE_LOGIN_COVER_KEY,
  LOGIN_COVER_IDS,
  normalizeLoginCoverId,
  readDeviceLoginCoverId,
  writeDeviceLoginCoverId,
} from './loginCoverPreference';

function memoryStorage() {
  const bag = new Map();
  return {
    getItem: (key) => (bag.has(key) ? bag.get(key) : null),
    setItem: (key, value) => bag.set(key, String(value)),
    removeItem: (key) => bag.delete(key),
    dump: () => Object.fromEntries(bag.entries()),
  };
}

describe('normalizeLoginCoverId', () => {
  it('accepts only the four public ids and defaults everything else to tokyo', () => {
    expect(LOGIN_COVER_IDS).toEqual(['tokyo', 'osaka', 'kyoto', 'kyushu']);
    expect(DEFAULT_LOGIN_COVER_ID).toBe('tokyo');
    expect(normalizeLoginCoverId('tokyo')).toBe('tokyo');
    expect(normalizeLoginCoverId(' OSAKA ')).toBe('osaka');
    expect(normalizeLoginCoverId('Kyoto')).toBe('kyoto');
    expect(normalizeLoginCoverId('kyushu')).toBe('kyushu');
    for (const value of [undefined, null, '', 'kamakura', 'tokyo,osaka', 1, { id: 'osaka' }, 'https://cdn.example/osaka.webp', 'user-123']) {
      expect(normalizeLoginCoverId(value)).toBe('tokyo');
    }
  });
});

describe('device login cover mirror', () => {
  let storage;

  beforeEach(() => {
    storage = memoryStorage();
  });

  it('stores only the enum and survives a reload of that storage', () => {
    expect(writeDeviceLoginCoverId(' KYUSHU ', storage)).toBe('kyushu');
    expect(storage.dump()).toEqual({ [DEVICE_LOGIN_COVER_KEY]: 'kyushu' });
    expect(readDeviceLoginCoverId(storage)).toBe('kyushu');
    expect(JSON.stringify(storage.dump())).not.toMatch(/http|token|user-|webp|eyJ/i);
  });

  it('drops unknown, missing, and url values to tokyo without throwing', () => {
    expect(readDeviceLoginCoverId(storage)).toBe('tokyo');
    storage.setItem(DEVICE_LOGIN_COVER_KEY, 'kamakura');
    expect(readDeviceLoginCoverId(storage)).toBe('tokyo');
    expect(storage.getItem(DEVICE_LOGIN_COVER_KEY)).toBe('kamakura');
    expect(writeDeviceLoginCoverId('https://evil.example/a.webp?user=abc', storage)).toBe('tokyo');
    expect(storage.getItem(DEVICE_LOGIN_COVER_KEY)).toBe('tokyo');
  });

  it('ignores storage failures', () => {
    const denied = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(readDeviceLoginCoverId(denied)).toBe('tokyo');
    expect(writeDeviceLoginCoverId('osaka', denied)).toBe('osaka');
    expect(readDeviceLoginCoverId(null)).toBe('tokyo');
    expect(writeDeviceLoginCoverId('kyoto', null)).toBe('kyoto');
  });

  it('uses the page localStorage when no store is passed', () => {
    const bag = memoryStorage();
    vi.stubGlobal('localStorage', bag);
    writeDeviceLoginCoverId('osaka');
    expect(readDeviceLoginCoverId()).toBe('osaka');
    vi.unstubAllGlobals();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
