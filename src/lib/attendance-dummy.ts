import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import {
  ATTENDANCE_TABLE,
  monthLabel,
  type AttendanceLogPayload,
} from "@/lib/attendance";

export type DummyEmployee = { nip: string; nama: string };

export type DummyLog = AttendanceLogPayload & { nama: string };

const CHUNK_SIZE = 500;

function fnv1a(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${pad2(h)}:${pad2(m)}:00`;
}

export function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}

export function generateDummyLogs(
  employees: DummyEmployee[],
  month: string
): DummyLog[] {
  const [year, mon] = month.split("-").map(Number);
  if (!year || !mon || mon < 1 || mon > 12) {
    throw new Error("Format bulan tidak valid, gunakan format YYYY-MM.");
  }
  if (employees.length === 0) {
    throw new Error(
      "Data karyawan kosong. Tambahkan karyawan di master data terlebih dahulu."
    );
  }

  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const now = new Date();
  const today = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

  const logs: DummyLog[] = [];

  for (const employee of employees) {
    for (let day = 1; day <= lastDay; day++) {
      const tanggal = `${month}-${pad2(day)}`;
      if (tanggal > today) continue;

      const weekday = new Date(Date.UTC(year, mon - 1, day)).getUTCDay();
      if (weekday === 0 || weekday === 6) continue;

      const key = `${employee.nip}|${tanggal}`;
      const roll = fnv1a(key) % 100;

      let status: DummyLog["status"];
      let jamMasuk: string | null = null;
      let jamPulang: string | null = null;
      let keterangan: string | null = null;

      if (roll < 70) {
        status = "Hadir";
        jamMasuk = minutesToTime(455 + (fnv1a(`${key}:in`) % 25));
      } else if (roll < 82) {
        status = "Telat";
        jamMasuk = minutesToTime(481 + (fnv1a(`${key}:in`) % 65));
      } else if (roll < 87) {
        status = "Cuti";
        keterangan = "Cuti tahunan";
      } else if (roll < 91) {
        status = "Izin";
        keterangan = "Izin pribadi";
      } else if (roll < 95) {
        status = "Sakit";
        keterangan = "Surat keterangan sakit";
      } else {
        status = "Alpa";
        keterangan = "Tanpa keterangan";
      }

      if (jamMasuk) {
        const outRoll = fnv1a(`${key}:out`) % 100;
        if (outRoll < 8) {
          keterangan = "Tanpa data jam pulang";
        } else {
          jamPulang = minutesToTime(1005 + (outRoll % 46));
        }
      }

      logs.push({
        nip: employee.nip,
        nama: employee.nama,
        tanggal,
        jam_masuk: jamMasuk,
        jam_pulang: jamPulang,
        status,
        keterangan,
      });
    }
  }

  logs.sort((a, b) =>
    a.tanggal === b.tanggal
      ? a.nip.localeCompare(b.nip)
      : a.tanggal.localeCompare(b.tanggal)
  );
  return logs;
}

export function downloadDummyFile(
  logs: DummyLog[],
  month: string,
  format: "xlsx" | "csv"
): void {
  const header = [
    "NIP",
    "NAMA",
    "TANGGAL",
    "JAM MASUK",
    "JAM PULANG",
    "STATUS",
    "KETERANGAN",
  ];
  const rows = logs.map((log) => [
    log.nip,
    log.nama,
    log.tanggal,
    log.jam_masuk ?? "",
    log.jam_pulang ?? "",
    log.status,
    log.keterangan ?? "",
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  worksheet["!cols"] = [
    { wch: 14 },
    { wch: 24 },
    { wch: 13 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 26 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Absensi");
  XLSX.writeFile(workbook, `absensi-dummy-${month}.${format}`);
}

export function buildDummyFile(
  employees: DummyEmployee[],
  month: string,
  format: "xlsx" | "csv"
): { rows: number; filename: string } {
  const logs = generateDummyLogs(employees, month);
  if (logs.length === 0) {
    throw new Error(
      `Tidak ada hari kerja pada ${monthLabel(month)} sampai hari ini.`
    );
  }
  downloadDummyFile(logs, month, format);
  return { rows: logs.length, filename: `absensi-dummy-${month}.${format}` };
}

export async function seedDummyAttendance(
  month: string,
  employees: DummyEmployee[]
): Promise<{ rows: number; employeeCount: number }> {
  const logs = generateDummyLogs(employees, month);
  if (logs.length === 0) {
    throw new Error(
      `Tidak ada hari kerja pada ${monthLabel(month)} sampai hari ini.`
    );
  }

  const payloads = logs.map<AttendanceLogPayload>(({ nip, tanggal, jam_masuk, jam_pulang, status, keterangan }) => ({
    nip,
    tanggal,
    jam_masuk,
    jam_pulang,
    status,
    keterangan,
  }));

  for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
    const chunk = payloads.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from(ATTENDANCE_TABLE)
      .upsert(chunk, { onConflict: "nip,tanggal" });
    if (error) {
      throw new Error(`Gagal menyimpan data dummy: ${error.message}`);
    }
  }

  return { rows: payloads.length, employeeCount: employees.length };
}
