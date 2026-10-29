"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, Sun } from "lucide-react";

type HeaderProps = {
  onMenuClick: () => void;
};

const TITLES: { match: (p: string) => boolean; title: string; subtitle: string }[] = [
  {
    match: (p) => p === "/attendance/import",
    title: "Import Absensi",
    subtitle: "Upload file absensi CSV/XLSX",
  },
  {
    match: (p) => p.startsWith("/attendance"),
    title: "Rekap Absensi",
    subtitle: "Rekapitulasi kehadiran bulanan",
  },
  {
    match: (p) => p.startsWith("/leave"),
    title: "Pengajuan Cuti/Izin",
    subtitle: "Kelola pengajuan cuti dan izin karyawan",
  },
  {
    match: (p) => p.startsWith("/reimbursement"),
    title: "Klaim & Reimbursement",
    subtitle: "Pengajuan dan persetujuan klaim karyawan",
  },
  {
    match: (p) => p.startsWith("/payroll"),
    title: "Payroll",
    subtitle: "Perhitungan dan slip gaji karyawan",
  },
  {
    match: (p) => p === "/",
    title: "Master Data Karyawan",
    subtitle: "Kelola data karyawan perusahaan",
  },
];

export default function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const current =
    TITLES.find((t) => t.match(pathname)) ??
    { title: "HR Portal", subtitle: "Sistem sumber daya manusia" };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
        aria-label="Buka sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden sm:block">
        <h1 className="text-base font-semibold text-slate-900">{current.title}</h1>
        <p className="text-xs text-slate-500">{current.subtitle}</p>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label="Notifikasi"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>

        <button
          type="button"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label="Mode terang"
        >
          <Sun className="h-5 w-5" />
        </button>

        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-xs font-semibold text-white"
        >
          AD
        </Link>
      </div>
    </header>
  );
}
