import * as XLSX from "xlsx";

export const ATTENDANCE_TABLE = "hr_attendance_logs";
export const EMPLOYEES_TABLE = "hr_employees";
export const WORK_START_TIME = "08:00:00";

export type AttendanceStatus =
  | "Hadir"
  | "Telat"
  | "Cuti"
  | "Izin"
  | "Sakit"
  | "Alpa";

export type ParsedRow = {
  rowNumber: number;
  nip: string;
  nama: string;
  tanggal: string;
  jamMasuk: string;
  jamPulang: string;
  keterangan: string;
  status: AttendanceStatus;
  matched: boolean;
  matchedNama: string;
  matchedDepartemen: string;
  errors: string[];
  warnings: string[];
};

export type AttendanceLogPayload = {
  nip: string;
  tanggal: string;
  jam_masuk: string | null;
  jam_pulang: string | null;
  status: AttendanceStatus;
  keterangan: string | null;
};

const FIELD_ALIASES: Record<string, string[]> = {
  nip: ["nip", "nik", "idkaryawan", "kodekaryawan", "employeecode", "kode"],
  nama: ["nama", "namakaryawan", "namalengkap", "name", "employeename"],
  tanggal: ["tanggal", "tgl", "date", "hari"],
  jamMasuk: ["jammasuk", "masuk", "checkin", "jamabsenmasuk", "waktumasuk", "timein", "jam"],
  jamPulang: ["jampulang", "pulang", "checkout", "jamabsenpulang", "waktupulang", "timeout"],
  status: ["status", "sts", "kehadiran"],
  keterangan: ["keterangan", "catatan", "note", "notes", "remark", "alasan"],
};

type RawRow = Record<string, unknown>;

