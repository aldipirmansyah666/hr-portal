-- HR Portal — Penggajian Lanjutan (Extended Payroll)
-- Jalankan di Supabase SQL Editor setelah hr_payroll.sql.
--
-- 1) Master komponen gaji per karyawan
-- 2) Penampung komponen kalkulasi di hr_payroll
--    Kolom lama (tunjangan, potongan_alpa, total_gaji) dipertahankan untuk
--    kompatibilitas data existing; aplikasi kini menulis kolom-kolom baru di
--    bawah. Total terbaru = total_terima (Take Home Pay).

create table if not exists public.hr_salary_components (
  id uuid primary key default gen_random_uuid(),
  nip text not null unique,
  gaji_pokok numeric not null default 0,
  tunjangan_jabatan numeric not null default 0,
  uang_makan_harian numeric not null default 0,
  tunjangan_transport numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists hr_salary_components_nip_idx
  on public.hr_salary_components (nip);

alter table public.hr_salary_components enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hr_salary_components'
      and policyname = 'Allow all access'
  ) then
    create policy "Allow all access"
      on public.hr_salary_components
      for all
      using (true)
      with check (true);
  end if;
end $$;

alter table public.hr_payroll
  add column if not exists tunjangan_jabatan numeric not null default 0,
  add column if not exists tunjangan_makan_transport numeric not null default 0,
  add column if not exists potongan_absensi numeric not null default 0,
  add column if not exists potongan_bpjs numeric not null default 0,
  add column if not exists total_terima numeric not null default 0;
