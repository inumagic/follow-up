-- Shared follow-up records for the static GitHub Pages app.
-- Run this in Supabase SQL Editor after creating a project.

create table if not exists public.followup_records (
  id uuid primary key default gen_random_uuid(),
  legacy_id text unique,
  patient_name text not null,
  birth_date date not null,
  phone text not null,
  visit_date date not null,
  visit_content text not null default '',
  today_treatments text[] not null default '{}',
  treatments text[] not null default '{}',
  interval_days integer not null check (interval_days between 1 and 1095),
  due_date date not null,
  due_time time,
  assistant text not null,
  status text not null default '待聯絡' check (status in ('待聯絡', '已聯絡', '已預約')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.followup_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.followup_records enable row level security;
alter table public.followup_staff enable row level security;

revoke all on public.followup_records from anon;
revoke all on public.followup_staff from anon;
grant select, insert, update on public.followup_records to authenticated;
grant select on public.followup_staff to authenticated;

drop policy if exists "Staff can read own membership" on public.followup_staff;
create policy "Staff can read own membership"
  on public.followup_staff for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Staff can read follow-up records" on public.followup_records;
create policy "Staff can read follow-up records"
  on public.followup_records for select to authenticated
  using (exists (
    select 1 from public.followup_staff where user_id = auth.uid()
  ));

drop policy if exists "Staff can add follow-up records" on public.followup_records;
create policy "Staff can add follow-up records"
  on public.followup_records for insert to authenticated
  with check (
    auth.uid() = created_by and exists (
      select 1 from public.followup_staff where user_id = auth.uid()
    )
  );

drop policy if exists "Staff can update follow-up records" on public.followup_records;
create policy "Staff can update follow-up records"
  on public.followup_records for update to authenticated
  using (exists (
    select 1 from public.followup_staff where user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.followup_staff where user_id = auth.uid()
  ));

