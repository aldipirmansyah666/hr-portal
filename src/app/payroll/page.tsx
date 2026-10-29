"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDownUp,
  CheckCircle2,
  Coins,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  RotateCcw,
  Settings2,
  Users,
  Wallet,
} from "lucide-react";
import {
  supabase,
  type Employee,
  type PayrollRow,
  type SalaryComponent,
} from "@/lib/supabase";
import { monthLabel, monthRange, EMPLOYEES_TABLE } from "@/lib/attendance";
import {
  PAYROLL_TABLE,
  REIMBURSEMENT_TABLE,
  SALARY_COMPONENTS_TABLE,
  buildPayrollPayloads,
  exportPayrollToXlsx,
  formatRupiah,
  sumByStatus,
  tallyAttendance,
  type SyncConfig,
} from "@/lib/payroll";
import PayrollSyncModal from "@/components/payroll/PayrollSyncModal";
import SalaryComponentModal from "@/components/payroll/SalaryComponentModal";
import SalarySlipModal from "@/components/payroll/SalarySlipModal";
import ConfirmDialog from "@/components/ConfirmDialog";

type Toast = { type: "success" | "error"; message: string } | null;
type Tab = "payroll" | "components";
type ComponentEdit = {
  employee: Employee;
  component: SalaryComponent | null;
} | null;

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function PaymentBadge({ status }: { status: string }) {
  if (status === "Lunas") {
    return (
      <span className="inline-flex whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        Lunas
      </span>
    );
  }
  return (
    <span className="inline-flex whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
      Belum Dibayar
    </span>
  );
}

