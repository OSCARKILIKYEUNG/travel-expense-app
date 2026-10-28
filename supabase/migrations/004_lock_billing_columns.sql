-- 004: users may not edit the billing columns on their own user_app_data row.
-- Only the Stripe webhook (service_role) and the SQL Editor (postgres) may set them.
--
-- Why: the 001 RLS policy "user_app_data_update_own" covers every column, so a
-- signed-in client could run update({ subscription_status: 'active' }) and get
-- unlimited AI scans. App sync never sends these columns (see
-- src/services/syncSupabase.js persistUserAppData), so normal saves keep working:
-- an upsert that does not name a column leaves it unchanged.
--
-- Safe to run more than once. Rollback: supabase/rollback/004_lock_billing_columns_down.sql

create or replace function public.user_app_data_protect_billing()
returns trigger
language plpgsql
as $$
begin
  -- PostgREST runs client requests as role anon or authenticated.
  -- service_role (webhook, parse-receipt) and postgres (SQL Editor) pass through.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.subscription_status is not null
       or new.stripe_customer_id is not null
       or new.stripe_subscription_id is not null then
      raise exception 'billing columns are managed by the server'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE (including the DO UPDATE half of an upsert)
  if new.subscription_status is distinct from old.subscription_status
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_subscription_id is distinct from old.stripe_subscription_id then
    raise exception 'billing columns are managed by the server'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.user_app_data_protect_billing() is
  'Blocks anon/authenticated clients from setting subscription_status / stripe_* on user_app_data (004).';

drop trigger if exists user_app_data_protect_billing on public.user_app_data;

create trigger user_app_data_protect_billing
  before insert or update on public.user_app_data
  for each row
  execute function public.user_app_data_protect_billing();
