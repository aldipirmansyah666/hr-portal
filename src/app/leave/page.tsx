"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Filter,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import { supabase, type Employee, type LeaveRequest } from "@/lib/supabase";
import { formatDayLabel } from "@/lib/attendance";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useModalDismiss } from "@/lib/useModalDismiss";

const TABLE = "hr_leave_requests";

const JENIS_CUTI = ["Cuti Tahunan", "Izin", "Sakit"] as const;
const STATUS_FILTERS = ["Pending", "Approved", "Rejected"] as const;

type Toast = { type: "success" | "error"; message: string } | null;

type FormData = {
  nip: string;
  jenis_cuti: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  alasan: string;
};

const EMPTY_FORM: FormData = {
  nip: "",
  jenis_cuti: "Cuti Tahunan",
  tanggal_mulai: "",
  tanggal_selesai: "",
  alasan: "",
};

function countDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = Date.parse(`${start}T00:00:00Z`);
  const e = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.round((e - s) / 86400000) + 1;
}

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Pending: "bg-amber-50 text-amber-700 border-amber-200",
    Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Rejected: "bg-rose-50 text-rose-700 border-rose-200",
  };
  const label: Record<string, string> = {
    Pending: "Menunggu",
    Approved: "Disetujui",
    Rejected: "Ditolak",
  };
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${
        map[status] ?? "bg-slate-50 text-slate-600 border-slate-200"
      }`}
    >
      {label[status] ?? status}
    </span>
  );
}

function JenisBadge({ jenis }: { jenis: string }) {
  const map: Record<string, string> = {
    "Cuti Tahunan": "bg-indigo-50 text-indigo-700 border-indigo-200",
    Izin: "bg-sky-50 text-sky-700 border-sky-200",
    Sakit: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${
        map[jenis] ?? "bg-slate-50 text-slate-600 border-slate-200"
      }`}
    >
      {jenis}
    </span>
  );
}

