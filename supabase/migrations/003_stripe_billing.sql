-- Stripe 訂閱狀態（Webhook 用 service role 更新；RLS 仍保護一般客戶端讀寫）
alter table public.user_app_data
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text;

create index if not exists user_app_data_stripe_customer_id_idx
  on public.user_app_data (stripe_customer_id)
  where stripe_customer_id is not null;

comment on column public.user_app_data.stripe_customer_id is 'Stripe Customer id (cus_...)';
comment on column public.user_app_data.stripe_subscription_id is 'Stripe Subscription id (sub_...)';
comment on column public.user_app_data.subscription_status is 'Stripe subscription.status e.g. active, canceled, past_due';
