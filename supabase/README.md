# Supabase Schema — HR Portal

Semua file SQL dijalankan lewat **Supabase SQL Editor**. Semua memakai
`create table if not exists` sehingga aman dijalankan berulang (tidak menimpa
tabel yang sudah ada).

## Urutan Eksekusi

1. `hr_employees.sql` — master data karyawan (referensi NIP untuk semua modul)
2. `hr_attendance_logs.sql` — log absensi harian, `unique (nip, tanggal)` wajib
   untuk fitur Import Absensi (upsert)
3. `hr_leave_requests.sql` — pengajuan cuti & izin
4. `hr_payroll.sql` — payroll, `unique (nip, bulan)` wajib untuk
   fitur Hitung & Sinkronisasi Gaji (upsert)
5. `hr_payroll_extended.sql` — Penggajian Lanjutan: master komponen gaji
   `hr_salary_components` + kolom kalkulasi di `hr_payroll`
   (`tunjangan_jabatan`, `tunjangan_makan_transport`, `potongan_absensi`,
   `potongan_bpjs`, `total_terima`/THP)
6. `hr_reimbursements.sql` — Klaim & Reimbursement: tabel
   `hr_reimbursements`, kolom `reimbursement` di `hr_payroll` (klaim Approved
   ikut THP), dan bucket Storage `reimbursement-bukti` untuk lampiran

## Catatan

- Skema direkonstruksi dari pemakaian aplikasi (type di `src/lib/supabase.ts`
  dan query di tiap halaman). Jika tabel sudah live di database, jalankan
  `create table if not exists` hanya untuk melengkapi, dan cocokkan kolom yang
  sudah ada dengan file ini.
- Kebijakan RLS: policy `Allow all access` untuk semua tabel — konsisten dengan
  pemakaian `anon key` tanpa autentikasi di aplikasi. **Ganti dengan policy
  berbasis `auth.uid()` bila aplikasi ditambahi login.`
- Kode aplikasi memakai tabel: `hr_employees`, `hr_attendance_logs`,
  `hr_leave_requests`, `hr_payroll`.
