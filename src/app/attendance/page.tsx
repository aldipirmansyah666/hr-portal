"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  UserCheck,
  UserX,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  EMPLOYEES_TABLE,
  buildRecap,
  exportRecapToXlsx,
  monthLabel,
  monthRange,
  type RecapRow,
} from "@/lib/attendance";
import { seedDummyAttendance } from "@/lib/attendance-dummy";
import DetailModal from "@/components/attendance/DetailModal";

type Toast = { type: "success" | "error"; message: string } | null;

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

type EmployeeRow = {
  nip: string;
  nama: string;
  jabatan: string | null;
  departemen: string | null;
};

type LogRow = { nip: string; status: string | null };

export default function RekapAbsensiPage() {
  const [month, setMonth] = useState(currentMonth);
  const [departemen, setDepartemen] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [detailRow, setDetailRow] = useState<RecapRow | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((type: "success" | "error", message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    const fetchDepartments = async () => {
      const { data, error } = await supabase
        .from(EMPLOYEES_TABLE)
        .select("departemen")
        .not("departemen", "is", null);
      if (!error && data) {
        const unique = Array.from(
          new Set((data as { departemen: string }[]).map((d) => d.departemen))
        ).sort();
        setDepartments(unique);
      }
    };
    fetchDepartments();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { start, end } = monthRange(month);

    const [employeesResult, logsResult] = await Promise.all([
      supabase
        .from(EMPLOYEES_TABLE)
        .select("nip, nama, jabatan, departemen")
        .order("nama", { ascending: true }),
      supabase
        .from("hr_attendance_logs")
        .select("nip, status")
        .gte("tanggal", start)
        .lte("tanggal", end),
    ]);

    if (employeesResult.error) {
      notify("error", `Gagal memuat karyawan: ${employeesResult.error.message}`);
    } else {
      setEmployees((employeesResult.data as EmployeeRow[]) ?? []);
    }

    if (logsResult.error) {
      notify("error", `Gagal memuat log absensi: ${logsResult.error.message}`);
    } else {
      setLogs((logsResult.data as LogRow[]) ?? []);
    }

    setLoading(false);
  }, [month, notify]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const recapRows = useMemo(
    () => buildRecap(employees, logs),
    [employees, logs]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recapRows.filter((row) => {
      const deptMatch = !departemen || row.departemen === departemen;
      if (!deptMatch) return false;
      if (!q) return true;
      return (
        row.nip.toLowerCase().includes(q) ||
        row.nama.toLowerCase().includes(q) ||
        row.jabatan.toLowerCase().includes(q)
      );
    });
  }, [recapRows, departemen, search]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => ({
        hadir: acc.hadir + row.hadir,
        telat: acc.telat + row.telat,
        cutiIzin: acc.cutiIzin + row.cutiIzin,
        alpa: acc.alpa + row.alpa,
      }),
      { hadir: 0, telat: 0, cutiIzin: 0, alpa: 0 }
    );
  }, [filteredRows]);

  const handleExport = () => {
    if (filteredRows.length === 0) {
      notify("error", "Tidak ada data untuk di-export.");
      return;
    }
    setExporting(true);
    try {
      exportRecapToXlsx(filteredRows, { month, departemen });
      notify("success", `Rekap ${monthLabel(month)} berhasil diunduh.`);
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Gagal export file.");
    } finally {
      setTimeout(() => setExporting(false), 600);
    }
  };

  const handleSeed = async () => {
    if (employees.length === 0) {
      notify("error", "Master karyawan kosong — tambah karyawan dulu di menu Karyawan.");
      return;
    }
    setSeeding(true);
    try {
      const seedEmployees = employees.map(({ nip, nama }) => ({ nip, nama }));
      const result = await seedDummyAttendance(month, seedEmployees);
      notify(
        "success",
        `${result.rows} log absensi dummy untuk ${result.employeeCount} karyawan (${monthLabel(month)}) berhasil disimpan.`
      );
      await fetchData();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Gagal menyemai data dummy.");
    } finally {
      setSeeding(false);
    }
  };

  const statCards = [
    {
      label: "Total Hadir",
      value: totals.hadir,
      icon: UserCheck,
      tone: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Total Telat",
      value: totals.telat,
      icon: CalendarClock,
      tone: "text-amber-600 bg-amber-50",
    },
    {
      label: "Cuti / Izin",
      value: totals.cutiIzin,
      icon: ClipboardList,
      tone: "text-sky-600 bg-sky-50",
    },
    {
      label: "Total Alpa",
      value: totals.alpa,
      icon: UserX,
      tone: "text-rose-600 bg-rose-50",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Rekapitulasi Absensi Bulanan</h2>
          <p className="mt-1 text-sm text-slate-500">
            Ringkasan performa kehadiran per karyawan — periode{" "}
            <span className="font-medium text-slate-700">{monthLabel(month)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/attendance/import"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Import Data
          </Link>
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Muat Ulang
          </button>
          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding || loading}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3.5 py-2.5 text-sm font-medium text-violet-700 shadow-sm transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
            title="Isi data dummy absensi bulan ini langsung ke database"
          >
            {seeding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {seeding ? "Menyemai..." : "Data Dummy"}
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || loading || filteredRows.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export to Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 sm:p-5"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                    {card.label}
                  </p>
                  <p className="text-2xl font-semibold tabular-nums text-slate-900">{card.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-500">
              <Filter className="h-3.5 w-3.5" />
              Filter
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Bulan</span>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value || currentMonth())}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                />
              </label>
              <label className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Departemen</span>
                <select
                  value={departemen}
                  onChange={(e) => setDepartemen(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                >
                  <option value="">Semua Departemen</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari NIP / nama karyawan..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 sm:w-64"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="text-sm">Memuat rekapitulasi absensi...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
            <ClipboardList className="h-10 w-10 text-slate-300" />
            <p className="text-sm">Tidak ada data untuk filter yang dipilih.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3.5 font-semibold">NIP</th>
                  <th className="px-4 py-3.5 font-semibold">Karyawan</th>
                  <th className="px-4 py-3.5 font-semibold">Departemen</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Hadir</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Telat</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Cuti/Izin</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Alpa</th>
                  <th className="px-4 py-3.5 font-semibold">Kehadiran</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => (
                  <tr
                    key={row.nip}
                    onClick={() => setDetailRow(row)}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-500">{row.nip}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-slate-900">{row.nama}</p>
                      <p className="text-[11px] text-slate-500">{row.jabatan}</p>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{row.departemen}</td>
                    <td className="px-4 py-3.5 text-right font-medium tabular-nums text-emerald-600">
                      {row.hadir}
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium tabular-nums text-amber-600">
                      {row.telat}
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium tabular-nums text-sky-600">
                      {row.cutiIzin}
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium tabular-nums text-rose-600">
                      {row.alpa}
                    </td>
                    <td className="px-4 py-3.5">
                      {row.total === 0 ? (
                        <span className="text-xs text-slate-500">Belum ada data</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                row.percentage >= 90
                                  ? "bg-emerald-500"
                                  : row.percentage >= 75
                                    ? "bg-amber-500"
                                    : "bg-rose-500"
                              }`}
                              style={{ width: `${row.percentage}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium tabular-nums text-slate-600">
                            {row.percentage}%
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailRow(row);
                          }}
                          title="Lihat Detail"
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Lihat Detail
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <td className="px-4 py-3" colSpan={3}>
                    Total ({filteredRows.length} karyawan)
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-600">
                    {totals.hadir}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-600">
                    {totals.telat}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-sky-600">
                    {totals.cutiIzin}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-rose-600">
                    {totals.alpa}
                  </td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {detailRow && (
        <DetailModal
          row={detailRow}
          month={month}
          onClose={() => setDetailRow(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60]">
          <div
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-sm ${
              toast.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0" />
            )}
            <p className="max-w-sm text-sm font-medium">{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
