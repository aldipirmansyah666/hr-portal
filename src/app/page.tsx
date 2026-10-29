"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Edit2,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { supabase, type Employee } from "@/lib/supabase";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useModalDismiss } from "@/lib/useModalDismiss";

const TABLE = "hr_employees";

type FormData = {
  nip: string;
  nama: string;
  email: string;
  no_hp: string;
  jabatan: string;
  departemen: string;
  tanggal_masuk: string;
  status: string;
};

const EMPTY_FORM: FormData = {
  nip: "",
  nama: "",
  email: "",
  no_hp: "",
  jabatan: "",
  departemen: "",
  tanggal_masuk: "",
  status: "Tetap",
};

const DEPARTEMENS = [
  "Human Resources",
  "Finance",
  "Marketing",
  "Operational",
  "Technology",
  "Legal",
];

const STATUS_OPTIONS = ["Tetap", "Kontrak", "Probation", "Magang"];

type ColumnKey = "jabatan" | "departemen" | "kontak" | "masuk" | "status";

const OPTIONAL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "jabatan", label: "Jabatan" },
  { key: "departemen", label: "Departemen" },
  { key: "kontak", label: "Kontak" },
  { key: "masuk", label: "Masuk" },
  { key: "status", label: "Status" },
];

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15";

function Badge({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    Tetap: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Kontrak: "bg-amber-50 text-amber-700 border-amber-200",
    Probation: "bg-sky-50 text-sky-700 border-sky-200",
    Magang: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
        map[status ?? ""] ?? "bg-slate-50 text-slate-600 border-slate-200"
      }`}
    >
      {status ?? "-"}
    </span>
  );
}

export default function KaryawanPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>({
    jabatan: true,
    departemen: true,
    kontak: true,
    masuk: true,
    status: true,
  });
  const [colsOpen, setColsOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const notify = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      notify("error", `Gagal memuat data: ${error.message}`);
    } else {
      setEmployees((data as Employee[]) ?? []);
    }
    setLoading(false);
  }, [notify]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useModalDismiss(modalOpen, () => {
    if (!saving) setModalOpen(false);
  });

  const allVisible = OPTIONAL_COLUMNS.every((col) => visibleCols[col.key]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      [e.nip, e.nama, e.email, e.no_hp, e.jabatan, e.departemen]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [employees, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setForm({
      nip: emp.nip ?? "",
      nama: emp.nama ?? "",
      email: emp.email ?? "",
      no_hp: emp.no_hp ?? "",
      jabatan: emp.jabatan ?? "",
      departemen: emp.departemen ?? "",
      tanggal_masuk: emp.tanggal_masuk ?? "",
      status: emp.status ?? "Tetap",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nip.trim() || !form.nama.trim()) {
      notify("error", "NIP dan Nama wajib diisi.");
      return;
    }

    setSaving(true);
    const payload = {
      nip: form.nip.trim(),
      nama: form.nama.trim(),
      email: form.email.trim() || null,
      no_hp: form.no_hp.trim() || null,
      jabatan: form.jabatan.trim() || null,
      departemen: form.departemen.trim() || null,
      tanggal_masuk: form.tanggal_masuk || null,
      status: form.status,
    };

    if (editing) {
      const { data, error } = await supabase
        .from(TABLE)
        .update(payload)
        .eq("id", editing.id)
        .select()
        .single();

      if (error) {
        notify("error", `Gagal memperbarui: ${error.message}`);
      } else if (data) {
        setEmployees((prev) => prev.map((e) => (e.id === data.id ? (data as Employee) : e)));
        notify("success", "Data karyawan berhasil diperbarui.");
        setModalOpen(false);
      }
    } else {
      const { data, error } = await supabase.from(TABLE).insert(payload).select().single();

      if (error) {
        notify("error", `Gagal menambah: ${error.message}`);
      } else if (data) {
        setEmployees((prev) => [data as Employee, ...prev]);
        notify("success", "Karyawan baru berhasil ditambahkan.");
        setModalOpen(false);
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from(TABLE).delete().eq("id", deleteTarget.id);

    if (error) {
      notify("error", `Gagal menghapus: ${error.message}`);
    } else {
      setEmployees((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      notify("success", "Data karyawan berhasil dihapus.");
      setDeleteTarget(null);
    }
    setDeleting(false);
  };

  const setField = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Data Karyawan</h2>
          <p className="mt-1 text-sm text-slate-500">
            Total <span className="font-medium text-slate-700">{employees.length}</span> karyawan
            terdaftar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchEmployees}
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
            <UserPlus className="h-4 w-4" />
            Tambah Karyawan
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari NIP, nama, jabatan, departemen..."
              className={`${inputCls} pl-9`}
            />
          </div>
          <div className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setColsOpen((v) => !v)}
              aria-expanded={colsOpen}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
            >
              {allVisible ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
              Kolom
            </button>
            {colsOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setColsOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Tampilkan Kolom
                  </p>
                  {OPTIONAL_COLUMNS.map((col) => (
                    <label
                      key={col.key}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={visibleCols[col.key]}
                        onChange={() =>
                          setVisibleCols((prev) => ({
                            ...prev,
                            [col.key]: !prev[col.key],
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="text-sm">Memuat data karyawan...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
            <Users className="h-10 w-10 text-slate-300" />
            <p className="text-sm">
              {search ? "Tidak ada karyawan yang cocok dengan pencarian." : "Belum ada data karyawan."}
            </p>
            {!search && (
              <button
                type="button"
                onClick={openCreate}
                className="mt-1 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Tambah Karyawan Pertama
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3.5 font-semibold">NIP</th>
                  <th className="px-4 py-3.5 font-semibold">Nama</th>
                  {visibleCols.jabatan && (
                    <th className="px-4 py-3.5 font-semibold">Jabatan</th>
                  )}
                  {visibleCols.departemen && (
                    <th className="px-4 py-3.5 font-semibold">Departemen</th>
                  )}
                  {visibleCols.kontak && <th className="px-4 py-3.5 font-semibold">Kontak</th>}
                  {visibleCols.masuk && <th className="px-4 py-3.5 font-semibold">Masuk</th>}
                  {visibleCols.status && <th className="px-4 py-3.5 font-semibold">Status</th>}
                  <th className="px-4 py-3.5 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((emp) => (
                  <tr key={emp.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-500">{emp.nip}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                          {emp.nama?.charAt(0)?.toUpperCase() ?? "?"}
                        </div>
                        <span className="font-medium text-slate-900">{emp.nama}</span>
                      </div>
                    </td>
                    {visibleCols.jabatan && (
                      <td className="px-4 py-3.5 text-slate-600">{emp.jabatan ?? "-"}</td>
                    )}
                    {visibleCols.departemen && (
                      <td className="px-4 py-3.5 text-slate-600">{emp.departemen ?? "-"}</td>
                    )}
                    {visibleCols.kontak && (
                      <td className="px-4 py-3.5">
                        <div className="text-xs text-slate-600">{emp.email ?? "-"}</div>
                        <div className="text-xs text-slate-500">{emp.no_hp ?? ""}</div>
                      </td>
                    )}
                    {visibleCols.masuk && (
                      <td className="px-4 py-3.5 text-slate-500">
                        {emp.tanggal_masuk
                          ? new Date(emp.tanggal_masuk).toLocaleDateString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "-"}
                      </td>
                    )}
                    {visibleCols.status && (
                      <td className="px-4 py-3.5">
                        <Badge status={emp.status} />
                      </td>
                    )}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(emp)}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-600"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(emp)}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                          title="Hapus"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
              <h3 className="text-lg font-semibold text-slate-900">
                {editing ? "Edit Karyawan" : "Tambah Karyawan"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                  NIP <span className="text-rose-500">*</span>
                </label>
                <input
                  value={form.nip}
                  onChange={setField("nip")}
                  className={inputCls}
                  placeholder="contoh: EMP-001"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                  Nama Lengkap <span className="text-rose-500">*</span>
                </label>
                <input
                  value={form.nama}
                  onChange={setField("nama")}
                  className={inputCls}
                  placeholder="Nama lengkap"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={setField("email")}
                  className={inputCls}
                  placeholder="nama@perusahaan.com"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">No. HP</label>
                <input
                  value={form.no_hp}
                  onChange={setField("no_hp")}
                  className={inputCls}
                  placeholder="08xxxxxxxxxx"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Jabatan</label>
                <input
                  value={form.jabatan}
                  onChange={setField("jabatan")}
                  className={inputCls}
                  placeholder="Staff, Manager, dll."
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Departemen</label>
                <select value={form.departemen} onChange={setField("departemen")} className={inputCls}>
                  <option value="">Pilih departemen</option>
                  {DEPARTEMENS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                  Tanggal Masuk
                </label>
                <input
                  type="date"
                  value={form.tanggal_masuk}
                  onChange={setField("tanggal_masuk")}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Status</label>
                <select value={form.status} onChange={setField("status")} className={inputCls}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
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
                  ) : editing ? (
                    <Edit2 className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {editing ? "Simpan Perubahan" : "Tambah"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Hapus Karyawan?"
          message={
            <>
              Data{" "}
              <span className="font-medium text-slate-700">{deleteTarget.nama}</span> (NIP:{" "}
              {deleteTarget.nip}) akan dihapus permanen.
            </>
          }
          confirmLabel="Ya, Hapus"
          tone="danger"
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] animate-in fade-in">
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
            <p className="text-sm font-medium">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-2 rounded p-1 opacity-70 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
