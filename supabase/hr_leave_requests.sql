-- HR Portal — Modul Pengajuan Cuti & Izin
-- Jalankan di Supabase SQL Editor.

create table if not exists public.hr_leave_requests (
  id uuid primary key default gen_random_uuid(),
  nip text not null,
  jenis_cuti text not null check (jenis_cuti in ('Cuti Tahunan', 'Izin', 'Sakit')),
  tanggal_mulai date not null,
  tanggal_selesai date not null,
  jumlah_hari int not null,
  alasan text,
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected')),
  created_at timestamptz not null default now(),
  constraint chk_tanggal check (tanggal_selesai >= tanggal_mulai)
);

create index if not exists hr_leave_requests_nip_idx on public.hr_leave_requests (nip);
create index if not exists hr_leave_requests_status_idx on public.hr_leave_requests (status);
create index if not exists hr_leave_requests_created_at_idx on public.hr_leave_requests (created_at desc);

alter table public.hr_leave_requests enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hr_leave_requests'
      and policyname = 'Allow all access'
  ) then
    create policy "Allow all access"
      on public.hr_leave_requests
      for all
      using (true)
      with check (true);
  end if;
end $$;
