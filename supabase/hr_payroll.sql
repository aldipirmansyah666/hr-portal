-- HR Portal — Modul Payroll / Penggajian Sederhana
-- Jalankan di Supabase SQL Editor.

create table if not exists public.hr_payroll (
  id uuid primary key default gen_random_uuid(),
  nip text not null,
  gaji_pokok numeric not null default 0,
  tunjangan numeric not null default 0,
  potongan_alpa numeric not null default 0,
  total_gaji numeric not null default 0,
  bulan text not null,
  status_pembayaran text not null default 'Belum Dibayar'
    check (status_pembayaran in ('Belum Dibayar', 'Lunas')),
  created_at timestamptz not null default now(),
  unique (nip, bulan)
);

create index if not exists hr_payroll_bulan_idx on public.hr_payroll (bulan);
create index if not exists hr_payroll_nip_idx on public.hr_payroll (nip);

alter table public.hr_payroll enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hr_payroll'
      and policyname = 'Allow all access'
  ) then
    create policy "Allow all access"
      on public.hr_payroll
      for all
      using (true)
      with check (true);
  end if;
end $$;
