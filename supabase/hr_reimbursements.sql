-- HR Portal — Modul Klaim & Reimbursement
-- Jalankan di Supabase SQL Editor setelah hr_payroll_extended.sql.
--
-- 1) Tabel klaim hr_reimbursements
-- 2) Integrasi payroll: kolom reimbursement (klaim Approved)
--    pada hr_payroll, ikut terhitung dalam total_terima (THP)
-- 3) Bucket Storage publik untuk lampiran nota/file

create table if not exists public.hr_reimbursements (
  id uuid primary key default gen_random_uuid(),
  nip text not null,
  kategori text not null,
  nominal numeric not null default 0,
  keterangan text,
  bukti_url text,
  status text not null default 'Pending',
  tanggal_pengajuan date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists hr_reimbursements_nip_idx
  on public.hr_reimbursements (nip);
create index if not exists hr_reimbursements_status_idx
  on public.hr_reimbursements (status);
create index if not exists hr_reimbursements_tanggal_idx
  on public.hr_reimbursements (tanggal_pengajuan);

alter table public.hr_reimbursements enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hr_reimbursements'
      and policyname = 'Allow all access'
  ) then
    create policy "Allow all access"
      on public.hr_reimbursements
      for all
      using (true)
      with check (true);
  end if;
end $$;

-- Integrasi THP: klaim Approved masuk kalkulasi payroll
alter table public.hr_payroll
  add column if not exists reimbursement numeric not null default 0;

-- Bucket lampiran (publik untuk tautan "Lihat Bukti")
insert into storage.buckets (id, name, public)
values ('reimbursement-bukti', 'reimbursement-bukti', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow all access reimbursement bukti'
  ) then
    create policy "Allow all access reimbursement bukti"
      on storage.objects
      for all
      using (bucket_id = 'reimbursement-bukti')
      with check (bucket_id = 'reimbursement-bukti');
  end if;
end $$;
