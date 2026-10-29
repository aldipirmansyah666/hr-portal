"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  FileUp,
  Loader2,
  RotateCcw,
  Save,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  ATTENDANCE_TABLE,
  EMPLOYEES_TABLE,
  downloadTemplate,
  isSaveable,
  parseAttendanceFile,
  toPayloads,
  type ParsedRow,
} from "@/lib/attendance";
import { buildDummyFile, currentMonthValue } from "@/lib/attendance-dummy";
import Dropzone, { ProcessingOverlay } from "@/components/attendance/Dropzone";
import PreviewTable from "@/components/attendance/PreviewTable";

type EmployeeLite = { nip: string; nama: string; departemen: string | null };

type Toast = { type: "success" | "error"; message: string } | null;

export default function ImportAbsensiPage() {
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((type: "success" | "error", message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    const fetchEmployees = async () => {
      const { data, error } = await supabase
        .from(EMPLOYEES_TABLE)
        .select("nip, nama, departemen");
      if (error) {
        notify("error", `Gagal memuat data karyawan: ${error.message}`);
      } else {
        setEmployees((data as EmployeeLite[]) ?? []);
      }
      setLoadingEmployees(false);
    };
    fetchEmployees();
  }, [notify]);

  const employeeMap = useMemo(() => {
    const map = new Map<string, { nama: string; departemen: string }>();
    for (const emp of employees) {
      map.set(emp.nip, { nama: emp.nama, departemen: emp.departemen ?? "-" });
    }
    return map;
  }, [employees]);

  const handleFile = useCallback(
    async (next: File | null) => {
      setFile(next);
      setRows(null);
      if (!next) return;

      setParsing(true);
      try {
        const parsed = await parseAttendanceFile(next, employeeMap);
        setRows(parsed);
        notify("success", `Berhasil membaca ${parsed.length} baris dari ${next.name}`);
      } catch (err) {
        setFile(null);
        notify("error", err instanceof Error ? err.message : "Gagal membaca file.");
      } finally {
        setParsing(false);
      }
    },
    [employeeMap, notify]
  );

  const saveableRows = useMemo(() => (rows ?? []).filter(isSaveable), [rows]);

  const handleSave = async () => {
    if (saveableRows.length === 0) return;
    setSaving(true);

    const payload = toPayloads(rows ?? []);
    const { error } = await supabase
      .from(ATTENDANCE_TABLE)
      .upsert(payload, { onConflict: "nip,tanggal" });

    if (error) {
      notify("error", `Gagal menyimpan: ${error.message}`);
    } else {
      notify(
        "success",
        `${payload.length} baris absensi tersimpan ke hr_attendance_logs.`
      );
      setFile(null);
      setRows(null);
    }
    setSaving(false);
  };

  const handleReset = () => {
    setFile(null);
    setRows(null);
  };

  const handleDownloadDummy = (format: "xlsx" | "csv") => {
    try {
      const result = buildDummyFile(employees, currentMonthValue(), format);
      notify(
        "success",
        `File dummy (${result.rows} baris absensi) berhasil diunduh: ${result.filename}`
      );
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Gagal membuat file dummy.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/attendance"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-indigo-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke Rekap Absensi
          </Link>
          <h2 className="text-xl font-semibold text-slate-900">Import Absensi</h2>
          <p className="mt-1 text-sm text-slate-500">
            Upload file <code className="font-mono text-slate-700">.csv</code> /{" "}
            <code className="font-mono text-slate-700">.xlsx</code>, periksa preview, lalu simpan
            ke database.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Template Excel
          </button>
          <button
            type="button"
            onClick={() => handleDownloadDummy("xlsx")}
            disabled={loadingEmployees || employees.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3.5 py-2.5 text-sm font-medium text-violet-700 shadow-sm transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
            title="Download file dummy absensi sesuai NIP karyawan"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Data Dummy (.xlsx)
          </button>
          <button
            type="button"
            onClick={() => handleDownloadDummy("csv")}
            disabled={loadingEmployees || employees.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3.5 py-2.5 text-sm font-medium text-violet-700 shadow-sm transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
            title="Download file dummy absensi format CSV"
          >
            <FileText className="h-4 w-4" />
            Data Dummy (.csv)
          </button>
          {rows && (
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || saveableRows.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Simpan ke Database
            {rows && saveableRows.length > 0 && !saving && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] tabular-nums">
                {saveableRows.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <FileUp className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">File Absensi</h3>
            <p className="text-xs text-slate-500">
              {loadingEmployees
                ? "Memuat master karyawan..."
                : `${employees.length} karyawan terdaftar untuk pencocokan NIP`}
            </p>
          </div>
        </div>

        <Dropzone
          file={file}
          onFile={handleFile}
          disabled={parsing || saving}
          onError={(m) => notify("error", m)}
        />
      </div>

      {parsing && <ProcessingOverlay label="Menganalisis file absensi..." />}

      {rows && !parsing && (
        <>
          <PreviewTable rows={rows} />

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5 text-sm text-slate-500">
              {saveableRows.length > 0 ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
              )}
              <p>
                {saveableRows.length > 0 ? (
                  <>
                    Siap menyimpan{" "}
                    <span className="font-semibold text-slate-900">{saveableRows.length}</span>{" "}
                    baris valid.
                  </>
                ) : (
                  "Tidak ada baris valid untuk disimpan. Periksa hasil validasi di atas."
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || saveableRows.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? "Menyimpan..." : "Simpan ke Database"}
            </button>
          </div>
        </>
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
