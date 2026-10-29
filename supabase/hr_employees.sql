-- HR Portal — Master Data Karyawan
-- Jalankan di Supabase SQL Editor.

create table if not exists public.hr_employees (
  id uuid primary key default gen_random_uuid(),
  nip text not null unique,
  nama text not null,
  email text,
  no_hp text,
  jabatan text,
  departemen text,
  tanggal_masuk date,
  status text default 'Tetap',
  created_at timestamptz not null default now()
);

create index if not exists hr_employees_nip_idx on public.hr_employees (nip);
create index if not exists hr_employees_nama_idx on public.hr_employees (nama);
create index if not exists hr_employees_departemen_idx on public.hr_employees (departemen);

alter table public.hr_employees enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hr_employees'
      and policyname = 'Allow all access'
  ) then
    create policy "Allow all access"
      on public.hr_employees
      for all
      using (true)
      with check (true);
  end if;
end $$;