export default function PayrollPage() {
  const [tab, setTab] = useState<Tab>("payroll");
  const [month, setMonth] = useState(currentMonth);
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [components, setComponents] = useState<SalaryComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<PayrollRow | null>(null);
  const [componentEdit, setComponentEdit] = useState<ComponentEdit>(null);
  const [savingComponent, setSavingComponent] = useState(false);
  const [slipRow, setSlipRow] = useState<PayrollRow | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((type: "success" | "error", message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [payrollResult, employeesResult, componentsResult] = await Promise.all([
      supabase
        .from(PAYROLL_TABLE)
        .select("*")
        .eq("bulan", month)
        .order("nip", { ascending: true }),
      supabase.from(EMPLOYEES_TABLE).select("*").order("nama", { ascending: true }),
      supabase
        .from(SALARY_COMPONENTS_TABLE)
        .select("*")
        .order("nip", { ascending: true }),
    ]);

    if (payrollResult.error) {
      notify("error", `Gagal memuat payroll: ${payrollResult.error.message}`);
    } else {
      setRows((payrollResult.data as PayrollRow[]) ?? []);
    }

    if (employeesResult.error) {
      notify("error", `Gagal memuat karyawan: ${employeesResult.error.message}`);
    } else {
      setEmployees((employeesResult.data as Employee[]) ?? []);
    }

    if (componentsResult.error) {
      notify("error", `Gagal memuat komponen gaji: ${componentsResult.error.message}`);
    } else {
      setComponents((componentsResult.data as SalaryComponent[]) ?? []);
    }
    setLoading(false);
  }, [month, notify]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const employeeMap = useMemo(
    () => new Map(employees.map((emp) => [emp.nip, emp])),
    [employees]
  );

  const componentMap = useMemo(
    () => new Map(components.map((comp) => [comp.nip, comp])),
    [components]
  );

  const totals = useMemo(() => sumByStatus(rows), [rows]);

  const stats = [
    {
      label: "Total Pengeluaran",
      value: formatRupiah(totals.total),
      icon: Wallet,
      tone: "text-indigo-600 bg-indigo-50",
    },
    {
      label: "Sudah Dibayar",
      value: formatRupiah(totals.paid),
      icon: CheckCircle2,
      tone: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Belum Dibayar",
      value: formatRupiah(totals.unpaid),
      icon: AlertCircle,
      tone: "text-amber-600 bg-amber-50",
    },
    {
      label: "Karyawan Digaji",
      value: String(rows.length),
      icon: Users,
      tone: "text-slate-600 bg-slate-100",
    },
  ];

  const handleSync = async (config: SyncConfig) => {
    setSyncing(true);
    try {
      const { start, end } = monthRange(month);
      const [logsResult, compsResult, claimsResult] = await Promise.all([
        supabase
          .from("hr_attendance_logs")
          .select("nip, status")
          .gte("tanggal", start)
          .lte("tanggal", end),
        supabase.from(SALARY_COMPONENTS_TABLE).select("*"),
        supabase
          .from(REIMBURSEMENT_TABLE)
          .select("nip, nominal, status")
          .eq("status", "Approved")
          .gte("tanggal_pengajuan", start)
          .lte("tanggal_pengajuan", end),
      ]);

      if (logsResult.error) throw new Error(logsResult.error.message);
      if (compsResult.error) throw new Error(compsResult.error.message);
      if (claimsResult.error) throw new Error(claimsResult.error.message);

      const tally = tallyAttendance(logsResult.data ?? []);
      const compMap = new Map<string, SalaryComponent>(
        ((compsResult.data as SalaryComponent[]) ?? []).map((c) => [c.nip, c])
      );
      const payloads = buildPayrollPayloads(
        employees,
        compMap,
        tally,
        month,
        config,
        (claimsResult.data ?? []).map((c) => ({
          nip: c.nip,
          nominal: c.nominal ?? 0,
        }))
      );

      if (payloads.length === 0) {
        throw new Error(
          "Tidak ada karyawan dengan komponen gaji — atur dulu di tab Pengaturan Komponen Gaji."
        );
      }

      const { error } = await supabase
        .from(PAYROLL_TABLE)
        .upsert(payloads, { onConflict: "nip,bulan" });

      if (error) throw new Error(error.message);

      const skipped = employees.length - payloads.length;
      notify(
        "success",
        `${payloads.length} baris payroll ${monthLabel(month)} dihitung & disinkronkan${
          skipped > 0 ? ` (${skipped} karyawan tanpa komponen dilewati)` : ""
        }.`
      );
      await fetchData();
      setSyncOpen(false);
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Gagal sinkronisasi payroll.");
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = () => {
    if (rows.length === 0) {
      notify("error", "Tidak ada data payroll untuk diekspor.");
      return;
    }
    setExporting(true);
    try {
      exportPayrollToXlsx(rows, employeeMap, month);
      notify("success", `Payroll ${monthLabel(month)} berhasil diunduh.`);
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Gagal export file.");
    } finally {
      setTimeout(() => setExporting(false), 600);
    }
  };

  const togglePayment = async (row: PayrollRow) => {
    const next = row.status_pembayaran === "Lunas" ? "Belum Dibayar" : "Lunas";
    setUpdatingId(row.id);
    const { error } = await supabase
      .from(PAYROLL_TABLE)
      .update({ status_pembayaran: next })
      .eq("id", row.id);

    if (error) {
      notify("error", `Gagal memperbarui status: ${error.message}`);
    } else {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, status_pembayaran: next } : r))
      );
      notify(
        "success",
        next === "Lunas"
          ? `Gaji ${row.nip} ditandai Lunas.`
          : `Gaji ${row.nip} dikembalikan ke Belum Dibayar.`
      );
    }
    setUpdatingId(null);
  };

  const handleSaveComponent = async (payload: {
    gaji_pokok: number;
    tunjangan_jabatan: number;
    uang_makan_harian: number;
    tunjangan_transport: number;
  }) => {
    if (!componentEdit) return;
    setSavingComponent(true);
    const { error } = await supabase
      .from(SALARY_COMPONENTS_TABLE)
      .upsert({ nip: componentEdit.employee.nip, ...payload }, { onConflict: "nip" });

    if (error) {
      notify("error", `Gagal menyimpan komponen gaji: ${error.message}`);
    } else {
      notify(
        "success",
        `Komponen gaji ${componentEdit.employee.nama} berhasil disimpan.`
      );
      setComponentEdit(null);
      await fetchData();
    }
    setSavingComponent(false);
  };

  const tabs: { key: Tab; label: string; icon: typeof Wallet }[] = [
    { key: "payroll", label: "Daftar Gaji", icon: Wallet },
    { key: "components", label: "Pengaturan Komponen Gaji", icon: Settings2 },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Payroll / Penggajian</h2>
          <p className="mt-1 text-sm text-slate-500">
            {tab === "payroll" ? (
              <>
                Periode{" "}
                <span className="font-medium text-slate-700">{monthLabel(month)}</span> —{" "}
                <span className="font-medium text-slate-700">{rows.length}</span> karyawan
                digaji
              </>
            ) : (
              <>
                <span className="font-medium text-slate-700">{components.length}</span> dari{" "}
                <span className="font-medium text-slate-700">{employees.length}</span>{" "}
                karyawan sudah memiliki komponen gaji
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Muat Ulang
          </button>
          {tab === "payroll" && (
            <>
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting || loading || rows.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export Payroll to Excel
              </button>
              <button
                type="button"
                onClick={() => setSyncOpen(true)}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
              >
                <ArrowDownUp className="h-4 w-4" />
                Hitung &amp; Sinkronisasi Gaji
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-sm transition ${
                active
                  ? "bg-indigo-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "payroll" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 sm:p-5"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                        {card.label}
                      </p>
                      <p className="truncate text-lg font-semibold tabular-nums text-slate-900">
                        {card.value}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Periode
                </span>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value || currentMonth())}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                />
              </label>
              {!loading && rows.length > 0 && (
                <p className="text-xs text-slate-500">
                  Total pengeluaran:{" "}
                  <span className="font-semibold text-slate-700">
                    {formatRupiah(totals.total)}
                  </span>
                </p>
              )}
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <p className="text-sm">Memuat data payroll...</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
                <Wallet className="h-10 w-10 text-slate-300" />
                <p className="text-sm">
                  Belum ada data payroll untuk {monthLabel(month)}.
                </p>
                <button
                  type="button"
                  onClick={() => setSyncOpen(true)}
                  className="mt-1 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
                >
                  <ArrowDownUp className="h-4 w-4" />
                  Hitung &amp; Sinkronisasi Gaji
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1450px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3.5 font-semibold">NIP</th>
                      <th className="px-4 py-3.5 font-semibold">Karyawan</th>
                      <th className="px-4 py-3.5 text-right font-semibold">Gaji Pokok</th>
                      <th className="px-4 py-3.5 text-right font-semibold">Tunj. Jabatan</th>
                      <th className="px-4 py-3.5 text-right font-semibold">Makan &amp; Transport</th>
                      <th className="px-4 py-3.5 text-right font-semibold">Reimbursement</th>
                      <th className="px-4 py-3.5 text-right font-semibold">Pot. Absensi</th>
                      <th className="px-4 py-3.5 text-right font-semibold">Pot. BPJS</th>
                      <th className="px-4 py-3.5 text-right font-semibold">Total (THP)</th>
                      <th className="px-4 py-3.5 font-semibold">Status</th>
                      <th className="px-4 py-3.5 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => {
                      const emp = employeeMap.get(row.nip);
                      const busy = updatingId === row.id;
                      return (
                        <tr key={row.id} className="transition hover:bg-slate-50">
                          <td className="px-4 py-3.5 font-mono text-xs text-slate-500">{row.nip}</td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                                {emp?.nama?.charAt(0)?.toUpperCase() ?? "?"}
                              </div>
                              <div>
                                <p className="font-medium text-slate-900">{emp?.nama ?? "-"}</p>
                                <p className="text-[11px] text-slate-500">{emp?.departemen ?? "-"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-slate-600">
                            {formatRupiah(row.gaji_pokok)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-slate-600">
                            {formatRupiah(row.tunjangan_jabatan)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-slate-600">
                            {formatRupiah(row.tunjangan_makan_transport)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-emerald-700">
                            {row.reimbursement > 0
                              ? `+${formatRupiah(row.reimbursement)}`
                              : formatRupiah(0)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-rose-600">
                            {row.potongan_absensi > 0
                              ? `-${formatRupiah(row.potongan_absensi)}`
                              : formatRupiah(0)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-rose-600">
                            {row.potongan_bpjs > 0
                              ? `-${formatRupiah(row.potongan_bpjs)}`
                              : formatRupiah(0)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-slate-900">
                            {formatRupiah(row.total_terima)}
                          </td>
                          <td className="px-4 py-3.5">
                            <PaymentBadge status={row.status_pembayaran} />
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setSlipRow(row)}
                                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                Slip Gaji
                              </button>
                              <button
                                type="button"
                                onClick={() => setPayTarget(row)}
                                disabled={busy}
                                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                  row.status_pembayaran === "Lunas"
                                    ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                }`}
                              >
                                {busy ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : row.status_pembayaran === "Lunas" ? (
                                  <RotateCcw className="h-3.5 w-3.5" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                )}
                                {row.status_pembayaran === "Lunas"
                                  ? "Belum Dibayar"
                                  : "Tandai Lunas"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <td className="px-4 py-3" colSpan={2}>
                        Total ({rows.length} karyawan)
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-600">
                        {formatRupiah(
                          rows.reduce((sum, r) => sum + (r.gaji_pokok || 0), 0)
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-600">
                        {formatRupiah(
                          rows.reduce((sum, r) => sum + (r.tunjangan_jabatan || 0), 0)
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-600">
                        {formatRupiah(
                          rows.reduce((sum, r) => sum + (r.tunjangan_makan_transport || 0), 0)
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-emerald-700">
                        +
                        {formatRupiah(
                          rows.reduce((sum, r) => sum + (r.reimbursement || 0), 0)
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-rose-600">
                        -
                        {formatRupiah(
                          rows.reduce((sum, r) => sum + (r.potongan_absensi || 0), 0)
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-rose-600">
                        -
                        {formatRupiah(
                          rows.reduce((sum, r) => sum + (r.potongan_bpjs || 0), 0)
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-900">
                        {formatRupiah(totals.total)}
                      </td>
                      <td className="px-4 py-3" colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "components" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">
                Master Tarif Gaji per Karyawan
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Tarif harian dikalikan hari hadir saat{" "}
                <span className="font-medium text-slate-700">Hitung &amp; Sinkronisasi Gaji</span>.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <p className="text-sm">Memuat komponen gaji...</p>
            </div>
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
              <Users className="h-10 w-10 text-slate-300" />
              <p className="text-sm">Belum ada data karyawan.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3.5 font-semibold">NIP</th>
                    <th className="px-4 py-3.5 font-semibold">Karyawan</th>
                    <th className="px-4 py-3.5 text-right font-semibold">Gaji Pokok</th>
                    <th className="px-4 py-3.5 text-right font-semibold">Tunj. Jabatan</th>
                    <th className="px-4 py-3.5 text-right font-semibold">Uang Makan / Hari</th>
                    <th className="px-4 py-3.5 text-right font-semibold">Transport / Hari</th>
                    <th className="px-4 py-3.5 font-semibold">Keterangan</th>
                    <th className="px-4 py-3.5 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp) => {
                    const comp = componentMap.get(emp.nip) ?? null;
                    return (
                      <tr key={emp.nip} className="transition hover:bg-slate-50">
                        <td className="px-4 py-3.5 font-mono text-xs text-slate-500">{emp.nip}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                              {emp.nama?.charAt(0)?.toUpperCase() ?? "?"}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{emp.nama}</p>
                              <p className="text-[11px] text-slate-500">{emp.jabatan ?? "-"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-slate-600">
                          {comp ? formatRupiah(comp.gaji_pokok) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-slate-600">
                          {comp ? formatRupiah(comp.tunjangan_jabatan) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-slate-600">
                          {comp ? formatRupiah(comp.uang_makan_harian) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-slate-600">
                          {comp ? formatRupiah(comp.tunjangan_transport) : "—"}
                        </td>
                        <td className="px-4 py-3.5">
                          {comp ? (
                            <span className="inline-flex whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                              Teratur
                            </span>
                          ) : (
                            <span className="inline-flex whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                              Belum diatur
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => setComponentEdit({ employee: emp, component: comp })}
                              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-medium shadow-sm transition ${
                                comp
                                  ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                  : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                              }`}
                            >
                              <Coins className="h-3.5 w-3.5" />
                              {comp ? "Ubah" : "Atur"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {payTarget && (
        <ConfirmDialog
          title={
            payTarget.status_pembayaran === "Lunas"
              ? "Kembalikan ke Belum Dibayar?"
              : "Tandai Lunas?"
          }
          message={
            <>
              Gaji{" "}
              <span className="font-medium text-slate-700">
                {employeeMap.get(payTarget.nip)?.nama ?? payTarget.nip}
              </span>{" "}
              (NIP: {payTarget.nip}) sebesar{" "}
              <span className="font-medium text-slate-700">
                {formatRupiah(payTarget.total_terima)}
              </span>{" "}
              untuk periode {monthLabel(month)} akan ditandai{" "}
              {payTarget.status_pembayaran === "Lunas"
                ? "belum dibayar kembali"
                : "sudah lunas"}
              .
            </>
          }
          confirmLabel={
            payTarget.status_pembayaran === "Lunas"
              ? "Ya, Kembalikan"
              : "Ya, Tandai Lunas"
          }
          tone={payTarget.status_pembayaran === "Lunas" ? "danger" : "success"}
          busy={updatingId === payTarget.id}
          onConfirm={async () => {
            const target = payTarget;
            try {
              await togglePayment(target);
            } finally {
              setPayTarget(null);
            }
          }}
          onCancel={() => setPayTarget(null)}
        />
      )}

      {syncOpen && (
        <PayrollSyncModal
          month={month}
          employeeCount={employees.length}
          componentCount={components.length}
          syncing={syncing}
          onClose={() => setSyncOpen(false)}
          onSync={handleSync}
        />
      )}

      {componentEdit && (
        <SalaryComponentModal
          employee={componentEdit.employee}
          component={componentEdit.component}
          saving={savingComponent}
          onClose={() => setComponentEdit(null)}
          onSave={handleSaveComponent}
        />
      )}

      {slipRow && (
        <SalarySlipModal
          row={slipRow}
          employee={employeeMap.get(slipRow.nip)}
          month={month}
          onClose={() => setSlipRow(null)}
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
