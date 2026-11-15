import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOGIN_COVER_ID,
  LOGIN_COVER_IDS,
} from '../../utils/loginCoverPreference';
import {
  DEFAULT_LOGIN_COVER_HEADLINE,
  LOGIN_COVER_CREDITS_HREF,
  LOGIN_COVER_HEADLINE_MODES,
  LOGIN_COVERS,
  findLoginCover,
  pickLoginCover,
  resolveLoginCover,
  resolveMountedLoginCover,
} from './loginCovers';

const DELIVERY = {
  tokyo: {
    sha256: 'f86d39b993bac622d80490b9250a21f308a5e1303564b1681bf08e7fb6a8815d',
    bytes: 96716,
  },
  osaka: {
    sha256: '1d9ab10cd99dc2e41adccb1a658f5b2302adc41390366287462e3fc70e92e26b',
    bytes: 169616,
  },
  kyoto: {
    sha256: 'bf93431d905f1fae2ebbc59e2d993b3955b8dad618812ec49d5c9b003238dac4',
    bytes: 121736,
  },
  kyushu: {
    sha256: '8522f15b659f1a821dc53848ba9cdbac0ff0fa0b78ad37c1919fc5ecde5013ea',
    bytes: 94630,
  },
};

function readWebpSize(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('not webp');
  }
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const tag = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (tag === 'VP8 ') {
      const sigAt = data + 3;
      if (buf[sigAt] !== 0x9d || buf[sigAt + 1] !== 0x01 || buf[sigAt + 2] !== 0x2a) {
        throw new Error('missing vp8 start code');
      }
      return {
        width: buf.readUInt16LE(sigAt + 3) & 0x3fff,
        height: buf.readUInt16LE(sigAt + 5) & 0x3fff,
      };
    }
    offset = data + size + (size & 1);
  }
  throw new Error('no dimension chunk');
}