function normalizeKey(key: string): string {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function mapHeaders(headerRow: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((cell, index) => {
    const key = normalizeKey(String(cell ?? ""));
    if (!key) return;
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.includes(key) && map[field] === undefined) {
        map[field] = index;
        break;
      }
    }
  });
  return map;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function normalizeDate(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    if (value.getUTCHours() === 0 && value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0) {
      return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
    }
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }

  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    if (Number.isInteger(value) && value >= 19000101 && value <= 29991231) {
      const str = String(value);
      return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
    }
    const ms = (Math.floor(value) - 25569) * 86400000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    }
    return "";
  }

  const str = String(value).trim();
  const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${pad(Number(iso[2]))}-${pad(Number(iso[3]))}`;
  }
  const dmy = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (dmy) {
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    return `${year}-${pad(Number(dmy[2]))}-${pad(Number(dmy[1]))}`;
  }

  const parsed = Date.parse(str);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  return "";
}

export function normalizeTime(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const frac = value - Math.floor(value);
    const total = Math.round(frac * 86400);
    const h = Math.floor(total / 3600) % 24;
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  const str = String(value).trim();
  const match = str.match(/(\d{1,2})[.:](\d{2})(?::(\d{2}))?/);
  if (match) {
    let h = Number(match[1]);
    const m = Number(match[2]);
    const s = match[3] ? Number(match[3]) : 0;
    const meridiem = str.toLowerCase().match(/\b(am|pm)\b/);
    if (meridiem) {
      if (meridiem[1] === "pm" && h < 12) h += 12;
      if (meridiem[1] === "am" && h === 12) h = 0;
    }
    if (h < 24 && m < 60 && s < 60) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return "";
}

function normalizeStatusToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

export function detectStatus(
  jamMasuk: string,
  sourceStatus: string
): { status: AttendanceStatus; warnings: string[] } {
  const warnings: string[] = [];
  const token = normalizeStatusToken(sourceStatus);

  const explicit: Record<string, AttendanceStatus> = {
    cuti: "Cuti",
    ck: "Cuti",
    c: "Cuti",
    izin: "Izin",
    i: "Izin",
    sakit: "Sakit",
    s: "Sakit",
    alpa: "Alpa",
    alpha: "Alpa",
    a: "Alpa",
    absen: "Alpa",
  };

  if (explicit[token]) return { status: explicit[token], warnings };

  if (!jamMasuk) {
    warnings.push("Jam masuk kosong — status ditandai Alpa");
    return { status: "Alpa", warnings };
  }

  if (jamMasuk > WORK_START_TIME) {
    warnings.push(`Telat — jam masuk ${jamMasuk.slice(0, 5)}`);
    return { status: "Telat", warnings };
  }
  return { status: "Hadir", warnings };
}

export function parseAttendanceFile(
  file: File,
  employeeMap: Map<string, { nama: string; departemen: string }>
): Promise<ParsedRow[]> {
  return parseWorkbook(file, employeeMap);
}

function parseCsv(content: string): unknown[][] {
  const text = content.replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [",", ";", "\t"].reduce((best, candidate) =>
    firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best
  );

  const rows: unknown[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function parseWorkbook(
  file: File,
  employeeMap: Map<string, { nama: string; departemen: string }>
): Promise<ParsedRow[]> {
  const buffer = await file.arrayBuffer();
  const isCsv = file.name.toLowerCase().endsWith(".csv");

  const matrix = isCsv
    ? parseCsv(new TextDecoder("utf-8").decode(buffer))
    : (() => {
        const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        return XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
          header: 1,
          defval: "",
          raw: true,
        });
      })();

  if (matrix.length < 2) {
    throw new Error("File tidak memiliki data (minimal 1 baris header + 1 baris data).");
  }

  const headerIndex = matrix.findIndex((row) =>
    row.some((cell) => normalizeKey(String(cell ?? "")).length > 0)
  );
  if (headerIndex === -1) {
    throw new Error("Header file tidak ditemukan.");
  }

  const columns = mapHeaders(matrix[headerIndex]);
  if (columns.nip === undefined) {
    throw new Error(
      'Kolom NIP tidak ditemukan. Pastikan header file mengandung "NIP" atau "NIK".'
    );
  }
  if (columns.tanggal === undefined) {
    throw new Error('Kolom Tanggal tidak ditemukan. Pastikan header file mengandung "Tanggal".');
  }

  const rows: ParsedRow[] = [];
  const seen = new Set<string>();
  const dataSlice = matrix.slice(headerIndex + 1);

  dataSlice.forEach((raw, offset) => {
    const get = (field: string): unknown => {
      const idx = columns[field];
      return idx === undefined ? "" : raw[idx];
    };

    const nip = String(get("nip") ?? "").trim();
    const tanggalRaw = get("tanggal");
    const namaRaw = String(get("nama") ?? "").trim();
    const tanggal = normalizeDate(tanggalRaw);
    const jamMasuk = normalizeTime(get("jamMasuk"));
    const jamPulang = normalizeTime(get("jamPulang"));
    const sourceStatus = String(get("status") ?? "").trim();
    const keterangan = String(get("keterangan") ?? "").trim();

    const isBlank = !nip && !tanggal && !jamMasuk && !namaRaw;
    if (isBlank) return;

    const errors: string[] = [];
    if (!nip) errors.push("NIP wajib diisi");
    if (!tanggal) errors.push("Tanggal wajib diisi atau format tidak dikenali");

    const employee = nip ? employeeMap.get(nip) : undefined;
    const matched = Boolean(employee);
    if (nip && !employee) errors.push("NIP tidak ditemukan di master karyawan");

    const duplicateKey = `${nip}__${tanggal}`;
    if (nip && tanggal) {
      if (seen.has(duplicateKey)) {
        errors.push("Duplikat NIP + tanggal dalam file");
      }
      seen.add(duplicateKey);
    }

    const { status, warnings } = detectStatus(jamMasuk, sourceStatus);

    rows.push({
      rowNumber: offset + headerIndex + 2,
      nip,
      nama: employee?.nama || namaRaw,
      tanggal,
      jamMasuk,
      jamPulang,
      keterangan,
      status,
      matched,
      matchedNama: employee?.nama ?? "",
      matchedDepartemen: employee?.departemen ?? "",
      errors,
      warnings,
    });
  });

  if (rows.length === 0) {
    throw new Error("Tidak ada baris data yang terbaca dari file.");
  }

  return rows;
}

export function isSaveable(row: ParsedRow): boolean {
  return row.errors.length === 0 && row.matched;
}

export function toPayloads(rows: ParsedRow[]): AttendanceLogPayload[] {
  return rows.filter(isSaveable).map((row) => ({
    nip: row.nip,
    tanggal: row.tanggal,
    jam_masuk: row.jamMasuk || null,
    jam_pulang: row.jamPulang || null,
    status: row.status,
    keterangan: row.keterangan || null,
  }));
}

export const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function monthLabel(monthValue: string): string {
  const [year, month] = monthValue.split("-");
  const index = Number(month) - 1;
  if (!year || Number.isNaN(index) || index < 0 || index > 11) return monthValue;
  return `${MONTH_NAMES[index]} ${year}`;
}

export function monthRange(monthValue: string): { start: string; end: string } {
  const [year, month] = monthValue.split("-").map(Number);
  const start = `${monthValue}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${monthValue}-${pad(lastDay)}`;
  return { start, end };
}

export type RecapRow = {
  nip: string;
  nama: string;
  jabatan: string;
  departemen: string;
  hadir: number;
  telat: number;
  cutiIzin: number;
  alpa: number;
  total: number;
  percentage: number;
};

export function buildRecap(
  employees: { nip: string; nama: string; jabatan: string | null; departemen: string | null }[],
  logs: { nip: string; status: string | null }[]
): RecapRow[] {
  const stats = new Map<
    string,
    { hadir: number; telat: number; cutiIzin: number; alpa: number }
  >();

  for (const log of logs) {
    const entry = stats.get(log.nip) ?? { hadir: 0, telat: 0, cutiIzin: 0, alpa: 0 };
    switch (log.status) {
      case "Hadir":
        entry.hadir += 1;
        break;
      case "Telat":
        entry.telat += 1;
        break;
      case "Cuti":
      case "Izin":
      case "Sakit":
        entry.cutiIzin += 1;
        break;
      case "Alpa":
        entry.alpa += 1;
        break;
    }
    stats.set(log.nip, entry);
  }

  return employees.map((emp) => {
    const entry = stats.get(emp.nip) ?? { hadir: 0, telat: 0, cutiIzin: 0, alpa: 0 };
    const total = entry.hadir + entry.telat + entry.cutiIzin + entry.alpa;
    const percentage = total > 0 ? Math.round(((entry.hadir + entry.telat) / total) * 100) : 0;
    return {
      nip: emp.nip,
      nama: emp.nama,
      jabatan: emp.jabatan ?? "-",
      departemen: emp.departemen ?? "-",
      hadir: entry.hadir,
      telat: entry.telat,
      cutiIzin: entry.cutiIzin,
      alpa: entry.alpa,
      total,
      percentage,
    };
  });
}

export function exportRecapToXlsx(
  rows: RecapRow[],
  options: { month: string; departemen: string }
): void {
  const aoa: (string | number)[][] = [
    ["REKAPITULASI ABSENSI BULANAN"],
    ["Periode", monthLabel(options.month)],
    ["Departemen", options.departemen || "Semua Departemen"],
    ["Dicetak", new Date().toLocaleString("id-ID")],
    [],
    [
      "No",
      "NIP",
      "Nama",
      "Jabatan",
      "Departemen",
      "Total Hadir",
      "Total Telat",
      "Total Cuti/Izin",
      "Total Alpa",
      "Total Terdata",
      "Kehadiran (%)",
    ],
    ...rows.map((row, index) => [
      index + 1,
      row.nip,
      row.nama,
      row.jabatan,
      row.departemen,
      row.hadir,
      row.telat,
      row.cutiIzin,
      row.alpa,
      row.total,
      row.percentage,
    ]),
    [],
    [
      "",
      "",
      "TOTAL",
      "",
      "",
      rows.reduce((sum, r) => sum + r.hadir, 0),
      rows.reduce((sum, r) => sum + r.telat, 0),
      rows.reduce((sum, r) => sum + r.cutiIzin, 0),
      rows.reduce((sum, r) => sum + r.alpa, 0),
      rows.reduce((sum, r) => sum + r.total, 0),
      "",
    ],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!cols"] = [
    { wch: 5 },
    { wch: 14 },
    { wch: 26 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 11 },
    { wch: 15 },
    { wch: 11 },
    { wch: 13 },
    { wch: 14 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Absensi");

  const deptSlug = (options.departemen || "semua")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  XLSX.writeFile(workbook, `rekap-absensi-${options.month}-${deptSlug}.xlsx`);
}

export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

export function formatDayLabel(iso: string): string {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  const month = MONTH_SHORT[Number(m) - 1];
  if (!y || !d || !month) return iso;
  return `${d} ${month} ${y}`;
}

export function formatClock(value: string | null): string {
  if (!value) return "-";
  return value.slice(0, 5);
}

export type DailyAttendanceLog = {
  tanggal: string;
  jam_masuk: string | null;
  jam_pulang: string | null;
  status: string | null;
  keterangan: string | null;
};

export function exportDetailToXlsx(
  employee: { nip: string; nama: string; jabatan: string; departemen: string },
  logs: DailyAttendanceLog[],
  month: string
): void {
  const aoa: (string | number)[][] = [
    ["DETAIL ABSENSI HARIAN"],
    ["NIP", employee.nip],
    ["Nama", employee.nama],
    ["Jabatan", employee.jabatan],
    ["Departemen", employee.departemen],
    ["Periode", monthLabel(month)],
    ["Dicetak", new Date().toLocaleString("id-ID")],
    [],
    ["No", "Tanggal", "Jam Masuk", "Jam Pulang", "Status", "Keterangan"],
    ...logs.map((log, index) => [
      index + 1,
      formatDayLabel(log.tanggal),
      formatClock(log.jam_masuk),
      formatClock(log.jam_pulang),
      log.status ?? "-",
      log.keterangan ?? "",
    ]),
    [],
    ["", "", "", "Total Hari Terdata", logs.length],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!cols"] = [
    { wch: 5 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 28 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Detail Absensi");

  const nipSlug = employee.nip.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  XLSX.writeFile(workbook, `detail-absensi-${nipSlug}-${month}.xlsx`);
}

export function downloadTemplate(): void {
  const aoa: (string | number)[][] = [
    ["NIP", "NAMA", "TANGGAL", "JAM MASUK", "JAM PULANG", "STATUS", "KETERANGAN"],
    ["EMP-001", "Budi Santoso", "2026-10-01", "07:50:00", "17:00:00", "", ""],
    ["EMP-002", "Siti Aminah", "2026-10-01", "08:20:00", "17:00:00", "", "Rapat lapangan"],
    ["EMP-003", "Andi Wijaya", "2026-10-02", "", "", "Cuti", "Cuti tahunan"],
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!cols"] = [
    { wch: 14 },
    { wch: 24 },
    { wch: 14 },
    { wch: 13 },
    { wch: 13 },
    { wch: 10 },
    { wch: 22 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template Absensi");
  XLSX.writeFile(workbook, "template-absensi.xlsx");
}
