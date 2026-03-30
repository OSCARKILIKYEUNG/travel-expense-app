import Stripe from 'stripe';
import { buffer } from 'node:stream/consumers';
import { createClient } from '@supabase/supabase-js';

/**
 * Stripe → Supabase：更新 `user_app_data` 訂閱欄位。
 *
 * 環境變數：STRIPE_SECRET_KEY、STRIPE_WEBHOOK_SECRET、SUPABASE_SERVICE_ROLE_KEY、
 * SUPABASE_URL 或 VITE_SUPABASE_URL
 *
 * SQL：supabase/migrations/003_stripe_billing.sql
 */

async function getRawBody(req) {
  const body = req.body;
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === 'string') return Buffer.from(body, 'utf8');

  const buf = await buffer(req);
  if (buf.length > 0) return buf;

  if (body && typeof body === 'object') {
    return Buffer.from(JSON.stringify(body), 'utf8');
  }

  return buf;
}

async function dispatchStripeEvent(stripe, supabase, event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.supabase_user_id;
      const customerId =
        typeof session.customer === 'string' ? session.customer : session.customer?.id;
      const subId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

      if (!userId || !customerId || !subId) {
        console.warn('[stripe-webhook] checkout.session.completed missing metadata/customer/subscription', {
          hasUserId: Boolean(userId),
          hasCustomerId: Boolean(customerId),
          hasSubId: Boolean(subId),
        });
        return;
      }

      const subscription = await stripe.subscriptions.retrieve(subId);
      const { error } = await supabase
        .from('user_app_data')
        .update({
          stripe_customer_id: customerId,
          stripe_subscription_id: subId,
          subscription_status: subscription.status,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
      if (!customerId) return;

      const { error } = await supabase
        .from('user_app_data')
        .update({
          stripe_subscription_id: sub.id,
          subscription_status: sub.status,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', customerId);

      if (error) throw error;
      break;
    }

    default:
      break;
  }
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!webhookSecret || !stripeSecretKey) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ error: 'Missing STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY' }));
  }

  if (!supabaseUrl || !serviceRoleKey) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL' }));
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Missing stripe-signature header' }));
  }

  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    console.error('[stripe-webhook] read body', err);
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Could not read request body' }));
  }

  console.log('[stripe-webhook] rawBody length:', rawBody.length, 'sig prefix:', sig.slice(0, 30));

  const stripe = new Stripe(stripeSecretKey);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] signature', err?.message || err);
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: `Webhook signature: ${err?.message || err}` }));
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    await dispatchStripeEvent(stripe, supabase, event);
  } catch (err) {
    console.error('[stripe-webhook] dispatch', err);
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: err?.message || String(err) }));
  }

  res.statusCode = 200;
  return res.end(JSON.stringify({ received: true }));
}