describe('loginCovers scenic catalog', () => {
  it('lists exactly TOKYO OSAKA KYOTO KYUSHU and matches the id allowlist', () => {
    expect(LOGIN_COVERS.map((cover) => cover.id)).toEqual([...LOGIN_COVER_IDS]);
    expect(LOGIN_COVERS.map((cover) => cover.id)).not.toContain('kamakura');
    expect(DEFAULT_LOGIN_COVER_ID).toBe('tokyo');
    expect(new Set(LOGIN_COVERS.map((cover) => cover.id)).size).toBe(4);

    for (const cover of LOGIN_COVERS) {
      expect(cover.city).toBe(cover.id.toUpperCase());
      expect(cover.variant).toBe('scenic-ink');
      expect(cover.width).toBe(720);
      expect(cover.height).toBe(960);
      expect(typeof cover.src).toBe('string');
      expect(cover.src).toContain(`default-${cover.id}`);
      expect(cover.alt.length).toBeGreaterThan(10);
      expect(cover).not.toHaveProperty('price');
      expect(JSON.stringify(cover)).not.toMatch(/stripe|checkout|entitlement/i);
    }

    expect(LOGIN_COVER_HEADLINE_MODES).toEqual(['html', 'painted']);
    expect(DEFAULT_LOGIN_COVER_HEADLINE).toBe('painted');
    expect(LOGIN_COVER_CREDITS_HREF).toBe('/login-cover-credits.html');

    const source = readFileSync(path.resolve('src/components/auth/loginCovers.js'), 'utf8');
    expect(source).not.toContain('kamakura.webp');
    expect(source).toContain('default-kyushu.webp');
  });

  it('keeps the prepared 720x960 delivery bytes and leaves the old oil files in place', () => {
    for (const id of LOGIN_COVER_IDS) {
      const file = path.resolve('src/assets/login-covers', `default-${id}.webp`);
      const buf = readFileSync(file);
      expect(buf.length).toBe(DELIVERY[id].bytes);
      expect(createHash('sha256').update(buf).digest('hex')).toBe(DELIVERY[id].sha256);
      expect(readWebpSize(buf)).toEqual({ width: 720, height: 960 });
    }
    for (const name of ['tokyo.webp', 'osaka.webp', 'kyoto.webp', 'kamakura.webp']) {
      expect(readFileSync(path.resolve('src/assets/login-covers', name)).length).toBeGreaterThan(0);
    }
  });

  it('resolves a saved id over the legacy bucket helper, and falls back to TOKYO', () => {
    expect(pickLoginCover(() => 0).id).toBe('tokyo');
    expect(pickLoginCover(() => 0.2499).id).toBe('tokyo');
    expect(pickLoginCover(() => 0.25).id).toBe('osaka');
    expect(pickLoginCover(() => 0.4999).id).toBe('osaka');
    expect(pickLoginCover(() => 0.5).id).toBe('kyoto');
    expect(pickLoginCover(() => 0.7499).id).toBe('kyoto');
    expect(pickLoginCover(() => 0.75).id).toBe('kyushu');
    expect(pickLoginCover(() => 0.9999).id).toBe('kyushu');
    expect(pickLoginCover(() => -0.5).id).toBe('tokyo');
    expect(pickLoginCover(() => 1).id).toBe('kyushu');
    expect(pickLoginCover(() => Number.NaN).id).toBe('tokyo');

    expect(findLoginCover('tokyo')).toBe(LOGIN_COVERS[0]);
    expect(findLoginCover('OSAKA')).toBe(LOGIN_COVERS[1]);
    expect(findLoginCover('  Kyoto  ')).toBe(LOGIN_COVERS[2]);
    expect(findLoginCover('kyushu')).toBe(LOGIN_COVERS[3]);
    expect(findLoginCover('kamakura')).toBeNull();
    expect(findLoginCover('none')).toBeNull();
    expect(findLoginCover('')).toBeNull();
    expect(findLoginCover(null)).toBeNull();

    const selected = resolveLoginCover('osaka');
    expect(selected.id).toBe('osaka');
    expect(selected.id).not.toBe(pickLoginCover(() => 0).id);
    expect(resolveLoginCover('kamakura').id).toBe('tokyo');
    expect(resolveLoginCover('https://example.invalid/cover.webp').id).toBe('tokyo');
    expect(resolveLoginCover(undefined).id).toBe('tokyo');
    expect(resolveMountedLoginCover(() => 'kyushu').id).toBe('kyushu');
    expect(resolveMountedLoginCover(() => {
      throw new Error('storage denied');
    }).id).toBe('tokyo');
  });

  it('publishes real photo authors, license links, share-alike terms, and an AI notice', () => {
    const files = [
      path.resolve('src/assets/login-covers/CREDITS.md'),
      path.resolve('public/login-cover-credits.html'),
    ];
    const required = [
      'Eckhard Pecher',
      'Tom Purves',
      'Basile Morin',
      'Project Kei / Keita.Honda',
      'https://commons.wikimedia.org/wiki/File:Tokyo_Tower_20060211.JPG',
      'https://creativecommons.org/licenses/by/2.5/',
      'https://commons.wikimedia.org/wiki/File:Osaka_castle_and_cherry_blossoms_2006.jpg',
      'https://creativecommons.org/licenses/by/2.0/',
      'https://commons.wikimedia.org/wiki/File:Yasaka-dori_early_morning_with_street_lanterns_and_the_Tower_of_Yasaka_%28Hokan-ji_Temple%29%2C_Kyoto%2C_Japan.jpg',
      'https://creativecommons.org/licenses/by-sa/4.0/',
      'https://commons.wikimedia.org/wiki/File:Kusasenrigahama_in_Aso_City_2007_0811_01.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/e/e4/Kusasenrigahama_in_Aso_City_2007_0811_01.jpg',
      'CC BY-SA 4.0',
      'AI transformation does not remove',
      'not claimed as proprietary',
    ];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const snippet of required) {
        expect(text, file).toContain(snippet);
      }
      expect(text.toLowerCase()).not.toContain('all rights reserved');
    }
  });
});
