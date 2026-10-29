"use client";

import { useState } from "react";
import { AlertCircle, Coins, Loader2, Save, X } from "lucide-react";
import type { Employee, SalaryComponent } from "@/lib/supabase";
import { useModalDismiss } from "@/lib/useModalDismiss";

type SalaryComponentModalProps = {
  employee: Employee;
  component: SalaryComponent | null;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: {
    gaji_pokok: number;
    tunjangan_jabatan: number;
    uang_makan_harian: number;
    tunjangan_transport: number;
  }) => void;
};

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15";

export default function SalaryComponentModal({
  employee,
  component,
  saving,
  onClose,
  onSave,
}: SalaryComponentModalProps) {
  const [gajiPokok, setGajiPokok] = useState(String(component?.gaji_pokok ?? 0));
  const [tunjanganJabatan, setTunjanganJabatan] = useState(
    String(component?.tunjangan_jabatan ?? 0)
  );
  const [uangMakan, setUangMakan] = useState(String(component?.uang_makan_harian ?? 0));
  const [transport, setTransport] = useState(String(component?.tunjangan_transport ?? 0));
  const [error, setError] = useState<string | null>(null);

  useModalDismiss(true, () => {
    if (!saving) onClose();
  });

  const handleSave = () => {
    const values = [gajiPokok, tunjanganJabatan, uangMakan, transport];
    if (values.some((v) => v.trim() === "" || Number(v) < 0)) {
      setError("Semua tarif harus berupa angka ≥ 0.");
      return;
    }

    setError(null);
    onSave({
      gaji_pokok: Number(gajiPokok) || 0,
      tunjangan_jabatan: Number(tunjanganJabatan) || 0,
      uang_makan_harian: Number(uangMakan) || 0,
      tunjangan_transport: Number(transport) || 0,
    });
  };

  const fields: {
    label: string;
    suffix: string;
    value: string;
    onChange: (v: string) => void;
    step: number;
  }[] = [
    {
      label: "Gaji Pokok",
      suffix: "/ bulan",
      value: gajiPokok,
      onChange: setGajiPokok,
      step: 100000,
    },
    {
      label: "Tunjangan Jabatan",
      suffix: "/ bulan",
      value: tunjanganJabatan,
      onChange: setTunjanganJabatan,
      step: 50000,
    },
    {
      label: "Uang Makan Harian",
      suffix: "/ hari hadir",
      value: uangMakan,
      onChange: setUangMakan,
      step: 5000,
    },
    {
      label: "Tunjangan Transport",
      suffix: "/ hari hadir",
      value: transport,
      onChange: setTransport,
      step: 5000,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={() => !saving && onClose()}
      />

      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Coins className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Komponen Gaji
              </h3>
              <p className="text-xs text-slate-500">
                <span className="font-medium text-slate-700">{employee.nama}</span> — NIP{" "}
                {employee.nip}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            {fields.map((field) => (
              <div key={field.label}>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                  {field.label}
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    Rp
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={field.step}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    className={`${inputCls} pl-9`}
                    disabled={saving}
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{field.suffix}</p>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <p>
              Tarif harian (uang makan &amp; transport) dikalikan{" "}
              <strong className="text-slate-700">hari hadir</strong> saat sinkronisasi
              payroll. Baris komponen disimpan unik per NIP (upsert).
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
            disabled={saving}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Menyimpan..." : "Simpan Komponen"}
          </button>
        </div>
      </div>
    </div>
  );
}
