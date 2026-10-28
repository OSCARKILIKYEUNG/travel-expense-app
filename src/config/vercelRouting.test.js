import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Vercel serves real files (dist/, api/*) before rewrites run. This test checks
// the SPA fallback rule so it never catches API routes or file-like paths, even
// when that file is missing (a missing /assets/x.js must 404, not return HTML).
const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
const spaRule = config.rewrites.find((r) => r.destination === '/index.html');
const matchesSpa = (path) => new RegExp(`^${spaRule.source}$`).test(path);

describe('vercel.json SPA fallback', () => {
  it('keeps the stripe-webhook trailing-slash rewrite first', () => {
    expect(config.rewrites[0]).toEqual({ source: '/api/stripe-webhook/', destination: '/api/stripe-webhook' });
    expect(config.functions['api/parse-receipt.js'].maxDuration).toBe(60);
  });

  it.each(['/', '/login', '/reset-password', '/add', '/settings', '/charts', '/settings/anything'])(
    'rewrites app route %s to index.html',
    (path) => expect(matchesSpa(path)).toBe(true),
  );

  it.each([
    '/api',
    '/api/parse-receipt',
    '/api/stripe-webhook',
    '/api/stripe-webhook/',
    '/assets/index-BL0xLA8J.js',
    '/assets/missing.css',
    '/sw.js',
    '/registerSW.js',
    '/workbox-3e722498.js',
    '/manifest.webmanifest',
    '/icons/icon-192.png',
    '/favicon.ico',
  ])('leaves %s alone', (path) => expect(matchesSpa(path)).toBe(false));
});
