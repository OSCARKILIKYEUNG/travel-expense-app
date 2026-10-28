-- Rollback for 004_lock_billing_columns.sql. Safe to run more than once.
drop trigger if exists user_app_data_protect_billing on public.user_app_data;
drop function if exists public.user_app_data_protect_billing();
