"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import StatusBadge, { RowStateBadge } from "./StatusBadge";
import { isSaveable, type ParsedRow } from "@/lib/attendance";

function formatDate(iso: string): string {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function PreviewTable({ rows }: { rows: ParsedRow[] }) {
  const saveable = rows.filter(isSaveable);
  const invalid = rows.filter((r) => r.errors.length > 0);
  const unmatched = rows.filter((r) => !r.matched);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Total Baris" value={rows.length} tone="slate" />
        <SummaryCard label="Siap Simpan" value={saveable.length} tone="emerald" />
        <SummaryCard label="NIP Tidak Dikenal" value={unmatched.length} tone="rose" />
        <SummaryCard label="Data Tidak Valid" value={invalid.length} tone="amber" />
      </div>

      {saveable.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-semibold">{saveable.length} baris</span> akan disimpan ke tabel{" "}
            <code className="rounded bg-emerald-100 px-1 py-0.5 font-mono">hr_attendance_logs</code>{" "}
            dengan metode upsert (aman dari duplikasi NIP + tanggal).
          </p>
        </div>
      )}

      {invalid.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <span className="font-semibold">{invalid.length} baris</span> dilewati saat penyimpanan
            karena tidak valid — periksa kolom NIP, tanggal, atau duplikat pada file sumber.
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
              <tr className="text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3.5 font-semibold">#</th>
                <th className="px-4 py-3.5 font-semibold">NIP</th>
                <th className="px-4 py-3.5 font-semibold">Nama</th>
                <th className="px-4 py-3.5 font-semibold">Tanggal</th>
                <th className="px-4 py-3.5 font-semibold">Masuk</th>
                <th className="px-4 py-3.5 font-semibold">Pulang</th>
                <th className="px-4 py-3.5 font-semibold">Departemen</th>
                <th className="px-4 py-3.5 font-semibold">Status</th>
                <th className="px-4 py-3.5 font-semibold">Validasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const valid = row.errors.length === 0;
                const highlight = !valid || !row.matched;
                return (
                  <tr
                    key={`${row.rowNumber}-${row.nip}-${row.tanggal}`}
                    className={`transition-colors ${
                      highlight
                        ? "bg-rose-50/70 hover:bg-rose-50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="px-4 py-3 text-xs text-slate-500">{row.rowNumber}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-600">{row.nip || "-"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900">{row.nama || "-"}</span>
                      {row.matched && row.nama && row.matchedNama && row.nama !== row.matchedNama && (
                        <span className="block text-[11px] text-slate-500">
                          di master: {row.matchedNama}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(row.tanggal)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-mono text-xs ${
                          row.status === "Telat" ? "text-amber-600" : "text-slate-600"
                        }`}
                      >
                        {row.jamMasuk || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {row.jamPulang || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{row.matchedDepartemen || "-"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <RowStateBadge valid={valid} matched={row.matched} />
                        {row.errors.map((err) => (
                          <p key={err} className="text-[11px] text-rose-600">
                            {err}
                          </p>
                        ))}
                        {row.warnings.map((warn) => (
                          <p key={warn} className="text-[11px] text-amber-600">
                            {warn}
                          </p>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p>
          Status otomatis: <span className="text-emerald-700">Hadir</span> jika masuk ≤ 08:00,{" "}
          <span className="text-amber-700">Telat</span> jika masuk &gt; 08:00. Kolom STATUS pada file
          bersifat opsional untuk kehadiran non-cara normal (Cuti, Izin, Sakit, Alpa).
        </p>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "emerald" | "rose" | "amber";
}) {
  const tones = {
    slate: "text-slate-900 border-slate-200",
    emerald: "text-emerald-700 border-emerald-200",
    rose: "text-rose-700 border-rose-200",
    amber: "text-amber-700 border-amber-200",
  } as const;
  return (
    <div className={`rounded-xl border bg-white px-4 py-3.5 shadow-sm ${tones[tone]}`}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
