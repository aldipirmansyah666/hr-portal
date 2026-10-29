import * as XLSX from "xlsx";
import { monthLabel } from "./attendance";
import type { Employee, PayrollRow, SalaryComponent } from "./supabase";

export const PAYROLL_TABLE = "hr_payroll";
export const SALARY_COMPONENTS_TABLE = "hr_salary_components";
export const REIMBURSEMENT_TABLE = "hr_reimbursements";
export const REIMBURSEMENT_BUCKET = "reimbursement-bukti";

export const REIMBURSEMENT_CATEGORIES = [
  "Transport",
  "Makan",
  "ATK",
  "Kesehatan",
  "Pendidikan",
  "Lainnya",
] as const;

export type SyncConfig = {
  tarifPotonganAlpa: number;
  bpjsPercent: number;
};

export type AttendanceTally = {
  hadir: Map<string, number>;
  alpa: Map<string, number>;
  telat: Map<string, number>;
};

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatRupiah(value: number): string {
  return rupiahFormatter.format(value ?? 0);
}

export function tallyAttendance(
  logs: { nip: string; status: string | null }[]
): AttendanceTally {
  const hadir = new Map<string, number>();
  const alpa = new Map<string, number>();
  const telat = new Map<string, number>();

  for (const log of logs) {
    if (log.status === "Hadir" || log.status === "Telat") {
      hadir.set(log.nip, (hadir.get(log.nip) ?? 0) + 1);
      if (log.status === "Telat") {
        telat.set(log.nip, (telat.get(log.nip) ?? 0) + 1);
      }
    } else if (log.status === "Alpa") {
      alpa.set(log.nip, (alpa.get(log.nip) ?? 0) + 1);
    }
  }
  return { hadir, alpa, telat };
}

export type PayrollPayload = Omit<
  PayrollRow,
  "id" | "created_at" | "status_pembayaran"
>;

export function buildPayrollPayloads(
  employees: { nip: string }[],
  components: Map<string, SalaryComponent>,
  tally: AttendanceTally,
  month: string,
  config: SyncConfig,
  reimbursements: { nip: string; nominal: number }[] = []
): PayrollPayload[] {
  const reimbByNip = new Map<string, number>();
  for (const claim of reimbursements) {
    reimbByNip.set(claim.nip, (reimbByNip.get(claim.nip) ?? 0) + (claim.nominal || 0));
  }

  const payloads: PayrollPayload[] = [];

  for (const emp of employees) {
    const comp = components.get(emp.nip);
    if (!comp) continue;

    const hariHadir = tally.hadir.get(emp.nip) ?? 0;
    const hariAlpa = tally.alpa.get(emp.nip) ?? 0;
    const tarifHarian = (comp.uang_makan_harian ?? 0) + (comp.tunjangan_transport ?? 0);

    const tunjanganMakanTransport = hariHadir * tarifHarian;
    const potonganAbsensi = hariAlpa * config.tarifPotonganAlpa;
    const potonganBpjs = Math.round(
      (((comp.gaji_pokok ?? 0) + (comp.tunjangan_jabatan ?? 0)) * config.bpjsPercent) / 100
    );
    const reimbursement = reimbByNip.get(emp.nip) ?? 0;
    const totalTerima =
      (comp.gaji_pokok ?? 0) +
      (comp.tunjangan_jabatan ?? 0) +
      tunjanganMakanTransport +
      reimbursement -
      potonganAbsensi -
      potonganBpjs;

    payloads.push({
      nip: emp.nip,
      bulan: month,
      gaji_pokok: comp.gaji_pokok ?? 0,
      tunjangan_jabatan: comp.tunjangan_jabatan ?? 0,
      tunjangan_makan_transport: tunjanganMakanTransport,
      potongan_absensi: potonganAbsensi,
      potongan_bpjs: potonganBpjs,
      reimbursement,
      total_terima: totalTerima,
    });
  }

  return payloads;
}

