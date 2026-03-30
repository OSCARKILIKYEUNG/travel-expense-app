import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

/**
 * 建立 Stripe Checkout（訂閱），並在 session.metadata 帶入 supabase_user_id，
 * 供 api/stripe-webhook.js 的 checkout.session.completed 更新 user_app_data。
 *
 * 環境變數：STRIPE_SECRET_KEY、STRIPE_PRICE_ID（price_...）、
 * VITE_SUPABASE_URL（或 SUPABASE_URL）、VITE_SUPABASE_ANON_KEY
 *
 * 請求：POST，Header Authorization: Bearer <Supabase access_token>
 */
function resolveAppOrigin(req) {
  const origin = req.headers.origin;
  if (origin && /^https:\/\//i.test(origin)) return origin.replace(/\/$/, '');
  if (origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return origin.replace(/\/$/, '');
  }
  const pub = process.env.PUBLIC_APP_URL;
  if (pub) return pub.replace(/\/$/, '');
  const v = process.env.VERCEL_URL;
  if (v) return `https://${v.replace(/\/$/, '')}`;
  return 'http://localhost:3000';
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'Missing Authorization Bearer token' }));
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;

  if (!supabaseUrl || !anonKey) {
    res.statusCode = 503;
    return res.end(
      JSON.stringify({
        error: 'Server missing SUPABASE_URL (or VITE_SUPABASE_URL) or VITE_SUPABASE_ANON_KEY',
      }),
    );
  }

  if (!stripeSecretKey || !priceId) {
    res.statusCode = 503;
    return res.end(
      JSON.stringify({
        error: 'Server missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID',
      }),
    );
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser(token);

  if (authErr || !user) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'Invalid or expired session' }));
  }

  const base = resolveAppOrigin(req);
  const stripe = new Stripe(stripeSecretKey);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/settings?checkout=success`,
      cancel_url: `${base}/settings?checkout=cancelled`,
      metadata: { supabase_user_id: user.id },
      client_reference_id: user.id,
      customer_email: user.email || undefined,
    });

    if (!session.url) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: 'Checkout session missing url' }));
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({ url: session.url }));
  } catch (err) {
    console.error('[create-checkout-session]', err?.message || err);
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: err?.message || String(err) }));
  }
}
