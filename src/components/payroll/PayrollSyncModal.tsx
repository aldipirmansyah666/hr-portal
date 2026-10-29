"use client";

import { useState } from "react";
import { AlertCircle, Calculator, Loader2, RefreshCw, X } from "lucide-react";
import { monthLabel } from "@/lib/attendance";
import type { SyncConfig } from "@/lib/payroll";
import { useModalDismiss } from "@/lib/useModalDismiss";

type PayrollSyncModalProps = {
  month: string;
  employeeCount: number;
  componentCount: number;
  syncing: boolean;
  onClose: () => void;
  onSync: (config: SyncConfig) => void;
};

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15";

export default function PayrollSyncModal({
  month,
  employeeCount,
  componentCount,
  syncing,
  onClose,
  onSync,
}: PayrollSyncModalProps) {
  const [tarifAlpa, setTarifAlpa] = useState("100000");
  const [bpjsPercent, setBpjsPercent] = useState("3");
  const [error, setError] = useState<string | null>(null);

  useModalDismiss(true, () => {
    if (!syncing) onClose();
  });

  const handleSync = () => {
    if (!tarifAlpa.trim() || Number(tarifAlpa) < 0) {
      setError("Tarif potongan per hari alpa harus berupa angka ≥ 0.");
      return;
    }
    if (!bpjsPercent.trim() || Number(bpjsPercent) < 0 || Number(bpjsPercent) > 100) {
      setError("Iuran BPJS harus berupa persentase 0–100.");
      return;
    }
    if (employeeCount === 0) {
      setError("Master karyawan kosong — tambah karyawan dulu di menu Karyawan.");
      return;
    }
    if (componentCount === 0) {
      setError(
        "Belum ada komponen gaji yang diatur. Buka tab Pengaturan Komponen Gaji dulu."
      );
      return;
    }

    setError(null);
    onSync({
      tarifPotonganAlpa: Number(tarifAlpa) || 0,
      bpjsPercent: Number(bpjsPercent) || 0,
    });
  };

  const notConfigured = employeeCount - componentCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={() => !syncing && onClose()}
      />

      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Calculator className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Hitung &amp; Sinkronisasi Gaji
              </h3>
              <p className="text-xs text-slate-500">
                Periode{" "}
                <span className="font-medium text-slate-700">{monthLabel(month)}</span> —{" "}
                {employeeCount} karyawan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={syncing}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                Potongan / Hari Alpa (Rp) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                step={10000}
                value={tarifAlpa}
                onChange={(e) => setTarifAlpa(e.target.value)}
                className={inputCls}
                disabled={syncing}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                Iuran BPJS Karyawan (%) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={bpjsPercent}
                onChange={(e) => setBpjsPercent(e.target.value)}
                className={inputCls}
                disabled={syncing}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Komponen gaji teratur</span>
              <span className="font-semibold text-slate-700">
                {componentCount} / {employeeCount} karyawan
              </span>
            </div>
            {notConfigured > 0 && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>
                  {notConfigured} karyawan belum punya komponen gaji — akan{" "}
                  <strong>lewat / tidak dihitung</strong> pada sinkronisasi ini.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <p>
              Gaji pokok, tunjangan jabatan, dan tarif uang makan/transport diambil dari{" "}
              <span className="font-medium text-slate-700">Pengaturan Komponen Gaji</span>.
              Uang makan &amp; transport ={" "}
              <strong className="text-slate-700">hari hadir × tarif harian</strong>, potongan
              absensi = hari alpa × tarif di atas, BPJS = % dari (gaji pokok + tunjangan
              jabatan). Data riil dari{" "}
              <span className="font-mono text-slate-600">hr_attendance_logs</span>; baris
              existing diperbarui (upsert), status pembayaran dipertahankan.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={syncing}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {syncing ? "Menyinkronkan..." : "Hitung & Sinkronisasi"}
          </button>
        </div>
      </div>
    </div>
  );
}