export default function LeavePage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{
    req: LeaveRequest;
    next: "Approved" | "Rejected";
  } | null>(null);
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

  useModalDismiss(modalOpen, () => {
    if (!saving) setModalOpen(false);
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [requestsResult, employeesResult] = await Promise.all([
      supabase.from(TABLE).select("*").order("created_at", { ascending: false }),
      supabase.from("hr_employees").select("*").order("nama", { ascending: true }),
    ]);

    if (requestsResult.error) {
      notify("error", `Gagal memuat pengajuan: ${requestsResult.error.message}`);
    } else {
      setRequests((requestsResult.data as LeaveRequest[]) ?? []);
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((req) => {
      if (filterStatus && req.status !== filterStatus) return false;
      if (!q) return true;
      const emp = employeeMap.get(req.nip);
      return (
        req.nip.toLowerCase().includes(q) ||
        (emp?.nama ?? "").toLowerCase().includes(q)
      );
    });
  }, [requests, filterStatus, search, employeeMap]);

  const stats = useMemo(() => {
    const base = { total: requests.length, pending: 0, approved: 0, rejected: 0 };
    for (const req of requests) {
      if (req.status === "Pending") base.pending += 1;
      else if (req.status === "Approved") base.approved += 1;
      else if (req.status === "Rejected") base.rejected += 1;
    }
    return base;
  }, [requests]);

  const days = countDays(form.tanggal_mulai, form.tanggal_selesai);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nip) {
      notify("error", "Pilih karyawan terlebih dahulu.");
      return;
    }
    if (!form.tanggal_mulai || !form.tanggal_selesai) {
      notify("error", "Tanggal mulai dan selesai wajib diisi.");
      return;
    }
    if (days <= 0) {
      notify("error", "Tanggal selesai harus sama dengan atau setelah tanggal mulai.");
      return;
    }
    if (!form.alasan.trim()) {
      notify("error", "Alasan pengajuan wajib diisi.");
      return;
    }

    setSaving(true);
    const payload = {
      nip: form.nip,
      jenis_cuti: form.jenis_cuti,
      tanggal_mulai: form.tanggal_mulai,
      tanggal_selesai: form.tanggal_selesai,
      jumlah_hari: days,
      alasan: form.alasan.trim(),
      status: "Pending",
    };

    const { data, error } = await supabase.from(TABLE).insert(payload).select().single();

    if (error) {
      notify("error", `Gagal mengajukan: ${error.message}`);
    } else if (data) {
      setRequests((prev) => [data as LeaveRequest, ...prev]);
      notify("success", "Pengajuan cuti/izin berhasil dicatat.");
      setModalOpen(false);
    }
    setSaving(false);
  };

  const updateStatus = async (id: string, status: "Approved" | "Rejected") => {
    setUpdatingId(id);
    const { error } = await supabase.from(TABLE).update({ status }).eq("id", id);

    if (error) {
      notify("error", `Gagal memperbarui status: ${error.message}`);
    } else {
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      notify(
        "success",
        status === "Approved"
          ? "Pengajuan berhasil disetujui."
          : "Pengajuan berhasil ditolak."
      );
    }
    setUpdatingId(null);
  };

  const statCards = [
    { label: "Total Pengajuan", value: stats.total, icon: ClipboardList, tone: "text-slate-600 bg-slate-100" },
    { label: "Menunggu", value: stats.pending, icon: Clock, tone: "text-amber-600 bg-amber-50" },
    { label: "Disetujui", value: stats.approved, icon: CheckCircle2, tone: "text-emerald-600 bg-emerald-50" },
    { label: "Ditolak", value: stats.rejected, icon: X, tone: "text-rose-600 bg-rose-50" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Pengajuan Cuti & Izin</h2>
          <p className="mt-1 text-sm text-slate-500">
            Total{" "}
            <span className="font-medium text-slate-700">{requests.length}</span> pengajuan
            tercatat
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Pengajuan Baru
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
            <label className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Status</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
              >
                <option value="">Semua Status</option>
                {STATUS_FILTERS.map((s) => (
                  <option key={s} value={s}>
                    {s === "Pending" ? "Menunggu" : s === "Approved" ? "Disetujui" : "Ditolak"}
                  </option>
                ))}
              </select>
            </label>
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
            <p className="text-sm">Memuat pengajuan cuti/izin...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
            <FileText className="h-10 w-10 text-slate-300" />
            <p className="text-sm">
              {search || filterStatus
                ? "Tidak ada pengajuan yang cocok dengan filter."
                : "Belum ada pengajuan cuti/izin."}
            </p>
            {!search && !filterStatus && (
              <button
                type="button"
                onClick={openCreate}
                className="mt-1 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Ajukan Pengajuan Pertama
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3.5 font-semibold">NIP</th>
                  <th className="px-4 py-3.5 font-semibold">Karyawan</th>
                  <th className="px-4 py-3.5 font-semibold">Jenis</th>
                  <th className="px-4 py-3.5 font-semibold">Mulai</th>
                  <th className="px-4 py-3.5 font-semibold">Selesai</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Hari</th>
                  <th className="px-4 py-3.5 font-semibold">Alasan</th>
                  <th className="px-4 py-3.5 font-semibold">Status</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((req) => {
                  const emp = employeeMap.get(req.nip);
                  const busy = updatingId === req.id;
                  return (
                    <tr key={req.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-500">{req.nip}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                            {emp?.nama?.charAt(0)?.toUpperCase() ?? "?"}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{emp?.nama ?? "-"}</p>
                            <p className="text-[11px] text-slate-500">{emp?.jabatan ?? "-"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <JenisBadge jenis={req.jenis_cuti} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                        {formatDayLabel(req.tanggal_mulai)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                        {formatDayLabel(req.tanggal_selesai)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium tabular-nums text-slate-700">
                        {req.jumlah_hari}
                      </td>
                      <td className="max-w-[220px] px-4 py-3.5">
                        <p className="truncate text-slate-600" title={req.alasan ?? ""}>
                          {req.alasan || "-"}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={req.status} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {req.status === "Pending" ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setConfirmTarget({ req, next: "Approved" })}
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {busy ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                )}
                                Setujui
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmTarget({ req, next: "Rejected" })}
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <X className="h-3.5 w-3.5" />
                                Tolak
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => !saving && setModalOpen(false)}
          />
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Pengajuan Baru</h3>
                  <p className="text-xs text-slate-500">Status awal: Menunggu (Pending)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                  Karyawan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.nip}
                  onChange={(e) => setForm((f) => ({ ...f, nip: e.target.value }))}
                  className={inputCls}
                  required
                >
                  <option value="">Pilih karyawan</option>
                  {employees.map((emp) => (
                    <option key={emp.nip} value={emp.nip}>
                      {emp.nip} — {emp.nama}
                      {emp.departemen ? ` (${emp.departemen})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                  Jenis Cuti <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {JENIS_CUTI.map((jenis) => (
                    <button
                      key={jenis}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, jenis_cuti: jenis }))}
                      className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition ${
                        form.jenis_cuti === jenis
                          ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                      }`}
                    >
                      {jenis}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                  Tanggal Mulai <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.tanggal_mulai}
                  onChange={(e) => setForm((f) => ({ ...f, tanggal_mulai: e.target.value }))}
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                  Tanggal Selesai <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.tanggal_selesai}
                  min={form.tanggal_mulai || undefined}
                  onChange={(e) => setForm((f) => ({ ...f, tanggal_selesai: e.target.value }))}
                  className={inputCls}
                  required
                />
              </div>

              <div className="sm:col-span-2 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <CalendarDays className="h-4 w-4 shrink-0 text-indigo-600" />
                <p className="text-sm text-slate-600">
                  Jumlah hari:{" "}
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {days > 0 ? days : 0} hari
                  </span>{" "}
                  <span className="text-xs text-slate-500">
                    (termasuk hari mulai &amp; selesai)
                  </span>
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                  Alasan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={form.alasan}
                  onChange={(e) => setForm((f) => ({ ...f, alasan: e.target.value }))}
                  rows={3}
                  className={`${inputCls} resize-none`}
                  placeholder="Contoh: Cuti tahunan untuk keperluan keluarga..."
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                  Ajukan Pengajuan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmTarget && (
        <ConfirmDialog
          title={
            confirmTarget.next === "Approved" ? "Setujui Pengajuan?" : "Tolak Pengajuan?"
          }
          message={
            <>
              Pengajuan{" "}
              <span className="font-medium text-slate-700">
                {confirmTarget.req.jenis_cuti}
              </span>{" "}
              milik{" "}
              <span className="font-medium text-slate-700">
                {employeeMap.get(confirmTarget.req.nip)?.nama ?? confirmTarget.req.nip}
              </span>{" "}
              (NIP: {confirmTarget.req.nip}) periode{" "}
              {formatDayLabel(confirmTarget.req.tanggal_mulai)} –{" "}
              {formatDayLabel(confirmTarget.req.tanggal_selesai)} akan{" "}
              {confirmTarget.next === "Approved" ? "disetujui" : "ditolak"}.
            </>
          }
          confirmLabel={
            confirmTarget.next === "Approved" ? "Ya, Setujui" : "Ya, Tolak"
          }
          tone={confirmTarget.next === "Approved" ? "success" : "danger"}
          busy={updatingId === confirmTarget.req.id}
          onConfirm={async () => {
            const { req, next } = confirmTarget;
            try {
              await updateStatus(req.id, next);
            } finally {
              setConfirmTarget(null);
            }
          }}
          onCancel={() => setConfirmTarget(null)}
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
