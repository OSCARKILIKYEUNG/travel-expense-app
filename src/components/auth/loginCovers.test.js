import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOGIN_COVER_HEADLINE,
  LOGIN_COVER_HEADLINE_MODES,
  LOGIN_COVERS,
  findLoginCover,
  pickLoginCover,
} from './loginCovers';

describe('loginCovers catalog and helpers', () => {
  it('defines 4 oil-painting covers with unique ids, uppercase cities, non-empty src and alt', () => {
    expect(LOGIN_COVERS).toHaveLength(4);
    const ids = LOGIN_COVERS.map((c) => c.id);
    expect(ids).toEqual(['tokyo', 'osaka', 'kyoto', 'kamakura']);
    expect(new Set(ids).size).toBe(4);

    for (const cover of LOGIN_COVERS) {
      expect(cover.city).toBe(cover.id.toUpperCase());
      expect(typeof cover.src).toBe('string');
      expect(cover.src.length).toBeGreaterThan(0);
      expect(typeof cover.alt).toBe('string');
      expect(cover.alt.length).toBeGreaterThan(10);
    }

    expect(LOGIN_COVER_HEADLINE_MODES).toEqual(['html', 'painted']);
    expect(DEFAULT_LOGIN_COVER_HEADLINE).toBe('painted');
  });

  it('picks a cover deterministically across uniform buckets including edge 0 and 0.9999', () => {
    expect(pickLoginCover(() => 0).id).toBe('tokyo');
    expect(pickLoginCover(() => 0.2499).id).toBe('tokyo');
    expect(pickLoginCover(() => 0.25).id).toBe('osaka');
    expect(pickLoginCover(() => 0.4999).id).toBe('osaka');
    expect(pickLoginCover(() => 0.5).id).toBe('kyoto');
    expect(pickLoginCover(() => 0.7499).id).toBe('kyoto');
    expect(pickLoginCover(() => 0.75).id).toBe('kamakura');
    expect(pickLoginCover(() => 0.9999).id).toBe('kamakura');

    // Out-of-bounds / non-finite defensive clamping
    expect(pickLoginCover(() => -0.5).id).toBe('tokyo');
    expect(pickLoginCover(() => 1).id).toBe('kamakura');
    expect(pickLoginCover(() => Number.NaN).id).toBe('tokyo');
  });

  it('finds a cover by id (case-insensitive) and returns null for unknown or empty ids', () => {
    expect(findLoginCover('tokyo')).toBe(LOGIN_COVERS[0]);
    expect(findLoginCover('OSAKA')).toBe(LOGIN_COVERS[1]);
    expect(findLoginCover('  Kyoto  ')).toBe(LOGIN_COVERS[2]);
    expect(findLoginCover('kamakura')).toBe(LOGIN_COVERS[3]);
    expect(findLoginCover('none')).toBeNull();
    expect(findLoginCover('sapporo')).toBeNull();
    expect(findLoginCover('')).toBeNull();
    expect(findLoginCover(null)).toBeNull();
    expect(findLoginCover(undefined)).toBeNull();
  });
});
