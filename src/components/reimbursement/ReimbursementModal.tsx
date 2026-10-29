"use client";

import { useState } from "react";
import {
  AlertCircle,
  Loader2,
  Paperclip,
  Receipt,
  Save,
  X,
} from "lucide-react";
import { REIMBURSEMENT_CATEGORIES } from "@/lib/payroll";
import type { Employee } from "@/lib/supabase";
import { useModalDismiss } from "@/lib/useModalDismiss";

export type ClaimForm = {
  nip: string;
  kategori: string;
  nominal: number;
  keterangan: string;
  file: File | null;
};

type ReimbursementModalProps = {
  employees: Employee[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: ClaimForm) => void;
};

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15";

export default function ReimbursementModal({
  employees,
  saving,
  onClose,
  onSubmit,
}: ReimbursementModalProps) {
  const [nip, setNip] = useState("");
  const [kategori, setKategori] = useState<string>(REIMBURSEMENT_CATEGORIES[0]);
  const [nominal, setNominal] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useModalDismiss(true, () => {
    if (!saving) onClose();
  });

  const handleSubmit = () => {
    if (!nip) {
      setError("Pilih karyawan terlebih dahulu.");
      return;
    }
    if (!nominal.trim() || Number(nominal) <= 0) {
      setError("Nominal harus berupa angka > 0.");
      return;
    }

    setError(null);
    onSubmit({
      nip,
      kategori,
      nominal: Number(nominal) || 0,
      keterangan: keterangan.trim(),
      file,
    });
  };

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
              <Receipt className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Ajukan Klaim</h3>
              <p className="text-xs text-slate-500">
                Klaim baru berstatus <span className="font-medium text-slate-700">Pending</span>{" "}
                menunggu persetujuan Admin HR
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
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              Karyawan <span className="text-rose-500">*</span>
            </label>
            <select
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              className={inputCls}
              disabled={saving}
            >
              <option value="">— Pilih karyawan —</option>
              {employees.map((emp) => (
                <option key={emp.nip} value={emp.nip}>
                  {emp.nama} — {emp.nip}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                Kategori <span className="text-rose-500">*</span>
              </label>
              <select
                value={kategori}
                onChange={(e) => setKategori(e.target.value)}
                className={inputCls}
                disabled={saving}
              >
                {REIMBURSEMENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                Nominal (Rp) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                  Rp
                </span>
                <input
                  type="number"
                  min={0}
                  step={10000}
                  value={nominal}
                  onChange={(e) => setNominal(e.target.value)}
                  className={`${inputCls} pl-9`}
                  disabled={saving}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              Catatan
            </label>
            <textarea
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Contoh: Transport rapat klien 12 Okt"
              className={`${inputCls} resize-none`}
              disabled={saving}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              Lampiran Nota / File
            </label>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 transition hover:border-indigo-400 hover:bg-indigo-50/50 ${
                saving ? "pointer-events-none opacity-60" : ""
              }`}
            >
              <Paperclip className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
                {file ? file.name : "Pilih file gambar / PDF..."}
              </span>
              {file && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setFile(null);
                  }}
                  className="rounded p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={saving}
              />
            </label>
            <p className="mt-1 text-[11px] text-slate-500">
              Opsional — maks 5 MB, JPG/PNG/PDF. Diunggah ke bucket{" "}
              <span className="font-mono text-slate-600">reimbursement-bukti</span>.
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
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Mengajukan..." : "Ajukan Klaim"}
          </button>
        </div>
      </div>
    </div>
  );
}
