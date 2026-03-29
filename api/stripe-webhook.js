import Stripe from 'stripe';
import { buffer } from 'node:stream/consumers';
import { createClient } from '@supabase/supabase-js';

/**
 * Stripe → Supabase：更新 `user_app_data` 訂閱欄位。
 *
 * 環境變數（Vercel）：
 * - STRIPE_SECRET_KEY
 * - STRIPE_WEBHOOK_SECRET（Dashboard / Workbench 建立 destination 後的 signing secret）
 * - SUPABASE_SERVICE_ROLE_KEY（僅伺服器，勿給前端）
 * - SUPABASE_URL 或 VITE_SUPABASE_URL（專案 URL）
 *
 * 建立 Checkout 時請在 session.metadata 帶上 `supabase_user_id`（登入使用者 UUID），
 * 否則 `checkout.session.completed` 無法對應列。
 *
 * SQL：執行 `supabase/migrations/003_stripe_billing.sql`
 */
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
    return res.end(
      JSON.stringify({
        error: '伺服器未設定 STRIPE_WEBHOOK_SECRET 或 STRIPE_SECRET_KEY',
      }),
    );
  }

  if (!supabaseUrl || !serviceRoleKey) {
    res.statusCode = 503;
    return res.end(
      JSON.stringify({
        error:
          '伺服器未設定 SUPABASE_SERVICE_ROLE_KEY 與 SUPABASE_URL（或 VITE_SUPABASE_URL）',
      }),
    );
  }

  const stripe = new Stripe(stripeSecretKey);

  let event;
  try {
    const rawBody = await buffer(req);
    const sig = req.headers['stripe-signature'];
    if (!sig) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Missing stripe-signature header' }));
    }
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
        console.warn('[stripe-webhook] checkout.session.completed 缺少 metadata 或 customer/subscription', {
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
