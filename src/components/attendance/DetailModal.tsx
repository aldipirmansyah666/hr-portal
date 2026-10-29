"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  Download,
  Loader2,
  Printer,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  ATTENDANCE_TABLE,
  exportDetailToXlsx,
  formatClock,
  formatDayLabel,
  monthLabel,
  monthRange,
  type AttendanceStatus,
  type DailyAttendanceLog,
  type RecapRow,
} from "@/lib/attendance";
import StatusBadge from "./StatusBadge";
import { useModalDismiss } from "@/lib/useModalDismiss";

const VALID_STATUSES: AttendanceStatus[] = [
  "Hadir",
  "Telat",
  "Cuti",
  "Izin",
  "Sakit",
  "Alpa",
];

function StatusCell({ status }: { status: string | null }) {
  if (status && (VALID_STATUSES as string[]).includes(status)) {
    return <StatusBadge status={status as AttendanceStatus} size="sm" />;
  }
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
      {status || "-"}
    </span>
  );
}

type DetailModalProps = {
  row: RecapRow;
  month: string;
  onClose: () => void;
};

export default function DetailModal({ row, month, onClose }: DetailModalProps) {
  const [logs, setLogs] = useState<DailyAttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useModalDismiss(true, onClose);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const { start, end } = monthRange(month);
    supabase
      .from(ATTENDANCE_TABLE)
      .select("tanggal, jam_masuk, jam_pulang, status, keterangan")
      .eq("nip", row.nip)
      .gte("tanggal", start)
      .lte("tanggal", end)
      .order("tanggal", { ascending: true })
      .then(({ data, error: err }) => {
        if (!active) return;
        if (err) {
          setError(err.message);
        } else {
          setLogs((data as DailyAttendanceLog[]) ?? []);
        }
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [row.nip, month]);

  const handleExport = () => {
    setExporting(true);
    try {
      exportDetailToXlsx(
        { nip: row.nip, nama: row.nama, jabatan: row.jabatan, departemen: row.departemen },
        logs,
        month
      );
    } finally {
      setTimeout(() => setExporting(false), 600);
    }
  };

  const profile = [
    { label: "NIP", value: row.nip, mono: true },
    { label: "Nama", value: row.nama },
    { label: "Jabatan", value: row.jabatan },
    { label: "Departemen", value: row.departemen },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="print-area relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="no-print flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Detail Absensi Harian
              </h3>
              <p className="text-sm text-slate-500">
                {row.nama} — Periode{" "}
                <span className="font-medium text-slate-700">{monthLabel(month)}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Tutup detail"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {profile.map((field) => (
              <div
                key={field.label}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3"
              >
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  {field.label}
                </p>
                <p
                  className={`mt-1 truncate text-sm font-medium text-slate-900 ${
                    field.mono ? "font-mono" : ""
                  }`}
                  title={field.value}
                >
                  {field.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Riwayat Harian
            </p>
            {!loading && !error && (
              <p className="text-xs text-slate-500">
                {logs.length} hari tercatat
              </p>
            )}
          </div>

          {loading ? (
            <div className="mt-3 flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-14 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              <p className="text-sm">Memuat riwayat absensi...</p>
            </div>
          ) : error ? (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Gagal memuat data: {error}</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="mt-3 flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-14 text-center">
              <p className="text-sm font-medium text-slate-700">
                Belum ada data absensi
              </p>
              <p className="text-xs text-slate-500">
                Tidak ada log untuk {monthLabel(month)}.
              </p>
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              <div className="max-h-[420px] overflow-auto print-scroll">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                    <tr className="text-xs uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3 font-semibold">Tanggal</th>
                      <th className="px-4 py-3 font-semibold">Jam Masuk</th>
                      <th className="px-4 py-3 font-semibold">Jam Pulang</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {logs.map((log) => (
                      <tr key={log.tanggal} className="transition-colors hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {formatDayLabel(log.tanggal)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">
                          {formatClock(log.jam_masuk)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">
                          {formatClock(log.jam_pulang)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <StatusCell status={log.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {log.keterangan || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="no-print flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Sumber: tabel <span className="font-mono text-slate-600">hr_attendance_logs</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || loading || logs.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export XLSX
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={loading || logs.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              Cetak / PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
