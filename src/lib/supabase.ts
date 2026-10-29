import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Employee = {
  id: string;
  nip: string;
  nama: string;
  email: string | null;
  no_hp: string | null;
  jabatan: string | null;
  departemen: string | null;
  tanggal_masuk: string | null;
  status: string | null;
  created_at?: string;
};

export type LeaveRequest = {
  id: string;
  nip: string;
  jenis_cuti: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  jumlah_hari: number;
  alasan: string | null;
  status: "Pending" | "Approved" | "Rejected";
  created_at?: string;
};

export type PayrollRow = {
  id: string;
  nip: string;
  gaji_pokok: number;
  tunjangan_jabatan: number;
  tunjangan_makan_transport: number;
  potongan_absensi: number;
  potongan_bpjs: number;
  reimbursement: number;
  total_terima: number;
  bulan: string;
  status_pembayaran: "Belum Dibayar" | "Lunas";
  created_at?: string;
};

export type ReimbursementStatus = "Pending" | "Approved" | "Rejected";

export type Reimbursement = {
  id: string;
  nip: string;
  kategori: string;
  nominal: number;
  keterangan: string | null;
  bukti_url: string | null;
  status: ReimbursementStatus;
  tanggal_pengajuan: string;
  created_at?: string;
};

export type SalaryComponent = {
  id: string;
  nip: string;
  gaji_pokok: number;
  tunjangan_jabatan: number;
  uang_makan_harian: number;
  tunjangan_transport: number;
  created_at?: string;
};
