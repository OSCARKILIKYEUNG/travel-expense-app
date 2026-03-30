import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

/**
 * Stripe → Supabase：更新 `user_app_data` 訂閱欄位。
 *
 * 使用 `export async function POST(request)` + `request.text()` 取得 **raw body**，
 * 避免 Vercel Node helpers 先解析 JSON 導致簽章驗證失敗（Recent deliveries 全 Failed）。
 *
 * 環境變數（Vercel）：
 * - STRIPE_SECRET_KEY
 * - STRIPE_WEBHOOK_SECRET
 * - SUPABASE_SERVICE_ROLE_KEY
 * - SUPABASE_URL 或 VITE_SUPABASE_URL
 *
 * SQL：supabase/migrations/003_stripe_billing.sql
 */

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

export async function POST(request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!webhookSecret || !stripeSecretKey) {
    return Response.json(
      { error: '伺服器未設定 STRIPE_WEBHOOK_SECRET 或 STRIPE_SECRET_KEY' },
      { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    );
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      {
        error: '伺服器未設定 SUPABASE_SERVICE_ROLE_KEY 與 SUPABASE_URL（或 VITE_SUPABASE_URL）',
      },
      { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    );
  }

  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    return Response.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let rawBody;
  try {
    rawBody = await request.text();
  } catch (err) {
    console.error('[stripe-webhook] read body', err);
    return Response.json({ error: 'Could not read body' }, { status: 400 });
  }

  const stripe = new Stripe(stripeSecretKey);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] signature', err?.message || err);
    return Response.json(
      { error: `Webhook signature: ${err?.message || err}` },
      { status: 400, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    await dispatchStripeEvent(stripe, supabase, event);
  } catch (err) {
    console.error('[stripe-webhook] dispatch', err);
    return Response.json(
      { error: err?.message || String(err) },
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    );
  }

  return Response.json({ received: true }, { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
