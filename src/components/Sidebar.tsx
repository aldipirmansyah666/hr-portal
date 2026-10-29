"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  FileText,
  Receipt,
  Upload,
  Users,
  Wallet,
  X,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Menu Utama",
    items: [
      { label: "Karyawan", href: "/", icon: Users },
      { label: "Import Absensi", href: "/attendance/import", icon: Upload },
      { label: "Rekap Absensi", href: "/attendance", icon: CalendarDays },
    ],
  },
  {
    label: "Operasional",
    items: [
      { label: "Pengajuan Cuti/Izin", href: "/leave", icon: FileText },
      { label: "Payroll", href: "/payroll", icon: Wallet },
      { label: "Klaim & Reimbursement", href: "/reimbursement", icon: Receipt },
    ],
  },
];

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-sm">
              HR
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-900">HR Portal</p>
              <p className="text-[11px] text-slate-500">Human Resource System</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            aria-label="Tutup sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {group.label}
              </p>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                          active
                            ? "bg-indigo-50 text-indigo-700"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                            active
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-100 text-slate-500 group-hover:text-slate-700"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        {item.label}
                        {active && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-600" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-xs font-semibold text-white">
              AD
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium text-slate-900">Admin HRD</p>
              <p className="truncate text-[11px] text-slate-500">admin@hrportal.id</p>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          </div>
        </div>
      </aside>
    </>
  );
}
