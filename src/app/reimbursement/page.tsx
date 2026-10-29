"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Check,
  Download,
  FileText,
  Loader2,
  Plus,
  Receipt,
  RefreshCw,
  X,
} from "lucide-react";
import {
  supabase,
  type Employee,
  type Reimbursement,
  type ReimbursementStatus,
} from "@/lib/supabase";
import { EMPLOYEES_TABLE } from "@/lib/attendance";
import {
  REIMBURSEMENT_BUCKET,
  REIMBURSEMENT_TABLE,
  formatRupiah,
} from "@/lib/payroll";
import ReimbursementModal, { type ClaimForm } from "@/components/reimbursement/ReimbursementModal";
import ConfirmDialog from "@/components/ConfirmDialog";

type Toast = { type: "success" | "error"; message: string } | null;
type Filter = "Semua" | ReimbursementStatus;
type Decision = { row: Reimbursement; action: "Approved" | "Rejected" } | null;

const STATUS_STYLES: Record<ReimbursementStatus, string> = {
  Pending: "border-amber-200 bg-amber-50 text-amber-700",
  Approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Rejected: "border-rose-200 bg-rose-50 text-rose-700",
};

const FILTERS: Filter[] = ["Semua", "Pending", "Approved", "Rejected"];

function StatusBadge({ status }: { status: ReimbursementStatus }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ReimbursementPage() {
  const [claims, setClaims] = useState<Reimbursement[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("Semua");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision>(null);
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
    const [claimsResult, employeesResult] = await Promise.all([
      supabase
        .from(REIMBURSEMENT_TABLE)
        .select("*")
        .order("tanggal_pengajuan", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from(EMPLOYEES_TABLE).select("*").order("nama", { ascending: true }),
    ]);

    if (claimsResult.error) {
      notify("error", `Gagal memuat klaim: ${claimsResult.error.message}`);
    } else {
      setClaims((claimsResult.data as Reimbursement[]) ?? []);
    }
    if (employeesResult.error) {
      notify("error", `Gagal memuat karyawan: ${employeesResult.error.message}`);
    } else {
      setEmployees((employeesResult.data as Employee[]) ?? []);
    }
    setLoading(false);
  }, [notify]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const employeeMap = useMemo(
    () => new Map(employees.map((emp) => [emp.nip, emp])),
    [employees]
  );

  const stats = useMemo(() => {
    const total = claims.reduce((sum, c) => sum + (c.nominal || 0), 0);
    const approved = claims
      .filter((c) => c.status === "Approved")
      .reduce((sum, c) => sum + (c.nominal || 0), 0);
    const pending = claims.filter((c) => c.status === "Pending").length;
    const rejected = claims.filter((c) => c.status === "Rejected").length;
    return { total, approved, pending, rejected };
  }, [claims]);

  const filteredClaims = useMemo(
    () => (filter === "Semua" ? claims : claims.filter((c) => c.status === filter)),
    [claims, filter]
  );

  const handleSubmit = async (form: ClaimForm) => {
    if (form.file && form.file.size > 5 * 1024 * 1024) {
      notify("error", "Ukuran lampiran melebihi 5 MB.");
      return;
    }

    setSaving(true);
    try {
      let buktiUrl: string | null = null;
      if (form.file) {
        const safeName = form.file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
        const path = `${form.nip}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(REIMBURSEMENT_BUCKET)
          .upload(path, form.file, { upsert: false });

        if (uploadError) {
          throw new Error(
            `Gagal unggah lampiran: ${uploadError.message}. Pastikan bucket "${REIMBURSEMENT_BUCKET}" sudah dibuat (jalankan hr_reimbursements.sql).`
          );
        }
        const { data: publicUrl } = supabase.storage
          .from(REIMBURSEMENT_BUCKET)
          .getPublicUrl(path);
        buktiUrl = publicUrl.publicUrl;
      }

      const { error } = await supabase.from(REIMBURSEMENT_TABLE).insert({
        nip: form.nip,
        kategori: form.kategori,
        nominal: form.nominal,
        keterangan: form.keterangan || null,
        bukti_url: buktiUrl,
        status: "Pending",
        tanggal_pengajuan: new Date().toISOString().slice(0, 10),
      });

      if (error) throw new Error(error.message);

      notify(
        "success",
        `Klaim ${form.kategori} ${formatRupiah(form.nominal)} berhasil diajukan.`
      );
      setModalOpen(false);
      await fetchData();
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Gagal mengajukan klaim.");
    } finally {
      setSaving(false);
    }
  };

  const handleDecision = async (target: NonNullable<Decision>) => {
    setUpdatingId(target.row.id);
    const { error } = await supabase
      .from(REIMBURSEMENT_TABLE)
      .update({ status: target.action })
      .eq("id", target.row.id);

    if (error) {
      notify("error", `Gagal memperbarui status: ${error.message}`);
      setUpdatingId(null);
      setDecision(null);
      return;
    }

    setClaims((prev) =>
      prev.map((c) => (c.id === target.row.id ? { ...c, status: target.action } : c))
    );
    notify(
      "success",
      `Klaim ${employeeMap.get(target.row.nip)?.nama ?? target.row.nip} ${
        target.action === "Approved" ? "disetujui" : "ditolak"
      }.`
    );
    setUpdatingId(null);
    setDecision(null);
  };

  const statsCards = [
    {
      label: "Total Diajukan",
      value: formatRupiah(stats.total),
      icon: Receipt,
      tone: "text-indigo-600 bg-indigo-50",
    },
    {
      label: "Nilai Disetujui",
      value: formatRupiah(stats.approved),
      icon: CheckCircle2,
      tone: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Menunggu",
      value: String(stats.pending),
      icon: AlertCircle,
      tone: "text-amber-600 bg-amber-50",
    },
    {
      label: "Ditolak",
      value: String(stats.rejected),
      icon: X,
      tone: "text-rose-600 bg-rose-50",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Klaim &amp; Reimbursement
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            <span className="font-medium text-slate-700">{claims.length}</span> klaim
            terdaftar —{" "}
            <span className="font-medium text-slate-700">
              {formatRupiah(stats.approved)}
            </span>{" "}
            disetujui (masuk THP payroll)
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
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            disabled={loading || employees.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Ajukan Klaim
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statsCards.map((card) => {
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
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`rounded-lg px-3.5 py-2 text-xs font-medium shadow-sm transition ${
                  filter === item
                    ? "bg-indigo-600 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Menampilkan{" "}
            <span className="font-semibold text-slate-700">{filteredClaims.length}</span>{" "}
            dari {claims.length} klaim
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="text-sm">Memuat data klaim...</p>
          </div>
        ) : filteredClaims.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
            <Receipt className="h-10 w-10 text-slate-300" />
            <p className="text-sm">
              {filter === "Semua"
                ? "Belum ada klaim reimbursement."
                : `Tidak ada klaim berstatus ${filter}.`}
            </p>
            {filter === "Semua" && (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="mt-1 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Ajukan Klaim
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3.5 font-semibold">Tanggal</th>
                  <th className="px-4 py-3.5 font-semibold">Karyawan</th>
                  <th className="px-4 py-3.5 font-semibold">Kategori</th>
                  <th className="px-4 py-3.5 font-semibold">Catatan</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Nominal</th>
                  <th className="px-4 py-3.5 font-semibold">Bukti</th>
                  <th className="px-4 py-3.5 font-semibold">Status</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClaims.map((claim) => {
                  const emp = employeeMap.get(claim.nip);
                  const busy = updatingId === claim.id;
                  return (
                    <tr key={claim.id} className="transition hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-500">
                        {formatDate(claim.tanggal_pengajuan)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                            {emp?.nama?.charAt(0)?.toUpperCase() ?? "?"}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{emp?.nama ?? claim.nip}</p>
                            <p className="font-mono text-[11px] text-slate-500">{claim.nip}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          {claim.kategori}
                        </span>
                      </td>
                      <td className="max-w-[220px] px-4 py-3.5 text-xs text-slate-600">
                        <p className="truncate" title={claim.keterangan ?? ""}>
                          {claim.keterangan || "—"}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold tabular-nums text-slate-900">
                        {formatRupiah(claim.nominal)}
                      </td>
                      <td className="px-4 py-3.5">
                        {claim.bukti_url ? (
                          <a
                            href={claim.bukti_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-600 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Lihat
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={claim.status} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          {claim.status === "Pending" ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setDecision({ row: claim, action: "Approved" })}
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:opacity-50"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Setujui
                              </button>
                              <button
                                type="button"
                                onClick={() => setDecision({ row: claim, action: "Rejected" })}
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 shadow-sm transition hover:bg-rose-100 disabled:opacity-50"
                              >
                                <X className="h-3.5 w-3.5" />
                                Tolak
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
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

      {modalOpen && (
        <ReimbursementModal
          employees={employees}
          saving={saving}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
        />
      )}

      {decision && (
        <ConfirmDialog
          title={
            decision.action === "Approved"
              ? "Setujui Klaim Reimbursement?"
              : "Tolak Klaim Reimbursement?"
          }
          message={
            <>
              Klaim{" "}
              <span className="font-medium text-slate-700">{decision.row.kategori}</span>{" "}
              senilai{" "}
              <span className="font-medium text-slate-700">
                {formatRupiah(decision.row.nominal)}
              </span>{" "}
              dari{" "}
              <span className="font-medium text-slate-700">
                {employeeMap.get(decision.row.nip)?.nama ?? decision.row.nip}
              </span>{" "}
              (NIP: {decision.row.nip}) akan{" "}
              {decision.action === "Approved" ? (
                <>
                  <span className="font-medium text-emerald-700">disetujui</span> dan
                  masuk kalkulasi THP payroll bulan pengajuan.
                </>
              ) : (
                <>
                  <span className="font-medium text-rose-700">ditolak</span> dan tidak
                  masuk perhitungan gaji.
                </>
              )}
            </>
          }
          confirmLabel={
            decision.action === "Approved" ? "Ya, Setujui" : "Ya, Tolak"
          }
          tone={decision.action === "Approved" ? "success" : "danger"}
          busy={updatingId === decision.row.id}
          onConfirm={async () => {
            const target = decision;
            await handleDecision(target);
          }}
          onCancel={() => setDecision(null)}
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