export function sumByStatus(rows: PayrollRow[]): {
  total: number;
  paid: number;
  unpaid: number;
} {
  let total = 0;
  let paid = 0;
  let unpaid = 0;
  for (const row of rows) {
    const value = row.total_terima || 0;
    total += value;
    if (row.status_pembayaran === "Lunas") paid += value;
    else unpaid += value;
  }
  return { total, paid, unpaid };
}

export function exportPayrollToXlsx(
  rows: PayrollRow[],
  employeeMap: Map<string, { nama: string }>,
  month: string
): void {
  const totals = sumByStatus(rows);

  const aoa: (string | number)[][] = [
    ["PAYROLL / PENGGAJIAN KARYAWAN"],
    ["Periode", monthLabel(month)],
    ["Dicetak", new Date().toLocaleString("id-ID")],
    [],
    [
      "No",
      "NIP",
      "Nama",
      "Gaji Pokok",
      "Tunj. Jabatan",
      "Makan & Transport",
      "Reimbursement",
      "Pot. Absensi",
      "Pot. BPJS",
      "Total (THP)",
      "Status",
    ],
    ...rows.map((row, index) => [
      index + 1,
      row.nip,
      employeeMap.get(row.nip)?.nama ?? "-",
      row.gaji_pokok || 0,
      row.tunjangan_jabatan || 0,
      row.tunjangan_makan_transport || 0,
      row.reimbursement || 0,
      row.potongan_absensi || 0,
      row.potongan_bpjs || 0,
      row.total_terima || 0,
      row.status_pembayaran,
    ]),
    [],
    ["", "", "TOTAL", "", "", "", "", "", "", totals.total, ""],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!cols"] = [
    { wch: 5 },
    { wch: 14 },
    { wch: 26 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 15 },
    { wch: 13 },
    { wch: 12 },
    { wch: 15 },
    { wch: 14 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Payroll");

  XLSX.writeFile(workbook, `payroll-${month}.xlsx`);
}

export function exportSlipToXlsx(
  row: PayrollRow,
  employee: Employee | undefined,
  month: string,
  days: { hadir: number; alpa: number }
): void {
  const aoa: (string | number)[][] = [
    ["SLIP GAJI"],
    ["Periode", monthLabel(month)],
    [],
    ["NIP", row.nip],
    ["Nama", employee?.nama ?? "-"],
    ["Jabatan", employee?.jabatan ?? "-"],
    ["Departemen", employee?.departemen ?? "-"],
    [],
    ["PENDAPATAN", "", ""],
    ["Gaji Pokok", row.gaji_pokok || 0, ""],
    ["Tunjangan Jabatan", row.tunjangan_jabatan || 0, ""],
    [
      `Uang Makan & Transport (${days.hadir} hari hadir)`,
      row.tunjangan_makan_transport || 0,
      "",
    ],
    ["Reimbursement (Approved)", row.reimbursement || 0, ""],
    [
      "Total Pendapatan",
      (row.gaji_pokok || 0) +
        (row.tunjangan_jabatan || 0) +
        (row.tunjangan_makan_transport || 0) +
        (row.reimbursement || 0),
      "",
    ],
    [],
    ["POTONGAN", "", ""],
    [`Potongan Absensi (${days.alpa} hari alpa)`, -(row.potongan_absensi || 0), ""],
    ["Iuran BPJS", -(row.potongan_bpjs || 0), ""],
    [
      "Total Potongan",
      -((row.potongan_absensi || 0) + (row.potongan_bpjs || 0)),
      "",
    ],
    [],
    ["TOTAL TERIMA (THP)", row.total_terima || 0, ""],
    [],
    ["Dicetak", new Date().toLocaleString("id-ID"), ""],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!cols"] = [{ wch: 36 }, { wch: 18 }, { wch: 8 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Slip Gaji");

  const nipSlug = row.nip.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  XLSX.writeFile(workbook, `slip-gaji-${nipSlug}-${month}.xlsx`);
}
