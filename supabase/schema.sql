-- Shared follow-up records for the static GitHub Pages app.
-- Anonymous visitors can submit records. Only authenticated staff can read,
-- update, or delete records.

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

-- Preserve a submission timestamp for older tables as well as new records.
alter table public.followup_records
  add column if not exists created_at timestamptz not null default now();
alter table public.followup_records
  alter column created_at set default now();
update public.followup_records
  set created_at = now()
  where created_at is null;
alter table public.followup_records
  alter column created_at set not null;

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
revoke all privileges on table public.followup_records from public, anon, authenticated;
grant insert on public.followup_records to anon;
grant select, insert, update, delete on public.followup_records to authenticated;

-- Remove legacy policies, including any permissive policy left by an older setup.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'followup_records'
  loop
    execute format('drop policy if exists %I on public.followup_records', existing_policy.policyname);
  end loop;
end $$;

create policy "Public can add follow-up records"
  on public.followup_records for insert to anon with check (true);
create policy "Authenticated staff can read follow-up records"
  on public.followup_records for select to authenticated using (auth.uid() is not null);
create policy "Authenticated staff can add follow-up records"
  on public.followup_records for insert to authenticated with check (auth.uid() is not null);
create policy "Authenticated staff can update follow-up records"
  on public.followup_records for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated staff can delete follow-up records"
  on public.followup_records for delete to authenticated using (auth.uid() is not null);

