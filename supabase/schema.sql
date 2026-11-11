-- Shared follow-up records for the static GitHub Pages app.
-- Anonymous visitors can read, insert, and update every record.

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
  status text not null default '待聯絡',
  created_at timestamptz not null default now()
);

-- Keep the status values in sync with app.js, including databases created by
-- an earlier version of this schema. CREATE TABLE IF NOT EXISTS does not
-- update constraints on an existing table.
alter table public.followup_records
  alter column status set default '待聯絡';
alter table public.followup_records
  drop constraint if exists followup_records_status_check;
update public.followup_records
  set status = '待聯絡'
  where status not in ('待聯絡', '已聯絡', '已預約');
alter table public.followup_records
  add constraint followup_records_status_check
  check (status in ('待聯絡', '已聯絡', '已預約'));

-- Allow inserts into databases that still have the legacy ownership column.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'followup_records' and column_name = 'created_by'
  ) then
    alter table public.followup_records alter column created_by drop not null;
  end if;
end $$;

alter table public.followup_records enable row level security;
grant select, insert, update on public.followup_records to anon;
revoke all on public.followup_records from authenticated;

drop policy if exists "Staff can read follow-up records" on public.followup_records;
drop policy if exists "Staff can add follow-up records" on public.followup_records;
drop policy if exists "Staff can update follow-up records" on public.followup_records;
drop policy if exists "Public can read follow-up records" on public.followup_records;
drop policy if exists "Public can add follow-up records" on public.followup_records;
drop policy if exists "Public can update follow-up records" on public.followup_records;

create policy "Public can read follow-up records"
  on public.followup_records for select to anon using (true);
create policy "Public can add follow-up records"
  on public.followup_records for insert to anon with check (true);
create policy "Public can update follow-up records"
  on public.followup_records for update to anon using (true) with check (true);
