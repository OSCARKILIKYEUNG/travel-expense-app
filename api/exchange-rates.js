/**
 * 同源代理 Frankfurter，避免瀏覽器直連 api.frankfurter.app 被 CORS／網路擋下。
 * GET /api/exchange-rates?from=HKD  → 轉發至 https://api.frankfurter.app/latest?from=HKD
 */
const FRANKFURTER_LATEST = 'https://api.frankfurter.app/latest';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }

  let from = typeof req.query?.from === 'string' ? req.query.from.trim() : '';
  if (!from && req.url) {
    try {
      const u = new URL(req.url, 'http://localhost');
      from = (u.searchParams.get('from') || '').trim();
    } catch { /* ignore */ }
  }
  if (!from || from.length !== 3) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Missing or invalid from' }));
  }

  const url = new URL(FRANKFURTER_LATEST);
  url.searchParams.set('from', from.toUpperCase());

  try {
    const r = await fetch(url.toString());
    const text = await r.text();
    res.statusCode = r.status;
    return res.end(text);
  } catch (err) {
    console.error('[exchange-rates]', err);
    res.statusCode = 502;
    return res.end(JSON.stringify({ error: err?.message || 'Upstream fetch failed' }));
  }
}
