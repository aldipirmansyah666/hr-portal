-- HR Portal — Log Absensi Harian
-- Jalankan di Supabase SQL Editor.
-- unique (nip, tanggal) WAJIB ada: dipakai oleh fitur Import Absensi
-- (upsert dengan onConflict "nip,tanggal").

create table if not exists public.hr_attendance_logs (
  id uuid primary key default gen_random_uuid(),
  nip text not null,
  tanggal date not null,
  jam_masuk time,
  jam_pulang time,
  status text not null
    check (status in ('Hadir', 'Telat', 'Cuti', 'Izin', 'Sakit', 'Alpa')),
  keterangan text,
  created_at timestamptz not null default now(),
  unique (nip, tanggal)
);

create index if not exists hr_attendance_logs_nip_idx
  on public.hr_attendance_logs (nip);
create index if not exists hr_attendance_logs_tanggal_idx
  on public.hr_attendance_logs (tanggal);
create index if not exists hr_attendance_logs_nip_tanggal_idx
  on public.hr_attendance_logs (nip, tanggal);

alter table public.hr_attendance_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'hr_attendance_logs'
      and policyname = 'Allow all access'
  ) then
    create policy "Allow all access"
      on public.hr_attendance_logs
      for all
      using (true)
      with check (true);
  end if;
end $$;
