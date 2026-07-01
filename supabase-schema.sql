-- 온기록 Supabase Auth/승인/쿼터 스키마
-- Supabase SQL Editor에서 한 번 실행하세요.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  purpose text,
  role text not null default 'user' check (role in ('user', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'blocked')),
  daily_limit integer not null default 2,
  profile_monthly_limit integer not null default 1,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id)
);

create table if not exists public.usage_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  used_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

create table if not exists public.user_data_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.device_daily_metrics (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_date date not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, record_date)
);

create index if not exists usage_logs_user_kind_used_at_idx
  on public.usage_logs (user_id, kind, used_at desc);

create index if not exists device_daily_metrics_user_date_idx
  on public.device_daily_metrics (user_id, record_date desc);

alter table public.profiles enable row level security;
alter table public.usage_logs enable row level security;
alter table public.user_data_snapshots enable row level security;
alter table public.device_daily_metrics enable row level security;

drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "profiles update own basic" on public.profiles;
create policy "profiles update own basic"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "usage read own" on public.usage_logs;
create policy "usage read own"
on public.usage_logs for select
using (auth.uid() = user_id);

drop policy if exists "snapshots read own" on public.user_data_snapshots;
create policy "snapshots read own"
on public.user_data_snapshots for select
using (auth.uid() = user_id);

drop policy if exists "snapshots upsert own" on public.user_data_snapshots;
create policy "snapshots upsert own"
on public.user_data_snapshots for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "device metrics read own" on public.device_daily_metrics;
create policy "device metrics read own"
on public.device_daily_metrics for select
using (auth.uid() = user_id);

drop policy if exists "device metrics upsert own" on public.device_daily_metrics;
create policy "device metrics upsert own"
on public.device_daily_metrics for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, purpose, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', ''),
    coalesce(new.raw_user_meta_data->>'purpose', ''),
    'user',
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 최초 관리자 지정 예시:
-- update public.profiles
-- set role = 'admin', status = 'approved', approved_at = now()
-- where email = '당신의이메일@example.com';
