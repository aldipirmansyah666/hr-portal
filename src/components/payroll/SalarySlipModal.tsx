"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Download,
  FileText,
  Loader2,
  Printer,
  X,
} from "lucide-react";
import { monthLabel, monthRange } from "@/lib/attendance";
import {
  SALARY_COMPONENTS_TABLE,
  exportSlipToXlsx,
  formatRupiah,
} from "@/lib/payroll";
import { useModalDismiss } from "@/lib/useModalDismiss";
import {
  supabase,
  type Employee,
  type PayrollRow,
} from "@/lib/supabase";

type SalarySlipModalProps = {
  row: PayrollRow;
  employee: Employee | undefined;
  month: string;
  onClose: () => void;
};

type SlipDetails = {
  hadir: number;
  alpa: number;
  tarifHarian: number;
};

function Line({
  label,
  note,
  value,
  negative,
}: {
  label: string;
  note?: string;
  value: number;
  negative?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <p className="text-sm text-slate-700">{label}</p>
        {note && <p className="text-xs text-slate-500">{note}</p>}
      </div>
      <p
        className={`whitespace-nowrap text-sm font-medium tabular-nums ${
          negative ? "text-rose-600" : "text-slate-900"
        }`}
      >
        {negative && value > 0 ? `- ${formatRupiah(value)}` : formatRupiah(value)}
      </p>
    </div>
  );
}

export default function SalarySlipModal({
  row,
  employee,
  month,
  onClose,
}: SalarySlipModalProps) {
  const [details, setDetails] = useState<SlipDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useModalDismiss(true, onClose);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const notify = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    const { start, end } = monthRange(month);

    const [logsResult, compResult] = await Promise.all([
      supabase
        .from("hr_attendance_logs")
        .select("status")
        .eq("nip", row.nip)
        .gte("tanggal", start)
        .lte("tanggal", end),
      supabase
        .from(SALARY_COMPONENTS_TABLE)
        .select("*")
        .eq("nip", row.nip)
        .maybeSingle(),
    ]);

    let hadir = 0;
    let alpa = 0;
    for (const log of logsResult.data ?? []) {
      if (log.status === "Hadir" || log.status === "Telat") hadir += 1;
      else if (log.status === "Alpa") alpa += 1;
    }

    const comp = compResult.data;
    setDetails({
      hadir,
      alpa,
      tarifHarian: (comp?.uang_makan_harian ?? 0) + (comp?.tunjangan_transport ?? 0),
    });
    setLoading(false);
  }, [row.nip, month]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    if (!details) return;
    setExporting(true);
    try {
      exportSlipToXlsx(row, employee, month, {
        hadir: details.hadir,
        alpa: details.alpa,
      });
      notify("Slip gaji berhasil diunduh.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Gagal export slip gaji.");
    } finally {
      setTimeout(() => setExporting(false), 600);
    }
  };

  const pendapatan =
    (row.gaji_pokok || 0) +
    (row.tunjangan_jabatan || 0) +
    (row.tunjangan_makan_transport || 0) +
    (row.reimbursement || 0);
  const potongan = (row.potongan_absensi || 0) + (row.potongan_bpjs || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm no-print"
        onClick={onClose}
      />

      <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-sm print-area">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5 no-print">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Slip Gaji</h3>
              <p className="text-xs text-slate-500">
                Periode{" "}
                <span className="font-medium text-slate-700">{monthLabel(month)}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {employee?.nama ?? row.nip}
              </p>
              <p className="font-mono text-xs text-slate-500">NIP {row.nip}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">{employee?.jabatan ?? "-"}</p>
              <p className="text-xs text-slate-500">{employee?.departemen ?? "-"}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-slate-500">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
              <p className="text-sm">Menyiapkan rincian gaji...</p>
            </div>
          ) : (
            <>
              <div className="mt-5">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Pendapatan
                </p>
                <div className="divide-y divide-slate-100">
                  <Line label="Gaji Pokok" value={row.gaji_pokok || 0} />
                  <Line label="Tunjangan Jabatan" value={row.tunjangan_jabatan || 0} />
                  <Line
                    label="Uang Makan & Transport"
                    note={`${details?.hadir ?? 0} hari hadir × ${formatRupiah(
                      details?.tarifHarian ?? 0
                    )}`}
                    value={row.tunjangan_makan_transport || 0}
                  />
                  {(row.reimbursement || 0) > 0 && (
                    <Line
                      label="Reimbursement (Approved)"
                      note="Klaim disetujui pada periode ini"
                      value={row.reimbursement || 0}
                    />
                  )}
                </div>
                <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Total Pendapatan
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-slate-900">
                    {formatRupiah(pendapatan)}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Potongan
                </p>
                <div className="divide-y divide-slate-100">
                  <Line
                    label="Potongan Absensi"
                    note={`${details?.alpa ?? 0} hari alpa`}
                    value={row.potongan_absensi || 0}
                    negative
                  />
                  <Line
                    label="Iuran BPJS"
                    note="Kesehatan & JHT"
                    value={row.potongan_bpjs || 0}
                    negative
                  />
                </div>
                <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Total Potongan
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-rose-600">
                    {potongan > 0 ? `- ${formatRupiah(potongan)}` : formatRupiah(0)}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
                      Total Terima (THP)
                    </p>
                    <p className="mt-0.5 text-[11px] text-indigo-600">
                      {details?.hadir ?? 0} hari hadir · {details?.alpa ?? 0} hari alpa ·{" "}
                      {row.status_pembayaran}
                    </p>
                  </div>
                  <p className="text-xl font-bold tabular-nums text-indigo-700">
                    {formatRupiah(row.total_terima || 0)}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-center text-[11px] text-slate-500">
                Dokumen elektronik — dicetak pada{" "}
                {new Date().toLocaleString("id-ID")}
              </p>
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 no-print">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={loading || exporting}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
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
            onClick={handlePrint}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Cetak / PDF
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] no-print">
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 shadow-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="max-w-sm text-sm font-medium">{toast}</p>
          </div>
        </div>
      )}
    </div>
  );
}
