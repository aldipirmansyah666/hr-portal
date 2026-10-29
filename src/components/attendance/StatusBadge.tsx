import type { AttendanceStatus } from "@/lib/attendance";

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  Hadir: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Telat: "bg-amber-50 text-amber-700 border-amber-200",
  Cuti: "bg-sky-50 text-sky-700 border-sky-200",
  Izin: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Sakit: "bg-violet-50 text-violet-700 border-violet-200",
  Alpa: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function StatusBadge({
  status,
  size = "md",
}: {
  status: AttendanceStatus;
  size?: "sm" | "md";
}) {
  const padding = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${padding} ${STATUS_STYLES[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}

export function RowStateBadge({
  valid,
  matched,
}: {
  valid: boolean;
  matched: boolean;
}) {
  if (!matched) {
    return (
      <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
        NIP Tidak Dikenal
      </span>
    );
  }
  if (!valid) {
    return (
      <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
        Tidak Valid
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
      Siap Simpan
    </span>
  );
}
