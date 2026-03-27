-- 旅遊記帳：每使用者一列，JSON 與現有 DataService 結構一致（trips_data / app_settings / people_list）
-- 在 Supabase SQL Editor 執行此檔，或於 CLI 連結專案後 supabase db push

create table if not exists public.user_app_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  trips_data jsonb not null default '{"trips":[],"currentTripId":null}'::jsonb,
  app_settings jsonb not null default '{}'::jsonb,
  people_list jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_app_data enable row level security;

create policy "user_app_data_select_own"
  on public.user_app_data for select
  using (auth.uid() = user_id);

create policy "user_app_data_insert_own"
  on public.user_app_data for insert
  with check (auth.uid() = user_id);

create policy "user_app_data_update_own"
  on public.user_app_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_app_data_delete_own"
  on public.user_app_data for delete
  using (auth.uid() = user_id);
