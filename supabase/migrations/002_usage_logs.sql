-- 掃描／用量紀錄：定價與 P50/P90 分析用；RLS 僅本人可寫入與讀取
-- 執行前請已套用 001_user_app_data.sql

create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null,
  -- 例：receipt_scan（每成功呼叫 parse-receipt 一筆）；日後可加 subscription_checkout 等
  metadata jsonb not null default '{}'::jsonb,
  -- 可選：{ "image_mime": "image/jpeg", "client_w": 1200, "files_in_batch": 3 } 勿存 base64
  created_at timestamptz not null default now()
);

create index if not exists usage_logs_user_id_created_at_idx
  on public.usage_logs (user_id, created_at desc);

create index if not exists usage_logs_event_type_idx
  on public.usage_logs (event_type, created_at desc);

comment on table public.usage_logs is '產品用量與成本分析；付費額度請另欄或聚合本表，勿僅依賴此表做強一致計費';

alter table public.usage_logs enable row level security;

create policy "usage_logs_select_own"
  on public.usage_logs for select
  using (auth.uid() = user_id);

create policy "usage_logs_insert_own"
  on public.usage_logs for insert
  with check (auth.uid() = user_id);

-- 不開放 update/delete：避免竄改用量；若需修正用 service role 後台
